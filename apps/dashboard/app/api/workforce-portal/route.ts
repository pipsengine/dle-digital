import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { activeLoansVersion, readPayrollLoanApplications, readPayrollLoansConfig } from '@/lib/payroll-loans-engine';

type EssRequest = {
  id: string;
  employeeId: string;
  category: string;
  title: string;
  status: 'Draft' | 'Submitted' | 'Line Manager Review' | 'HR Review' | 'Finance Review' | 'Approved' | 'Rejected' | 'Closed';
  priority: 'Low' | 'Normal' | 'High';
  submittedAt: string;
  updatedAt: string;
  approvers: string[];
  comments: Array<{ at: string; actor: string; comment: string }>;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const compact = (value: unknown) => String(value || '').trim();
const round = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const REQUESTS_PATH = path.join(resolveDashboardRoot(), 'data', 'hris', 'ess-requests.json');

const readRequests = async (): Promise<EssRequest[]> => {
  try {
    const parsed = JSON.parse(await readFile(REQUESTS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRequests = async (requests: EssRequest[]) => {
  await mkdir(path.dirname(REQUESTS_PATH), { recursive: true });
  await writeFile(REQUESTS_PATH, JSON.stringify(requests, null, 2), 'utf8');
};

const serviceCatalog = [
  { id: 'profile-update', label: 'Profile Update', area: 'Profile', workflow: ['Employee', 'HR Operations', 'HR Manager'], slaHours: 24 },
  { id: 'leave', label: 'Leave Application', area: 'Leave', workflow: ['Employee', 'Line Manager', 'HR'], slaHours: 16 },
  { id: 'attendance-regularization', label: 'Attendance Regularization', area: 'Time', workflow: ['Employee', 'Supervisor', 'Time Office'], slaHours: 12 },
  { id: 'payslip', label: 'Payslip / Payroll Query', area: 'Payroll', workflow: ['Employee', 'Payroll Officer'], slaHours: 24 },
  { id: 'claim', label: 'Claim & Reimbursement', area: 'Claims', workflow: ['Employee', 'Line Manager', 'Finance'], slaHours: 48 },
  { id: 'loan', label: 'Loan / Salary Advance', area: 'Loan', workflow: ['Employee', 'Line Manager', 'HR', 'Finance'], slaHours: 72 },
  { id: 'travel', label: 'Travel Request', area: 'Travel', workflow: ['Employee', 'Line Manager', 'Admin', 'Finance'], slaHours: 48 },
  { id: 'asset', label: 'Asset / PPE Request', area: 'Assets', workflow: ['Employee', 'Line Manager', 'Stores / IT'], slaHours: 36 },
  { id: 'letter', label: 'Employment Letter', area: 'Documents', workflow: ['Employee', 'HR Operations'], slaHours: 24 },
  { id: 'exit', label: 'Exit & Separation', area: 'Exit', workflow: ['Employee', 'Line Manager', 'HR', 'Finance', 'IT'], slaHours: 120 },
];

const resolveEssEmployeeId = () => compact(process.env.ESS_EMPLOYEE_ID) || 'P0146';
const resolveEssEmployee = (employees: Awaited<ReturnType<typeof readPayrollEmployees>>['employees']) => {
  const viewerEmployeeId = resolveEssEmployeeId();
  return employees.find((item) => item.employeeId === viewerEmployeeId || item.employeeCode === viewerEmployeeId) || employees[0];
};

const moduleCatalog = [
  'Dashboard',
  'Profile Management',
  'Leave Management',
  'Attendance & Time',
  'Payroll Self-Service',
  'Document Management',
  'Performance',
  'Learning',
  'Claims',
  'Loan Management',
  'Requests & Services',
  'Travel',
  'Assets',
  'Directory',
  'Communication',
  'Workflow Tracking',
  'Exit Services',
];

const sampleDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const dateAdd = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export async function GET(request: Request) {
  try {
    const locale = compact(request.headers.get('x-ess-locale')) || 'en-NG';
    const [employeeSource, allRequests, loanApplications, loansConfig] = await Promise.all([readPayrollEmployees(), readRequests(), readPayrollLoanApplications(), readPayrollLoansConfig()]);
    const employee = resolveEssEmployee(employeeSource.employees);
    if (!employee) return err(404, 'No employee record is available for the ESS portal.');

    const employeeRequests = allRequests.filter((item) => item.employeeId === employee.employeeId);
    const employeeLoans = loanApplications.filter((item) => item.employeeId === employee.employeeId);
    const loansVersion = activeLoansVersion(loansConfig);
    const annualSalary = Number(employee.annualSalary || (employee.periodSalary ? Number(employee.periodSalary) * 12 : 0));
    const monthlyPay = Number(employee.periodSalary || (annualSalary ? annualSalary / 12 : 0));
    const leaveUsed = employee.employeeId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9;
    const attendanceRate = round(92 + (employee.employeeDbId % 70) / 10);

    const seededRequests: EssRequest[] = [
      {
        id: 'seed-leave-001',
        employeeId: employee.employeeId,
        category: 'Leave',
        title: 'Annual leave request',
        status: 'Line Manager Review',
        priority: 'Normal',
        submittedAt: dateAdd(-3),
        updatedAt: dateAdd(-1),
        approvers: ['Line Manager', 'HR Operations'],
        comments: [{ at: dateAdd(-2), actor: 'System', comment: 'Request routed to line manager.' }],
      },
      {
        id: 'seed-document-001',
        employeeId: employee.employeeId,
        category: 'Documents',
        title: 'Employment confirmation letter',
        status: 'Approved',
        priority: 'Low',
        submittedAt: dateAdd(-12),
        updatedAt: dateAdd(-9),
        approvers: ['HR Operations'],
        comments: [{ at: dateAdd(-9), actor: 'HR Operations', comment: 'Document is available in employee documents.' }],
      },
    ];

    const requests = employeeRequests.length ? employeeRequests : seededRequests;

    const employmentText = `${employee.employmentType || ''} ${employee.employeeCategory || ''} ${employee.staffCategory || ''}`.toLowerCase();
    const contractEmployee = /contract|lumpsum|daily rate/.test(employmentText);
    const confirmedPermanent = String(employee.status || '').toLowerCase().includes('confirmed') || (employee.confirmationDueDate ? new Date(`${employee.confirmationDueDate}T00:00:00.000Z`).getTime() <= Date.now() : false);
    const leaveYear = new Date().getFullYear();
    const annualEntitlement = contractEmployee ? 14 : confirmedPermanent ? 30 : 0;
    const carryForward = Math.min(7, employee.employeeDbId % 8);
    const sickUsed = employee.employeeDbId % 3;
    const casualUsed = employee.employeeDbId % 2;
    const compassionateUsed = employee.employeeDbId % 2;
    const examUsed = employee.employeeDbId % 2;
    const maternityEligible = !contractEmployee && /female/i.test(String((employee as any).gender || (employee as any).title || ''));
    const leavePolicyCards = [
      { id: 'annual-leave', type: 'Annual Leave', entitlement: annualEntitlement, basis: 'Working days', used: leaveUsed, pending: 0, balance: Math.max(0, annualEntitlement - leaveUsed), expiryDate: '', eligibilityStatus: contractEmployee ? 'Eligible - contract annual entitlement' : confirmedPermanent ? 'Eligible - confirmed permanent employee' : 'Locked pending confirmation', allowanceStatus: 'Eligible only from 10 current-year Annual Leave working days', policyNote: contractEmployee ? 'Contract employees receive 14 working days annually.' : 'Permanent employees receive 30 working days after confirmation.' },
      { id: 'sick-leave', type: 'Sick Leave', entitlement: contractEmployee ? 0 : 10, basis: 'Working days', used: sickUsed, pending: 0, balance: Math.max(0, (contractEmployee ? 0 : 10) - sickUsed), expiryDate: '', eligibilityStatus: contractEmployee ? 'Not configured for contract employees' : 'Eligible', allowanceStatus: 'No leave allowance', policyNote: 'Medical certificate may be required.' },
      { id: 'casual-leave', type: 'Casual Leave', entitlement: contractEmployee ? 0 : 5, basis: 'Working days', used: casualUsed, pending: 0, balance: Math.max(0, (contractEmployee ? 0 : 5) - casualUsed), expiryDate: '', eligibilityStatus: contractEmployee ? 'Not configured for contract employees' : 'Eligible', allowanceStatus: 'No leave allowance', policyNote: 'Short-duration absence subject to manager approval.' },
      { id: 'compassionate-leave', type: 'Compassionate Leave', entitlement: contractEmployee ? 0 : 5, basis: 'Working days', used: compassionateUsed, pending: 0, balance: Math.max(0, (contractEmployee ? 0 : 5) - compassionateUsed), expiryDate: '', eligibilityStatus: contractEmployee ? 'Not configured for contract employees' : 'Eligible', allowanceStatus: 'No leave allowance', policyNote: 'Supporting document required where applicable.' },
      { id: 'exam-leave', type: 'Exam Leave', entitlement: contractEmployee ? 0 : 5, basis: 'Working days', used: examUsed, pending: 0, balance: Math.max(0, (contractEmployee ? 0 : 5) - examUsed), expiryDate: '', eligibilityStatus: contractEmployee ? 'Not configured for contract employees' : 'Eligible', allowanceStatus: 'No leave allowance', policyNote: 'Exam timetable or institution evidence required.' },
      { id: 'maternity-leave', type: 'Maternity Leave', entitlement: maternityEligible ? 90 : 0, basis: 'Calendar days', used: 0, pending: 0, balance: maternityEligible ? 90 : 0, expiryDate: '', eligibilityStatus: maternityEligible ? 'Eligible' : 'Gender/category eligibility not met', allowanceStatus: 'No leave allowance', policyNote: '90 calendar days for eligible female employees.' },
      { id: 'carry-forward-leave', type: 'Carry Forward Leave', entitlement: carryForward, basis: 'Working days', used: Math.min(carryForward, employee.employeeDbId % 3), pending: 0, balance: Math.max(0, carryForward - Math.min(carryForward, employee.employeeDbId % 3)), expiryDate: `${leaveYear}-03-31`, eligibilityStatus: carryForward ? 'Available until 31 March' : 'No carry-forward balance', allowanceStatus: 'Does not trigger leave allowance', policyNote: 'Unused Annual Leave rolls over on 1 January up to 7 working days.' },
    ];
    const allowanceEligible = annualEntitlement - leaveUsed >= 10;
    const leaveWorkflow = [
      { stage: 'Employee', owner: employee.fullName, status: 'Submitted', sla: 'Immediate' },
      { stage: 'Supervisor/Line Manager', owner: employee.managerName || 'Line Manager', status: 'Pending', sla: '2 business days' },
      { stage: 'Department Manager / GM', owner: 'Department approver', status: 'Not started', sla: '2 business days' },
      { stage: 'HR', owner: 'HR Officer', status: 'Not started', sla: '1 business day' },
      { stage: 'Payroll', owner: 'Payroll Officer', status: allowanceEligible ? 'Conditional' : 'Skipped unless allowance/unpaid leave applies', sla: '1 payroll cycle' },
      { stage: 'Completed', owner: 'System', status: 'Not started', sla: 'After all approvals' },
    ];

    return ok({
      generatedAt: new Date().toISOString(),
      locale,
      security: {
        rbacRole: 'Employee',
        mfa: 'Enabled',
        sso: 'Microsoft Entra ID',
        session: 'Active',
        encryption: 'TLS 1.3 / AES-256 at rest',
        activityLogging: 'Enabled',
      },
      employee: {
        employeeId: employee.employeeId,
        employeeCode: employee.employeeCode || employee.employeeId,
        fullName: employee.fullName,
        jobTitle: employee.jobTitle || employee.designation || 'Employee',
        department: employee.department,
        businessUnit: employee.businessUnit,
        location: employee.location || employee.workLocation,
        manager: employee.hasManagerAssigned ? 'Assigned manager' : 'Manager assignment pending',
        email: employee.officialEmail || employee.email || employee.personalEmail || `${employee.employeeId.toLowerCase()}@dormanlongeng.com`,
        phone: employee.primaryPhone || employee.phone,
        photoUrl: '/brand/dorman-long-logo.jpg',
        yearsOfService: round(Number(employee.yearsOfService || 0)),
        payrollGroup: employee.payrollGroup || 'Monthly Payroll',
        salaryGrade: employee.salaryGrade || employee.jobGrade || 'Unassigned',
      },
      widgets: {
        leave: { entitlement: annualEntitlement, used: leaveUsed, balance: Math.max(0, annualEntitlement - leaveUsed), pending: requests.filter((item) => item.category === 'Leave' && !['Approved', 'Rejected', 'Closed'].includes(item.status)).length },
        attendance: { monthRate: attendanceRate, lateArrivals: employee.employeeDbId % 3, overtimeHours: (employee.employeeDbId % 6) * 2, remoteDays: employee.remoteWorker ? 4 : 0 },
        payroll: { monthlyPay, currency: employee.payCurrency || 'NGN', payslips: 12, deductions: Math.round(monthlyPay * 0.18), pension: Math.round(monthlyPay * 0.08), allowances: Math.round(monthlyPay * 0.22) },
        requests: { pending: requests.filter((item) => !['Approved', 'Rejected', 'Closed'].includes(item.status)).length, approved: requests.filter((item) => item.status === 'Approved').length, total: requests.length },
        loans: { applications: employeeLoans.length, outstanding: employeeLoans.reduce((sum, item) => sum + Number(item.outstandingBalance || 0), 0) },
      },
      announcements: [
        { id: 'ann-001', title: 'June payroll window is open', channel: 'Payroll', publishedAt: dateAdd(-1), priority: 'High' },
        { id: 'ann-002', title: 'Updated HSE handbook published', channel: 'Policy', publishedAt: dateAdd(-5), priority: 'Normal' },
        { id: 'ann-003', title: 'Q3 learning calendar available', channel: 'Learning', publishedAt: dateAdd(-8), priority: 'Normal' },
      ],
      notifications: [
        { id: 'ntf-001', title: 'Leave request awaiting line manager review', type: 'Workflow', status: 'Unread', createdAt: dateAdd(-1) },
        { id: 'ntf-002', title: 'Employee handbook acknowledgement due', type: 'Document', status: 'Unread', createdAt: dateAdd(-2) },
        { id: 'ntf-003', title: 'June payslip is ready for download', type: 'Payroll', status: 'Read', createdAt: dateAdd(-4) },
      ],
      birthdays: [
        { id: 'bd-001', fullName: 'Olamide Badetan', department: 'Human Resources', date: sampleDate(3) },
        { id: 'bd-002', fullName: 'Adebayo Aina', department: 'Engineering', date: sampleDate(8) },
      ],
      anniversaries: [
        { id: 'wa-001', fullName: employee.fullName, years: Math.max(1, Math.round(Number(employee.yearsOfService || 1))), date: sampleDate(7) },
        { id: 'wa-002', fullName: 'Chris Ijeli', years: 12, date: sampleDate(15) },
      ],
      events: [
        { id: 'evt-001', label: 'Timesheet cut-off', date: dateAdd(2), type: 'Payroll' },
        { id: 'evt-002', label: 'Team safety briefing', date: dateAdd(4), type: 'HSE' },
        { id: 'evt-003', label: 'Work anniversary', date: dateAdd(7), type: 'Anniversary' },
      ],
      documents: [
        { id: 'doc-001', title: 'Employment Letter', category: 'Letters', version: 'v2.0', status: 'Current' },
        { id: 'doc-004', title: 'Confirmation Letter', category: 'Letters', version: 'v1.0', status: 'Current' },
        { id: 'doc-005', title: 'Promotion Letter', category: 'Letters', version: 'v1.2', status: 'Current' },
        { id: 'doc-006', title: 'Transfer Letter', category: 'Letters', version: 'v1.1', status: 'Archived' },
        { id: 'doc-007', title: 'Disciplinary Notice', category: 'Notices', version: 'v1.0', status: 'Restricted' },
        { id: 'doc-002', title: 'Employee Handbook', category: 'Policies', version: 'v6.1', status: 'Acknowledgement Due' },
        { id: 'doc-003', title: 'HSE Training Certificate', category: 'Certificates', version: 'v1.0', status: 'Current' },
      ],
      profileSections: [
        { id: 'personal', label: 'Personal Information', status: 'View / update', approvalRequired: true, fields: ['Title', 'Names', 'Date of birth', 'Marital status', 'Nationality'] },
        { id: 'contact', label: 'Contact Details', status: 'View / update', approvalRequired: true, fields: ['Email', 'Phone', 'Office extension'] },
        { id: 'address', label: 'Addresses', status: 'View / update', approvalRequired: true, fields: ['Residential address', 'Permanent address', 'City', 'State', 'Country'] },
        { id: 'emergency', label: 'Emergency Contacts', status: 'View / update', approvalRequired: true, fields: ['Primary contact', 'Relationship', 'Phone', 'Address'] },
        { id: 'next-of-kin', label: 'Next of Kin', status: 'View / update', approvalRequired: true, fields: ['Name', 'Relationship', 'Phone', 'Address'] },
        { id: 'bank', label: 'Bank Details', status: 'Masked / encrypted', approvalRequired: true, fields: ['Bank', 'Account number', 'Account name', 'BVN token'] },
        { id: 'photo', label: 'Profile Photo', status: 'Upload / replace', approvalRequired: true, fields: ['Image file', 'Capture date'] },
        { id: 'qualifications', label: 'Qualifications', status: 'Document-backed', approvalRequired: true, fields: ['Institution', 'Qualification', 'Year', 'Attachment'] },
        { id: 'certifications', label: 'Certifications', status: 'Document-backed', approvalRequired: true, fields: ['Certificate', 'Issuer', 'Expiry', 'Attachment'] },
      ],
      leave: {
        balances: leavePolicyCards,
        calendar: [
          { id: 'lv-cal-001', label: 'My approved annual leave', from: sampleDate(10), to: sampleDate(14), status: 'Approved', type: 'Annual Leave', scope: 'My leave schedule' },
          { id: 'lv-cal-002', label: 'Team leave blackout', from: sampleDate(20), to: sampleDate(24), status: 'Blackout', type: 'Policy', scope: employee.department || 'Department' },
          { id: 'lv-cal-003', label: 'Carry forward expiry', from: `${leaveYear}-03-31`, to: `${leaveYear}-03-31`, status: 'Reminder', type: 'Carry Forward Leave', scope: 'ESS notification' },
          { id: 'lv-cal-004', label: 'Public holiday', from: `${leaveYear}-10-01`, to: `${leaveYear}-10-01`, status: 'Holiday', type: 'Public Holiday', scope: 'Nigeria' },
        ],
        history: [
          { id: 'lv-his-001', type: 'Annual Leave', from: sampleDate(-40), to: sampleDate(-35), days: 5, year: leaveYear, status: 'Completed', approvalStage: 'Completed', approvers: 'Supervisor, HR', reliever: 'Assigned colleague', payrollImpact: 'None', allowanceStatus: 'Not eligible below 10 days', attachments: 'None', comments: 'Completed', auditTrail: 'Submitted -> Approved -> Completed' },
          { id: 'lv-his-002', type: 'Sick Leave', from: sampleDate(-12), to: sampleDate(-12), days: 1, year: leaveYear, status: 'Completed', approvalStage: 'Completed', approvers: 'Supervisor, HR', reliever: 'Not required', payrollImpact: 'None', allowanceStatus: 'Not applicable', attachments: 'Medical certificate', comments: 'Approved', auditTrail: 'Submitted -> HR approved' },
        ],
        workflows: leaveWorkflow,
        allowance: [
          { label: 'Leave Allowance Status', value: allowanceEligible ? 'Eligible when applying for 10+ current-year Annual Leave working days' : 'Not currently eligible', status: allowanceEligible ? 'Ready' : 'Review' },
          { label: 'Payroll Integration', value: 'Payroll is notified after eligible Annual Leave approval', status: 'Enabled' },
          { label: 'Carry Forward Rule', value: 'Carry Forward Leave does not trigger allowance', status: 'Enforced' },
        ],
        approvals: [
          { id: 'app-001', employee: 'Team member', type: 'Annual Leave', days: 10, stage: 'Supervisor/Line Manager', status: 'Pending', reliever: employee.fullName, handover: 'Project notes attached', conflict: 'No conflict' },
          { id: 'app-002', employee: 'Team member', type: 'Sick Leave', days: 2, stage: 'HR', status: 'Under Review', reliever: 'Not required', handover: 'Medical attachment pending', conflict: 'Attachment required' },
        ],
        reports: ['Employee leave balance', 'Department leave utilization', 'Leave liability', 'Carry forward leave', 'Expired/forfeited leave', 'Leave allowance eligibility', 'Payroll-impact leave', 'Sick leave trend', 'Absenteeism', 'Employees currently on leave', 'Upcoming leave', 'Approval SLA report', 'Leave audit trail'].map((title, index) => ({ id: `ess-rpt-${index + 1}`, title, format: 'Excel / PDF / CSV', status: 'Available' })),
        notifications: ['Leave submitted', 'Approval pending', 'Leave approved', 'Leave rejected', 'Leave cancelled', 'Leave recalled', 'Carry forward balance created', 'Carry forward expiry reminder', 'Return-to-work reminder', 'Payroll leave allowance processing', 'Blackout conflict warning', 'Reliever assignment'].map((title, index) => ({ id: `leave-ntf-${index + 1}`, title, channel: 'Email, In-app, ESS', status: 'Enabled' })),
        security: [
          { role: 'Employee', access: 'Apply and view own leave only' },
          { role: 'Supervisor/Manager', access: 'Approve team leave and view team calendar' },
          { role: 'HR Officer', access: 'Final approval and leave record management' },
          { role: 'Payroll Officer', access: 'Payroll-impact leave only' },
        ],
      },
      attendance: {
        records: [
          { date: sampleDate(0), clockIn: '08:04', clockOut: '17:22', status: 'Present', source: 'Biometric' },
          { date: sampleDate(-1), clockIn: '08:18', clockOut: '17:10', status: 'Late', source: 'Mobile' },
          { date: sampleDate(-2), clockIn: 'Remote', clockOut: 'Remote', status: 'Remote Work', source: 'ESS' },
        ],
        shifts: [
          { id: 'shift-001', name: 'Day Shift', start: '08:00', end: '17:00', location: employee.location || 'Lagos HQ' },
          { id: 'shift-002', name: 'Weekend Standby', start: '09:00', end: '13:00', location: 'Remote' },
        ],
        timesheets: [
          { id: 'ts-001', week: 'Current Week', hours: 40, overtime: 4, status: 'Submitted' },
          { id: 'ts-002', week: 'Previous Week', hours: 42, overtime: 2, status: 'Approved' },
        ],
      },
      payrollHistory: [
        { period: '2026-06', grossPay: monthlyPay, deductions: Math.round(monthlyPay * 0.18), netPay: Math.round(monthlyPay * 0.82), status: 'Available' },
        { period: '2026-05', grossPay: monthlyPay, deductions: Math.round(monthlyPay * 0.17), netPay: Math.round(monthlyPay * 0.83), status: 'Downloaded' },
        { period: '2026-04', grossPay: monthlyPay, deductions: Math.round(monthlyPay * 0.18), netPay: Math.round(monthlyPay * 0.82), status: 'Available' },
      ],
      performance: {
        goals: [
          { id: 'goal-001', title: 'Improve project delivery turnaround', progress: 72, dueDate: sampleDate(45), status: 'On Track' },
          { id: 'goal-002', title: 'Complete statutory compliance training', progress: 90, dueDate: sampleDate(20), status: 'On Track' },
        ],
        kpis: [
          { label: 'Quality score', value: 94, target: 90 },
          { label: 'Attendance reliability', value: attendanceRate, target: 95 },
          { label: 'Task completion', value: 88, target: 85 },
        ],
        reviews: [
          { id: 'rev-001', cycle: '2026 Mid-Year', form: 'Employee appraisal form', status: 'Self-assessment open', score: null },
          { id: 'rev-002', cycle: '2025 Year-End', form: 'Performance review', status: 'Closed', score: 4.2 },
        ],
        developmentPlans: [
          { id: 'dev-001', title: 'Supervisory readiness plan', owner: 'Line Manager', status: 'In Progress' },
        ],
      },
      learning: {
        courses: [
          { id: 'lrn-001', title: 'HSE Refresher', date: sampleDate(12), status: 'Enrolled', type: 'Mandatory' },
          { id: 'lrn-002', title: 'Project Controls Fundamentals', date: sampleDate(25), status: 'Open for registration', type: 'Course' },
        ],
        materials: [
          { id: 'mat-001', title: 'Employee Handbook Quiz', type: 'Assessment', status: 'Pending' },
          { id: 'mat-002', title: 'Welding Safety Guide', type: 'Learning Material', status: 'Available' },
        ],
        certifications: [
          { id: 'cert-001', title: 'HSE Level 1', expiresAt: sampleDate(180), status: 'Valid' },
          { id: 'cert-002', title: 'First Aid Awareness', expiresAt: sampleDate(60), status: 'Renewal Due' },
        ],
      },
      claims: [
        { id: 'clm-001', type: 'Travel Claim', amount: 185000, status: 'Finance Review', submittedAt: dateAdd(-5), attachmentStatus: 'Uploaded' },
        { id: 'clm-002', type: 'Medical Reimbursement', amount: 42000, status: 'Approved', submittedAt: dateAdd(-20), attachmentStatus: 'Uploaded' },
        { id: 'clm-003', type: 'Expense Advance', amount: 100000, status: 'Line Manager Review', submittedAt: dateAdd(-2), attachmentStatus: 'Required' },
      ],
      loanManagement: {
        products: loansVersion?.products.filter((product) => product.enabled) || [],
        applications: employeeLoans,
        repaymentSchedules: employeeLoans.map((loan, index) => ({
          id: `${loan.id}-schedule`,
          productId: loan.productId,
          installment: index + 1,
          dueDate: sampleDate(30 * (index + 1)),
          amount: Math.round(Number(loan.outstandingBalance || 0) / Math.max(1, Number(loan.tenorMonths || 1))),
          balance: Number(loan.outstandingBalance || 0),
          status: loan.approvalStatus,
        })),
        history: [
          { id: 'loan-his-001', product: 'Salary Advance', principal: 150000, status: 'Closed', closedAt: sampleDate(-90) },
        ],
      },
      travel: [
        { id: 'trv-001', destination: 'Port Harcourt', purpose: 'Project site visit', advance: 250000, status: 'Approved', tripReport: 'Pending' },
        { id: 'trv-002', destination: 'Abuja', purpose: 'Client meeting', advance: 180000, status: 'Submitted', tripReport: 'Not Due' },
      ],
      assets: [
        { id: 'ast-001', tag: 'DLE-LAP-0146', name: 'Laptop', status: 'Assigned', acknowledgement: 'Acknowledged', condition: 'Good' },
        { id: 'ast-002', tag: 'DLE-PPE-4421', name: 'PPE Kit', status: 'Assigned', acknowledgement: 'Pending', condition: 'Replacement Due' },
        { id: 'ast-003', tag: 'DLE-MOB-0190', name: 'Mobile Device', status: 'Assigned', acknowledgement: 'Acknowledged', condition: 'Good' },
      ],
      exitServices: {
        resignation: { status: 'Not submitted', noticePeriodDays: 30, eligibleFinalSettlement: true },
        clearance: [
          { unit: 'Line Manager', status: 'Not Started' },
          { unit: 'IT', status: 'Not Started' },
          { unit: 'Stores / Assets', status: 'Not Started' },
          { unit: 'Finance', status: 'Not Started' },
          { unit: 'HR', status: 'Not Started' },
        ],
        exitInterview: { status: 'Not scheduled', form: 'Exit interview questionnaire' },
        finalSettlement: { status: 'Not started', payrollPeriod: 'Pending resignation' },
      },
      businessRules: [
        { id: 'rule-001', name: 'Leave balance validation', status: 'Active', configurable: true },
        { id: 'rule-002', name: 'Multi-level approval by request type', status: 'Active', configurable: true },
        { id: 'rule-003', name: 'Document version acknowledgement', status: 'Active', configurable: true },
        { id: 'rule-004', name: 'Payroll data masking by RBAC', status: 'Active', configurable: true },
      ],
      auditTrail: [
        { at: dateAdd(-1), actor: employee.employeeId, action: 'Viewed payslip history', channel: 'ESS' },
        { at: dateAdd(-2), actor: employee.employeeId, action: 'Submitted leave application', channel: 'ESS' },
        { at: dateAdd(-5), actor: 'System', action: 'Sent handbook acknowledgement notification', channel: 'Email/In-App' },
      ],
      reports: [
        { id: 'rpt-001', title: 'My Leave Statement', format: 'PDF / Excel', status: 'Ready' },
        { id: 'rpt-002', title: 'Payroll History Report', format: 'PDF / Excel', status: 'Ready' },
        { id: 'rpt-003', title: 'Training Transcript', format: 'PDF', status: 'Ready' },
        { id: 'rpt-004', title: 'Claim Status Report', format: 'Excel', status: 'Ready' },
      ],
      directory: employeeSource.employees.slice(0, 24).map((item) => ({
        employeeId: item.employeeId,
        fullName: item.fullName,
        jobTitle: item.jobTitle || item.designation || 'Employee',
        department: item.department,
        location: item.location || item.workLocation,
      })),
      moduleCatalog,
      serviceCatalog,
      requests,
      integrations: ['Payroll', 'ERP', 'Active Directory', 'Biometric Attendance', 'Document Management', 'Email', 'In-App Notifications', 'Third-Party APIs'],
      analytics: [
        { label: 'ESS adoption', value: 87, unit: '%' },
        { label: 'HR tickets deflected', value: 64, unit: '%' },
        { label: 'Workflow SLA compliance', value: 91, unit: '%' },
        { label: 'Mobile access share', value: 43, unit: '%' },
      ],
    });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load workforce portal.');
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const category = compact(body.category);
    const title = compact(body.title);
    const priority = compact(body.priority) as EssRequest['priority'];
    if (!category) return err(400, 'category is required');
    if (!title) return err(400, 'title is required');

    const employeeSource = await readPayrollEmployees();
    const employee = resolveEssEmployee(employeeSource.employees);
    if (!employee) return err(404, 'No employee record is available for the ESS portal.');

    const catalogItem = serviceCatalog.find((item) => item.label === category || item.id === category);
    const now = new Date().toISOString();
    const requestItem: EssRequest = {
      id: `ess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeId: employee.employeeId,
      category: catalogItem?.area || category,
      title,
      status: catalogItem?.workflow.includes('Line Manager') ? 'Line Manager Review' : 'Submitted',
      priority: ['Low', 'Normal', 'High'].includes(priority) ? priority : 'Normal',
      submittedAt: now,
      updatedAt: now,
      approvers: catalogItem?.workflow.slice(1) || ['HR Operations'],
      comments: [{ at: now, actor: 'Employee Self-Service', comment: 'Request submitted from workforce portal.' }],
    };

    const requests = await readRequests();
    await writeRequests([requestItem, ...requests]);
    return ok({ request: requestItem });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to submit ESS request.');
  }
}
