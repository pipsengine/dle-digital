import { NextResponse } from 'next/server';
import {
  readEmployeeDirectoryFromDb,
  upsertEmployeePayrollIdentityFromSageInDb,
  type DleEmployeeDirectoryRow,
} from '@/lib/dle-enterprise-db';
import { calculatePayrollEarnings } from '@/lib/payroll-earnings-engine';
import { normalizePayrollMatchKey, readActiveSagePayrollEmployees, type SagePayrollEmployee } from '@/lib/sage-people-payroll-store';

type MigrationStatus = 'Matched' | 'Mismatch' | 'Missing HRIS' | 'Missing Sage Gross' | 'Review';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();

const normalizedCode = (value: unknown) => compact(value).toUpperCase().replace(/_/g, '');

const jsonValue = (raw: string | null | undefined, keys: string[]) => {
  if (!raw) return '';
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    for (const key of keys) {
      const match = compact(data[key]);
      if (match) return match;
    }
  } catch {
    return '';
  }
  return '';
};

const pensionProviderFromSage = (employee: SagePayrollEmployee) => jsonValue(employee.sageEmployeeDetailJson, [
  'PensionFundAdministrator',
  'PensionFundAdmin',
  'PensionProvider',
  'PFA',
  'PFADescription',
  'RetirementFundName',
  'PensionAdministrator',
]);

const pensionPinFromSage = (employee: SagePayrollEmployee) => jsonValue(employee.sageEmployeeDetailJson, [
  'PensionNo',
  'PensionNumber',
  'PensionPIN',
  'PFANumber',
  'PfaNumber',
  'RSAPIN',
  'RsaPin',
  'RetirementSavingsAccountNo',
]);

const hasIdentityValue = (employee: SagePayrollEmployee) => Boolean(
  compact(employee.bankName)
  || compact(employee.accountNo)
  || compact(employee.accountName)
  || compact(employee.taxNo)
  || pensionProviderFromSage(employee)
  || pensionPinFromSage(employee)
);

const sageNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const sageOrCurrent = (sageValue: unknown, currentValue: number | null | undefined) => {
  const n = sageNumber(sageValue);
  return n !== null ? n : currentValue;
};

const hasPayrollValue = (employee: SagePayrollEmployee) => (
  sageNumber(employee.periodSalary) !== null
  || sageNumber(employee.annualSalary) !== null
  || sageNumber(employee.ratePerDay) !== null
  || sageNumber(employee.ratePerHour) !== null
);

const isPayrollMigrationReviewEmployee = (employee: SagePayrollEmployee) => {
  const raw = normalizedCode(employee.employeeCode || employee.directoryEmployeeCode);
  if (raw.startsWith('C')) return false;
  return true;
};

const employeeType = (employee: SagePayrollEmployee) => {
  const raw = normalizedCode(employee.directoryEmployeeCode || employee.employeeCode);
  if (raw.startsWith('NYSC') || raw.startsWith('N')) return 'NYSC';
  if (raw.startsWith('IT') || raw.startsWith('I')) return 'IT';
  if (raw.startsWith('L')) return 'Lumpsum';
  return 'Permanent';
};

const sageGross = (employee: SagePayrollEmployee) => {
  const periodSalary = Number(employee.periodSalary || 0);
  if (periodSalary > 0) return periodSalary;
  const annualSalary = Number(employee.annualSalary || 0);
  return annualSalary > 0 ? annualSalary / 12 : 0;
};

const hrisGross = (employee: DleEmployeeDirectoryRow | undefined) => {
  if (!employee) return 0;
  const periodSalary = Number(employee.periodSalary || 0);
  if (periodSalary > 0) return periodSalary;
  const annualSalary = Number(employee.annualSalary || 0);
  return annualSalary > 0 ? annualSalary / 12 : 0;
};

const statusFor = (sourceGross: number, targetGross: number, employee?: DleEmployeeDirectoryRow): MigrationStatus => {
  if (!employee) return 'Missing HRIS';
  if (sourceGross <= 0) return 'Missing Sage Gross';
  if (Math.abs(sourceGross - targetGross) > 0.01) return 'Mismatch';
  return 'Matched';
};

