import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isLeaveAllowancePaymentCode } from '@/lib/leave-allowance-policy';
import { normalizePayrollPeriod } from '@/lib/payroll-leave-allowance-store';
import { activePayrollPeriod } from '@/lib/payroll-periods';
import { isEnterprisePayrollPeriod } from '@/lib/payroll-enterprise-source';
import { readActiveSagePayrollEmployeesWithLatestPayslipLines } from '@/lib/sage-people-payroll-store';

export type PayrollPeriodEarningAdjustment = {
  period: string;
  employeeId?: string;
  employeeCode?: string;
  salaryGrades?: string[];
  profileIds?: string[];
  code: string;
  name: string;
  amount: number;
  taxable: boolean;
  source?: string;
};

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();

const STANDARD_PROFILE_EARNING_CODES = new Set([
  'JNR_BASIC', 'JNR_HOUSE', 'JNR_HOUSING', 'JNR_LEAVE', 'JNR_MEDICAL', 'JNR_MEDICALTAX',
  'JNR_OTHERALL', 'JNR_OTHERALLTAX', 'JNR_TRANS', 'JNR_TRANSPORT', 'JNR_UTILITY',
  'SNR_BASIC', 'SNR_HOUSE', 'SNR_HOUSING', 'SNR_LEAVE', 'SNR_MEDICAL', 'SNR_MEDICALTAX',
  'SNR_OTHERALL', 'SNR_OTHERALLTAX', 'SNR_TRANS', 'SNR_TRANSPORT', 'SNR_UTILITY', 'SNR_LEAVETAX',
  'SNR_NJIC', 'PER_MEAL',
  'MGT_BASIC', 'MGT_HOUSE', 'MGT_HOUSING', 'MGT_LEAVE', 'MGT_MEDICAL', 'MGT_MEDICALTAX',
  'MGT_OTHERALL', 'MGT_OTHERALLTAX', 'MGT_TRANS', 'MGT_TRANSPORT', 'MGT_UTILITY', 'MGT_FURN',
  'MGT_FURN_TAX', 'MGT_UTILITY_TAX', 'MGT_LEAVE_TAX', 'MGT_OTHALL_TAX',
  'MGT1COLA_BASIC', 'MGT1COLA_HOUSIN', 'MGT1COLA_LEAVE', 'MGT1COLA_MEDICAL', 'MGT1COLA_MEDTAX',
  'MGT1COLA_OTHALL', 'MGT1COLA_OTHALLTAX', 'MGT1COLA_TRANSP', 'MGT1COLA_FURN', 'MGT1COLA_UTILIT',
  'SNM_BASIC', 'SNM_HOUSE', 'SNM_HOUSING', 'SNM_LEAVE', 'SNM_MEDICAL', 'SNM_MEDICALTAX',
  'SNM_OTHERALL', 'SNM_OTHERALLTAX', 'SNM_TRANS', 'SNM_TRANSPORT', 'SNM_UTILITY', 'SNM_FURN',
  'JCWEEKDAY', 'JCWEEKDAY_NT', 'WEEKDAYOVT', 'PUBHOL', 'SATEARN', 'SUNDAYEARN',
  'STIPEND_NT', 'BASIC', 'ALLOWANCE', 'ARREARS', 'LTI', 'LT',
]);

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const ADJUSTMENTS_PATH = process.env.DLE_PAYROLL_EARNING_ADJUSTMENTS_PATH
  || (process.env.DLE_HRIS_DATA_DIR ? path.join(process.env.DLE_HRIS_DATA_DIR, 'payroll-period-earning-adjustments.json') : '')
  || path.join(resolveDashboardRoot(), 'data', 'hris', 'payroll-period-earning-adjustments.json');

export const isSupplementalSageEarningCode = (code?: string | null) => {
  const normalized = compact(code).toUpperCase();
  if (!normalized) return false;
  if (STANDARD_PROFILE_EARNING_CODES.has(normalized)) return false;
  if (isLeaveAllowancePaymentCode(normalized)) return false;
  return true;
};

