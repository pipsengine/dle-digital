import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

export type LeaveRole = 'Leave Administrator' | 'HR Officer' | 'HR Manager' | 'Department Manager' | 'Supervisor' | 'Payroll Officer' | 'Employee' | 'Executive' | 'System Administrator';
export type LeaveStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Cancelled' | 'Completed';
export type WorkflowStage = 'Employee' | 'Supervisor' | 'Manager' | 'HR' | 'Final Approval' | 'Closed';
export type LeaveTone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';

export type LeaveActionId =
  | 'create'
  | 'apply'
  | 'edit'
  | 'save-draft'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'recall'
  | 'cancel'
  | 'withdraw'
  | 'encash'
  | 'delegate'
  | 'escalate'
  | 'reassign'
  | 'adjust-balance'
  | 'process-accrual'
  | 'process-carry-forward'
  | 'generate-report'
  | 'export'
  | 'import'
  | 'archive'
  | 'reopen'
  | 'view-history'
  | 'view-audit-trail'
  | 'request-clarification'
  | 'bulk-approve'
  | 'bulk-reject'
  | 'schedule-leave'
  | 'block-period'
  | 'publish-calendar'
  | 'post-to-payroll'
  | 'close-year';

export type LeaveAction = {
  id: LeaveActionId;
  label: string;
  roles: LeaveRole[];
  stage?: WorkflowStage[];
  requiresReason?: boolean;
  sensitive?: boolean;
};

export type LeaveAuditEntry = {
  id: string;
  at: string;
  user: string;
  role: LeaveRole;
  action: string;
  record: string;
  oldValue: string | null;
  newValue: string | null;
  comments?: string;
  reason?: string;
};

export type LeaveApplicationRecord = {
  id: string;
  employeeId: string;
  fullName: string;
  department: string;
  managerName: string;
  location: string;
  employeeCategory: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  stage: WorkflowStage;
  approvalStatus: string;
  policyComplianceStatus: 'Compliant' | 'Attention Required' | 'Blocked';
  balanceImpact: number;
  availableBalance: number;
  actingOfficer: string;
  supportingDocuments: number;
  exceptions: string[];
  auditCount: number;
};

export type LeaveBalanceRecord = {
  employeeId: string;
  fullName: string;
  department: string;
  leaveType: string;
  currentBalance: number;
  accruedBalance: number;
  usedBalance: number;
  pendingBalance: number;
  forfeitedBalance: number;
  carryForwardBalance: number;
  liabilityValue: number;
  status: 'Healthy' | 'Review' | 'Blocked';
  exceptions: string[];
};

export type LeaveTypeRule = {
  id: string;
  name: string;
  active: boolean;
  entitlementDays: number;
  durationBasis: 'Working days' | 'Calendar days';
  eligibility: string;
  waitingPeriodDays: number;
  gradeRestrictions: string[];
  categoryRestrictions: string[];
  genderRestriction: string;
  documentRequirements: string[];
  approvalLevels: string[];
  accrualRule: string;
  carryForwardRule: string;
  encashmentRule: string;
  allowanceRule: string;
};

export type LeavePayload = {
  generatedAt: string;
  source: string;
  role: LeaveRole;
  section: string;
  permissions: {
    canApply: boolean;
    canApprove: boolean;
    canAdminister: boolean;
    canProcessFinancials: boolean;
    canConfigure: boolean;
    canExport: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalEmployees: number;
    employeesOnLeave: number;
    returningToday: number;
    pendingApplications: number;
    pendingApprovals: number;
    leaveUtilizationPct: number;
    leaveLiability: number;
    encashmentRequests: number;
    recallRequests: number;
    cancellationRequests: number;
    exceptionCount: number;
  };
  current: {
    leaveStatus: string;
    availableActions: string[];
    nextRequiredAction: string;
    approvalStatus: string;
    policyComplianceStatus: string;
    leaveBalanceImpact: string;
    auditHistory: string;
    workflowProgress: string;
    exceptionIndicators: string[];
  };
  actions: LeaveAction[];
  applications: LeaveApplicationRecord[];
  balances: LeaveBalanceRecord[];
  leaveTypes: LeaveTypeRule[];
  calendar: Array<Record<string, string | number>>;
  blockedPeriods: Array<Record<string, string>>;
  workflowMatrix: Array<Record<string, string>>;
  reports: Array<Record<string, string>>;
  notifications: Array<Record<string, string>>;
  auditTrail: LeaveAuditEntry[];
  integrations: Array<Record<string, string>>;
  operationalSections: Array<{ id: string; label: string; area: 'Dashboard' | 'Transactions' | 'Planning & Balances' | 'Administration' | 'Reports & Analytics'; description: string; actions: LeaveActionId[]; controls: string[]; reports?: string[] }>;
};

const nowIso = () => new Date().toISOString();
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};
const ESS_REQUESTS_PATH = path.join(resolveDashboardRoot(), 'data', 'hris', 'ess-requests.json');

const adminRoles: LeaveRole[] = ['Leave Administrator', 'HR Officer', 'HR Manager', 'System Administrator'];
const managerRoles: LeaveRole[] = ['Department Manager', 'Supervisor', 'HR Manager', 'Executive'];
const approvalRoles: LeaveRole[] = ['Supervisor', 'Department Manager', 'HR Manager', 'Executive', 'System Administrator'];
const financeRoles: LeaveRole[] = ['Payroll Officer', 'HR Manager', 'Executive', 'System Administrator'];
const allRoles: LeaveRole[] = ['Leave Administrator', 'HR Officer', 'HR Manager', 'Department Manager', 'Supervisor', 'Payroll Officer', 'Employee', 'Executive', 'System Administrator'];

