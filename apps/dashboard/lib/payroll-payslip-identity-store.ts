import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SagePayrollEmployee } from '@/lib/sage-people-payroll-store';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';

export type PayslipEmployeeIdentity = {
  employeeId: string;
  employeeCode?: string;
  sourceEmployeeCode?: string;
  fullName?: string;
  jobTitle?: string;
  department?: string;
  businessUnit?: string;
  location?: string;
  payrollGroup?: string;
  salaryGrade?: string;
  payCurrency?: string;
  paymentRun?: string;
  paymentType?: string;
  bankName?: string;
  bankCode?: string;
  branchName?: string;
  branchCode?: string;
  accountNo?: string;
  accountName?: string;
  accountTypeId?: number | null;
  pensionProvider?: string;
  pensionPin?: string;
  taxIdentificationNumber?: string;
  migratedAt: string;
  migratedBy?: string;
  sourceSystem: 'Sage Payroll' | 'DLE HRIS';
};

const compact = (value: unknown) => String(value || '').trim();

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const resolveRuntimeDataDirs = () => {
  const cwd = process.cwd();
  const dirs = [
    process.env.DLE_PAYSLIP_IDENTITY_PATH ? path.dirname(path.resolve(process.env.DLE_PAYSLIP_IDENTITY_PATH)) : '',
    process.env.DLE_HRIS_DATA_DIR ? path.resolve(process.env.DLE_HRIS_DATA_DIR) : '',
    path.join(cwd, 'data', 'hris'),
    path.basename(cwd).toLowerCase() === 'site' ? path.join(path.dirname(cwd), 'runtime-data', 'hris') : '',
    path.join(cwd, 'runtime-data', 'hris'),
    path.join(resolveDashboardRoot(), 'data', 'hris'),
  ].filter(Boolean);
  return Array.from(new Set(dirs.map((dir) => path.resolve(dir))));
};

const IDENTITY_PATHS = [
  process.env.DLE_PAYSLIP_IDENTITY_PATH ? path.resolve(process.env.DLE_PAYSLIP_IDENTITY_PATH) : '',
  ...resolveRuntimeDataDirs().map((dir) => path.join(dir, 'payroll-payslip-identities.json')),
].filter(Boolean);

const pensionProviderFromSage = (employee: SagePayrollEmployee) => {
  try {
    const data = JSON.parse(employee.sageEmployeeDetailJson || '{}') as Record<string, unknown>;
    return compact(data.PensionFundAdministrator || data.PensionFundAdmin || data.PensionProvider || data.PFA || data.PFADescription || data.RetirementFundName || data.PensionAdministrator);
  } catch {
    return '';
  }
};

const pensionPinFromSage = (employee: SagePayrollEmployee) => {
  try {
    const data = JSON.parse(employee.sageEmployeeDetailJson || '{}') as Record<string, unknown>;
    return compact(data.PensionNo || data.PensionNumber || data.PensionPIN || data.PFANumber || data.PfaNumber || data.RSAPIN || data.RsaPin || data.RetirementSavingsAccountNo);
  } catch {
    return '';
  }
};

export const payslipIdentityFromSage = (employee: SagePayrollEmployee, options?: { employeeId?: string; migratedBy?: string }): PayslipEmployeeIdentity => ({
  employeeId: compact(options?.employeeId || employee.directoryEmployeeCode || employee.employeeCode),
  employeeCode: compact(employee.directoryEmployeeCode || employee.employeeCode),
  sourceEmployeeCode: compact(employee.employeeCode),
  fullName: compact(employee.displayName),
  jobTitle: compact(employee.jobTitle),
  department: compact(employee.departmentName || employee.hierarchyDepartmentName),
  businessUnit: compact(employee.companyCode || employee.companyName),
  location: compact(employee.siteName || employee.hierarchyLocationName || employee.physicalCityTown),
  payrollGroup: compact(employee.companyCode || employee.remunerationDefinition),
  salaryGrade: compact(employee.jobGradeCode || employee.jobGrade),
  payCurrency: compact(employee.companyCurrency || 'NGN'),
  paymentRun: compact(employee.paymentRunLong || employee.paymentRunShort),
  paymentType: compact(employee.paymentType),
  bankName: compact(employee.bankName),
  bankCode: compact(employee.bankCode),
  branchName: compact(employee.branchName),
  branchCode: compact(employee.branchCode),
  accountNo: compact(employee.accountNo),
  accountName: compact(employee.accountName),
  accountTypeId: employee.accountTypeId ?? null,
  pensionProvider: pensionProviderFromSage(employee),
  pensionPin: pensionPinFromSage(employee),
  taxIdentificationNumber: compact(employee.taxNo),
  migratedAt: new Date().toISOString(),
  migratedBy: compact(options?.migratedBy),
  sourceSystem: 'Sage Payroll',
});

export const readPayslipEmployeeIdentities = async (): Promise<PayslipEmployeeIdentity[]> => {
  for (const identityPath of IDENTITY_PATHS) {
    try {
      const parsed = JSON.parse(await readFile(identityPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Try the next configured/runtime location.
    }
  }
  return [];
};

export const payslipIdentityMap = async () => {
  const identities = await readPayslipEmployeeIdentities();
  const map = new Map<string, PayslipEmployeeIdentity>();
  identities.forEach((identity) => {
    [identity.employeeId, identity.employeeCode, identity.sourceEmployeeCode]
      .map(normalizePayrollMatchKey)
      .filter(Boolean)
      .forEach((key) => map.set(key, identity));
  });
  return map;
};

export const writePayslipEmployeeIdentities = async (records: PayslipEmployeeIdentity[]) => {
  const current = await readPayslipEmployeeIdentities();
  const next = new Map<string, PayslipEmployeeIdentity>();
  current.forEach((record) => {
    const key = normalizePayrollMatchKey(record.employeeId || record.employeeCode || record.sourceEmployeeCode);
    if (key) next.set(key, record);
  });
  records.forEach((record) => {
    const key = normalizePayrollMatchKey(record.employeeId || record.employeeCode || record.sourceEmployeeCode);
    if (key) next.set(key, record);
  });
  const payload = JSON.stringify(Array.from(next.values()).sort((a, b) => compact(a.employeeId).localeCompare(compact(b.employeeId))), null, 2);
  const writePaths = [
    ...IDENTITY_PATHS.filter((identityPath) => existsSync(identityPath)),
    ...IDENTITY_PATHS.filter((identityPath) => !existsSync(identityPath)),
  ];
  let lastError: unknown = null;
  for (const identityPath of writePaths) {
    try {
      await mkdir(path.dirname(identityPath), { recursive: true });
      await writeFile(identityPath, payload, 'utf8');
      return Array.from(next.values());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to write payslip identity store.');
};
