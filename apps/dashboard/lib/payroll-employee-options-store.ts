import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

export type PayrollEmployeeOption = {
  employeeId: string;
  employeeCode?: string;
  nhfApplicable?: boolean;
  annualRentRelief?: number | null;
  updatedAt: string;
  updatedBy?: string;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const resolveOptionsPath = () => {
  const candidates = [
    process.env.DLE_PAYROLL_EMPLOYEE_OPTIONS_PATH,
    process.env.DLE_HRIS_DATA_DIR ? path.join(process.env.DLE_HRIS_DATA_DIR, 'payroll-employee-options.json') : null,
    path.join(resolveDashboardRoot(), 'data', 'hris', 'payroll-employee-options.json'),
    path.join(process.cwd(), 'apps', 'dashboard', 'data', 'hris', 'payroll-employee-options.json'),
    path.join(process.cwd(), 'data', 'hris', 'payroll-employee-options.json'),
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
};

const OPTIONS_PATH = resolveOptionsPath();
const compact = (value: unknown) => String(value || '').trim();
const keyFor = (value: unknown) => compact(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

export const readPayrollEmployeeOptions = async (): Promise<PayrollEmployeeOption[]> => {
  try {
    const parsed = JSON.parse(await readFile(OPTIONS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writePayrollEmployeeOption = async (option: Omit<PayrollEmployeeOption, 'updatedAt'> & { updatedAt?: string }) => {
  const current = await readPayrollEmployeeOptions();
  const nextOption: PayrollEmployeeOption = { ...option, updatedAt: option.updatedAt || new Date().toISOString() };
  const keys = [nextOption.employeeId, nextOption.employeeCode].map(keyFor).filter(Boolean);
  const next = current.filter((item) => ![item.employeeId, item.employeeCode].map(keyFor).some((key) => keys.includes(key)));
  next.push(nextOption);
  await mkdir(path.dirname(OPTIONS_PATH), { recursive: true });
  await writeFile(OPTIONS_PATH, JSON.stringify(next.sort((a, b) => keyFor(a.employeeId).localeCompare(keyFor(b.employeeId))), null, 2), 'utf8');
  return nextOption;
};

export const applyPayrollEmployeeOptions = async (employees: DleEmployeeDirectoryRow[]) => {
  const options = await readPayrollEmployeeOptions();
  if (!options.length) return employees;
  const byKey = new Map<string, PayrollEmployeeOption>();
  options.forEach((option) => {
    [option.employeeId, option.employeeCode].map(keyFor).filter(Boolean).forEach((key) => byKey.set(key, option));
  });
  return employees.map((employee) => {
    const option = [employee.employeeId, employee.employeeCode, employee.sourceEmployeeId].map(keyFor).map((key) => byKey.get(key)).find(Boolean);
    if (!option) return employee;
    return {
      ...employee,
      nhfApplicable: typeof option.nhfApplicable === 'boolean' ? option.nhfApplicable : employee.nhfApplicable,
      annualRentRelief: Number.isFinite(Number(option.annualRentRelief)) ? Number(option.annualRentRelief) : employee.annualRentRelief,
    };
  });
};