export async function GET() {
  try {
    const [sageEmployees, hrisEmployees] = await Promise.all([
      readActiveSagePayrollEmployees(),
      readEmployeeDirectoryFromDb(),
    ]);
    const hrisByCode = new Map((hrisEmployees ?? []).map((employee) => [normalizedCode(employee.employeeCode), employee]));
    const targetSageEmployees = sageEmployees.filter(isPayrollMigrationReviewEmployee);

    const records = targetSageEmployees.map((source) => {
      const employeeCode = normalizedCode(source.directoryEmployeeCode || source.employeeCode);
      const hrisEmployee = hrisByCode.get(employeeCode);
      const sourceGross = roundMoney(sageGross(source));
      const targetGross = roundMoney(hrisGross(hrisEmployee));
      const earnings = hrisEmployee ? calculatePayrollEarnings(hrisEmployee) : null;
      const status = statusFor(sourceGross, targetGross, hrisEmployee);
      const sourcePensionProvider = pensionProviderFromSage(source);
      const sourcePensionPin = pensionPinFromSage(source);
      const issues = [
        ...!hrisEmployee ? ['Employee has not been migrated into HRIS'] : [],
        ...sourceGross <= 0 ? ['Sage gross salary is blank or zero'] : [],
        ...hrisEmployee && Math.abs(sourceGross - targetGross) > 0.01 ? ['HRIS gross salary does not match Sage gross salary'] : [],
        ...earnings?.profileId === 'fallback' && employeeType(source) === 'Permanent' ? ['Permanent employee needs salary grade/category mapping for earning profile'] : [],
        ...hrisEmployee && compact(source.bankName) && !compact(hrisEmployee.bankName) ? ['Bank name is available in Sage but missing in HRIS payroll setup'] : [],
        ...hrisEmployee && compact(source.accountNo) && !compact(hrisEmployee.accountNo) ? ['Account number is available in Sage but missing in HRIS payroll setup'] : [],
        ...hrisEmployee && sourcePensionProvider && !compact(hrisEmployee.pensionProvider) ? ['Pension administrator is available in Sage but missing in HRIS payroll setup'] : [],
        ...hrisEmployee && sourcePensionPin && !compact(hrisEmployee.pensionPin) ? ['Pension number is available in Sage but missing in HRIS payroll setup'] : [],
        ...hrisEmployee && compact(source.taxNo) && !compact(hrisEmployee.taxIdentificationNumber) ? ['Tax/PAYE reference is available in Sage but missing in HRIS payroll setup'] : [],
      ];
      return {
        sageEmployeeId: source.employeeId,
        employeeCode,
        sourceEmployeeCode: source.employeeCode,
        employeeName: source.displayName || hrisEmployee?.fullName || employeeCode,
        employeeType: employeeType(source),
        status,
        issues,
        sage: {
          periodSalary: roundMoney(Number(source.periodSalary || 0)),
          annualSalary: roundMoney(Number(source.annualSalary || 0)),
          monthlyGross: sourceGross,
          jobGrade: source.jobGradeCode || source.jobGrade || '',
          remunerationDefinition: source.remunerationDefinition || '',
          paymentRun: source.paymentRunLong || source.paymentRunShort || '',
          bankName: source.bankName || '',
          hasAccountNumber: Boolean(compact(source.accountNo)),
          accountName: source.accountName || '',
          taxNumber: source.taxNo || '',
          pensionProvider: sourcePensionProvider,
          hasPensionNumber: Boolean(sourcePensionPin),
        },
        hris: hrisEmployee ? {
          employeeDbId: hrisEmployee.employeeDbId,
          employmentType: hrisEmployee.employmentType,
          employmentStatus: hrisEmployee.status,
          payrollGroup: hrisEmployee.payrollGroup,
          salaryGrade: hrisEmployee.salaryGrade || hrisEmployee.jobGrade || '',
          periodSalary: roundMoney(Number(hrisEmployee.periodSalary || 0)),
          annualSalary: roundMoney(Number(hrisEmployee.annualSalary || 0)),
          monthlyGross: targetGross,
          earningProfileId: earnings?.profileId || '',
          earningProfile: earnings?.profileName || '',
          calculatedBasic: roundMoney(earnings?.basicPay || 0),
          taxablePay: roundMoney(earnings?.taxablePay || 0),
          nonTaxablePay: roundMoney(earnings?.nonTaxablePay || 0),
          bankName: hrisEmployee.bankName || '',
          hasAccountNumber: Boolean(compact(hrisEmployee.accountNo)),
          accountName: hrisEmployee.accountName || '',
          taxNumber: hrisEmployee.taxIdentificationNumber || '',
          pensionProvider: hrisEmployee.pensionProvider || '',
          hasPensionNumber: Boolean(compact(hrisEmployee.pensionPin)),
        } : null,
      };
    }).sort((a, b) => a.employeeType.localeCompare(b.employeeType) || a.employeeCode.localeCompare(b.employeeCode));

    const totals = records.reduce(
      (sum, record) => {
        sum.employees += 1;
        sum.sageGross += record.sage.monthlyGross;
        sum.hrisGross += record.hris?.monthlyGross || 0;
        sum.matched += record.status === 'Matched' ? 1 : 0;
        sum.mismatch += record.status === 'Mismatch' ? 1 : 0;
        sum.missingHris += record.status === 'Missing HRIS' ? 1 : 0;
        sum.missingGross += record.status === 'Missing Sage Gross' ? 1 : 0;
        if (record.employeeType === 'Permanent') sum.permanent += 1;
        if (record.employeeType === 'Lumpsum') sum.lumpsum += 1;
        return sum;
      },
      { employees: 0, permanent: 0, lumpsum: 0, matched: 0, mismatch: 0, missingHris: 0, missingGross: 0, sageGross: 0, hrisGross: 0 }
    );

    return ok({
      generatedAt: new Date().toISOString(),
      source: 'Sage 300 People Payroll vs DLE HRIS payroll setup',
      summary: {
        ...totals,
        sageGross: roundMoney(totals.sageGross),
        hrisGross: roundMoney(totals.hrisGross),
        grossVariance: roundMoney(totals.hrisGross - totals.sageGross),
      },
      records,
    });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load Sage migration review.');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string };
    if (body.action !== 'migrate-payroll-identity') return err(400, 'Unsupported Sage migration action.');

    const [sageEmployees, hrisEmployees] = await Promise.all([
      readActiveSagePayrollEmployees(),
      readEmployeeDirectoryFromDb(),
    ]);
    const hrisByCode = new Map<string, DleEmployeeDirectoryRow>();
    for (const employee of hrisEmployees ?? []) {
      const keys = [
        normalizePayrollMatchKey(employee.employeeCode),
        normalizePayrollMatchKey(employee.employeeId),
        normalizePayrollMatchKey(employee.id),
      ].filter(Boolean);
      keys.forEach((key) => hrisByCode.set(key, employee));
    }

    const summary = {
      reviewed: 0,
      migrated: 0,
      missingHris: 0,
      skippedNoIdentity: 0,
      failed: 0,
      failures: [] as { employeeCode: string; error: string }[],
    };

    for (const source of sageEmployees) {
      summary.reviewed += 1;
      const keys = [
        normalizePayrollMatchKey(source.directoryEmployeeCode),
        normalizePayrollMatchKey(source.employeeCode),
        normalizePayrollMatchKey(source.employeeCodeDisplay || ''),
      ].filter(Boolean);
      const hrisEmployee = keys.map((key) => hrisByCode.get(key)).find(Boolean);
      if (!hrisEmployee) {
        summary.missingHris += 1;
        continue;
      }
      if (!hasIdentityValue(source) && !hasPayrollValue(source)) {
        summary.skippedNoIdentity += 1;
        continue;
      }

      try {
        await upsertEmployeePayrollIdentityFromSageInDb({
          employeeDbId: hrisEmployee.employeeDbId,
          payrollGroup: source.companyCode || hrisEmployee.payrollGroup,
          salaryGrade: source.jobGradeCode || source.jobGrade || hrisEmployee.salaryGrade || hrisEmployee.jobGrade,
          payCurrency: source.companyCurrency || hrisEmployee.payCurrency || 'NGN',
          paymentRun: source.paymentRunLong || source.paymentRunShort || hrisEmployee.paymentRun,
          paymentType: source.paymentType || hrisEmployee.paymentType,
          periodSalary: sageOrCurrent(source.periodSalary, hrisEmployee.periodSalary),
          annualSalary: sageOrCurrent(source.annualSalary, hrisEmployee.annualSalary),
          ratePerDay: sageOrCurrent(source.ratePerDay, hrisEmployee.ratePerDay),
          ratePerHour: sageOrCurrent(source.ratePerHour, hrisEmployee.ratePerHour),
          hoursPerDay: sageOrCurrent(source.hoursPerDay, hrisEmployee.hoursPerDay),
          hoursPerPeriod: sageOrCurrent(source.hoursPerPeriod, hrisEmployee.hoursPerPeriod),
          bankName: source.bankName,
          accountNo: source.accountNo,
          accountName: source.accountName,
          pensionProvider: pensionProviderFromSage(source),
          pensionPin: pensionPinFromSage(source),
          taxIdentificationNumber: source.taxNo,
        });
        summary.migrated += 1;
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({
          employeeCode: source.directoryEmployeeCode || source.employeeCode,
          error: error instanceof Error ? error.message : 'Unknown migration failure',
        });
      }
    }

    return ok({
      migratedAt: new Date().toISOString(),
      summary: {
        ...summary,
        failures: summary.failures.slice(0, 20),
      },
    });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to migrate Sage payroll identity records.');
  }
}
