import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readEmployeeDirectoryFromDb, type DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

export type PayrollEmployeeSource = {
  employees: DleEmployeeDirectoryRow[];
  source: 'DLE_Enterprise HRIS' | 'Local HRIS payroll cache';
  databaseAvailable: boolean;
  warning: string | null;
};

type EmployeeSourceCache = {
  value?: PayrollEmployeeSource;
  expiresAt: number;
  staleUntil: number;
  pending?: Promise<PayrollEmployeeSource>;
};

export const payrollDataSourceInfo = (source: PayrollEmployeeSource) => ({
  source: source.source,
  databaseAvailable: source.databaseAvailable,
  warning: source.warning,
  employeeCount: source.employees.length,
});

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_ROOT = path.join(resolveDashboardRoot(), 'data', 'hris');
const str = (value: unknown) => String(value || '').trim();
const moneyFromRate = (rate: number) => (Number.isFinite(rate) && rate > 0 ? rate * 22 : 0);
const EMPLOYEE_SOURCE_CACHE_MS = Number(process.env.HRIS_EMPLOYEE_SOURCE_CACHE_MS || 60000);
const EMPLOYEE_SOURCE_STALE_MS = Number(process.env.HRIS_EMPLOYEE_SOURCE_STALE_MS || 900000);
const EMPLOYEE_SOURCE_FALLBACK_CACHE_MS = Number(process.env.HRIS_EMPLOYEE_SOURCE_FALLBACK_CACHE_MS || 10000);
const EMPLOYEE_SOURCE_FALLBACK_STALE_MS = Number(process.env.HRIS_EMPLOYEE_SOURCE_FALLBACK_STALE_MS || 60000);
const EMPLOYEE_SOURCE_DB_TIMEOUT_MS = Number(process.env.HRIS_EMPLOYEE_SOURCE_DB_TIMEOUT_MS || 5000);
let employeeSourceCache: EmployeeSourceCache | null = null;

const cacheWindow = (source: PayrollEmployeeSource) => {
  if (source.databaseAvailable) {
    return { expiresIn: EMPLOYEE_SOURCE_CACHE_MS, staleFor: EMPLOYEE_SOURCE_STALE_MS };
  }
  return { expiresIn: EMPLOYEE_SOURCE_FALLBACK_CACHE_MS, staleFor: EMPLOYEE_SOURCE_FALLBACK_STALE_MS };
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const emptyEmployee = (employeeId: string, fullName: string): DleEmployeeDirectoryRow => ({
  id: employeeId,
  employeeId,
  employeeCode: employeeId,
  employeeDbId: Math.abs(employeeId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)),
  fullName,
  title: '',
  firstName: fullName.split(' ')[0] || fullName,
  middleName: '',
  lastName: fullName.split(' ').slice(1).join(' '),
  gender: '',
  dateOfBirth: '',
  maritalStatus: '',
  email: '',
  officialEmail: '',
  personalEmail: '',
  phone: '',
  primaryPhone: '',
  alternatePhone: '',
  officeExtension: '',
  residentialAddress: '',
  permanentAddress: '',
  city: '',
  state: 'Lagos',
  country: 'Nigeria',
  postalCode: '',
  jobTitle: 'Unassigned Job Title',
  designation: '',
  jobGrade: '',
  department: 'Unassigned Department',
  division: 'Unassigned Division',
  businessUnit: 'DLE Corporate',
  costCenter: '',
  location: 'Lagos HQ',
  workLocation: 'Lagos HQ',
  officeLocation: 'Lagos HQ',
  staffCategory: '',
  employeeCategory: '',
  employmentType: 'Permanent',
  status: 'Active',
  nationality: 'Nigerian',
  expatriate: false,
  fieldWorker: false,
  remoteWorker: false,
  dateJoined: '',
  probationStartDate: '',
  probationEndDate: '',
  confirmationDueDate: '',
  contractStartDate: '',
  yearsOfService: 0,
  emergencyContactsComplete: false,
  emergencyContactCount: 0,
  documentCount: 0,
  hasManagerAssigned: false,
  payrollSource: 'Local HRIS payroll cache',
  payrollGroup: 'Monthly Payroll',
  salaryGrade: 'Unassigned',
  benefitGroup: '',
  payCurrency: 'NGN',
  paymentRun: 'Monthly',
  paymentType: 'Bank Transfer',
  periodSalary: null,
  annualSalary: null,
  ratePerHour: null,
  ratePerDay: null,
  hoursPerDay: 8,
  hoursPerPeriod: 176,
  setupAssignedToPayroll: true,
  sourceSystem: 'Local HRIS payroll cache',
  sourceEmployeeId: employeeId,
  createdAt: '',
  modifiedAt: '',
  aiRiskScore: 0,
  trainingCompliance: 'Compliant',
});