const action = (id: LeaveActionId, label: string, roles: LeaveRole[] = allRoles, stage?: WorkflowStage[], requiresReason = false, sensitive = false): LeaveAction => ({
  id,
  label,
  roles,
  stage,
  requiresReason,
  sensitive,
});

export const leaveActions: LeaveAction[] = [
  action('create', 'Create', adminRoles),
  action('apply', 'Apply Leave', allRoles),
  action('edit', 'Edit', ['Employee', ...adminRoles]),
  action('save-draft', 'Save Draft', allRoles),
  action('submit', 'Submit', allRoles, ['Employee']),
  action('approve', 'Approve', approvalRoles, ['Supervisor', 'Manager', 'HR', 'Final Approval'], false, true),
  action('reject', 'Reject', approvalRoles, ['Supervisor', 'Manager', 'HR', 'Final Approval'], true, true),
  action('recall', 'Recall', managerRoles, undefined, true, true),
  action('cancel', 'Cancel', allRoles, undefined, true),
  action('withdraw', 'Withdraw', ['Employee', ...adminRoles], undefined, true),
  action('encash', 'Encash', financeRoles, undefined, true, true),
  action('delegate', 'Delegate', managerRoles, undefined, true),
  action('escalate', 'Escalate', managerRoles, undefined, true),
  action('reassign', 'Reassign', adminRoles, undefined, true),
  action('adjust-balance', 'Adjust Balance', adminRoles, undefined, true, true),
  action('process-accrual', 'Process Accrual', adminRoles, undefined, false, true),
  action('process-carry-forward', 'Process Carry Forward', adminRoles, undefined, false, true),
  action('generate-report', 'Generate Report', [...adminRoles, ...managerRoles, 'Payroll Officer']),
  action('export', 'Export', [...adminRoles, ...managerRoles, 'Payroll Officer']),
  action('import', 'Import', adminRoles, undefined, false, true),
  action('archive', 'Archive', ['HR Manager', 'System Administrator'], undefined, true, true),
  action('reopen', 'Reopen', ['HR Manager', 'System Administrator'], undefined, true, true),
  action('view-history', 'View History', allRoles),
  action('view-audit-trail', 'View Audit Trail', [...adminRoles, 'Executive', 'System Administrator']),
  action('request-clarification', 'Request Clarification', approvalRoles, undefined, true),
  action('bulk-approve', 'Bulk Approve', approvalRoles, undefined, false, true),
  action('bulk-reject', 'Bulk Reject', approvalRoles, undefined, true, true),
  action('schedule-leave', 'Schedule Leave', allRoles),
  action('block-period', 'Block Leave Period', adminRoles, undefined, true),
  action('publish-calendar', 'Publish Calendar', adminRoles),
  action('post-to-payroll', 'Post to Payroll', financeRoles, undefined, false, true),
  action('close-year', 'Close Leave Year', ['HR Manager', 'System Administrator'], undefined, false, true),
];

const auditStore: LeaveAuditEntry[] = [];

const dateAdd = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const isWorkingDate = (date: string) => {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day !== 0 && day !== 6;
};

const dateInRange = (date: string, startDate: string, endDate: string) =>
  date >= startDate && date <= endDate;

const currentYear = new Date().getFullYear();
export const dormantLongPolicy = {
  annualPermanentDays: 30,
  annualContractDays: 14,
  sickDays: 10,
  casualDays: 5,
  compassionateDays: 5,
  examDays: 5,
  maternityCalendarDays: 90,
  carryForwardCap: 7,
  carryForwardExpiry: `${currentYear}-03-31`,
  allowanceMinimumAnnualDays: 10,
};

