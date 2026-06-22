import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readClockingRecords } from '@/lib/attendance-clocking-store';
import { readLiveDailyAttendance, type LiveAttendanceRecord } from '@/lib/biometric-live-attendance-store';
import { readPayrollEmployees, type PayrollEmployeeSource } from '@/lib/payroll-employee-source';
import { readTimeAndLogsPayload, type TimePayload } from '@/lib/time-and-logs-management-store';

export type WorkforceRole =
  | 'Employee'
  | 'Supervisor'
  | 'Manager'
  | 'General Manager'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Payroll Manager'
  | 'Executive Management'
  | 'Administrator'
  | 'Super Administrator';

export type WorkforceActionId =
  | 'capture-attendance'
  | 'sync-device'
  | 'submit-timesheet'
  | 'approve'
  | 'reject'
  | 'request-correction'
  | 'schedule-shift'
  | 'publish-roster'
  | 'request-overtime'
  | 'post-to-payroll'
  | 'generate-report'
  | 'export'
  | 'delegate'
  | 'escalate'
  | 'lock'
  | 'unlock'
  | 'view-history'
  | 'view-audit-trail';

export type WorkforceAction = { id: WorkforceActionId; label: string; roles: WorkforceRole[]; requiresReason?: boolean; sensitive?: boolean };
export type WorkforceAuditEntry = { id: string; at: string; user: string; role: WorkforceRole; action: string; record: string; oldValue: string | null; newValue: string | null; reason?: string; comments?: string };
export type WorkforceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  location: string;
  site: string;
  shift: string;
  attendanceStatus: string;
  timeStatus: string;
  approvalStatus: string;
  payrollStatus: string;
  productivityStatus: string;
  hoursWorked: number;
  overtimeHours: number;
  timeIn: string | null;
  timeOut: string | null;
  exceptions: string[];
};
export type WorkforceShiftSchedule = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  location: string;
  site: string;
  shift: string;
  startDate: string;
  endDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  supervisor: string;
  status: 'Draft' | 'Published' | 'Conflict' | 'Cancelled';
  notes: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
};
export type WorkforceSection = { id: string; label: string; description: string; tabs: Array<{ id: string; label: string; controls: string[] }>; actions: WorkforceActionId[] };
export type WorkforcePayload = {
  generatedAt: string;
  source: string;
  role: WorkforceRole;
  section: string;
  tab: string;
  permissions: { canCapture: boolean; canApprove: boolean; canSchedule: boolean; canPostPayroll: boolean; canConfigure: boolean; canExport: boolean; canAudit: boolean };
  summary: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    earlyDepartures: number;
    missingPunches: number;
    onLeaveToday: number;
    attendanceExceptions: number;
    timesheetHours: number;
    overtimeHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    shiftConflicts: number;
    productivityPct: number;
  };
  current: {
    workforceStatus: string;
    availableActions: string[];
    nextRequiredAction: string;
    approvalStatus: string;
    complianceStatus: string;
    payrollImpact: string;
    auditHistory: string;
    workflowProgress: string;
    exceptionIndicators: string[];
  };
  sections: WorkforceSection[];
  actions: WorkforceAction[];
  records: WorkforceRecord[];
  shiftSchedules: WorkforceShiftSchedule[];
  auditTrail: WorkforceAuditEntry[];
};

const nowIso = () => new Date().toISOString();
const allRoles: WorkforceRole[] = ['Employee', 'Supervisor', 'Manager', 'General Manager', 'HR Officer', 'HR Manager', 'Payroll Officer', 'Payroll Manager', 'Executive Management', 'Administrator', 'Super Administrator'];
const approvalRoles: WorkforceRole[] = ['Supervisor', 'Manager', 'General Manager', 'HR Officer', 'HR Manager', 'Payroll Officer', 'Payroll Manager', 'Administrator', 'Super Administrator'];
const scheduleRoles: WorkforceRole[] = ['Supervisor', 'Manager', 'General Manager', 'HR Officer', 'HR Manager', 'Administrator', 'Super Administrator'];
const payrollRoles: WorkforceRole[] = ['Payroll Officer', 'Payroll Manager', 'HR Manager', 'Administrator', 'Super Administrator'];
const adminRoles: WorkforceRole[] = ['HR Officer', 'HR Manager', 'Administrator', 'Super Administrator'];

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const AUDIT_PATH = path.join(DATA_DIR, 'workforce-management-audit.json');
const SHIFT_SCHEDULE_PATH = path.join(DATA_DIR, 'workforce-shift-schedules.json');

const ensureAuditStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(AUDIT_PATH);
  } catch {
    await writeFile(AUDIT_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};

const readAuditTrail = async (): Promise<WorkforceAuditEntry[]> => {
  await ensureAuditStore();
  try {
    const parsed = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed as WorkforceAuditEntry[] : [];
  } catch {
    return [];
  }
};

const writeAuditTrail = async (items: WorkforceAuditEntry[]) => {
  await ensureAuditStore();
  await writeFile(AUDIT_PATH, JSON.stringify(items.slice(0, 500), null, 2), 'utf8');
};

const readShiftSchedules = async (): Promise<WorkforceShiftSchedule[]> => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(SHIFT_SCHEDULE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed as WorkforceShiftSchedule[] : [];
  } catch {
    return [];
  }
};

const writeShiftSchedules = async (items: WorkforceShiftSchedule[]) => {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SHIFT_SCHEDULE_PATH, JSON.stringify(items.slice(0, 2000), null, 2), 'utf8');
};

const action = (id: WorkforceActionId, label: string, roles: WorkforceRole[] = allRoles, requiresReason = false, sensitive = false): WorkforceAction => ({ id, label, roles, requiresReason, sensitive });
const workforceActions: WorkforceAction[] = [
  action('capture-attendance', 'Capture Attendance', ['Employee', 'Supervisor', 'HR Officer', 'HR Manager', 'Administrator', 'Super Administrator']),
  action('sync-device', 'Sync Device', adminRoles, false, true),
  action('submit-timesheet', 'Submit Timesheet', ['Employee', 'Supervisor', 'Manager', ...adminRoles]),
  action('approve', 'Approve', approvalRoles, false, true),
  action('reject', 'Reject', approvalRoles, true, true),
  action('request-correction', 'Request Correction', allRoles, true),
  action('schedule-shift', 'Schedule Shift', scheduleRoles),
  action('publish-roster', 'Publish Roster', scheduleRoles, false, true),
  action('request-overtime', 'Request Overtime', ['Employee', 'Supervisor', 'Manager', ...adminRoles]),
  action('post-to-payroll', 'Post to Payroll', payrollRoles, false, true),
  action('generate-report', 'Generate Report', [...approvalRoles, 'Executive Management']),
  action('export', 'Export', allRoles),
  action('delegate', 'Delegate', approvalRoles, true),
  action('escalate', 'Escalate', approvalRoles, true),
  action('lock', 'Lock', payrollRoles, false, true),
  action('unlock', 'Unlock', ['Administrator', 'Super Administrator'], true, true),
  action('view-history', 'View History', allRoles),
  action('view-audit-trail', 'View Audit Trail', [...adminRoles, 'Executive Management']),
];

