import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sql from 'mssql';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';

export type PayrollLeaveAllowanceEvent = {
  id: string;
  employeeId: string;
  employeeCode: string;
  fullName?: string;
  period: string;
  leaveYear: number;
  leaveType: 'Annual Leave';
  days: number;
  code: string;
  description: string;
  amount: number;
  taxableAmount: number;
  status: 'Pending Approval' | 'Approved' | 'Posted' | 'Paid' | 'Reversed';
  source: 'Sage Payroll Migration' | 'ESS Leave Approval' | 'HR Leave Approval';
  requestId?: string;
  approvedAt?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
  audit: Array<{ at: string; actor: string; action: string; note?: string }>;
};

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();
export const normalizePayrollPeriod = (value?: string | null) => compact(value).replace(/\//g, '-').slice(0, 7);

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_ROOT = path.join(resolveDashboardRoot(), 'data', 'hris');
const EVENTS_PATH = path.join(DATA_ROOT, 'payroll-leave-allowance-events.json');

let syncCache: { mtime: number; events: PayrollLeaveAllowanceEvent[] } | null = null;

const config = () => ({
  server: process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8',
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL',
  },
  connectionTimeout: Number(process.env.SAGE_PAYROLL_DB_CONNECT_TIMEOUT || 15000),
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 60000),
});