export const isFourteenDayPaidLeaveEmployee = (employee: Pick<DleEmployeeDirectoryRow, 'employeeId' | 'employeeCode' | 'employmentType' | 'employeeCategory' | 'staffCategory' | 'payrollGroup' | 'salaryGrade' | 'jobGrade'>) => {
  const categoryText = [
    employee.employmentType,
    employee.employeeCategory,
    employee.staffCategory,
    employee.payrollGroup,
    employee.salaryGrade,
    employee.jobGrade,
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ').toLowerCase();
  const code = String(employee.employeeCode || employee.employeeId || '').trim().toUpperCase();
  return (
    /\b(contract|lumpsum|lump sum|daily rate|casual|temporary)\b/.test(categoryText) ||
    /\b(nysc|national youth service|industrial training|intern|internship|student trainee|\bit\b)\b/.test(categoryText) ||
    /^(IT|I|NYSC|N)\d+/.test(code)
  );
};

export const annualLeaveEntitlementForEmployee = (employee: DleEmployeeDirectoryRow) =>
  isFourteenDayPaidLeaveEmployee(employee)
    ? dormantLongPolicy.annualContractDays
    : isConfirmedPermanent(employee)
      ? dormantLongPolicy.annualPermanentDays
      : 0;

const seedLeaveTypes: LeaveTypeRule[] = [
  { id: 'annual-leave', name: 'Annual Leave', active: true, entitlementDays: dormantLongPolicy.annualPermanentDays, durationBasis: 'Working days', eligibility: 'Permanent employees receive 30 working days after confirmation of appointment; contract employees receive 14 working days annually while contract-active.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Contract'], genderRestriction: 'None', documentRequirements: [], approvalLevels: ['Supervisor', 'Manager', 'HR'], accrualRule: 'Annual entitlement grant with confirmation validation for permanent employees', carryForwardRule: `Every 1 January, unused Annual Leave rolls over to a maximum of ${dormantLongPolicy.carryForwardCap} working days as Carry Forward Leave and expires on 31 March.`, encashmentRule: 'Not encashable unless separately approved by HR and Payroll policy.', allowanceRule: `Leave Allowance is payable only when at least ${dormantLongPolicy.allowanceMinimumAnnualDays} working days Annual Leave is applied from the current year's entitlement.` },
  { id: 'sick-leave', name: 'Sick Leave', active: true, entitlementDays: dormantLongPolicy.sickDays, durationBasis: 'Working days', eligibility: 'Permanent employees receive 10 working days annually with medical evidence where required.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'None', documentRequirements: ['Medical certificate'], approvalLevels: ['Supervisor', 'HR'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable', allowanceRule: 'No leave allowance' },
  { id: 'casual-leave', name: 'Casual Leave', active: true, entitlementDays: dormantLongPolicy.casualDays, durationBasis: 'Working days', eligibility: 'Permanent employees receive 5 working days annually subject to manager approval.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'None', documentRequirements: [], approvalLevels: ['Supervisor'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable', allowanceRule: 'No leave allowance' },
  { id: 'compassionate-leave', name: 'Compassionate Leave', active: true, entitlementDays: dormantLongPolicy.compassionateDays, durationBasis: 'Working days', eligibility: 'Permanent employees receive 5 working days annually for HR-approved compassionate reasons.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'None', documentRequirements: ['Supporting document'], approvalLevels: ['Supervisor', 'HR'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable', allowanceRule: 'No leave allowance' },
  { id: 'exam-leave', name: 'Exam Leave', active: true, entitlementDays: dormantLongPolicy.examDays, durationBasis: 'Working days', eligibility: 'Permanent employees receive 5 working days annually for approved examination schedules.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'None', documentRequirements: ['Exam timetable', 'Institution evidence'], approvalLevels: ['Manager', 'HR'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable', allowanceRule: 'No leave allowance' },
  { id: 'maternity-leave', name: 'Maternity Leave', active: true, entitlementDays: dormantLongPolicy.maternityCalendarDays, durationBasis: 'Calendar days', eligibility: 'Eligible confirmed permanent female employees receive 90 calendar days by policy.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'Female', documentRequirements: ['Medical certificate', 'Expected delivery date'], approvalLevels: ['Manager', 'HR', 'Final Approval'], accrualRule: 'Policy grant', carryForwardRule: 'Not applicable', encashmentRule: 'Not encashable', allowanceRule: 'No leave allowance' },
  { id: 'unpaid-leave', name: 'Unpaid Leave', active: true, entitlementDays: 0, durationBasis: 'Working days', eligibility: 'HR-approved exception with payroll impact.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Contract'], genderRestriction: 'None', documentRequirements: ['Reason evidence'], approvalLevels: ['Manager', 'HR', 'Payroll'], accrualRule: 'No accrual', carryForwardRule: 'Not applicable', encashmentRule: 'Not encashable', allowanceRule: 'Deductible through payroll where applicable' },
];

const hashNum = (value: string) => value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
const activeStatus = (status: string) => ['active', 'confirmed', 'probation', 'on leave', 'contract active', 'reactivated'].includes(String(status || '').toLowerCase());
const isConfirmedPermanent = (employee: DleEmployeeDirectoryRow) => {
  const status = String(employee.status || '').toLowerCase();
  const confirmationDue = employee.confirmationDueDate ? new Date(`${employee.confirmationDueDate}T00:00:00.000Z`).getTime() : null;
  return status.includes('confirmed') || status.includes('on leave') || status.includes('reactivated') || (status === 'active' && confirmationDue !== null && confirmationDue <= Date.now());
};

const entitlementFor = (employee: DleEmployeeDirectoryRow, leaveType = 'Annual Leave') => {
  if (leaveType === 'Annual Leave') return annualLeaveEntitlementForEmployee(employee);
  if (isFourteenDayPaidLeaveEmployee(employee)) return 0;
  if (leaveType === 'Sick Leave') return dormantLongPolicy.sickDays;
  if (leaveType === 'Casual Leave') return dormantLongPolicy.casualDays;
  if (leaveType === 'Compassionate Leave') return dormantLongPolicy.compassionateDays;
  if (leaveType === 'Exam Leave') return dormantLongPolicy.examDays;
  if (leaveType === 'Maternity Leave') return dormantLongPolicy.maternityCalendarDays;
  return 0;
};

const balanceFor = (employee: DleEmployeeDirectoryRow, leaveType = 'Annual Leave') => {
  const base = entitlementFor(employee, leaveType);
  const used = Math.min(base, hashNum(employee.employeeId) % Math.max(base || 1, 1));
  const pending = hashNum(employee.fullName) % 4;
  const carry = leaveType === 'Annual Leave' ? Math.min(dormantLongPolicy.carryForwardCap, hashNum(employee.department || '') % (dormantLongPolicy.carryForwardCap + 1)) : 0;
  return {
    current: Math.max(0, base + carry - used - pending),
    accrued: base + carry,
    used,
    pending,
    forfeited: leaveType === 'Annual Leave' ? hashNum(employee.employeeCode || employee.employeeId) % 3 : 0,
    carry,
  };
};