export const workforceSections: WorkforceSection[] = [
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Real-time attendance capture, biometric/mobile/GPS/site attendance, exceptions, approvals, audit, and anomaly detection.',
    actions: ['request-correction', 'export', 'view-audit-trail'],
    tabs: [
      { id: 'dashboard', label: 'Dashboard', controls: ['Daily attendance status', 'Late arrivals', 'Absences', 'Missing punches'] },
      { id: 'capture', label: 'Clocking', controls: ['Live biometric punches', 'Manual exception review', 'Attendance register verification'] },
      { id: 'exceptions', label: 'Exceptions', controls: ['Late arrival review', 'Absence review', 'Missing punch correction', 'Early departure review'] },
      { id: 'approvals', label: 'Approvals', controls: ['Attendance approvals', 'Correction approvals', 'Audit trail'] },
    ],
  },
  {
    id: 'time-tracking',
    label: 'Time Tracking',
    description: 'Timesheet entry, project/department/task/job costing time logs, field work, activity and productivity tracking.',
    actions: ['export', 'view-history'],
    tabs: [
      { id: 'timesheets', label: 'Timesheets', controls: ['Timesheet entry', 'Timesheet periods', 'Timesheet approvals', 'Timesheet reports'] },
      { id: 'projects', label: 'Projects', controls: ['Project allocations', 'Project manager approvals', 'Cost control review'] },
      { id: 'costing', label: 'Job Costing', controls: ['Cost center allocation', 'Payroll-ready hours', 'Variance review'] },
    ],
  },
  {
    id: 'shift-and-scheduling',
    label: 'Shift & Scheduling',
    description: 'Shift management, schedules, rosters, rotations, calendars, swaps, holidays, weekends, and intelligent workforce balancing.',
    actions: ['schedule-shift', 'publish-roster', 'export', 'view-audit-trail'],
    tabs: [
      { id: 'shifts', label: 'Shifts', controls: ['Day shift', 'Night shift', 'Rotational shift'] },
      { id: 'assignment', label: 'Assignment', controls: ['Shift assignment', 'Conflict detection'] },
      { id: 'rosters', label: 'Rosters', controls: ['Roster publishing', 'Shift calendar'] },
    ],
  },
  {
    id: 'overtime-management',
    label: 'Overtime Management',
    description: 'Overtime requests, approvals, logs, dashboards, reports, rates, payroll transfer, and audit history.',
    actions: ['export', 'view-audit-trail'],
    tabs: [
      { id: 'requests', label: 'Requests', controls: ['Overtime requests', 'Weekend overtime', 'Public holiday overtime'] },
      { id: 'approval', label: 'Approval', controls: ['Overtime approval', 'Overtime audit history'] },
      { id: 'payroll', label: 'Payroll', controls: ['Approved overtime transfer to payroll'] },
    ],
  },
  {
    id: 'reviews-and-approvals',
    label: 'Reviews & Approvals',
    description: 'Configurable multi-level workflow engine for attendance, timesheets, overtime, supervisor, department, HR, and payroll reviews.',
    actions: ['export', 'view-audit-trail'],
    tabs: [
      { id: 'workflow', label: 'Workflow', controls: ['Supervisor review', 'Project manager approval', 'Cost control review', 'HR approval', 'Payroll posting'] },
      { id: 'attendance', label: 'Attendance', controls: ['Attendance approval', 'Correction approval'] },
      { id: 'timesheets', label: 'Timesheets', controls: ['Timesheet approval', 'Project split approval'] },
      { id: 'overtime', label: 'Overtime', controls: ['Overtime approval', 'Escalation'] },
    ],
  },
  {
    id: 'time-corrections',
    label: 'Time Corrections',
    description: 'Missing punches, attendance adjustments, shift changes, mandatory justification, attachments, approvals, and audit history.',
    actions: ['request-correction', 'export', 'view-history'],
    tabs: [
      { id: 'missing-clock-in', label: 'Missing Clock-In', controls: ['Missing Clock-In Requests', 'Justification mandatory', 'Attachment support'] },
      { id: 'missing-clock-out', label: 'Missing Clock-Out', controls: ['Missing Clock-Out Requests', 'Multi-level approval'] },
      { id: 'adjustments', label: 'Adjustments', controls: ['Attendance Adjustment Requests', 'Complete audit history'] },
      { id: 'shift-change', label: 'Shift Changes', controls: ['Shift Change Requests', 'Approval workflow'] },
    ],
  },
  {
    id: 'reports-and-analytics',
    label: 'Reports & Analytics',
    description: 'Operational, productivity, executive, compliance, export, API, AI, and workforce automation analytics.',
    actions: ['export', 'view-history', 'view-audit-trail'],
    tabs: [
      { id: 'operational', label: 'Operational', controls: ['Daily attendance report', 'Late arrival report', 'Absence report', 'Overtime report'] },
      { id: 'productivity', label: 'Productivity', controls: ['Employee hours report', 'Project time utilization', 'Payroll hours report'] },
      { id: 'exports', label: 'Exports', controls: ['CSV export', 'API response'] },
    ],
  },
];

const normalizeRole = (role?: string | null): WorkforceRole => allRoles.find((item) => item.toLowerCase() === String(role || '').toLowerCase()) || 'HR Manager';
const round = (value: number) => Math.round(value * 100) / 100;
const hasAction = (sectionId: string, actionId: WorkforceActionId) => workforceSections.find((section) => section.id === sectionId)?.actions.includes(actionId) || false;
const minutesFromTime = (value?: string | null) => {
  if (!value) return null;
  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};