const readEventsRaw = async (): Promise<PayrollLeaveAllowanceEvent[]> => {
  try {
    const parsed = JSON.parse(await readFile(EVENTS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readPayrollLeaveAllowanceEvents = readEventsRaw;

export const writePayrollLeaveAllowanceEvents = async (events: PayrollLeaveAllowanceEvent[]) => {
  await mkdir(DATA_ROOT, { recursive: true });
  const sorted = [...events].sort((a, b) => `${b.period}-${b.employeeCode}`.localeCompare(`${a.period}-${a.employeeCode}`));
  await writeFile(EVENTS_PATH, JSON.stringify(sorted, null, 2), 'utf8');
  syncCache = { mtime: Date.now(), events: sorted };
};

export const readPayrollLeaveAllowanceEventsSync = () => {
  try {
    if (!existsSync(EVENTS_PATH)) return [];
    const stat = statSync(EVENTS_PATH) as { mtimeMs: number };
    if (syncCache && syncCache.mtime === stat.mtimeMs) return syncCache.events;
    const parsed = JSON.parse(readFileSync(EVENTS_PATH, 'utf8'));
    const events = Array.isArray(parsed) ? parsed as PayrollLeaveAllowanceEvent[] : [];
    syncCache = { mtime: stat.mtimeMs, events };
    return events;
  } catch {
    return syncCache?.events || [];
  }
};

export const leaveAllowanceEventsForEmployeePeriod = (employee: DleEmployeeDirectoryRow, period?: string) => {
  const normalizedPeriod = normalizePayrollPeriod(period);
  if (!normalizedPeriod) return [];
  const employeeKeys = [
    employee.employeeId,
    employee.employeeCode,
    employee.sourceEmployeeId,
  ].map(normalizePayrollMatchKey).filter(Boolean);
  return readPayrollLeaveAllowanceEventsSync().filter((event) => {
    if (!['Approved', 'Posted', 'Paid'].includes(event.status)) return false;
    if (event.period !== normalizedPeriod) return false;
    const eventKeys = [event.employeeId, event.employeeCode].map(normalizePayrollMatchKey).filter(Boolean);
    return eventKeys.some((key) => employeeKeys.includes(key));
  });
};

export const hasLeaveAllowanceInYear = async (employee: DleEmployeeDirectoryRow, leaveYear: number, excludeRequestId?: string) => {
  const employeeKeys = [
    employee.employeeId,
    employee.employeeCode,
    employee.sourceEmployeeId,
  ].map(normalizePayrollMatchKey).filter(Boolean);
  return (await readPayrollLeaveAllowanceEvents()).some((event) => {
    if (event.leaveYear !== leaveYear || event.leaveType !== 'Annual Leave') return false;
    if (excludeRequestId && event.requestId === excludeRequestId) return false;
    if (!['Approved', 'Posted', 'Paid'].includes(event.status)) return false;
    const eventKeys = [event.employeeId, event.employeeCode].map(normalizePayrollMatchKey).filter(Boolean);
    return eventKeys.some((key) => employeeKeys.includes(key));
  });
};

const sageLeaveAllowanceQuery = `
SELECT
  e.EmployeeCode AS employeeCode,
  ge.DisplayName AS fullName,
  ppg.StartDate AS periodStart,
  ppg.EndDate AS periodEnd,
  ppg.CalendarYear AS calendarYear,
  ppg.CalendarMonth AS calendarMonth,
  ed.DefCode AS code,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(ed.LongDescription)), ''), ed.DefCode) AS description,
  pel.Total AS amount,
  pel.TaxableAmount AS taxableAmount
FROM Payroll.PayslipEarnLine pel
JOIN Payroll.Payslip p
  ON p.PayslipID = pel.PayslipID
JOIN Employee.EmployeePayPeriod epp
  ON epp.EmployeePayPeriodID = p.EmployeePayPeriodID
JOIN Company.PayPeriodGen ppg
  ON ppg.PayPeriodGenID = epp.PayPeriodGenID
JOIN Employee.Employee e
  ON e.EmployeeID = epp.EmployeeID
JOIN Entity.GenEntity ge
  ON ge.GenEntityID = e.GenEntityID
JOIN Payroll.EarningDef ed
  ON ed.EarningDefID = pel.DefID
WHERE
  ppg.CalendarYear >= YEAR(GETDATE()) - 1
  AND ISNULL(pel.Total, 0) <> 0
  AND (
    UPPER(ed.DefCode) IN ('LEAVEALLOW', 'SNR_LEAVETAX')
    OR UPPER(ed.DefCode) LIKE '%[_]LEAVE'
    OR UPPER(ed.DefCode) LIKE '%LEAVEALLOW%'
    OR UPPER(ed.ShortDescription) LIKE '%LEAVE ALLOWANCE%'
  )
ORDER BY ppg.CalendarYear DESC, ppg.CalendarMonth DESC, e.EmployeeCode;
`;

type SageLeaveRow = {
  employeeCode: string;
  fullName: string | null;
  calendarYear: number;
  calendarMonth: number;
  code: string;
  description: string;
  amount: number;
  taxableAmount: number | null;
};

export const readSageLeaveAllowanceEvents = async (): Promise<PayrollLeaveAllowanceEvent[]> => {
  const pool = new sql.ConnectionPool(config());
  await pool.connect();
  try {
    const result = await pool.request().query(sageLeaveAllowanceQuery);
    const now = new Date().toISOString();
    return (result.recordset as SageLeaveRow[]).map((row) => {
      const period = `${Number(row.calendarYear || 0)}-${String(Number(row.calendarMonth || 0)).padStart(2, '0')}`;
      const code = compact(row.code).toUpperCase() || 'LEAVEALLOW';
      const employeeCode = compact(row.employeeCode);
      return {
        id: `sage-${period}-${normalizePayrollMatchKey(employeeCode)}-${code}`,
        employeeId: employeeCode,
        employeeCode,
        fullName: compact(row.fullName),
        period,
        leaveYear: Number(row.calendarYear || period.slice(0, 4)),
        leaveType: 'Annual Leave' as const,
        days: 10,
        code,
        description: compact(row.description) || 'Leave Allowance',
        amount: roundMoney(Number(row.amount || 0)),
        taxableAmount: roundMoney(Number(row.taxableAmount ?? row.amount ?? 0)),
        status: 'Paid' as const,
        source: 'Sage Payroll Migration' as const,
        postedAt: `${period}-01T00:00:00.000Z`,
        createdAt: now,
        updatedAt: now,
        audit: [{ at: now, actor: 'Sage Payroll Migration', action: 'Imported paid leave allowance', note: `${code} ${period}` }],
      };
    }).filter((event) => event.employeeCode && event.amount !== 0);
  } finally {
    await pool.close();
  }
};

export const syncSageLeaveAllowanceEvents = async () => {
  try {
    const [current, sageEvents] = await Promise.all([readPayrollLeaveAllowanceEvents(), readSageLeaveAllowanceEvents()]);
    const byId = new Map(current.map((event) => [event.id, event]));
    for (const sageEvent of sageEvents) {
      const existing = byId.get(sageEvent.id);
      byId.set(sageEvent.id, existing ? { ...existing, ...sageEvent, createdAt: existing.createdAt, audit: existing.audit?.length ? existing.audit : sageEvent.audit } : sageEvent);
    }
    const events = Array.from(byId.values());
    await writePayrollLeaveAllowanceEvents(events);
    return events;
  } catch {
    return readPayrollLeaveAllowanceEvents();
  }
};

export const upsertApprovedLeaveAllowanceEvent = async (input: {
  employee: DleEmployeeDirectoryRow;
  period: string;
  leaveYear: number;
  days: number;
  amount: number;
  taxableAmount?: number;
  source: PayrollLeaveAllowanceEvent['source'];
  requestId?: string;
  actor: string;
  note?: string;
}) => {
  const period = normalizePayrollPeriod(input.period);
  if (!period) throw new Error('Payroll period is required for leave allowance posting.');
  if (await hasLeaveAllowanceInYear(input.employee, input.leaveYear, input.requestId)) {
    throw new Error(`Leave allowance has already been paid or approved for ${input.leaveYear}.`);
  }
  const now = new Date().toISOString();
  const employeeCode = compact(input.employee.employeeCode || input.employee.employeeId);
  const requestKey = input.requestId ? normalizePayrollMatchKey(input.requestId) : String(Date.now());
  const event: PayrollLeaveAllowanceEvent = {
    id: `ess-${input.leaveYear}-${normalizePayrollMatchKey(employeeCode)}-${requestKey}`,
    employeeId: input.employee.employeeId,
    employeeCode,
    fullName: input.employee.fullName,
    period,
    leaveYear: input.leaveYear,
    leaveType: 'Annual Leave',
    days: Math.max(0, Number(input.days || 0)),
    code: 'LEAVEALLOW',
    description: 'Leave Allowance',
    amount: roundMoney(Number(input.amount || 0)),
    taxableAmount: roundMoney(Number(input.taxableAmount ?? input.amount ?? 0)),
    status: 'Approved',
    source: input.source,
    requestId: input.requestId,
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
    audit: [{ at: now, actor: input.actor, action: 'Approved leave allowance for payroll', note: input.note }],
  };
  const events = await readPayrollLeaveAllowanceEvents();
  await writePayrollLeaveAllowanceEvents([event, ...events.filter((item) => item.id !== event.id)]);
  return event;
};