const readJson = async <T,>(fileName: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(path.join(DATA_ROOT, fileName), 'utf8')) as T;
  } catch {
    return fallback;
  }
};

const readCachedPayrollEmployees = async () => {
  const rows = await readJson<any[]>('timesheet-entry.json', []);
  const byEmployee = new Map<string, DleEmployeeDirectoryRow>();
  for (const row of rows) {
    const employeeId = str(row.employeeId);
    if (!employeeId || byEmployee.has(employeeId)) continue;
    const rate = Number(row.labourRateNgn || 0);
    const employee = emptyEmployee(employeeId, str(row.employeeName) || employeeId);
    employee.department = str(row.department) || employee.department;
    employee.businessUnit = str(row.businessUnit) || employee.businessUnit;
    employee.location = str(row.location) || str(row.site) || employee.location;
    employee.workLocation = employee.location;
    employee.officeLocation = employee.location;
    employee.jobTitle = str(row.mode) || employee.jobTitle;
    employee.payrollGroup = str(row.mode).toLowerCase().includes('daily') ? 'Daily Rate' : 'Monthly Payroll';
    employee.employmentType = str(row.employeeId).startsWith('C') ? 'Contract' : 'Permanent';
    employee.salaryGrade = 'Cache';
    employee.ratePerHour = rate || null;
    employee.ratePerDay = rate ? rate * 8 : null;
    employee.periodSalary = moneyFromRate(rate) || null;
    employee.annualSalary = employee.periodSalary ? employee.periodSalary * 12 : null;
    employee.fieldWorker = true;
    byEmployee.set(employeeId, employee);
  }
  return Array.from(byEmployee.values());
};

const loadPayrollEmployees = async (): Promise<PayrollEmployeeSource> => {
  try {
    const employees = await withTimeout(readEmployeeDirectoryFromDb(), EMPLOYEE_SOURCE_DB_TIMEOUT_MS, 'DLE_Enterprise HRIS employee source timed out.');
    if (employees?.length) {
      return { employees, source: 'DLE_Enterprise HRIS', databaseAvailable: true, warning: null };
    }
  } catch {
    // Fall through to cache; payroll pages should stay operational while DB connectivity is restored.
  }

  const cached = await readCachedPayrollEmployees();
  return {
    employees: cached,
    source: 'Local HRIS payroll cache',
    databaseAvailable: false,
    warning: 'DLE_Enterprise HRIS database is not available. Showing local cached payroll data until the database connection is restored.',
  };
};

export const readPayrollEmployees = async (): Promise<PayrollEmployeeSource> => {
  const now = Date.now();
  if (employeeSourceCache?.value && employeeSourceCache.expiresAt > now) return employeeSourceCache.value;

  if (employeeSourceCache?.value && employeeSourceCache.staleUntil > now) {
    if (!employeeSourceCache.pending) {
      const staleValue = employeeSourceCache.value;
      const pending = loadPayrollEmployees()
        .then((value) => {
          const window = cacheWindow(value);
          employeeSourceCache = { value, expiresAt: Date.now() + window.expiresIn, staleUntil: Date.now() + window.staleFor };
          return value;
        })
        .catch(() => {
          const window = cacheWindow(staleValue);
          employeeSourceCache = { value: staleValue, expiresAt: Date.now() + window.expiresIn, staleUntil: Date.now() + window.staleFor };
          return staleValue;
        });
      employeeSourceCache.pending = pending;
      pending.catch(() => undefined);
    }
    return employeeSourceCache.value;
  }

  if (employeeSourceCache?.pending) return employeeSourceCache.pending;

  const pending = loadPayrollEmployees().then((value) => {
    const window = cacheWindow(value);
    employeeSourceCache = { value, expiresAt: Date.now() + window.expiresIn, staleUntil: Date.now() + window.staleFor };
    return value;
  });
  employeeSourceCache = { value: employeeSourceCache?.value, expiresAt: 0, staleUntil: 0, pending };
  return pending;
};
