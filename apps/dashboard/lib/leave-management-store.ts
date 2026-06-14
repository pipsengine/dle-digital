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
  operationalSections: Array<{ id: string; label: string; description: string; actions: LeaveActionId[]; controls: string[]; reports?: string[] }>;
};

const nowIso = () => new Date().toISOString();
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

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

const seedLeaveTypes: LeaveTypeRule[] = [
  { id: 'annual-leave', name: 'Annual Leave', active: true, entitlementDays: 21, eligibility: 'Active employees after confirmation or category eligibility.', waitingPeriodDays: 90, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Lumpsum'], genderRestriction: 'None', documentRequirements: [], approvalLevels: ['Supervisor', 'Manager', 'HR'], accrualRule: 'Monthly pro-rata accrual', carryForwardRule: 'Maximum 5 days, expires after 90 days', encashmentRule: 'Eligible above minimum retained balance' },
  { id: 'sick-leave', name: 'Sick Leave', active: true, entitlementDays: 10, eligibility: 'Active employees with medical evidence where required.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Lumpsum', 'Daily Rate'], genderRestriction: 'None', documentRequirements: ['Medical certificate'], approvalLevels: ['Supervisor', 'HR'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable' },
  { id: 'maternity-leave', name: 'Maternity Leave', active: true, entitlementDays: 84, eligibility: 'Eligible female employees by policy.', waitingPeriodDays: 180, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'Female', documentRequirements: ['Medical certificate', 'Expected delivery date'], approvalLevels: ['Manager', 'HR', 'Final Approval'], accrualRule: 'Policy grant', carryForwardRule: 'Not applicable', encashmentRule: 'Not encashable' },
  { id: 'paternity-leave', name: 'Paternity Leave', active: true, entitlementDays: 5, eligibility: 'Eligible male employees by policy.', waitingPeriodDays: 180, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'Male', documentRequirements: ['Birth notification'], approvalLevels: ['Manager', 'HR'], accrualRule: 'Policy grant', carryForwardRule: 'Not applicable', encashmentRule: 'Not encashable' },
  { id: 'compassionate-leave', name: 'Compassionate Leave', active: true, entitlementDays: 5, eligibility: 'Active employees with HR-approved reason.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Lumpsum', 'Daily Rate'], genderRestriction: 'None', documentRequirements: ['Supporting document'], approvalLevels: ['Supervisor', 'HR'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable' },
  { id: 'study-leave', name: 'Study Leave', active: true, entitlementDays: 10, eligibility: 'Approved learning plan and manager endorsement.', waitingPeriodDays: 180, gradeRestrictions: [], categoryRestrictions: ['Permanent'], genderRestriction: 'None', documentRequirements: ['Admission/exam evidence'], approvalLevels: ['Manager', 'HR', 'Final Approval'], accrualRule: 'Policy grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable' },
  { id: 'casual-leave', name: 'Casual Leave', active: true, entitlementDays: 3, eligibility: 'Active employees subject to manager approval.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Lumpsum'], genderRestriction: 'None', documentRequirements: [], approvalLevels: ['Supervisor'], accrualRule: 'Annual grant', carryForwardRule: 'No carry forward', encashmentRule: 'Not encashable' },
  { id: 'unpaid-leave', name: 'Unpaid Leave', active: true, entitlementDays: 0, eligibility: 'HR-approved exception with payroll impact.', waitingPeriodDays: 0, gradeRestrictions: [], categoryRestrictions: ['Permanent', 'Lumpsum', 'Daily Rate'], genderRestriction: 'None', documentRequirements: ['Reason evidence'], approvalLevels: ['Manager', 'HR', 'Payroll'], accrualRule: 'No accrual', carryForwardRule: 'Not applicable', encashmentRule: 'Not encashable' },
];

const hashNum = (value: string) => value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
const activeStatus = (status: string) => ['active', 'confirmed', 'probation', 'on leave', 'contract active', 'reactivated'].includes(String(status || '').toLowerCase());

const balanceFor = (employee: DleEmployeeDirectoryRow, leaveType = 'Annual Leave') => {
  const base = leaveType === 'Annual Leave' ? 21 : leaveType === 'Sick Leave' ? 10 : leaveType === 'Compassionate Leave' ? 5 : leaveType === 'Casual Leave' ? 3 : 0;
  const used = Math.min(base, hashNum(employee.employeeId) % Math.max(base || 1, 1));
  const pending = hashNum(employee.fullName) % 4;
  const carry = leaveType === 'Annual Leave' ? hashNum(employee.department || '') % 5 : 0;
  return {
    current: Math.max(0, base + carry - used - pending),
    accrued: base + carry,
    used,
    pending,
    forfeited: leaveType === 'Annual Leave' ? hashNum(employee.employeeCode || employee.employeeId) % 2 : 0,
    carry,
  };
};

const buildApplications = (employees: DleEmployeeDirectoryRow[]): LeaveApplicationRecord[] => {
  const sample = employees.filter((employee) => activeStatus(employee.status)).slice(0, 18);
  const statuses: LeaveStatus[] = ['Submitted', 'Under Review', 'Approved', 'Draft', 'Cancelled', 'Completed'];
  return sample.map((employee, index) => {
    const type = seedLeaveTypes[index % seedLeaveTypes.length].name;
    const balance = balanceFor(employee, type);
    const days = 1 + (hashNum(employee.employeeId) % 7);
    const status = statuses[index % statuses.length];
    const exceptions = [
      ...(days > balance.current && type !== 'Unpaid Leave' ? ['Insufficient leave balance'] : []),
      ...(index % 9 === 0 ? ['Acting officer not assigned'] : []),
      ...(index % 11 === 0 ? ['Overlapping leave detected'] : []),
      ...(index % 13 === 0 ? ['Requested date touches blocked period'] : []),
    ];
    const blocked = exceptions.some((item) => item.includes('Insufficient') || item.includes('Overlapping') || item.includes('blocked'));
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
      actingOfficer: index % 9 === 0 ? 'Not assigned' : sample[(index + 1) % sample.length]?.fullName || 'Assigned',
      supportingDocuments: index % 3,
      exceptions,
      auditCount: 2 + (index % 5),
    };
  });
};

const buildBalances = (employees: DleEmployeeDirectoryRow[]) => employees.slice(0, 120).map((employee) => {
  const leaveType = 'Annual Leave';
  const balance = balanceFor(employee, leaveType);
  const exceptions = [
    ...(balance.current < 3 ? ['Low leave balance'] : []),
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
  { id: 'leave-dashboard', label: 'Leave Dashboard', description: 'Operational leave command center with status, approvals, liability, exceptions, calendars, and action queues.', actions: ['apply', 'view-history', 'process-accrual', 'process-carry-forward', 'generate-report', 'view-audit-trail'], controls: ['Current leave status', 'Available actions', 'Next required action', 'Approval status', 'Policy compliance status', 'Leave balance impact', 'Audit history', 'Workflow progress', 'Exception indicators'] },
  { id: 'leave-application', label: 'Leave Application', description: 'Workflow-driven leave application, drafts, document upload readiness, validation, status tracking, printing, and history.', actions: ['apply', 'save-draft', 'submit', 'edit', 'withdraw', 'cancel', 'view-history'], controls: ['Leave balance verification', 'Eligibility verification', 'Leave conflict detection', 'Public holiday validation', 'Overlapping leave detection', 'Reporting manager validation', 'Acting officer validation'] },
  { id: 'leave-approval', label: 'Leave Approval', description: 'Multi-level supervisor, manager, HR, and final approval queue with comments, delegation, escalation, and bulk decisions.', actions: ['approve', 'reject', 'request-clarification', 'escalate', 'delegate', 'reassign', 'bulk-approve', 'bulk-reject', 'view-history'], controls: ['Department matrix', 'Grade matrix', 'Leave type matrix', 'Duration matrix', 'Employee category matrix'] },
  { id: 'leave-calendar', label: 'Leave Calendar', description: 'Daily, weekly, monthly, department, location, and company-wide leave planning calendar.', actions: ['schedule-leave', 'block-period', 'publish-calendar', 'generate-report'], controls: ['Team calendar', 'Department calendar', 'Company calendar', 'Holiday calendar', 'Conflict resolution', 'Critical date reservation'] },
  { id: 'leave-balance', label: 'Leave Balance', description: 'Leave balance administration for current, accrued, used, pending, forfeited, and carry-forward balances.', actions: ['adjust-balance', 'import', 'export', 'view-history', 'process-accrual', 'process-carry-forward'], controls: ['Current balance', 'Accrued balance', 'Used balance', 'Pending balance', 'Forfeited balance', 'Carry forward balance'] },
  ...seedLeaveTypes.map((type) => ({ id: type.id, label: type.name, description: `${type.name} entitlement, eligibility, workflow, documents, accrual, carry-forward, and approval rules.`, actions: ['create', 'edit', 'archive', 'view-history', 'export'] as LeaveActionId[], controls: ['Entitlement limits', 'Eligibility rules', 'Waiting periods', 'Grade restrictions', 'Employee category restrictions', 'Gender restrictions', 'Document requirements', 'Approval levels'] })),
  { id: 'leave-recall', label: 'Leave Recall', description: 'Manager-to-HR leave recall workflow with employee notification, balance impact, and compensation tracking.', actions: ['recall', 'approve', 'reject', 'view-history'], controls: ['Recall reason', 'Recall date', 'Unused leave days', 'Compensation impact', 'Employee notification'] },
  { id: 'leave-cancellation', label: 'Leave Cancellation', description: 'Cancellation requests, approval history, reversals, and balance restoration.', actions: ['cancel', 'approve', 'reject', 'reopen', 'view-history'], controls: ['Cancellation reason', 'Cancellation approval history', 'Balance restoration'] },
  { id: 'leave-encashment', label: 'Leave Encashment', description: 'Encashment eligibility, value calculation, approval, payroll posting, and reporting.', actions: ['encash', 'submit', 'approve', 'reject', 'post-to-payroll', 'generate-report'], controls: ['Minimum balance requirements', 'Maximum encashment rules', 'Policy eligibility', 'Payroll integration'] },
  { id: 'leave-policy-setup', label: 'Leave Policy Setup', description: 'Policy creation, cloning, activation, assignment, import/export, accrual, carry-forward, encashment, recall, cancellation, and workflow rules.', actions: ['create', 'edit', 'archive', 'import', 'export', 'view-audit-trail'], controls: ['Leave entitlement', 'Accrual frequency', 'Carry forward rules', 'Expiry rules', 'Encashment rules', 'Recall rules', 'Cancellation rules', 'Approval workflow rules'] },
  { id: 'leave-reports', label: 'Leave Reports', description: 'Utilization, balances, liability, approvals, recall, cancellation, encashment, trends, history, departments, and absenteeism.', actions: ['generate-report', 'export', 'view-history'], controls: ['Schedule report', 'Email report', 'Save report view'], reports: ['Leave Utilization Report', 'Leave Balance Report', 'Leave Liability Report', 'Leave Approval Report', 'Leave Recall Report', 'Leave Cancellation Report', 'Leave Encashment Report', 'Leave Trend Analysis', 'Employee Leave History', 'Department Leave Report', 'Absenteeism Report'] },
];

const reportList = ['Leave Utilization Report', 'Leave Balance Report', 'Leave Liability Report', 'Leave Approval Report', 'Leave Recall Report', 'Leave Cancellation Report', 'Leave Encashment Report', 'Leave Trend Analysis', 'Employee Leave History', 'Department Leave Report', 'Absenteeism Report'].map((name, index) => ({
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

export async function readLeaveManagementPayload(section = 'leave-dashboard', roleInput?: string | null): Promise<LeavePayload> {
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
  const currentSection = sectionConfig.find((item) => item.id === section) || sectionConfig[0];
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
    ],
    workflowMatrix: [
      { dimension: 'Department', rule: 'Supervisor -> Manager -> HR' },
      { dimension: 'Grade', rule: 'Senior grades require final approval' },
      { dimension: 'Leave Type', rule: 'Maternity, Study, Unpaid require HR final review' },
      { dimension: 'Duration', rule: 'More than 10 days escalates to HR Manager' },
      { dimension: 'Employee Category', rule: 'Daily Rate leave validates payroll impact' },
    ],
    reports: reportList,
    notifications: ['Leave submitted', 'Leave approved', 'Leave rejected', 'Leave recalled', 'Leave cancelled', 'Leave encashed', 'Leave balance adjusted', 'Accrual completed', 'Carry forward completed', 'Leave year closed'].map((name, index) => ({ id: `ntf-${index + 1}`, event: name, channels: 'Email, In-app, ESS', status: 'Enabled' })),
    auditTrail: auditStore.slice(0, 50),
    integrations: [
      { system: 'ESS Portal', status: 'Ready', purpose: 'Apply leave, balances, calendar, history, status, withdrawals, documents, encashment status' },
      { system: 'Payroll Management', status: 'Ready', purpose: 'Unpaid leave, encashment earnings, liability posting, payroll calendar validation' },
      { system: 'Attendance', status: 'Ready', purpose: 'Disable clock-in during approved leave and reconcile absences' },
      { system: 'Notifications', status: 'Ready', purpose: 'Email, in-app, and ESS alerts' },
      { system: 'Finance', status: 'Ready', purpose: `Leave liability ${moneyFmt.format(leaveLiability)} export/posting` },
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
    const sampleBalance = payload.balances[0]?.currentBalance || 0;
    if (leaveType !== 'Unpaid Leave' && requestedDays > sampleBalance) return { ok: false, status: 409, message: 'Leave application cannot proceed without sufficient balance.' };
    if (body.overlaps) return { ok: false, status: 409, message: 'Overlapping leave request detected.' };
    if (body.blockedPeriod) return { ok: false, status: 409, message: 'Leave application falls within a blocked period.' };
  }
  if (actionId === 'close-year' && payload.summary.pendingApplications + payload.summary.pendingApprovals > 0) return { ok: false, status: 409, message: 'Leave year cannot close with unresolved transactions.' };
  if (actionId === 'process-carry-forward' && !body.approved) return { ok: false, status: 409, message: 'Carry forward requires approval before processing.' };
  if (actionId === 'encash' && Number(body.days || 0) > 5) return { ok: false, status: 409, message: 'Encashment request exceeds configured policy limit.' };
  return { ok: true, status: 200, message: `${actionDef.label} completed and audit logged.` };
}