const adjustmentKey = (row: Pick<PayrollPeriodEarningAdjustment, 'period' | 'employeeCode' | 'employeeId' | 'code'>) =>
  `${normalizePayrollPeriod(row.period)}|${compact(row.employeeCode || row.employeeId).toUpperCase()}|${compact(row.code).toUpperCase()}`;

export const readPayrollPeriodEarningAdjustments = async (): Promise<PayrollPeriodEarningAdjustment[]> => {
  try {
    const parsed = JSON.parse(await readFile(ADJUSTMENTS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed as PayrollPeriodEarningAdjustment[] : [];
  } catch {
    return [];
  }
};

export const writePayrollPeriodEarningAdjustments = async (rows: PayrollPeriodEarningAdjustment[]) => {
  await mkdir(path.dirname(ADJUSTMENTS_PATH), { recursive: true });
  const sorted = [...rows].sort((left, right) =>
    `${left.period}-${left.employeeCode || left.employeeId}-${left.code}`.localeCompare(`${right.period}-${right.employeeCode || right.employeeId}-${right.code}`));
  await writeFile(ADJUSTMENTS_PATH, JSON.stringify(sorted, null, 2), 'utf8');
};

export const syncSageSupplementalEarningAdjustments = async (period?: string) => {
  const normalizedPeriod = normalizePayrollPeriod(period || activePayrollPeriod());
  if (!normalizedPeriod || isEnterprisePayrollPeriod(normalizedPeriod)) return [];

  const [current, sageEmployees] = await Promise.all([
    readPayrollPeriodEarningAdjustments(),
    readActiveSagePayrollEmployeesWithLatestPayslipLines(),
  ]);

  const byKey = new Map(current.map((row) => [adjustmentKey(row), row]));
  let changed = false;

  for (const sageEmployee of sageEmployees) {
    let lines: Array<{ code?: string; name?: string; amount?: number; taxableAmount?: number | null }> = [];
    try {
      lines = JSON.parse(String(sageEmployee.latestEarningLinesJson || '[]'));
    } catch {
      lines = [];
    }
    const employeeCode = compact(sageEmployee.employeeCodeDisplay || sageEmployee.employeeCode || sageEmployee.directoryEmployeeCode);
    if (!employeeCode) continue;

    for (const line of lines) {
      const code = compact(line.code);
      const amount = roundMoney(Number(line.amount || 0));
      if (!code || amount === 0 || !isSupplementalSageEarningCode(code)) continue;

      const taxableAmount = line.taxableAmount === null || line.taxableAmount === undefined
        ? amount
        : roundMoney(Number(line.taxableAmount || 0));
      const next: PayrollPeriodEarningAdjustment = {
        period: normalizedPeriod,
        employeeId: employeeCode,
        employeeCode,
        code,
        name: compact(line.name || code),
        amount,
        taxable: taxableAmount > 0,
        source: 'Sage payslip supplemental earning sync',
      };
      const key = adjustmentKey(next);
      const existing = byKey.get(key);
      if (existing && existing.amount === next.amount && existing.taxable === next.taxable) continue;
      byKey.set(key, next);
      changed = true;
    }
  }

  const merged = Array.from(byKey.values());
  if (changed) await writePayrollPeriodEarningAdjustments(merged);
  return merged.filter((row) => normalizePayrollPeriod(row.period) === normalizedPeriod && isSupplementalSageEarningCode(row.code));
};

export const adjustmentsPathForDiagnostics = () => ADJUSTMENTS_PATH;

export const adjustmentsFileMtime = () => {
  try {
    if (!existsSync(ADJUSTMENTS_PATH)) return 0;
    return (statSync(ADJUSTMENTS_PATH) as { mtimeMs: number }).mtimeMs;
  } catch {
    return 0;
  }
};