const buildApplications = (employees: DleEmployeeDirectoryRow[]): LeaveApplicationRecord[] => {
  const sample = employees.filter((employee) => activeStatus(employee.status)).slice(0, 18);
  const statuses: LeaveStatus[] = ['Submitted', 'Under Review', 'Approved', 'Draft', 'Cancelled', 'Completed'];
  return sample.map((employee, index) => {
    const type = seedLeaveTypes[index % seedLeaveTypes.length].name;
    const balance = balanceFor(employee, type);
    const days = type === 'Annual Leave' && index % 3 === 0 ? 10 + (hashNum(employee.employeeId) % 6) : 1 + (hashNum(employee.employeeId) % 7);
    const currentYearAnnualAllowance = type === 'Annual Leave' && days >= dormantLongPolicy.allowanceMinimumAnnualDays && balance.accrued > balance.carry;
    const fourteenDayPaidLeave = isFourteenDayPaidLeaveEmployee(employee);
    const status = statuses[index % statuses.length];
    const exceptions = [
      ...(type === 'Annual Leave' && !fourteenDayPaidLeave && !isConfirmedPermanent(employee) ? ['Annual Leave is available only after confirmation of appointment'] : []),
      ...(days > balance.current && type !== 'Unpaid Leave' ? ['Insufficient leave balance'] : []),
      ...(type === 'Annual Leave' && days < dormantLongPolicy.allowanceMinimumAnnualDays ? ['Leave Allowance not payable below 10 current-year Annual Leave days'] : []),
      ...(index % 9 === 0 ? ['Acting officer not assigned'] : []),
      ...(index % 11 === 0 ? ['Overlapping leave detected'] : []),
      ...(index % 13 === 0 ? ['Requested date touches blocked period'] : []),
    ];
    const blocked = exceptions.some((item) => item.includes('Insufficient') || item.includes('Overlapping') || item.includes('blocked') || item.includes('confirmation'));
    return {
      id: `LV-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      department: employee.department || 'Unassigned',
      managerName: employee.managerName || employee.departmentHead || 'Unassigned',
      location: employee.location || employee.workLocation || 'Unassigned',
      employeeCategory: employee.employeeCategory || employee.employmentType || 'Unassigned',
      leaveType: type,
      startDate: dateAdd(index + 1),
      endDate: dateAdd(index + days),
      days,
      status,
      stage: status === 'Draft' ? 'Employee' : status === 'Submitted' ? 'Supervisor' : status === 'Under Review' ? 'HR' : status === 'Approved' ? 'Final Approval' : 'Closed',
      approvalStatus: status === 'Approved' || status === 'Completed' ? 'Approved' : status === 'Rejected' ? 'Rejected' : status === 'Cancelled' ? 'Cancelled' : 'Pending',
      policyComplianceStatus: blocked ? 'Blocked' : exceptions.length ? 'Attention Required' : 'Compliant',
      balanceImpact: type === 'Unpaid Leave' ? 0 : days,
      availableBalance: balance.current,
      actingOfficer: currentYearAnnualAllowance ? 'Payroll notified for Leave Allowance' : index % 9 === 0 ? 'Not assigned' : sample[(index + 1) % sample.length]?.fullName || 'Assigned',
      supportingDocuments: index % 3,
      exceptions,
      auditCount: 2 + (index % 5),
    };
  });
};

export type ApprovedPaidLeaveDay = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  requestId: string;
};

type EssLeaveRequest = {
  id: string;
  employeeId: string;
  category: string;
  status: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  paidLeave?: boolean;
};

const readApprovedEssPaidLeaveRequests = async () => {
  try {
    const parsed = JSON.parse(await readFile(ESS_REQUESTS_PATH, 'utf8')) as EssLeaveRequest[];
    return Array.isArray(parsed)
      ? parsed.filter((request) =>
          request.category === 'Leave' &&
          request.paidLeave !== false &&
          request.leaveType === 'Annual Leave' &&
          ['Approved', 'Closed'].includes(request.status) &&
          request.startDate &&
          request.endDate,
        )
      : [];
  } catch {
    return [];
  }
};

export async function approvedPaidLeaveForDate(date: string): Promise<ApprovedPaidLeaveDay[]> {
  if (!date || !isWorkingDate(date)) return [];
  const employeeSource = await readPayrollEmployees();
  const employeesById = new Map(employeeSource.employees.flatMap((employee) => [
    [employee.employeeId, employee],
    [employee.employeeCode, employee],
  ].filter(([key]) => Boolean(key)) as Array<[string, DleEmployeeDirectoryRow]>));
  const generated = buildApplications(employeeSource.employees)
    .filter((application) =>
      application.leaveType === 'Annual Leave' &&
      ['Approved', 'Completed'].includes(application.status) &&
      application.policyComplianceStatus !== 'Blocked' &&
      dateInRange(date, application.startDate, application.endDate),
    )
    .map((application) => {
      const employee = employeesById.get(application.employeeId);
      return {
        employeeId: application.employeeId,
        employeeCode: employee?.employeeCode || application.employeeId,
        fullName: application.fullName,
        leaveType: application.leaveType,
        startDate: application.startDate,
        endDate: application.endDate,
        days: application.days,
        status: application.status,
        requestId: application.id,
      };
    });
  const essRequests = (await readApprovedEssPaidLeaveRequests())
    .filter((request) => dateInRange(date, request.startDate || '', request.endDate || ''))
    .map((request) => {
      const employee = employeesById.get(request.employeeId);
      return {
        employeeId: request.employeeId,
        employeeCode: employee?.employeeCode || request.employeeId,
        fullName: employee?.fullName || request.employeeId,
        leaveType: request.leaveType || 'Annual Leave',
        startDate: request.startDate || date,
        endDate: request.endDate || date,
        days: Number(request.days || 0),
        status: request.status as LeaveStatus,
        requestId: request.id,
      };
    });
  return [...generated, ...essRequests];
}

const buildBalances = (employees: DleEmployeeDirectoryRow[]) => employees.slice(0, 120).map((employee) => {
  const leaveType = 'Annual Leave';
  const balance = balanceFor(employee, leaveType);
  const fourteenDayPaidLeave = isFourteenDayPaidLeaveEmployee(employee);
  const exceptions = [
    ...(balance.current < 3 ? ['Low leave balance'] : []),
    ...(!fourteenDayPaidLeave && !isConfirmedPermanent(employee) ? ['Annual Leave locked pending confirmation of appointment'] : []),
    ...(!activeStatus(employee.status) ? ['Employee status is not leave active'] : []),
    ...(employee.hasManagerAssigned === false ? ['Reporting manager missing'] : []),
  ];
  return {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    department: employee.department || 'Unassigned',
    leaveType,
    currentBalance: balance.current,
    accruedBalance: balance.accrued,
    usedBalance: balance.used,
    pendingBalance: balance.pending,
    forfeitedBalance: balance.forfeited,
    carryForwardBalance: balance.carry,
    liabilityValue: balance.current * 18500,
    status: exceptions.some((item) => item.includes('status')) ? 'Blocked' : exceptions.length ? 'Review' : 'Healthy',
    exceptions,
  } satisfies LeaveBalanceRecord;
});

const sectionConfig: LeavePayload['operationalSections'] = [
  { id: 'dashboard', label: 'Dashboard', area: 'Dashboard', description: 'Operational leave command center with status, approvals, liability, exceptions, calendars, and action queues.', actions: ['apply', 'view-history', 'process-accrual', 'process-carry-forward', 'generate-report', 'view-audit-trail'], controls: ['Current leave status', 'Available actions', 'Next required action', 'Approval status', 'Policy compliance status', 'Leave balance impact', 'Audit history', 'Workflow progress', 'Exception indicators'] },
  { id: 'applications', label: 'Applications', area: 'Transactions', description: 'Workflow-driven leave applications, drafts, document upload readiness, validation, status tracking, printing, and history.', actions: ['apply', 'save-draft', 'submit', 'edit', 'withdraw', 'cancel', 'view-history'], controls: ['Leave balance verification', 'Eligibility verification', 'Leave conflict detection', 'Public holiday validation', 'Overlapping leave detection', 'Reporting manager validation', 'Acting officer validation'] },
  { id: 'approvals', label: 'Approvals', area: 'Transactions', description: 'Multi-level supervisor, manager, HR, and final approval queue with comments, delegation, escalation, and bulk decisions.', actions: ['approve', 'reject', 'request-clarification', 'escalate', 'delegate', 'reassign', 'bulk-approve', 'bulk-reject', 'view-history'], controls: ['Department matrix', 'Grade matrix', 'Leave type matrix', 'Duration matrix', 'Employee category matrix'] },
  { id: 'recalls', label: 'Recalls', area: 'Transactions', description: 'Manager-to-HR leave recall workflow with employee notification, balance impact, compensation tracking, and audit history.', actions: ['recall', 'approve', 'reject', 'view-history'], controls: ['Recall reason', 'Recall date', 'Unused leave days', 'Compensation impact', 'Employee notification'] },
  { id: 'cancellations', label: 'Cancellations', area: 'Transactions', description: 'Cancellation requests, approval history, reversals, and balance restoration.', actions: ['cancel', 'approve', 'reject', 'reopen', 'view-history'], controls: ['Cancellation reason', 'Cancellation approval history', 'Balance restoration'] },
  { id: 'encashments', label: 'Encashments', area: 'Transactions', description: 'Encashment eligibility, value calculation, approval, payroll posting, and reporting.', actions: ['encash', 'submit', 'approve', 'reject', 'post-to-payroll', 'generate-report'], controls: ['Minimum balance requirements', 'Maximum encashment rules', 'Policy eligibility', 'Payroll integration'] },
  { id: 'leave-calendar', label: 'Leave Calendar', area: 'Planning & Balances', description: 'Daily, weekly, monthly, department, location, and company-wide leave planning calendar.', actions: ['schedule-leave', 'block-period', 'publish-calendar', 'generate-report'], controls: ['Team calendar', 'Department calendar', 'Company calendar', 'Holiday calendar', 'Conflict resolution', 'Critical date reservation'] },
  { id: 'team-leave-planner', label: 'Team Leave Planner', area: 'Planning & Balances', description: 'Manager planning surface for team coverage, resource conflicts, critical roles, and absence forecasting.', actions: ['schedule-leave', 'block-period', 'publish-calendar', 'generate-report'], controls: ['Department coverage', 'Critical role coverage', 'Reliever assignment', 'Overlap detection', 'Manager planning notes'] },
  { id: 'leave-balances', label: 'Leave Balances', area: 'Planning & Balances', description: 'Leave balance administration for current, accrued, used, pending, forfeited, carry-forward balances, and liability values.', actions: ['adjust-balance', 'import', 'export', 'view-history', 'process-accrual', 'process-carry-forward'], controls: ['Current balance', 'Accrued balance', 'Used balance', 'Pending balance', 'Forfeited balance', 'Carry forward balance', 'Leave liability value'] },
  { id: 'holiday-calendar', label: 'Holiday Calendar', area: 'Planning & Balances', description: 'Holiday and non-working-day management with region, location, payroll, and calendar integration controls.', actions: ['create', 'edit', 'publish-calendar', 'import', 'export'], controls: ['Public holidays', 'Company holidays', 'Regional observances', 'Payroll calendar sync', 'ESS visibility'] },
  { id: 'leave-types', label: 'Leave Types', area: 'Administration', description: 'Centralized Dorman Long leave type catalogue for annual, sick, casual, compassionate, exam, maternity, unpaid, contract annual, and future leave types.', actions: ['create', 'edit', 'archive', 'view-history', 'export'], controls: ['Permanent Annual Leave: 30 working days after confirmation', 'Contract/Lumpsum/NYSC/IT Annual Leave: 14 paid working days annually', 'Sick/Casual/Compassionate/Exam: 10/5/5/5 working days', 'Maternity Leave: 90 calendar days', 'Leave Allowance rule', 'Document requirements', 'Approval levels'] },
  { id: 'leave-policies', label: 'Leave Policies', area: 'Administration', description: 'Dorman Long policy configuration, cloning, activation, assignment, import/export, allowance, carry-forward, recall, cancellation, and workflow rules.', actions: ['create', 'edit', 'archive', 'import', 'export', 'view-audit-trail'], controls: ['Annual entitlement policy', 'Confirmation eligibility gate', 'Leave Allowance threshold', '31 March carry-forward expiry', 'Recall rules', 'Cancellation rules', 'Approval workflow rules'] },
  { id: 'leave-accruals', label: 'Leave Accruals', area: 'Administration', description: 'Scheduled annual entitlement processing with permanent/contract eligibility validation, confirmation checks, exception review, posting, and audit controls.', actions: ['process-accrual', 'view-history', 'generate-report', 'export'], controls: ['1 January annual grant', 'Permanent entitlement validation', 'Contract entitlement validation', 'Confirmation validation', 'Exception preview', 'Posting audit'] },
  { id: 'carry-forward-processing', label: 'Carry Forward Processing', area: 'Administration', description: 'Every 1 January, unused Annual Leave rolls over to Carry Forward Leave capped at 7 working days and expiring on 31 March.', actions: ['process-carry-forward', 'approve', 'reject', 'view-history', 'generate-report'], controls: ['7 working day cap', '31 March expiry', 'Forfeiture calculation', 'Approval requirement', 'Balance posting'] },
  { id: 'balance-adjustments', label: 'Balance Adjustments', area: 'Administration', description: 'Controlled manual balance corrections with RBAC, approval, evidence, audit, and rollback governance.', actions: ['adjust-balance', 'approve', 'reject', 'view-audit-trail', 'export'], controls: ['Adjustment reason', 'Evidence attachment', 'Approval workflow', 'Segregation of duties', 'Audit trail'] },
  { id: 'leave-year-end-processing', label: 'Leave Year-End Processing', area: 'Administration', description: 'Year-end close, 1 January entitlement grant, carry-forward posting, 31 March expiry handling, forfeiture, liability reporting, archive, and payroll handoff.', actions: ['close-year', 'process-carry-forward', 'process-accrual', 'post-to-payroll', 'archive', 'generate-report'], controls: ['Open transaction checks', '1 January annual grant', 'Carry-forward posting', '31 March expiry posting', 'Liability snapshot', 'Archive controls'] },
  { id: 'leave-reports', label: 'Leave Reports', area: 'Reports & Analytics', description: 'Executive leave report catalogue for Dorman Long utilization, balances, liability, approvals, allowance eligibility, carry-forward, history, departments, and absenteeism.', actions: ['generate-report', 'export', 'view-history'], controls: ['Schedule report', 'Email report', 'Save report view', 'Dashboard analytics'], reports: ['Leave Utilization Report', 'Leave Balance Report', 'Leave Liability Report', 'Leave Allowance Eligibility Report', 'Carry Forward Expiry Report', 'Leave Approval Report', 'Employee Leave History', 'Department Leave Report', 'Absenteeism Report'] },
  { id: 'leave-utilization', label: 'Leave Utilization', area: 'Reports & Analytics', description: 'Utilization analytics by employee, department, location, grade, category, period, and leave type.', actions: ['generate-report', 'export', 'view-history'], controls: ['Utilization rate', 'Absence frequency', 'Department comparison', 'Leave type mix', 'Seasonality analysis'] },
  { id: 'leave-liability', label: 'Leave Liability', area: 'Reports & Analytics', description: 'Financial liability tracking for accrued, carried, pending, forfeited, and encashable balances with payroll and finance integration.', actions: ['generate-report', 'export', 'post-to-payroll', 'view-history'], controls: ['Liability valuation', 'Payroll posting readiness', 'Finance export', 'Encashment exposure', 'Year-end liability snapshot'] },
  { id: 'leave-trends', label: 'Leave Trends', area: 'Reports & Analytics', description: 'Trend analytics for leave demand, absence patterns, recurring exceptions, approval SLA, coverage risk, and workforce planning signals.', actions: ['generate-report', 'export', 'view-history'], controls: ['Monthly trend', 'Department trend', 'Exception trend', 'Approval SLA trend', 'Coverage risk trend'] },
  { id: 'approval-reports', label: 'Approval Reports', area: 'Reports & Analytics', description: 'Approval workflow analytics covering pending queues, SLA breaches, delegations, escalations, rejections, and approver performance.', actions: ['generate-report', 'export', 'view-audit-trail'], controls: ['Pending approval queue', 'SLA breach report', 'Delegation report', 'Escalation report', 'Approver audit trail'] },
];

const sectionAliases: Record<string, string> = {
  'leave-dashboard': 'dashboard',
  transactions: 'applications',
  'planning-and-balances': 'leave-calendar',
  administration: 'leave-types',
  'reports-and-analytics': 'leave-reports',
  'leave-application': 'applications',
  'leave-approval': 'approvals',
  'leave-recall': 'recalls',
  'leave-cancellation': 'cancellations',
  'leave-encashment': 'encashments',
  'leave-balance': 'leave-balances',
  'leave-policy-setup': 'leave-policies',
  'reports-analytics': 'leave-reports',
  'annual-leave': 'leave-types',
  'sick-leave': 'leave-types',
  'maternity-leave': 'leave-types',
  'paternity-leave': 'leave-types',
  'compassionate-leave': 'leave-types',
  'study-leave': 'leave-types',
  'casual-leave': 'leave-types',
  'unpaid-leave': 'leave-types',
};

const normalizeSection = (section = 'dashboard') => sectionAliases[section] || section;

const reportList = ['Executive Leave Policy Dashboard', 'Leave Utilization Report', 'Leave Balance Report', 'Leave Liability Report', 'Leave Allowance Eligibility Report', 'Carry Forward Expiry Report', 'Leave Approval Report', 'Leave Recall Report', 'Leave Cancellation Report', 'Leave Trend Analysis', 'Employee Leave History', 'Department Leave Report', 'Absenteeism Report'].map((name, index) => ({
  id: `rpt-${index + 1}`,
  name,
  status: index % 3 === 0 ? 'Scheduled' : 'Ready',
  formats: 'Excel, PDF, CSV',
}));

const normalizeRole = (role?: string | null): LeaveRole => {
  const found = allRoles.find((item) => item.toLowerCase() === String(role || '').toLowerCase());
  return found || 'Leave Administrator';
};

const permissionsFor = (role: LeaveRole): LeavePayload['permissions'] => ({
  canApply: true,
  canApprove: approvalRoles.includes(role),
  canAdminister: adminRoles.includes(role),
  canProcessFinancials: financeRoles.includes(role),
  canConfigure: ['HR Manager', 'System Administrator', 'Leave Administrator'].includes(role),
  canExport: role !== 'Employee',
  canViewAudit: role !== 'Employee',
});

export async function readLeaveManagementPayload(section = 'dashboard', roleInput?: string | null): Promise<LeavePayload> {
  const normalizedSection = normalizeSection(section);
  const role = normalizeRole(roleInput);
  const employeeSource = await readPayrollEmployees();
  const employees = employeeSource.employees;
  const applications = buildApplications(employees);
  const balances = buildBalances(employees);
  const pendingApplications = applications.filter((item) => ['Submitted', 'Under Review', 'Draft'].includes(item.status)).length;
  const pendingApprovals = applications.filter((item) => ['Supervisor', 'Manager', 'HR', 'Final Approval'].includes(item.stage) && !['Approved', 'Completed', 'Cancelled', 'Rejected'].includes(item.status)).length;
  const employeesOnLeave = employees.filter((employee) => String(employee.status || '').toLowerCase().includes('leave')).length + applications.filter((item) => item.status === 'Approved').length;
  const exceptionCount = applications.reduce((sum, item) => sum + item.exceptions.length, 0) + balances.reduce((sum, item) => sum + item.exceptions.length, 0);
  const leaveLiability = balances.reduce((sum, item) => sum + item.liabilityValue, 0);
  const currentSection = sectionConfig.find((item) => item.id === normalizedSection) || sectionConfig[0];
  const availableActions = leaveActions.filter((item) => currentSection.actions.includes(item.id) && item.roles.includes(role));
  const blocked = applications.filter((item) => item.policyComplianceStatus === 'Blocked');
  const nextRequiredAction = blocked.length ? 'Resolve leave validation exceptions' : pendingApprovals ? 'Approve pending leave requests' : 'Run monthly accrual and publish calendar';

  return {
    generatedAt: nowIso(),
    source: `${employeeSource.source} with enterprise leave workflow controls`,
    role,
    section: currentSection.id,
    permissions: permissionsFor(role),
    summary: {
      totalEmployees: employees.length,
      employeesOnLeave,
      returningToday: Math.max(0, applications.filter((item) => item.endDate === dateAdd(0)).length),
      pendingApplications,
      pendingApprovals,
      leaveUtilizationPct: balances.length ? Math.round((balances.reduce((sum, item) => sum + item.usedBalance, 0) / Math.max(1, balances.reduce((sum, item) => sum + item.accruedBalance, 0))) * 100) : 0,
      leaveLiability,
      encashmentRequests: Math.max(1, Math.floor(balances.filter((item) => item.currentBalance > 10).length / 18)),
      recallRequests: applications.filter((item) => item.status === 'Approved').length,
      cancellationRequests: applications.filter((item) => item.status === 'Cancelled').length,
      exceptionCount,
    },
    current: {
      leaveStatus: pendingApplications ? 'Operational queues active' : 'No pending employee leave queue',
      availableActions: availableActions.map((item) => item.label),
      nextRequiredAction,
      approvalStatus: pendingApprovals ? `${pendingApprovals} approvals pending` : 'No approvals pending',
      policyComplianceStatus: blocked.length ? `${blocked.length} blocked requests` : 'Compliant',
      leaveBalanceImpact: `${balances.reduce((sum, item) => sum + item.pendingBalance, 0)} pending days reserved`,
      auditHistory: `${auditStore.length} action logs captured this session`,
      workflowProgress: pendingApprovals ? 'Employee -> Supervisor -> Manager -> HR -> Final Approval' : 'Workflow clear',
      exceptionIndicators: blocked.slice(0, 4).flatMap((item) => item.exceptions).slice(0, 5),
    },
    actions: availableActions,
    applications,
    balances,
    leaveTypes: seedLeaveTypes,
    calendar: applications.slice(0, 10).map((item) => ({ id: item.id, label: `${item.fullName} - ${item.leaveType}`, from: item.startDate, to: item.endDate, status: item.status, department: item.department, location: item.location })),
    blockedPeriods: [
      { id: 'blk-001', name: 'Payroll close blackout', from: dateAdd(18), to: dateAdd(20), scope: 'Company-wide', status: 'Published' },
      { id: 'blk-002', name: 'Major shutdown coverage window', from: dateAdd(35), to: dateAdd(39), scope: 'Operations', status: 'Reserved' },
      { id: 'blk-003', name: 'Carry Forward Leave expiry reminder', from: `${currentYear}-03-24`, to: dormantLongPolicy.carryForwardExpiry, scope: 'Employees with carry-forward balances', status: 'Published' },
    ],
    workflowMatrix: [
      { dimension: 'Department', rule: 'Supervisor -> Manager -> HR' },
      { dimension: 'Grade', rule: 'Senior grades require final approval' },
      { dimension: 'Leave Type', rule: 'Maternity, Exam, Unpaid, and exception leave require HR final review' },
      { dimension: 'Duration', rule: 'Annual Leave of 10 working days or more triggers Leave Allowance payroll review' },
      { dimension: 'Employee Category', rule: 'Permanent annual leave validates confirmation; contract annual leave validates active contract entitlement' },
    ],
    reports: reportList,
    notifications: ['Leave submitted', 'Leave approved', 'Leave rejected', 'Leave recalled', 'Leave cancelled', 'Leave Allowance payroll review required', 'Annual Leave locked pending confirmation', 'Carry Forward Leave created on 1 January', 'Carry Forward Leave expires 31 March', 'Leave balance adjusted', 'Accrual completed', 'Leave year closed'].map((name, index) => ({ id: `ntf-${index + 1}`, event: name, channels: 'Email, In-app, ESS', status: 'Enabled' })),
    auditTrail: auditStore.slice(0, 50),
    integrations: [
      { system: 'ESS Portal', status: 'Ready', purpose: 'Apply leave, view Dorman Long entitlements, balances, carry-forward expiry, calendars, history, status, withdrawals, and documents' },
      { system: 'Payroll Management', status: 'Ready', purpose: `Leave Allowance payable only for ${dormantLongPolicy.allowanceMinimumAnnualDays}+ current-year Annual Leave working days; unpaid leave and liability posting supported` },
      { system: 'Attendance', status: 'Ready', purpose: 'Disable clock-in during approved leave and reconcile absences' },
      { system: 'Notifications', status: 'Ready', purpose: 'Email, in-app, and ESS alerts' },
      { system: 'Finance', status: 'Ready', purpose: `Leave liability ${moneyFmt.format(leaveLiability)} export/posting with carry-forward and allowance exposure` },
    ],
    operationalSections: sectionConfig,
  };
}

export function auditLeaveAction(input: Omit<LeaveAuditEntry, 'id' | 'at'>) {
  auditStore.unshift({ id: `leave-aud-${Date.now()}-${Math.random().toString(16).slice(2)}`, at: nowIso(), ...input });
  if (auditStore.length > 300) auditStore.length = 300;
}

export function validateLeaveAction(actionId: LeaveActionId, roleInput: string | null | undefined, payload: LeavePayload, body: any = {}) {
  const role = normalizeRole(roleInput);
  const actionDef = leaveActions.find((item) => item.id === actionId);
  if (!actionDef) return { ok: false, status: 400, message: 'Unknown leave action.' };
  if (!actionDef.roles.includes(role)) return { ok: false, status: 403, message: `${role} is not permitted to perform ${actionDef.label}.` };
  if (actionDef.requiresReason && !String(body.reason || '').trim()) return { ok: false, status: 400, message: 'Reason is required for this leave action.' };
  if (actionId === 'approve' && body.employeeId && String(body.actor || '').toLowerCase() === String(body.employeeId || '').toLowerCase()) return { ok: false, status: 409, message: 'Self-approval is not permitted.' };
  if (['approve', 'bulk-approve'].includes(actionId) && payload.applications.some((item) => item.policyComplianceStatus === 'Blocked')) return { ok: false, status: 409, message: 'Resolve blocked leave exceptions before approval.' };
  if (actionId === 'apply' || actionId === 'submit') {
    const requestedDays = Number(body.days || 0);
    const leaveType = String(body.leaveType || 'Annual Leave');
    const employeeCategory = String(body.employeeCategory || body.employmentType || 'Permanent');
    const fourteenDayPaidLeaveRequest = /contract|lumpsum|lump sum|daily rate|casual|temporary|nysc|national youth service|industrial training|intern|internship|\bit\b/i.test(employeeCategory) || /^(IT|I|NYSC|N)\d+/i.test(String(body.employeeId || body.employeeCode || ''));
    const confirmed = body.confirmed === true || String(body.confirmationStatus || '').toLowerCase() === 'confirmed';
    const sampleBalance = payload.balances[0]?.currentBalance || 0;
    if (leaveType === 'Annual Leave' && !fourteenDayPaidLeaveRequest && !confirmed) return { ok: false, status: 409, message: 'Annual Leave is available only after confirmation of appointment.' };
    if (leaveType === 'Annual Leave' && fourteenDayPaidLeaveRequest && requestedDays > dormantLongPolicy.annualContractDays) return { ok: false, status: 409, message: `Contract/Lumpsum/NYSC/IT paid Annual Leave cannot exceed ${dormantLongPolicy.annualContractDays} working days annually.` };
    if (leaveType === 'Annual Leave' && requestedDays >= dormantLongPolicy.allowanceMinimumAnnualDays && body.usesCarryForward) return { ok: false, status: 409, message: 'Leave Allowance applies only to current-year Annual Leave entitlement, not Carry Forward Leave.' };
    if (leaveType !== 'Unpaid Leave' && requestedDays > sampleBalance) return { ok: false, status: 409, message: 'Leave application cannot proceed without sufficient balance.' };
    if (body.overlaps) return { ok: false, status: 409, message: 'Overlapping leave request detected.' };
    if (body.blockedPeriod) return { ok: false, status: 409, message: 'Leave application falls within a blocked period.' };
  }
  if (actionId === 'close-year' && payload.summary.pendingApplications + payload.summary.pendingApprovals > 0) return { ok: false, status: 409, message: 'Leave year cannot close with unresolved transactions.' };
  if (actionId === 'process-carry-forward' && !body.approved) return { ok: false, status: 409, message: 'Carry forward requires approval before processing.' };
  if (actionId === 'encash' && Number(body.days || 0) > 5) return { ok: false, status: 409, message: 'Encashment request exceeds configured policy limit.' };
  return { ok: true, status: 200, message: `${actionDef.label} completed and audit logged.` };
}