const summarizeExceptions = (records: WorkforceRecord[]) => {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const exception of record.exceptions) {
      counts.set(exception, (counts.get(exception) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([label, count]) => `${label}${count > 1 ? ` (${count})` : ''}`);
};

const permissionsFor = (role: WorkforceRole): WorkforcePayload['permissions'] => ({
  canCapture: ['Employee', 'Supervisor', 'HR Officer', 'HR Manager', 'Administrator', 'Super Administrator'].includes(role),
  canApprove: approvalRoles.includes(role),
  canSchedule: scheduleRoles.includes(role),
  canPostPayroll: payrollRoles.includes(role),
  canConfigure: ['HR Manager', 'Administrator', 'Super Administrator'].includes(role),
  canExport: true,
  canAudit: role !== 'Employee',
});

type AttendanceSourceRecord = Pick<LiveAttendanceRecord, 'id' | 'employeeId' | 'employeeName' | 'department' | 'businessUnit' | 'jobTitle' | 'location' | 'site' | 'shift' | 'status' | 'scheduledStart' | 'scheduledEnd' | 'checkInTime' | 'checkOutTime' | 'minutesLate' | 'overtimeHours' | 'supervisor'>;

const readAttendanceSource = async (): Promise<{ source: string; records: AttendanceSourceRecord[] }> => {
  try {
    const live = await readLiveDailyAttendance();
    return { source: `Live biometric database (${live.attendanceDate})`, records: live.records };
  } catch {
    const stored = await readClockingRecords();
    return {
      source: 'Persisted attendance store',
      records: stored.map((item) => ({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        department: item.department,
        businessUnit: item.businessUnit,
        jobTitle: item.jobTitle,
        location: item.location,
        site: item.site,
        shift: item.shift,
        status: item.attendanceStatus,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        checkInTime: item.clockInTime,
        checkOutTime: item.clockOutTime,
        minutesLate: item.minutesLate,
        overtimeHours: item.overtimeHours,
        supervisor: item.supervisor,
      })),
    };
  }
};

const employeeKeys = (employee: PayrollEmployeeSource['employees'][number]) => [
  employee.employeeCode,
  employee.employeeId,
  employee.sourceEmployeeId,
  String(employee.employeeDbId || ''),
].map((item) => String(item || '').trim()).filter(Boolean);

const normalizeLookup = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const buildRecords = async (employees: PayrollEmployeeSource['employees'], timePayload: TimePayload, attendanceSource: Awaited<ReturnType<typeof readAttendanceSource>>): Promise<WorkforceRecord[]> => {
  const attendanceByEmployee = new Map<string, AttendanceSourceRecord>();
  for (const record of attendanceSource.records) {
    attendanceByEmployee.set(normalizeLookup(record.employeeId), record);
    attendanceByEmployee.set(normalizeLookup(record.employeeName), record);
  }
  const timeByEmployee = new Map<string, TimePayload['records'][number]>();
  for (const record of timePayload.records) {
    timeByEmployee.set(normalizeLookup(record.employeeId), record);
    timeByEmployee.set(normalizeLookup(record.employeeName), record);
  }
  return employees.map((employee) => {
    const keys = [...employeeKeys(employee), employee.fullName].map(normalizeLookup);
    const record = keys.map((key) => attendanceByEmployee.get(key)).find(Boolean);
    const time = keys.map((key) => timeByEmployee.get(key)).find(Boolean);
    const attendanceStatus = record?.status || 'Not Captured';
    const checkout = minutesFromTime(record?.checkOutTime);
    const scheduledEnd = minutesFromTime(record?.scheduledEnd);
    const earlyDeparture = checkout !== null && scheduledEnd !== null && checkout < scheduledEnd - 5;
    const exceptions = [
      ...(!record ? ['Attendance Not Captured'] : []),
      ...(attendanceStatus === 'Late' ? ['Late Arrival'] : []),
      ...((record?.minutesLate || 0) > 15 ? ['Late Arrival Threshold Exceeded'] : []),
      ...(attendanceStatus === 'Absent' ? ['Absence Without Approved Attendance Transaction'] : []),
      ...(record?.checkInTime && !record?.checkOutTime ? ['Missing Clock-Out'] : []),
      ...(!record?.checkInTime && record?.checkOutTime ? ['Missing Clock-In'] : []),
      ...(earlyDeparture ? ['Early Departure'] : []),
      ...(time?.exceptions || []),
    ].filter((item, index, list) => list.indexOf(item) === index);
    return {
      id: record?.id || `wm-${employee.employeeCode || employee.employeeId}`,
      employeeId: employee.employeeCode || employee.employeeId,
      employeeName: employee.fullName,
      department: employee.department || record?.department || 'Unassigned',
      location: employee.workLocation || employee.location || record?.location || 'Unassigned',
      site: employee.projectSite || employee.officeLocation || record?.site || employee.location || 'Unassigned',
      shift: record?.shift || employee.shift || 'Day',
      attendanceStatus,
      timeStatus: time?.status || 'Pending Timesheet',
      approvalStatus: time?.approvalStatus || (attendanceStatus === 'Absent' || attendanceStatus === 'Not Captured' ? 'Review Required' : 'Pending'),
      payrollStatus: time?.payrollStatus || 'Not Ready',
      productivityStatus: attendanceStatus === 'Present' || attendanceStatus === 'Remote' ? 'Productive' : attendanceStatus === 'Late' ? 'Review' : 'Exception',
      hoursWorked: round(time?.hoursWorked || (record?.checkInTime ? 8 + record.overtimeHours : 0)),
      overtimeHours: round(time?.overtimeHours || record?.overtimeHours || 0),
      timeIn: record?.checkInTime || null,
      timeOut: record?.checkOutTime || null,
      exceptions,
    };
  });
};

export async function readWorkforceManagementPayload(sectionInput = 'attendance', tabInput?: string | null, roleInput?: string | null): Promise<WorkforcePayload> {
  const role = normalizeRole(roleInput);
  const section = workforceSections.find((item) => item.id === sectionInput) || workforceSections[0];
  const tab = section.tabs.find((item) => item.id === tabInput) || section.tabs[0];
  const [employees, timePayload, attendanceSource, auditTrail, shiftSchedules] = await Promise.all([readPayrollEmployees(), readTimeAndLogsPayload('timesheet-entry', 'HR Manager'), readAttendanceSource(), readAuditTrail(), readShiftSchedules()]);
  const records = await buildRecords(employees.employees, timePayload, attendanceSource);
  const presentToday = records.filter((item) => ['Present', 'Remote'].includes(item.attendanceStatus)).length;
  const absentToday = records.filter((item) => item.attendanceStatus === 'Absent').length;
  const lateToday = records.filter((item) => item.attendanceStatus === 'Late').length;
  const earlyDepartures = records.filter((item) => item.exceptions.includes('Early Departure')).length;
  const missingPunches = records.filter((item) => item.exceptions.includes('Missing Clock-In') || item.exceptions.includes('Missing Clock-Out')).length;
  const onLeaveToday = records.filter((item) => item.attendanceStatus === 'On Leave').length;
  const exceptionRecords = records.filter((item) => item.exceptions.length > 0);
  const pendingApprovals = records.filter((item) => item.approvalStatus.includes('Pending') || item.approvalStatus.includes('Review')).length;
  const payrollReadyHours = round(records.filter((item) => item.payrollStatus.includes('Ready') || item.payrollStatus.includes('Posted')).reduce((sum, item) => sum + item.hoursWorked, 0));
  const actions = workforceActions.filter((item) => hasAction(section.id, item.id) && item.roles.includes(role));
  const totalHours = records.reduce((sum, item) => sum + item.hoursWorked, 0);
  const productivityPct = records.length ? Math.round((records.filter((item) => item.productivityStatus === 'Productive').length / records.length) * 100) : 0;

  return {
    generatedAt: nowIso(),
    source: `${employees.source}; ${attendanceSource.source}; ${timePayload.source}`,
    role,
    section: section.id,
    tab: tab.id,
    permissions: permissionsFor(role),
    summary: {
      totalEmployees: employees.employees.length,
      presentToday,
      absentToday,
      lateToday,
      earlyDepartures,
      missingPunches,
      onLeaveToday,
      attendanceExceptions: exceptionRecords.length,
      timesheetHours: round(timePayload.summary.totalHours || totalHours),
      overtimeHours: round(records.reduce((sum, item) => sum + item.overtimeHours, 0)),
      pendingApprovals,
      payrollReadyHours,
      shiftConflicts: records.filter((item) => item.exceptions.some((error) => error.toLowerCase().includes('shift'))).length,
      productivityPct,
    },
    current: {
      workforceStatus: `${section.label} / ${tab.label} active`,
      availableActions: actions.map((item) => item.label),
      nextRequiredAction: exceptionRecords.length ? 'Resolve workforce exceptions and approval queues' : 'Generate payroll-ready workforce report',
      approvalStatus: pendingApprovals ? `${pendingApprovals} records require approval/review` : 'Approval queue clear',
      complianceStatus: exceptionRecords.length ? `${exceptionRecords.length} workforce exceptions detected` : 'Compliant',
      payrollImpact: `${payrollReadyHours} hours ready for payroll integration`,
      auditHistory: `${auditTrail.length} persisted action log${auditTrail.length === 1 ? '' : 's'}`,
      workflowProgress: 'Employee -> Supervisor -> Manager -> General Manager -> HR -> Payroll',
      exceptionIndicators: summarizeExceptions(exceptionRecords),
    },
    sections: workforceSections,
    actions,
    records,
    shiftSchedules,
    auditTrail: auditTrail.slice(0, 50),
  };
}

export async function scheduleWorkforceShift(input: {
  actor: string;
  role: WorkforceRole;
  employeeId: string;
  employeeName?: string;
  department?: string;
  location?: string;
  site?: string;
  shift: string;
  startDate: string;
  endDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  supervisor?: string;
  notes?: string;
  publish?: boolean;
}) {
  const schedules = await readShiftSchedules();
  const record: WorkforceShiftSchedule = {
    id: `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    employeeId: input.employeeId,
    employeeName: input.employeeName || input.employeeId,
    department: input.department || 'Unassigned',
    location: input.location || 'Unassigned',
    site: input.site || input.location || 'Unassigned',
    shift: input.shift,
    startDate: input.startDate,
    endDate: input.endDate,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    supervisor: input.supervisor || 'Unassigned',
    status: input.publish ? 'Published' : 'Draft',
    notes: input.notes || '',
    createdAt: nowIso(),
    createdBy: input.actor,
    publishedAt: input.publish ? nowIso() : undefined,
  };
  schedules.unshift(record);
  await writeShiftSchedules(schedules);
  return record;
}

export async function publishWorkforceRoster(actor: string) {
  const schedules = await readShiftSchedules();
  const now = nowIso();
  const updated = schedules.map((item) => item.status === 'Draft' ? { ...item, status: 'Published' as const, publishedAt: now, createdBy: item.createdBy || actor } : item);
  await writeShiftSchedules(updated);
  return updated.filter((item) => item.status === 'Published').length;
}

export async function auditWorkforceAction(input: Omit<WorkforceAuditEntry, 'id' | 'at'>) {
  const auditTrail = await readAuditTrail();
  auditTrail.unshift({ id: `wm-aud-${Date.now()}-${Math.random().toString(16).slice(2)}`, at: nowIso(), ...input });
  await writeAuditTrail(auditTrail);
}

export function validateWorkforceAction(actionId: WorkforceActionId, roleInput: string | null | undefined, payload: WorkforcePayload, body: any = {}) {
  const role = normalizeRole(roleInput);
  const actionDef = workforceActions.find((item) => item.id === actionId);
  if (!actionDef) return { ok: false, status: 400, message: 'Unknown Workforce Management action.' };
  if (!actionDef.roles.includes(role)) return { ok: false, status: 403, message: `${role} is not permitted to perform ${actionDef.label}.` };
  if (actionDef.requiresReason && !String(body.reason || '').trim()) return { ok: false, status: 400, message: 'Reason is required for this workforce action.' };
  if (['approve', 'post-to-payroll', 'lock'].includes(actionId) && payload.summary.attendanceExceptions > 0) return { ok: false, status: 409, message: 'Resolve workforce exceptions before approval, payroll posting, or locking.' };
  if (actionId === 'post-to-payroll' && payload.summary.pendingApprovals > 0) return { ok: false, status: 409, message: 'Payroll posting requires all workforce approvals to be completed.' };
  if (actionId === 'publish-roster' && payload.summary.shiftConflicts > 0) return { ok: false, status: 409, message: 'Resolve shift or roster conflicts before publishing.' };
  return { ok: true, status: 200, message: `${actionDef.label} completed and audit logged.` };
}
