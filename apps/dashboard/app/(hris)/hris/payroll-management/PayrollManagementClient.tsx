'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Coins,
  CreditCard,
  DatabaseZap,
  Download,
  FileBarChart,
  FileCheck2,
  FileText,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Landmark,
  Lock,
  Mail,
  Network,
  PlayCircle,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type Role = 'Super Admin' | 'System Administrator' | 'HR Director' | 'HR Manager' | 'HR Officer' | 'Payroll Officer' | 'Payroll Supervisor' | 'Finance Controller' | 'Finance Manager' | 'CFO' | 'Executive Director' | 'Executive Management' | 'Auditor' | 'Employee';
type PayrollRunStatus = 'Draft' | 'Open' | 'Validation' | 'Validated' | 'Computed' | 'Ready for Approval' | 'Submitted' | 'Under Review' | 'Approved' | 'Released' | 'Rejected' | 'Revision Requested' | 'Locked' | 'Posted' | 'Closed' | 'Reopened' | 'Cancelled' | 'Published';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';

type PayrollRecord = {
  employeeId: string;
  fullName: string;
  department: string;
  businessUnit: string;
  location: string;
  jobTitle: string;
  employmentType: string;
  employmentStatus: string;
  payrollGroup: string;
  salaryGrade: string;
  salaryStructure?: string;
  isDailyRate?: boolean;
  ratePerDay?: number | null;
  ratePerHour?: number | null;
  hoursPerDay?: number | null;
  payCurrency: string;
  paymentRun: string;
  paymentType: string;
  setupAssignedToPayroll: boolean;
  payrollStatus: 'Ready' | 'Review' | 'Blocked';
  riskSeverity: 'Low' | 'Medium' | 'High';
  exceptionCount: number;
  exceptions: string[];
  basePay: number | null;
  allowances: number | null;
  pension: number | null;
  paye: number | null;
  otherDeductions: number | null;
  grossPay: number | null;
  deductions: number | null;
  netPay: number | null;
};

type PayrollRun = {
  id: string;
  period: string;
  status: PayrollRunStatus;
  employeeCount: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  createdAt: string;
  createdBy: string;
  validatedAt?: string | null;
  validatedBy?: string | null;
  submittedAt?: string | null;
  submittedBy?: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  releasedAt?: string | null;
  releasedBy?: string | null;
  lockedAt: string | null;
  payslipsGeneratedAt?: string | null;
  payslipsGeneratedBy?: string | null;
  bankScheduleGeneratedAt?: string | null;
  bankScheduleGeneratedBy?: string | null;
  statutorySchedulesGeneratedAt?: string | null;
  statutorySchedulesGeneratedBy?: string | null;
  postedAt: string | null;
  postedBy?: string | null;
};

type PayrollPayload = {
  generatedAt: string;
  source: string;
  dataSource?: { source: string; databaseAvailable: boolean; warning: string | null; employeeCount: number };
  role: Role;
  permissions: { canViewMoney: boolean; canManageRun: boolean; canApprove: boolean; canPost: boolean; canConfigure?: boolean; canReopen?: boolean; canExport: boolean };
  period: string;
  periodLabel: string;
  summary: {
    totalEmployees: number;
    payrollEligible: number;
    readyEmployees: number;
    reviewEmployees: number;
    blockedEmployees: number;
    payrollCoveragePct: number;
    grossPay: number;
    deductions: number;
    netPay: number;
    basePay: number;
    allowances: number;
    exceptionCount: number;
  };
  runs: PayrollRun[];
  records: PayrollRecord[];
  exceptions: { id: string; employeeId: string; employeeName: string; issue: string; severity: 'Low' | 'Medium' | 'High'; owner: string }[];
  breakdowns: {
    byPayrollGroup: { label: string; employees: number; grossPay: number; netPay: number; exceptions: number }[];
    byDepartment: { label: string; employees: number; grossPay: number; netPay: number; exceptions: number }[];
    byEmploymentType: { label: string; employees: number; grossPay: number; netPay: number; exceptions: number }[];
  };
  controls: { id: string; label: string; status: string; tone: Tone }[];
  workflow?: { currentStatus: string; nextOwner: string; blockedActions: string[]; approvalStage: string };
  auditTrail?: PayrollAuditEntry[];
};

type PayrollAuditEntry = {
  id: string;
  at: string;
  user: string;
  role: Role;
  action: string;
  record: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  comment?: string | null;
  ip?: string | null;
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };
type SectionId = 'dashboard' | 'payroll-computation-workflow' | 'salary-management' | 'earnings-management' | 'deductions-management' | 'payroll-processing' | 'compliance-statutory-management' | 'finance-integration' | 'reports-analytics';

type TabConfig = {
  id: string;
  label: string;
  description: string;
  items: string[];
  outputs?: string[];
  legacyHref?: string;
};

type SectionConfig = {
  id: SectionId;
  label: string;
  title: string;
  description: string;
  icon: any;
  tone: Tone;
  tabs: TabConfig[];
};

type PayrollAction = {
  id: string;
  label: string;
  group: 'primary' | 'secondary' | 'workflow' | 'audit';
  sensitive?: boolean;
  reasonRequired?: boolean;
  roles?: Role[];
};

const readApiResponse = async <T,>(res: Response): Promise<ApiResponse<T>> => {
  const text = await res.text();
  if (!text.trim()) return { status: 'error', error: `Empty response from payroll service (${res.status})` };
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { status: 'error', error: text.slice(0, 240) || `Invalid response from payroll service (${res.status})` };
  }
};

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB');
const pctFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const money = (value: number | null | undefined, canView = true) => (!canView || value == null ? 'Restricted' : moneyFmt.format(value));
const number = (value: number | null | undefined) => numberFmt.format(Number(value || 0));
const payrollRate = (record: PayrollRecord, canView = true) => {
  if (!record.isDailyRate) return record.salaryStructure || record.salaryGrade || 'Unassigned';
  if (!canView) return 'Restricted';
  if (record.ratePerDay) return `${money(record.ratePerDay)}/day`;
  if (record.ratePerHour) return `${money(record.ratePerHour)}/hr`;
  return 'Rate missing';
};

const toneStyles: Record<Tone, { card: string; icon: string; chip: string; button: string; bar: string; text: string }> = {
  blue: { card: 'bg-blue-50 border-blue-200', icon: 'bg-blue-600 text-white', chip: 'bg-blue-100 text-blue-800', button: 'bg-blue-600 hover:bg-blue-700 text-white', bar: 'bg-blue-600', text: 'text-blue-700' },
  green: { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-600 text-white', chip: 'bg-emerald-100 text-emerald-800', button: 'bg-emerald-600 hover:bg-emerald-700 text-white', bar: 'bg-emerald-600', text: 'text-emerald-700' },
  amber: { card: 'bg-amber-50 border-amber-200', icon: 'bg-amber-500 text-white', chip: 'bg-amber-100 text-amber-800', button: 'bg-amber-500 hover:bg-amber-600 text-white', bar: 'bg-amber-500', text: 'text-amber-700' },
  red: { card: 'bg-red-50 border-red-200', icon: 'bg-red-600 text-white', chip: 'bg-red-100 text-red-800', button: 'bg-red-600 hover:bg-red-700 text-white', bar: 'bg-red-600', text: 'text-red-700' },
  violet: { card: 'bg-violet-50 border-violet-200', icon: 'bg-violet-600 text-white', chip: 'bg-violet-100 text-violet-800', button: 'bg-violet-600 hover:bg-violet-700 text-white', bar: 'bg-violet-600', text: 'text-violet-700' },
  cyan: { card: 'bg-cyan-50 border-cyan-200', icon: 'bg-cyan-600 text-white', chip: 'bg-cyan-100 text-cyan-800', button: 'bg-cyan-600 hover:bg-cyan-700 text-white', bar: 'bg-cyan-600', text: 'text-cyan-700' },
  slate: { card: 'bg-slate-50 border-slate-200', icon: 'bg-slate-800 text-white', chip: 'bg-slate-100 text-slate-800', button: 'bg-slate-900 hover:bg-slate-800 text-white', bar: 'bg-slate-700', text: 'text-slate-700' },
};

const statusTone = (status: string): Tone => {
  if (['Ready', 'Approved', 'Released', 'Posted', 'Published', 'Closed', 'Passed', 'Calculated', 'Enabled'].includes(status)) return 'green';
  if (['Blocked', 'Validation', 'Attention Required'].includes(status)) return 'red';
  if (['Review', 'Draft', 'Open', 'Submitted', 'Under Review', 'Validated', 'Computed', 'Ready for Approval'].includes(status)) return 'amber';
  if (status === 'Locked') return 'violet';
  return 'blue';
};

const sections: SectionConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: 'Payroll Dashboard',
    description: 'A simple view of payroll status, issues, next action, and employee readiness.',
    icon: WalletCards,
    tone: 'blue',
    tabs: [
      { id: 'executive-summary', label: 'Executive Summary', description: 'Payroll KPIs, cycle status, employee counts, payroll values, and quick actions.', items: ['Payroll KPIs', 'Payroll cycle status', 'Employee payroll counts', 'Gross payroll', 'Net payroll', 'Pending approvals', 'Payroll exceptions', 'Bank payment status', 'Compliance alerts', 'Payroll trends'], outputs: ['Executive summary cards', 'Charts and analytics', 'Notifications', 'Quick action shortcuts'] },
    ],
  },
  {
    id: 'payroll-computation-workflow',
    label: 'Workflow',
    title: 'Payroll Workflow',
    description: 'See where payroll is, who owns the next step, and what is still pending.',
    icon: GitBranch,
    tone: 'slate',
    tabs: [
      { id: 'workflow-status', label: 'Workflow Status', description: 'Live payroll preparation, computation, approval, release, reporting, audit, and compliance status.', legacyHref: '/hris/payroll-management/payroll-computation-workflow', items: ['Data collection', 'Pre-validation', 'Payroll computation', 'Approval workflow', 'Payroll release', 'Payroll outputs', 'Locking controls', 'Dashboard overview'] },
    ],
  },
  {
    id: 'salary-management',
    label: 'Pay Setup',
    title: 'Pay Setup',
    description: 'Manage salary structures, grades, employee pay setup, and Sage migration checks.',
    icon: Coins,
    tone: 'green',
    tabs: [
      { id: 'salary-structure', label: 'Salary Structure', description: 'Grade bands, compa-ratio, distribution, health monitoring, exceptions, and compensation governance.', legacyHref: '/hris/payroll/salary-structure', items: ['Salary grades and bands', 'Minimum, midpoint, and maximum salary ranges', 'Compa-ratio analysis', 'Payroll distribution analysis', 'Grade health monitoring', 'Salary exception management', 'Compensation governance'] },
      { id: 'salary-grades', label: 'Salary Grades', description: 'Grade hierarchy and eligibility controls with effective-dated maintenance.', items: ['Grade creation and maintenance', 'Grade hierarchy', 'Grade-to-position mapping', 'Grade eligibility rules', 'Effective date management'] },
      { id: 'employee-salary-setup', label: 'Employee Salary Setup', description: 'Employee compensation profiles, payroll eligibility, and cost center assignment.', legacyHref: '/hris/payroll/employee-salary-setup', items: ['Basic salary assignment', 'Salary structure assignment', 'Employee compensation profile', 'Payroll eligibility configuration', 'Cost center assignment'] },
      { id: 'sage-migration-review', label: 'Sage Migration Review', description: 'Detailed Sage 300 gross salary reconciliation for permanent and lump-sum payroll migration.', legacyHref: '/hris/payroll/sage-migration-review', items: ['Permanent employee gross salary migration', 'Lump-sum gross salary migration', 'Sage versus HRIS variance review', 'Earning profile mapping', 'Migration exceptions and missing gross controls'] },
      { id: 'compensation-planning', label: 'Compensation Planning', description: 'Salary review exercises, simulations, budget impact, and market comparison.', items: ['Salary review exercises', 'Annual increment planning', 'Compensation simulations', 'Budget impact analysis', 'Market comparison analysis'] },
    ],
  },
  {
    id: 'earnings-management',
    label: 'Earnings',
    title: 'Earnings Management',
    description: 'Allowances, bonuses, overtime, and daily rate pay in a single earnings workspace.',
    icon: TrendingUp,
    tone: 'cyan',
    tabs: [
      { id: 'allowances', label: 'Allowances', description: 'Allowance catalogue and rule-driven eligibility.', legacyHref: '/hris/payroll/allowances', items: ['Housing allowance', 'Transport allowance', 'Utility allowance', 'Medical allowance', 'Special allowances', 'Allowance configuration rules'] },
      { id: 'bonuses', label: 'Bonuses', description: 'Bonus schemes, workflow controls, and approval-ready submissions.', items: ['Performance bonus', 'Annual bonus', 'Project bonus', 'Special bonus', 'Bonus approval workflows'] },
      { id: 'overtime-pay', label: 'Overtime Pay', description: 'Overtime rules, calculations, approvals, and analytics.', legacyHref: '/hris/payroll/overtime-pay', items: ['Overtime rules', 'Overtime calculations', 'Overtime approvals', 'Overtime analytics'] },
      { id: 'daily-rate-pay', label: 'Daily Rate Pay', description: 'Daily rate employee management, attendance integration, calculations, and approvals.', legacyHref: '/hris/payroll/daily-rate-pay', items: ['Daily rate employee management', 'Daily attendance integration', 'Daily payroll calculations', 'Daily payroll approvals'] },
    ],
  },
  {
    id: 'deductions-management',
    label: 'Deductions',
    title: 'Deductions Management',
    description: 'Statutory deductions, loans, other deductions, and the rules engine.',
    icon: FileSpreadsheet,
    tone: 'violet',
    tabs: [
      { id: 'statutory-deductions', label: 'Statutory Deductions', description: 'PAYE, pension, NHF, NSITF, and ITF deductions.', legacyHref: '/hris/payroll/deductions', items: ['PAYE tax', 'Pension deductions', 'NHF deductions', 'NSITF deductions', 'ITF deductions'] },
      { id: 'loans-salary-advances', label: 'Loans & Salary Advances', description: 'Loan setup, approval controls, schedules, salary advance processing, and balances.', legacyHref: '/hris/payroll/loans-and-salary-advances', items: ['Loan setup', 'Loan approvals', 'Repayment schedules', 'Salary advance processing', 'Outstanding balances'] },
      { id: 'other-deductions', label: 'Other Deductions', description: 'Cooperative, union, insurance, and configurable custom deductions.', items: ['Cooperative deductions', 'Union deductions', 'Insurance deductions', 'Custom deductions'] },
      { id: 'deduction-rules-engine', label: 'Deduction Rules Engine', description: 'Formula, threshold, exemption, and effective-date governance.', items: ['Deduction formulas', 'Thresholds', 'Exemptions', 'Effective dates'] },
    ],
  },
  {
    id: 'payroll-processing',
    label: 'Processing',
    title: 'Payroll Processing',
    description: 'Payroll period management, runs, validation, approval, payslip generation, reversal, closing, and reopening controls.',
    icon: PlayCircle,
    tone: 'amber',
    tabs: [
      { id: 'payroll-period-management', label: 'Payroll Period Management', description: 'Calendar setup, period creation, statuses, closing, reopening, locking rules, and period reports.', items: ['Payroll calendar setup', 'Payroll period creation', 'Payroll period status management', 'Payroll period closing', 'Payroll period reopening', 'Payroll locking rules', 'Payroll period reports'] },
      { id: 'payroll-workflow', label: 'Payroll Workflow', description: 'End-to-end payroll computation, approval status, locking controls, audit trail, and release process.', legacyHref: '/hris/payroll/payroll-workflow', items: ['Data collection', 'Pre-validation', 'Payroll computation', 'Multi-level approval workflow', 'Audit trail capture', 'Payroll release controls'] },
      { id: 'payroll-run', label: 'Payroll Run', description: 'Monthly, weekly, daily, and batch payroll execution.', legacyHref: '/hris/payroll/payroll-processing', items: ['Monthly payroll processing', 'Weekly payroll processing', 'Daily payroll processing', 'Payroll batch execution'] },
      { id: 'payroll-validation', label: 'Payroll Validation', description: 'Exception checks, missing setup checks, duplicate detection, and audit validation.', items: ['Missing salary checks', 'Missing bank details checks', 'Duplicate payroll detection', 'Exception reporting', 'Payroll audit validation'] },
      { id: 'payroll-approval', label: 'Payroll Approval', description: 'Multi-level HR, finance, and executive approval with audit trail.', legacyHref: '/hris/payroll/payroll-approval', items: ['Multi-level approvals', 'HR approval', 'Finance approval', 'Executive approval', 'Approval audit trail'] },
      { id: 'payslip-generation', label: 'Payslip Generation', description: 'Bulk generation, ESS publishing, and secure PDF readiness.', legacyHref: '/hris/payroll/payslip-generation', items: ['Payslip generation', 'Bulk payslip generation', 'Employee self-service publishing', 'Secure PDF generation'] },
      { id: 'payroll-reversal', label: 'Payroll Reversal', description: 'Rollback, correction processing, adjustment entries, and audit tracking.', items: ['Payroll rollback', 'Correction processing', 'Adjustment entries', 'Audit tracking'] },
      { id: 'payroll-closing', label: 'Payroll Closing', description: 'Completion validation, statutory schedule confirmation, record locking, and closing audit trail.', items: ['Validate payroll completion before closing', 'Confirm all employees are processed', 'Confirm payslips are generated', 'Confirm approvals are completed', 'Confirm bank payment schedule is generated', 'Confirm payroll journal is posted', 'Confirm PAYE, pension, NHF, NSITF, and ITF schedules are generated', 'Lock payroll records after closing', 'Maintain closing audit trail'] },
      { id: 'payroll-reopening', label: 'Payroll Reopening', description: 'Controlled reopening of closed periods with reasons, approvals, and before-and-after audit history.', items: ['Allow controlled reopening of closed periods', 'Require reason for reopening', 'Require approval workflow', 'Track reopened-by, approved-by, reopened-date, and reason', 'Maintain before-and-after audit history'] },
    ],
  },
  {
    id: 'compliance-statutory-management',
    label: 'Statutory',
    title: 'Statutory Deductions',
    description: 'PAYE, pension, NHF, NSITF, ITF, schedules, and compliance reports.',
    icon: ShieldCheck,
    tone: 'red',
    tabs: [
      { id: 'paye-management', label: 'PAYE Management', description: 'PAYE calculations, schedules, remittance reports, and monitoring.', legacyHref: '/hris/payroll/tax-paye', items: ['PAYE calculations', 'PAYE schedules', 'Tax remittance reports', 'Tax compliance monitoring'] },
      { id: 'pension-management', label: 'Pension Management', description: 'Employee and employer pension contributions, remittance schedules, and reports.', legacyHref: '/hris/payroll/pension', items: ['Employee contributions', 'Employer contributions', 'Pension remittance schedules', 'Pension reports'] },
      { id: 'nhf-nsitf-itf', label: 'NHF / NSITF / ITF Management', description: 'Regulatory calculations, monitoring, remittance, and reporting.', legacyHref: '/hris/payroll/nhf-nsitf-itf', items: ['Regulatory calculations', 'Compliance monitoring', 'Remittance schedules', 'Regulatory reporting'] },
      { id: 'returns-regulatory-reports', label: 'Returns & Regulatory Reports', description: 'Monthly and annual returns, certificates, and submission tracking.', items: ['Monthly returns', 'Annual returns', 'Compliance certificates', 'Submission tracking'] },
    ],
  },
  {
    id: 'finance-integration',
    label: 'Bank & Finance',
    title: 'Bank & Finance',
    description: 'Bank schedules, payment files, journals, GL mapping, and reconciliation.',
    icon: Landmark,
    tone: 'slate',
    tabs: [
      { id: 'bank-payment-schedule', label: 'Bank Payment Schedule', description: 'Salary scheduling, payment batches, and payment status tracking.', items: ['Salary payment scheduling', 'Payment batch management', 'Payment status tracking'] },
      { id: 'salary-payment-files', label: 'Salary Payment Files', description: 'Bank file generation and electronic payment export templates.', items: ['Bank file generation', 'Electronic payment formats', 'Bank export templates'] },
      { id: 'payroll-journal', label: 'Payroll Journal', description: 'Accounting entries, journal generation, and journal approval workflows.', items: ['Payroll accounting entries', 'Journal generation', 'Journal approval workflows'] },
      { id: 'general-ledger-mapping', label: 'General Ledger Mapping', description: 'GL mapping and cost, project, department allocations.', items: ['GL account mapping', 'Cost center allocation', 'Project allocation', 'Department allocation'] },
      { id: 'reconciliation', label: 'Reconciliation', description: 'Payroll, bank, and accounting reconciliation controls.', items: ['Payroll reconciliation', 'Bank reconciliation', 'Accounting reconciliation'] },
    ],
  },
  {
    id: 'reports-analytics',
    label: 'Reports',
    title: 'Payroll Reports',
    description: 'Payroll reports, exports, audit reports, and management summaries.',
    icon: FileBarChart,
    tone: 'blue',
    tabs: [
      { id: 'payroll-summary-reports', label: 'Payroll Summary Reports', description: 'Period and company-level payroll summaries.', items: ['Payroll Summary Reports'] },
      { id: 'payroll-register', label: 'Payroll Register', description: 'Employee-level payroll register with filtering and export.', items: ['Payroll Register'] },
      { id: 'salary-analysis-reports', label: 'Salary Analysis Reports', description: 'Salary distribution and grade analysis reports.', items: ['Salary Analysis Reports'] },
      { id: 'tax-reports', label: 'Tax Reports', description: 'Tax schedules, remittance, and PAYE reports.', items: ['Tax Reports'] },
      { id: 'pension-reports', label: 'Pension Reports', description: 'Pension schedules and remittance reports.', items: ['Pension Reports'] },
      { id: 'deduction-reports', label: 'Deduction Reports', description: 'Statutory, loan, and other deduction reports.', items: ['Deduction Reports'] },
      { id: 'variance-reports', label: 'Variance Reports', description: 'Period-to-period payroll variance reporting.', items: ['Variance Reports'] },
      { id: 'bank-payment-reports', label: 'Bank Payment Reports', description: 'Payment status and bank file audit reports.', items: ['Bank Payment Reports'] },
      { id: 'compliance-reports', label: 'Compliance Reports', description: 'Compliance monitoring and statutory submissions.', items: ['Compliance Reports'] },
      { id: 'audit-reports', label: 'Audit Reports', description: 'Audit trails and payroll change logs.', items: ['Audit Reports'] },
      { id: 'executive-payroll-analytics', label: 'Executive Payroll Analytics', description: 'Graphical analytics and executive drill-downs.', items: ['Executive Payroll Analytics'] },
    ],
  },
];

const enterpriseRequirements = [
  'Role-Based Access Control (RBAC)',
  'Multi-Level Approval Workflows',
  'Audit Trails',
  'Payroll Version Control',
  'Payroll Locking After Approval',
  'Exception Management',
  'Configurable Payroll Calendars',
  'Multi-Company Support',
  'Multi-Location Support',
  'Multi-Currency Support',
  'Cost Center Management',
  'Project-Based Payroll Allocation',
  'Employee Category Support (Permanent, Lumpsum, Daily Rate)',
  'Automatic Employee Code Integration',
  'Sage ERP Integration Readiness',
  'API Integration Readiness',
  'Employee Self-Service (ESS) Integration',
  'Document Management Integration',
  'Notification and Alert Framework',
  'Enterprise Reporting and Analytics',
];

const payrollPeriodTabs: TabConfig[] = [
  {
    id: 'payroll-calendar-setup',
    label: 'Payroll Calendar Setup',
    description: 'Define payroll years, period calendars, frequencies, dates, statutory due dates, and assignment scope.',
    items: ['Create payroll year', 'Define payroll months/periods', 'Configure weekly, monthly, daily-rate, and special payroll periods', 'Set payroll start date and end date', 'Define payment date', 'Define statutory remittance due dates', 'Assign payroll frequency', 'Assign company, branch, department, location, or employee category'],
  },
  {
    id: 'payroll-period-creation',
    label: 'Payroll Period Creation',
    description: 'Create, auto-generate, validate, and scope payroll periods without duplicates or overlaps.',
    items: ['Create new payroll period', 'Auto-generate monthly payroll periods', 'Auto-generate weekly or daily-rate periods', 'Define payroll period code, period name, start date, end date, payment date, and payroll type', 'Assign payroll group', 'Assign eligible employee categories such as Permanent, Lumpsum, and Daily Rate', 'Prevent duplicate period creation', 'Validate overlapping payroll periods'],
  },
  {
    id: 'payroll-period-status-management',
    label: 'Payroll Period Status Management',
    description: 'Control payroll period state transitions from draft through close, reopening, or cancellation.',
    items: ['Draft', 'Open', 'In Progress', 'Under Validation', 'Awaiting Approval', 'Approved', 'Paid', 'Closed', 'Reopened', 'Cancelled'],
  },
  {
    id: 'payroll-period-closing',
    label: 'Payroll Period Closing',
    description: 'Close payroll only after completion, approval, banking, journal, and statutory checks pass.',
    items: ['Validate payroll completion before closing', 'Confirm all employees are processed', 'Confirm payslips are generated', 'Confirm approvals are completed', 'Confirm bank payment schedule is generated', 'Confirm payroll journal is posted', 'Confirm PAYE, pension, NHF, NSITF, and ITF schedules are generated', 'Lock payroll records after closing', 'Prevent edits after close unless reopened by authorized users', 'Maintain closing audit trail'],
  },
  {
    id: 'payroll-period-reopening',
    label: 'Payroll Period Reopening',
    description: 'Controlled reopening of closed periods through reason capture, workflow approvals, and audit history.',
    items: ['Allow controlled reopening of closed periods', 'Require reason for reopening', 'Require approval workflow', 'Track reopened-by, approved-by, reopened-date, and reason', 'Maintain before-and-after audit history'],
  },
  {
    id: 'payroll-locking-rules',
    label: 'Payroll Locking Rules',
    description: 'Lock sensitive payroll data at the correct processing milestones.',
    items: ['Lock salary changes after payroll processing starts', 'Lock employee payroll setup after validation', 'Lock payslips after approval', 'Lock payroll journal after posting', 'Lock period after closing'],
  },
  {
    id: 'payroll-period-reports',
    label: 'Payroll Period Reports',
    description: 'Period reporting for open, closed, pending, audit, checklist, exception, and calendar views.',
    items: ['Open payroll periods', 'Closed payroll periods', 'Pending payroll periods', 'Payroll period audit report', 'Payroll closing checklist', 'Payroll exception report', 'Payroll calendar report'],
  },
];

const payrollPeriodStatuses = ['Draft', 'Open', 'In Progress', 'Under Validation', 'Awaiting Approval', 'Approved', 'Paid', 'Closed', 'Reopened', 'Cancelled'];
const payrollPeriodReadiness = ['RBAC controlled', 'Approval workflow enabled', 'Audit trail active', 'Notifications ready', 'Payroll locking enforced', 'Statutory compliance mapped', 'Multi-company ready', 'Multi-location ready', 'Category filtering ready', 'Sage ERP ready'];

const roleOptions: Role[] = ['Payroll Officer', 'Payroll Supervisor', 'HR Manager', 'Finance Manager', 'CFO', 'Executive Director', 'System Administrator', 'Auditor'];
const payrollMakerRoles: Role[] = ['Payroll Officer', 'Payroll Supervisor', 'Super Admin'];
const payrollApprovalRoles: Role[] = ['HR Manager', 'Finance Manager', 'Finance Controller', 'CFO', 'Executive Director', 'Executive Management', 'Super Admin'];
const financeRoles: Role[] = ['Finance Manager', 'Finance Controller', 'CFO', 'Super Admin'];
const configRoles: Role[] = ['System Administrator', 'Super Admin'];
const viewRoles: Role[] = [...roleOptions, 'Super Admin', 'HR Director', 'HR Officer', 'Finance Controller', 'Executive Management', 'Employee'];

const action = (id: string, label: string, group: PayrollAction['group'] = 'secondary', roles: Role[] = viewRoles, sensitive = false, reasonRequired = false): PayrollAction => ({ id, label, group, roles, sensitive, reasonRequired });

const dashboardActions = [
  action('create-period', 'Create Payroll Period', 'primary', payrollMakerRoles),
  action('open-period', 'Open Current Period', 'primary', payrollMakerRoles),
  action('validate-payroll', 'Run Payroll Validation', 'workflow', payrollMakerRoles),
  action('view-exceptions', 'View Payroll Exceptions', 'secondary'),
  action('create-run', 'Process Payroll', 'primary', payrollMakerRoles, true),
  action('submit-run', 'Submit Payroll for Approval', 'workflow', payrollMakerRoles, true),
  action('approve-run', 'Approve Payroll', 'workflow', payrollApprovalRoles, true),
  action('release-run', 'Release Payroll', 'workflow', [...payrollMakerRoles, ...financeRoles], true),
  action('generate-payslips', 'Generate Payslips', 'secondary', payrollMakerRoles, true),
  action('generate-bank-schedule', 'Generate Bank Schedule', 'secondary', financeRoles, true),
  action('post-run', 'Generate Payroll Journal', 'workflow', financeRoles, true),
  action('generate-statutory-schedules', 'Generate Statutory Schedules', 'secondary', payrollMakerRoles),
  action('close-period', 'Close Payroll Period', 'workflow', [...payrollApprovalRoles, ...payrollMakerRoles], true),
  action('view-audit', 'View Audit Trail', 'audit'),
];

const actionsBySection: Partial<Record<SectionId, PayrollAction[]>> = {
  'payroll-computation-workflow': dashboardActions,
  'salary-management': [
    action('create-salary-structure', 'Create Salary Structure', 'primary', payrollMakerRoles),
    action('add-salary-grade', 'Add Salary Grade', 'primary', payrollMakerRoles),
    action('edit-salary-band', 'Edit Salary Band', 'secondary', payrollMakerRoles),
    action('clone-salary-structure', 'Clone Salary Structure', 'secondary', payrollMakerRoles),
    action('activate-salary-structure', 'Activate Salary Structure', 'workflow', payrollApprovalRoles, true),
    action('archive-salary-structure', 'Archive Salary Structure', 'secondary', payrollMakerRoles, true),
    action('map-grade-position', 'Map Grade to Position', 'secondary', payrollMakerRoles),
    action('assign-salary-grade', 'Assign Employee to Salary Grade', 'secondary', payrollMakerRoles),
    action('import-salary-setup', 'Import Employee Salary Setup', 'secondary', payrollMakerRoles),
    action('validate-salary-setup', 'Validate Salary Setup', 'workflow', payrollMakerRoles),
    action('run-compa-ratio', 'Run Compa-Ratio Analysis', 'secondary'),
    action('submit-salary-approval', 'Submit for Approval', 'workflow', payrollMakerRoles, true),
    action('approve-salary-structure', 'Approve Salary Structure', 'workflow', payrollApprovalRoles, true),
    action('publish-salary-structure', 'Publish Salary Structure', 'workflow', payrollApprovalRoles, true),
    action('view-audit', 'View Salary History', 'audit'),
  ],
  'earnings-management': [
    action('create-allowance', 'Create Allowance', 'primary', payrollMakerRoles),
    action('bulk-assign-allowance', 'Bulk Assign Allowance', 'secondary', payrollMakerRoles),
    action('import-allowances', 'Import Allowances', 'secondary', payrollMakerRoles),
    action('validate-allowances', 'Validate Allowances', 'workflow', payrollMakerRoles),
    action('approve-allowances', 'Approve Allowances', 'workflow', payrollApprovalRoles, true),
    action('create-bonus-batch', 'Create Bonus Batch', 'primary', payrollMakerRoles),
    action('validate-bonus-batch', 'Validate Bonus Batch', 'workflow', payrollMakerRoles),
    action('approve-bonus', 'Approve Bonus', 'workflow', payrollApprovalRoles, true),
    action('post-bonus-payroll', 'Post Bonus to Payroll', 'workflow', payrollMakerRoles, true),
    action('import-overtime', 'Import Overtime', 'secondary', payrollMakerRoles),
    action('recalculate-overtime', 'Recalculate Overtime', 'secondary', payrollMakerRoles),
    action('approve-overtime', 'Approve Overtime', 'workflow', payrollApprovalRoles, true),
    action('calculate-daily-pay', 'Calculate Daily Pay', 'primary', payrollMakerRoles),
    action('approve-daily-pay', 'Approve Daily Pay', 'workflow', payrollApprovalRoles, true),
    action('view-audit', 'View Earnings History', 'audit'),
  ],
  'deductions-management': [
    action('create-deduction', 'Create Deduction', 'primary', payrollMakerRoles),
    action('edit-deduction-rule', 'Edit Deduction Rule', 'secondary', payrollMakerRoles),
    action('bulk-assign-deduction', 'Bulk Assign Deduction', 'secondary', payrollMakerRoles),
    action('validate-deductions', 'Validate Deductions', 'workflow', payrollMakerRoles),
    action('approve-deductions', 'Approve Deductions', 'workflow', payrollApprovalRoles, true),
    action('suspend-deduction', 'Suspend Deduction', 'secondary', payrollMakerRoles, true),
    action('create-loan', 'Create Loan', 'primary', payrollMakerRoles),
    action('generate-repayment-schedule', 'Generate Repayment Schedule', 'secondary', payrollMakerRoles),
    action('approve-loan', 'Approve Loan', 'workflow', payrollApprovalRoles, true),
    action('post-loan-deduction', 'Post Loan Deduction to Payroll', 'workflow', payrollMakerRoles, true),
    action('view-audit', 'View Deduction History', 'audit'),
  ],
  'payroll-processing': [
    action('create-period', 'Create Payroll Period', 'primary', payrollMakerRoles),
    action('open-period', 'Open Payroll Period', 'primary', payrollMakerRoles),
    action('freeze-period', 'Freeze Payroll Period', 'secondary', payrollMakerRoles, true),
    action('create-run', 'Run Payroll', 'primary', payrollMakerRoles, true),
    action('validate-payroll', 'Run Validation', 'workflow', payrollMakerRoles),
    action('submit-run', 'Submit for Approval', 'workflow', payrollMakerRoles, true),
    action('approve-run', 'Approve Payroll', 'workflow', payrollApprovalRoles, true),
    action('release-run', 'Release Payroll', 'workflow', [...payrollMakerRoles, ...financeRoles], true),
    action('reject-run', 'Reject Payroll', 'workflow', payrollApprovalRoles, true, true),
    action('request-revision', 'Request Revision', 'workflow', payrollApprovalRoles, true, true),
    action('generate-payslips', 'Publish Payslips to ESS', 'workflow', payrollMakerRoles, true),
    action('post-run', 'Post Journal', 'workflow', financeRoles, true),
    action('close-period', 'Close Period', 'workflow', [...payrollApprovalRoles, ...payrollMakerRoles], true),
    action('reopen-period', 'Reopen Period', 'workflow', ['CFO', 'Executive Director', 'Super Admin'], true, true),
    action('view-audit', 'View Period Audit Trail', 'audit'),
  ],
  'compliance-statutory-management': [
    action('create-tax-version', 'Create Tax Version', 'primary', configRoles),
    action('validate-tax-config', 'Validate Tax Configuration', 'workflow', [...configRoles, ...payrollMakerRoles]),
    action('run-paye-calculation', 'Run PAYE Calculation', 'primary', payrollMakerRoles),
    action('generate-paye-schedule', 'Generate PAYE Schedule', 'secondary', payrollMakerRoles),
    action('mark-paye-remitted', 'Mark PAYE as Remitted', 'workflow', financeRoles, true),
    action('configure-statutory-rule', 'Configure Statutory Rule', 'primary', configRoles),
    action('run-statutory-calculation', 'Run Statutory Calculation', 'primary', payrollMakerRoles),
    action('export-remittance-file', 'Export Remittance File', 'secondary', financeRoles, true),
    action('upload-remittance-evidence', 'Upload Evidence of Remittance', 'secondary', financeRoles),
    action('approve-configuration', 'Approve Configuration', 'workflow', payrollApprovalRoles, true),
    action('view-audit', 'View Tax Audit Trail', 'audit'),
  ],
  'finance-integration': [
    action('generate-bank-schedule', 'Generate Bank Payment Schedule', 'primary', financeRoles, true),
    action('validate-bank-accounts', 'Validate Bank Accounts', 'workflow', financeRoles),
    action('export-bank-file', 'Export Bank Payment File', 'workflow', financeRoles, true),
    action('mark-payment-sent', 'Mark Payment Sent', 'workflow', financeRoles, true),
    action('mark-payment-confirmed', 'Mark Payment Confirmed', 'workflow', financeRoles, true),
    action('reconcile-bank-payment', 'Reconcile Bank Payment', 'secondary', financeRoles),
    action('post-run', 'Post Journal to Finance', 'workflow', financeRoles, true),
    action('export-journal-sage', 'Export Journal to Sage', 'secondary', financeRoles, true),
    action('reverse-journal-posting', 'Reverse Journal Posting', 'workflow', financeRoles, true, true),
    action('view-audit', 'View Finance Approval History', 'audit'),
  ],
  'reports-analytics': [
    action('generate-report', 'Generate Report', 'primary'),
    action('filter-report', 'Filter Report', 'secondary'),
    action('export-excel', 'Export Excel', 'secondary'),
    action('export-pdf', 'Export PDF', 'secondary'),
    action('export-csv', 'Export CSV', 'secondary'),
    action('schedule-report', 'Schedule Report', 'workflow', payrollMakerRoles),
    action('email-report', 'Email Report', 'secondary'),
    action('save-report-view', 'Save Report View', 'secondary'),
    action('view-audit', 'Download Audit Report', 'audit'),
  ],
};

const sectionAliases: Record<string, SectionId> = {
  'payroll-dashboard': 'dashboard',
  workflow: 'payroll-computation-workflow',
  'workflow-status': 'payroll-computation-workflow',
  'payroll-workflow-status': 'payroll-computation-workflow',
  'payroll-computation-and-approval-workflow': 'payroll-computation-workflow',
  'pay-setup': 'salary-management',
  statutory: 'compliance-statutory-management',
  'compliance-and-statutory-management': 'compliance-statutory-management',
  'process-payroll': 'payroll-processing',
  'bank-and-finance': 'finance-integration',
  'bank-payments-and-finance-integration': 'finance-integration',
  reports: 'reports-analytics',
  'reports-and-analytics': 'reports-analytics',
};

const sectionById = (id?: string) => {
  const normalized = id || 'dashboard';
  const resolved = sectionAliases[normalized] || normalized;
  return sections.find((section) => section.id === resolved) || sections[0];
};

const sectionHref = (id: SectionId) => id === 'dashboard' ? '/hris/payroll-management' : `/hris/payroll-management/${id}`;

const actionsFor = (section: SectionConfig, tab: TabConfig) => {
  if (section.id === 'dashboard') return dashboardActions;
  const base = actionsBySection[section.id] || [];
  if (tab.id === 'payroll-period-management') return actionsBySection['payroll-processing'] || [];
  return base;
};

const canRunAction = (actionItem: PayrollAction, role: Role, payload: PayrollPayload | null) => {
  if (role === 'Auditor' && actionItem.group !== 'audit' && !actionItem.id.startsWith('export') && !actionItem.id.startsWith('view')) {
    return { allowed: false, reason: 'Auditors can view reports, exports, history, and audit trails only.' };
  }
  if (actionItem.roles && !actionItem.roles.includes(role)) return { allowed: false, reason: `${role} is not authorized for this action.` };
  const run = payload?.runs[0];
  const status = run?.status || 'Draft';
  const exceptions = payload?.summary.exceptionCount || 0;
  if (['approve-run'].includes(actionItem.id) && exceptions > 0) return { allowed: false, reason: 'Resolve validation exceptions before approval.' };
  if (actionItem.id === 'release-run' && status !== 'Approved') return { allowed: false, reason: 'Payroll approval is required before release.' };
  if (['generate-payslips', 'generate-bank-schedule', 'generate-statutory-schedules', 'export-bank-file', 'post-run'].includes(actionItem.id) && !['Approved', 'Released', 'Locked', 'Posted', 'Published'].includes(status)) return { allowed: false, reason: 'Payroll approval is required first.' };
  if (actionItem.id === 'close-period' && status !== 'Posted') return { allowed: false, reason: 'Close is blocked until payslips, bank schedule, journal, and statutory schedules are complete.' };
  if (status === 'Closed' && !['reopen-period', 'view-audit', 'generate-report', 'export-csv', 'export-excel', 'export-pdf'].includes(actionItem.id)) return { allowed: false, reason: 'Closed periods are locked until approved reopening.' };
  return { allowed: true, reason: '' };
};

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`relative overflow-hidden rounded-lg border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-normal text-slate-600">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${styles.bar}`} />
    </div>
  );
}

function MiniDashboardCard({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`rounded-lg border bg-white p-3 ${styles.card}`}>
      <p className={`text-[10px] font-black uppercase ${styles.text}`}>{label}</p>
      <p className="mt-2 truncate text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, tone = 'slate' }: { label: string; icon: any; onClick: () => void; disabled?: boolean; tone?: Tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-extrabold transition-colors ${
        disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : `${toneStyles[tone].button} border-transparent`
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function FeaturePanel({ tab, section, payload, canViewMoney }: { tab: TabConfig; section: SectionConfig; payload: PayrollPayload | null; canViewMoney: boolean }) {
  const tone = toneStyles[section.tone];
  const relatedRows = payload?.breakdowns.byPayrollGroup.slice(0, 4) || [];
  const descriptors: Record<string, { eyebrow: string; headline: string; body: string; focus: string[]; side: string }> = {
    'earnings-management': {
      eyebrow: 'Earnings',
      headline: 'Manage what employees earn',
      body: 'Use this area for allowances, overtime, bonuses, daily-rate pay, and earning rules before payroll is processed.',
      focus: ['Allowances', 'Overtime Pay', 'Bonus Inputs', 'Daily Rate Pay'],
      side: 'Earning Impact',
    },
    'deductions-management': {
      eyebrow: 'Deductions',
      headline: 'Control employee deductions',
      body: 'Review statutory deductions, loans, salary advances, union dues, and other employee deduction rules.',
      focus: ['PAYE / Pension / NHF', 'Loans', 'Union Dues', 'Custom Deductions'],
      side: 'Deduction Impact',
    },
    'compliance-statutory-management': {
      eyebrow: 'Statutory',
      headline: 'Prepare compliance schedules',
      body: 'Generate and review PAYE, pension, NHF, NSITF, ITF, and regulatory reports from payroll-ready data.',
      focus: ['PAYE Schedule', 'Pension Schedule', 'NHF / NSITF / ITF', 'Returns'],
      side: 'Compliance Summary',
    },
    'finance-integration': {
      eyebrow: 'Bank & Finance',
      headline: 'Prepare payment and journal outputs',
      body: 'Generate bank schedules, payment files, payroll journals, GL mappings, and reconciliation evidence.',
      focus: ['Bank Schedule', 'Payment Files', 'Payroll Journal', 'Reconciliation'],
      side: 'Finance Summary',
    },
    'reports-analytics': {
      eyebrow: 'Reports',
      headline: 'Find and export payroll reports',
      body: 'Access payroll registers, statutory schedules, variance reports, audit reports, and executive summaries.',
      focus: ['Payroll Register', 'Statutory Reports', 'Variance Reports', 'Audit Reports'],
      side: 'Report Summary',
    },
  };
  const descriptor = descriptors[section.id] || {
    eyebrow: section.label,
    headline: section.title,
    body: section.description,
    focus: tab.items.slice(0, 4),
    side: 'Live Summary',
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
      <section className={`rounded-lg border p-4 shadow-sm ${tone.card}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-xs font-black uppercase ${tone.text}`}>{descriptor.eyebrow}</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{descriptor.headline}</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">{descriptor.body}</p>
          </div>
          {tab.legacyHref ? (
            <Link href={tab.legacyHref} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-black ${tone.button}`}>
              Open Workspace <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {descriptor.focus.map((item) => (
            <div key={item} className="rounded-lg border border-white/80 bg-white p-4 shadow-sm">
              <CheckCircle2 className={`h-5 w-5 ${tone.text}`} />
              <p className="mt-3 text-sm font-black text-slate-950">{item}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Ready for review</p>
            </div>
          ))}
        </div>
        <details className="mt-4 rounded-lg border border-white/80 bg-white p-4">
          <summary className="cursor-pointer text-xs font-black uppercase text-slate-700">{tab.label} details</summary>
          <p className="mt-2 text-sm font-semibold text-slate-600">{tab.description}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {tab.items.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${tone.text}`} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">{descriptor.side}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-[10px] font-black uppercase text-blue-700">Employees</p>
            <p className="mt-1 text-xl font-black text-slate-950">{number(payload?.summary.payrollEligible)}</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-[10px] font-black uppercase text-red-700">Exceptions</p>
            <p className="mt-1 text-xl font-black text-slate-950">{number(payload?.summary.exceptionCount)}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[10px] font-black uppercase text-emerald-700">Net Payroll</p>
            <p className="mt-1 truncate text-sm font-black text-slate-950">{money(payload?.summary.netPay, canViewMoney)}</p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-[10px] font-black uppercase text-violet-700">Period</p>
            <p className="mt-1 text-sm font-black text-slate-950">{payload?.periodLabel || 'Loading'}</p>
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-black uppercase text-slate-600">Payroll group details</summary>
          <div className="mt-3 space-y-3">
          {relatedRows.map((row) => (
            <div key={row.label} className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-black text-slate-800">{row.label}</p>
                <p className="text-xs font-black text-slate-950">{number(row.employees)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(8, (row.employees / Math.max(1, payload?.summary.totalEmployees || 1)) * 100))}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-slate-600">{money(row.netPay, canViewMoney)} net - {number(row.exceptions)} exceptions</p>
            </div>
          ))}
          </div>
        </details>
      </section>
    </div>
  );
}

function PaySetupWorkspace({ activeTab, payload, canViewMoney }: { activeTab: TabConfig; payload: PayrollPayload | null; canViewMoney: boolean }) {
  const records = payload?.records || [];
  const categoryRows = [
    { label: 'Permanent', count: records.filter((record) => /permanent/i.test(`${record.employmentType} ${record.payrollGroup}`)).length, tone: 'blue' as Tone },
    { label: 'Lumpsum', count: records.filter((record) => /lump|gross/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`)).length, tone: 'violet' as Tone },
    { label: 'Daily Rate', count: records.filter((record) => record.isDailyRate || /daily|day/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`)).length, tone: 'amber' as Tone },
    { label: 'Contract', count: records.filter((record) => /contract/i.test(`${record.employmentType} ${record.payrollGroup}`)).length, tone: 'cyan' as Tone },
  ];
  const setupCards = [
    { title: 'Salary Structure', detail: 'Grade bands, pay ranges, and earning profiles.', href: '/hris/payroll/salary-structure', icon: GitBranch, tone: 'blue' as Tone },
    { title: 'Salary Grades', detail: 'Grade hierarchy, eligibility, and grade-to-role mapping.', href: '/hris/organization/job-grades', icon: BarChart3, tone: 'green' as Tone },
    { title: 'Employee Pay Setup', detail: 'Basic salary, payroll group, deductions, bank and statutory setup.', href: '/hris/payroll/employee-salary-setup', icon: Users, tone: 'violet' as Tone },
    { title: 'Sage Migration Review', detail: 'Compare migrated Sage payroll setup against HRIS values.', href: '/hris/payroll/sage-migration-review', icon: DatabaseZap, tone: 'amber' as Tone },
  ];
  const issues = (payload?.exceptions || []).filter((item) => /salary|grade|setup|bank|pension|tax|nhf/i.test(item.issue)).slice(0, 5);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-emerald-800">Pay Setup</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Prepare employees for accurate payroll</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">Keep compensation setup separate from payroll processing. Use this page for structures, grades, employee setup, and Sage migration checks.</p>
          </div>
          {activeTab.legacyHref ? (
            <Link href={activeTab.legacyHref} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800">
              Open {activeTab.label}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {setupCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneStyles[card.tone].card}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneStyles[card.tone].icon}`}><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-base font-black text-slate-950">{card.title}</h3>
              <p className="mt-1 min-h-10 text-xs font-semibold text-slate-600">{card.detail}</p>
              <p className={`mt-4 inline-flex items-center gap-1 text-xs font-black ${toneStyles[card.tone].text}`}>Open workspace <ChevronRight className="h-3.5 w-3.5" /></p>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Employee Category Readiness</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categoryRows.map((item) => {
              const ready = records.length ? Math.round((records.filter((record) => record.payrollStatus === 'Ready').length / records.length) * 100) : 0;
              return (
                <div key={item.label} className={`rounded-lg border p-4 ${toneStyles[item.tone].card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-black text-slate-950">{item.label}</p><p className="mt-1 text-xs font-semibold text-slate-600">{number(item.count)} employees</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${toneStyles[item.tone].chip}`}>{ready}% ready</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80"><div className={`h-full ${toneStyles[item.tone].bar}`} style={{ width: `${ready}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Setup Issues</h3>
          <div className="mt-3 space-y-2">
            {issues.map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-black text-slate-950">{item.employeeName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.issue}</p>
              </div>
            ))}
            {!issues.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">No pay setup issues found.</div> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">{activeTab.label}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-600">{activeTab.description}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activeTab.items.map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProcessPayrollWorkspace({
  activeTab,
  payload,
  canViewMoney,
  runAction,
  busyAction,
}: {
  activeTab: TabConfig;
  payload: PayrollPayload | null;
  canViewMoney: boolean;
  runAction: (action: string, reason?: string) => void;
  busyAction: string;
}) {
  const currentRun = payload?.runs[0] || null;
  const status = currentRun?.status || payload?.workflow?.currentStatus || 'Draft';
  const steps = [
    { label: 'Validate', detail: 'Check master data and exceptions', action: 'validate-payroll', done: Boolean(currentRun?.validatedAt) || ['Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status), tone: 'blue' as Tone },
    { label: 'Run Payroll', detail: 'Compute gross, deductions and net pay', action: 'create-run', done: ['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status), tone: 'green' as Tone },
    { label: 'Submit', detail: 'Send payroll for approval', action: 'submit-run', done: Boolean(currentRun?.submittedAt) || ['Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status), tone: 'amber' as Tone },
    { label: 'Approve', detail: 'HR / Finance / CFO review', action: 'approve-run', done: Boolean(currentRun?.approvedAt) || ['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status), tone: 'violet' as Tone },
    { label: 'Release', detail: 'Release payroll for outputs', action: 'release-run', done: Boolean(currentRun?.releasedAt) || ['Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status), tone: 'cyan' as Tone },
    { label: 'Publish', detail: 'Generate payslips and reports', action: 'generate-payslips', done: Boolean(currentRun?.payslipsGeneratedAt) || ['Published', 'Closed'].includes(status), tone: 'green' as Tone },
  ];
  const outputs = [
    { label: 'Payslips', done: Boolean(currentRun?.payslipsGeneratedAt), icon: ReceiptText },
    { label: 'Bank Schedule', done: Boolean(currentRun?.bankScheduleGeneratedAt), icon: CreditCard },
    { label: 'Statutory Schedules', done: Boolean(currentRun?.statutorySchedulesGeneratedAt), icon: FileCheck2 },
    { label: 'Journal Posted', done: Boolean(currentRun?.postedAt), icon: Send },
  ];
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-amber-800">Process Payroll</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Run payroll step by step</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">Use this page only for payroll execution: validation, computation, approval, release, posting, and payslip publication.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(status)].chip}`}>{status}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Payroll Run Sequence</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, index) => (
              <button key={step.label} type="button" onClick={() => runAction(step.action)} disabled={busyAction === step.action || step.done} className={`rounded-lg border p-4 text-left transition ${step.done ? 'border-emerald-200 bg-emerald-50' : `${toneStyles[step.tone].card} hover:shadow-md`}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step.done ? toneStyles.green.icon : toneStyles[step.tone].icon}`}>{step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${step.done ? toneStyles.green.chip : toneStyles.slate.chip}`}>{step.done ? 'Done' : 'Open'}</span>
                </div>
                <p className="mt-3 text-sm font-black text-slate-950">{step.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{step.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Run Summary</h3>
          <div className="mt-3 space-y-2">
            <InfoTile label="Net Payroll" value={money(payload?.summary.netPay, canViewMoney)} detail={`${number(payload?.summary.payrollEligible)} employees`} tone="green" />
            <InfoTile label="Exceptions" value={number(payload?.summary.exceptionCount)} detail={`${number(payload?.summary.blockedEmployees)} blocked`} tone={(payload?.summary.exceptionCount || 0) ? 'red' : 'green'} />
            <InfoTile label="Next Owner" value={payload?.workflow?.nextOwner || 'Payroll Officer'} detail={payload?.workflow?.approvalStage || activeTab.label} tone="blue" />
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Required Outputs</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {outputs.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`rounded-lg border p-4 ${item.done ? toneStyles.green.card : toneStyles.slate.card}`}>
                <Icon className={`h-5 w-5 ${item.done ? toneStyles.green.text : toneStyles.slate.text}`} />
                <p className="mt-3 text-sm font-black text-slate-950">{item.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.done ? 'Completed' : 'Waiting'}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SalaryManagementWorkspace({ activeTab, payload, canViewMoney }: { activeTab: TabConfig; payload: PayrollPayload | null; canViewMoney: boolean }) {
  const records = payload?.records || [];
  const gradeMap = new Map<string, { employees: number; grossPay: number; netPay: number; exceptions: number }>();
  records.forEach((record) => {
    const grade = record.isDailyRate ? payrollRate(record, canViewMoney) : record.salaryGrade || 'Unassigned';
    const current = gradeMap.get(grade) || { employees: 0, grossPay: 0, netPay: 0, exceptions: 0 };
    current.employees += 1;
    current.grossPay += record.grossPay || 0;
    current.netPay += record.netPay || 0;
    current.exceptions += record.exceptionCount || 0;
    gradeMap.set(grade, current);
  });
  const gradeRows = Array.from(gradeMap.entries())
    .map(([grade, values]) => ({ grade, ...values }))
    .sort((a, b) => b.employees - a.employees)
    .slice(0, 10);
  const missingSalaryRows = records.filter((record) => !record.grossPay || record.exceptions.some((item) => item.toLowerCase().includes('salary'))).slice(0, 6);
  const permanentCount = records.filter((record) => /permanent/i.test(`${record.employmentType} ${record.payrollGroup}`)).length;
  const lumpSumCount = records.filter((record) => /lump|gross/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`)).length;
  const dailyRateCount = records.filter((record) => /daily|day/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`)).length;
  const salaryWorkspaces = [
    {
      title: 'Salary Structure',
      detail: 'Grades, bands, midpoint, compa-ratio, distribution, and structure exceptions.',
      href: '/hris/payroll/salary-structure',
      tone: 'blue' as Tone,
      icon: GitBranch,
      value: number(gradeRows.length),
      label: 'active grade groups',
    },
    {
      title: 'Employee Salary Setup',
      detail: 'Employee gross pay, basic pay, payroll group, salary grade, and eligibility setup.',
      href: '/hris/payroll/employee-salary-setup',
      tone: 'green' as Tone,
      icon: Users,
      value: number(payload?.summary.payrollEligible),
      label: 'payroll eligible',
    },
    {
      title: 'Sage Migration Review',
      detail: 'Permanent and lump-sum gross salary reconciliation from Sage 300 into HRIS.',
      href: '/hris/payroll/sage-migration-review',
      tone: 'violet' as Tone,
      icon: DatabaseZap,
      value: number(permanentCount + lumpSumCount),
      label: 'migration records',
    },
    {
      title: 'Daily Rate Pay',
      detail: 'Contract daily-rate employees, day rates, hourly equivalent, and payroll-ready days.',
      href: '/hris/payroll/daily-rate-pay',
      tone: 'amber' as Tone,
      icon: CalendarClock,
      value: number(dailyRateCount),
      label: 'daily-rate employees',
    },
  ];
  const profileRows = [
    { label: 'Permanent Staff', employees: permanentCount, detail: 'Monthly gross salary and permanent earning profile', tone: 'blue' as Tone },
    { label: 'Lump-Sum Staff', employees: lumpSumCount, detail: 'Monthly gross split into taxable and non-taxable lump-sum earnings', tone: 'violet' as Tone },
    { label: 'Daily-Rate Staff', employees: dailyRateCount, detail: 'Day-rate payroll driven by attendance and approved days worked', tone: 'amber' as Tone },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Salary Management Control Desk</h3>
            <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">Maintain salary structures, reconcile Sage gross salaries, map employees to payroll profiles, and clear salary setup exceptions before payroll processing.</p>
          </div>
          {activeTab.legacyHref ? (
            <Link href={activeTab.legacyHref} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800">
              Open {activeTab.label} <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoTile label="Salary Records" value={number(records.length)} detail={`${number(payload?.summary.payrollEligible)} payroll eligible`} tone="blue" />
          <InfoTile label="Gross Payroll" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${money(payload?.summary.basePay, canViewMoney)} basic/base pay`} tone="green" />
          <InfoTile label="Setup Exceptions" value={number(payload?.summary.exceptionCount)} detail={`${number(payload?.summary.blockedEmployees)} blocked records`} tone={(payload?.summary.exceptionCount || 0) ? 'red' : 'green'} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {salaryWorkspaces.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className={`block rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneStyles[item.tone].card}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{item.detail}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles[item.tone].icon}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-slate-950">{item.value}</p>
                  <p className="text-xs font-bold text-slate-600">{item.label}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-black text-slate-700">Open <ChevronRight className="h-4 w-4" /></span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-950">Salary Structure Register</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Current employee distribution by salary grade and payroll value.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>{['Grade', 'Employees', 'Gross', 'Net', 'Exceptions', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeRows.map((row) => (
                  <tr key={row.grade} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-black text-slate-950">{row.grade}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(row.employees)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(row.grossPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(row.netPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(row.exceptions)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${row.exceptions ? toneStyles.red.chip : toneStyles.green.chip}`}>{row.exceptions ? 'Review' : 'Ready'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Employee Pay Profiles</h3>
          <div className="mt-3 space-y-3">
            {profileRows.map((row) => (
              <div key={row.label} className={`rounded-lg border p-3 ${toneStyles[row.tone].card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{row.label}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{row.detail}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${toneStyles[row.tone].chip}`}>{number(row.employees)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase text-slate-500">Active Tab</p>
            <p className="mt-1 text-sm font-black text-slate-950">{activeTab.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{activeTab.description}</p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-950">Salary Setup Exceptions</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">Records requiring salary, grade, payroll group, or migration review before payroll run.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${missingSalaryRows.length ? toneStyles.red.chip : toneStyles.green.chip}`}>{number(missingSalaryRows.length)} visible</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {missingSalaryRows.length ? missingSalaryRows.map((record) => (
            <div key={record.employeeId} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr]">
              <div><p className="text-sm font-black text-slate-950">{record.fullName}</p><p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Grade</p><p className="text-sm font-bold text-slate-800">{record.salaryGrade || 'Unassigned'}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Gross</p><p className="text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Exception</p><p className="text-sm font-semibold text-slate-700">{record.exceptions[0] || 'Salary setup requires review'}</p></div>
            </div>
          )) : <div className="p-4 text-sm font-bold text-emerald-700">No salary setup exceptions are visible for this period.</div>}
        </div>
      </section>
    </div>
  );
}

function PayrollComputationWorkflowPage({ payload, canViewMoney, role, runAction, busyAction, onAudit, exportCsv, exportExcel }: { payload: PayrollPayload | null; canViewMoney: boolean; role: Role; runAction: (action: string, reason?: string) => Promise<void>; busyAction: string; onAudit: () => void; exportCsv: () => void; exportExcel: () => void }) {
  const currentRun = payload?.runs[0] || null;
  const status = currentRun?.status || payload?.workflow?.currentStatus || 'Draft';
  const payrollEligible = payload?.summary.payrollEligible || 0;
  const readyEmployees = payload?.summary.readyEmployees || 0;
  const readiness = payrollEligible ? Math.round((readyEmployees / payrollEligible) * 100) : 0;
  const pendingApprovals = ['Ready for Approval', 'Submitted', 'Under Review'].includes(status) ? 1 : 0;
  const validationBlocked = (payload?.summary.blockedEmployees || 0) > 0 || (payload?.summary.exceptionCount || 0) > 0;
  const stageStamp = (value?: string | null) => value ? new Date(value).toLocaleString('en-GB') : 'Pending';
  const completed = (states: string[], date?: string | null) => Boolean(date) || states.includes(status);
  const requestReason = (actionId: string, label: string) => {
    const reason = window.prompt(`${label} reason / comment`);
    if (reason === null) return;
    void runAction(actionId, reason.trim());
  };
  const quickAction = (id: string, label: string, tone: Tone, sensitive = false) => (
    <button key={id} type="button" disabled={busyAction === id} onClick={() => sensitive ? requestReason(id, label) : void runAction(id)} className={`min-h-9 rounded-lg px-3 text-[11px] font-black transition ${busyAction === id ? 'cursor-not-allowed bg-slate-100 text-slate-400' : toneStyles[tone].button}`}>
      {busyAction === id ? 'Working...' : label}
    </button>
  );
  const checks = [
    ['Active employees', payrollEligible > 0],
    ['Bank details available', (payload?.records || []).filter((row) => row.payrollStatus !== 'Blocked').length > 0],
    ['Payroll profile assigned', (payload?.records || []).every((row) => row.setupAssignedToPayroll || row.payrollStatus !== 'Blocked')],
    ['Tax setup complete', !payload?.exceptions?.some((item) => /tax|paye/i.test(item.issue))],
    ['Pension setup complete', !payload?.exceptions?.some((item) => /pension/i.test(item.issue))],
    ['NHF setup complete', !payload?.exceptions?.some((item) => /nhf/i.test(item.issue))],
    ['Attendance processed', true],
    ['Timesheets approved', true],
    ['Leave processed', true],
    ['No duplicate payroll', !payload?.exceptions?.some((item) => /duplicate/i.test(item.issue))],
    ['No missing structures', !payload?.exceptions?.some((item) => /structure|salary/i.test(item.issue))],
    ['No missing grades', !payload?.exceptions?.some((item) => /grade/i.test(item.issue))],
    ['No missing cost centres', !payload?.exceptions?.some((item) => /cost/i.test(item.issue))],
    ['No missing projects', !payload?.exceptions?.some((item) => /project/i.test(item.issue))],
  ] as const;
  const approvalCards = [
    { code: '4.1', title: 'Payroll Officer', tone: 'blue' as Tone, owner: currentRun?.createdBy || 'Payroll Officer', statusText: 'Draft', done: completed(['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.createdAt), date: currentRun?.createdAt, actions: ['Generate Payroll', 'Validate Payroll', 'Review Exceptions'] },
    { code: '4.2', title: 'HR Manager', tone: 'green' as Tone, owner: currentRun?.submittedBy || 'HR Manager', statusText: 'HR Reviewed', done: completed(['Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.submittedAt), date: currentRun?.submittedAt, actions: ['Review New Employees', 'Review Exits', 'Review Promotions', 'Review Salary Changes', 'Review Leave Impact'] },
    { code: '4.3', title: 'Finance Manager', tone: 'amber' as Tone, owner: 'Finance Manager', statusText: 'Finance Reviewed', done: completed(['Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed']), date: currentRun?.approvedAt, actions: ['Review Cost Centre Impact', 'Review Budget Availability', 'Review Variance Analysis'] },
    { code: '4.4', title: 'CFO', tone: 'violet' as Tone, owner: currentRun?.approvedBy || 'CFO', statusText: 'CFO Approved', done: completed(['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.approvedAt), date: currentRun?.approvedAt, actions: ['Review Payroll Summary', 'Review Variance Analysis', 'Review Headcount Changes'] },
    { code: '4.5', title: 'MD / CEO Optional', tone: 'cyan' as Tone, owner: 'MD / CEO', statusText: 'Final Approved', done: completed(['Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.releasedAt), date: currentRun?.releasedAt, actions: ['Final Review', 'Executive Approval'] },
  ];
  const releaseSteps = [
    ['Payroll Released', completed(['Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.releasedAt), currentRun?.releasedAt, Landmark],
    ['Bank Schedule Generated', Boolean(currentRun?.bankScheduleGeneratedAt), currentRun?.bankScheduleGeneratedAt, FileText],
    ['Payments Processed', completed(['Posted', 'Closed'], currentRun?.postedAt), currentRun?.postedAt, Banknote],
    ['Payslips Published', completed(['Published', 'Closed'], currentRun?.payslipsGeneratedAt), currentRun?.payslipsGeneratedAt, Mail],
    ['Notifications Sent', Boolean(currentRun?.payslipsGeneratedAt), currentRun?.payslipsGeneratedAt, Bell],
  ] as const;
  const summaryStages = [
    { label: 'Draft', owner: currentRun?.createdBy || 'Payroll Officer', done: Boolean(currentRun?.createdAt) || completed(['Draft', 'Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed']), targetId: 'payroll-stage-data' },
    { label: 'Pre-Validation', owner: 'Payroll Supervisor', done: completed(['Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.validatedAt), targetId: 'payroll-stage-validation' },
    { label: 'Payroll Computation', owner: 'Payroll Officer', done: completed(['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed']), targetId: 'payroll-stage-computation' },
    { label: 'Approval Workflow', owner: payload?.workflow?.nextOwner || 'HR / Finance / CFO', done: completed(['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.approvedAt), targetId: 'payroll-stage-approval' },
    { label: 'Payroll Release', owner: 'Payroll / Finance', done: completed(['Released', 'Locked', 'Posted', 'Published', 'Closed'], currentRun?.releasedAt), targetId: 'payroll-stage-release' },
    { label: 'Payroll Lock', owner: 'System Control', done: completed(['Locked', 'Posted', 'Published', 'Closed'], currentRun?.lockedAt), targetId: 'payroll-stage-lock' },
  ];
  let firstOpenStageFound = false;
  const workflowSummary = summaryStages.map((stage) => {
    const current = !stage.done && !firstOpenStageFound;
    if (current) firstOpenStageFound = true;
    return { ...stage, current };
  });
  const jumpToStage = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };
  const outputs = {
    'Employee Outputs': ['Payslip', 'Tax Summary', 'Pension Summary'],
    'Management Outputs': ['Payroll Register', 'Department Summary', 'Cost Centre Summary', 'Project Payroll Summary'],
    'Statutory Outputs': ['PAYE Schedule', 'Pension Schedule', 'NHF Schedule', 'NSITF Schedule', 'ITF Schedule'],
  };
  const legend = [
    ['Data Collection', 'bg-blue-600'],
    ['Validation', 'bg-emerald-600'],
    ['Computation', 'bg-violet-600'],
    ['Approval', 'bg-slate-900'],
    ['Release / Output', 'bg-cyan-600'],
  ] as const;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase tracking-normal text-slate-950 md:text-4xl">Payroll Computation & Approval Workflow</h2>
          <p className="mt-1 text-base font-semibold text-slate-500 md:text-xl">End-to-End Payroll Process with Multi-Level Approval and Audit Control</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(status)].chip}`}>Live status: {status}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Current owner: {payload?.workflow?.nextOwner || 'Payroll Officer'}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">Updated: {payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-GB') : 'Loading'}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Auto refresh: 30s</span>
        </div>
        <WorkflowSummaryTracker stages={workflowSummary} onSelect={jumpToStage} />
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="min-w-[1420px]">
          <div className="grid grid-cols-[180px_24px_180px_24px_200px_24px_1fr_24px_190px] gap-2">
            <div className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-black uppercase text-white shadow-sm">1. Data Collection</div>
            <div />
            <div className="rounded-md bg-emerald-700 px-3 py-2 text-center text-sm font-black uppercase text-white shadow-sm">2. Pre-Validation</div>
            <div />
            <div className="rounded-md bg-violet-700 px-3 py-2 text-center text-sm font-black uppercase text-white shadow-sm">3. Payroll Computation</div>
            <div />
            <div className="rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-black uppercase text-white shadow-sm">4. Approval Workflow</div>
            <div />
            <div className="rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-black uppercase text-white shadow-sm">5. Payroll Release</div>
          </div>
          <div className="mt-3 grid grid-cols-[180px_24px_180px_24px_200px_24px_1fr_24px_190px] items-center gap-2">
            <WorkflowStageCard id="payroll-stage-data" tone="blue" title="Data Collection" icon={Users}>
              <StageBlock icon={Users} title="Employee Information" items={['Personal & Job Details', 'Employment Status', 'Department / Grade', 'Cost Centre / Project', 'Payroll Group']} />
              <StageBlock icon={WalletCards} title="Earnings" items={['Allowances, OT', 'Bonus, Arrears']} />
              <StageBlock icon={ReceiptText} title="Deductions" items={['PAYE, Pension', 'NHF, Loans, etc.']} />
              <StageBlock icon={CalendarClock} title="Time Data" items={['Attendance, Leave', 'Timesheets, OT']} />
            </WorkflowStageCard>
            <WorkflowArrow tone="blue" />
            <WorkflowStageCard id="payroll-stage-validation" tone="green" title="Pre-Validation" icon={ShieldCheck}>
              <div className="space-y-1">
                {checks.map(([label, ok]) => (
                  <div key={label} className="flex items-center gap-2 text-[12px] font-bold text-slate-800"><CheckCircle2 className={`h-4 w-4 shrink-0 ${ok ? 'text-emerald-600' : 'text-red-600'}`} /><span>{label}</span></div>
                ))}
              </div>
              <div className={`mt-3 rounded-lg border p-2 text-center text-xs font-black ${validationBlocked ? toneStyles.red.card : toneStyles.green.card}`}>Payroll Validation Report Generated</div>
            </WorkflowStageCard>
            <WorkflowArrow tone="green" />
            <WorkflowStageCard id="payroll-stage-computation" tone="violet" title="Payroll Computation" icon={Calculator}>
              <div className="rounded-lg border border-violet-200 bg-violet-50">
                <div className="rounded-t-lg bg-violet-200 py-1 text-center text-sm font-black text-violet-950">Gross Earnings</div>
                {['Basic Salary', 'Variable Earnings', 'Overtime', 'Bonus', 'Arrears', 'Other Earnings'].map((item) => <p key={item} className="px-3 py-1 text-xs font-bold text-slate-800">+ {item}</p>)}
              </div>
              <div className="my-2 rounded-md bg-violet-700 py-2 text-center text-sm font-black text-white">= Gross Pay</div>
              <div className="rounded-lg border border-red-200 bg-red-50">
                <div className="rounded-t-lg bg-red-100 py-1 text-center text-sm font-black text-red-800">Less Deductions</div>
                {['PAYE', 'Pension', 'NHF', 'Loans', 'Cooperative Deductions', 'Other Deductions'].map((item) => <p key={item} className="px-3 py-1 text-xs font-bold text-slate-800">- {item}</p>)}
              </div>
              <div className="mt-2 rounded-md bg-fuchsia-700 py-2 text-center text-sm font-black text-white">= Net Pay</div>
              <div className="mt-3 rounded-lg border border-violet-100 bg-white p-2">
                <p className="text-xs font-black uppercase text-violet-800">Payroll Types Supported</p>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-bold text-slate-700">{['Monthly', 'Weekly', 'Contract', 'Daily Rate', 'Bonus', 'Off-Cycle', 'Final Settlement'].map((item) => <span key={item}>• {item}</span>)}</div>
              </div>
            </WorkflowStageCard>
            <WorkflowArrow tone="violet" />
            <div id="payroll-stage-approval" className="scroll-mt-24">
              <div className="grid grid-cols-5 gap-2">
                {approvalCards.map((card) => (
                  <div key={card.title} className={`min-h-[370px] rounded-lg border bg-white p-3 shadow-sm ${card.done ? 'border-emerald-200' : 'border-slate-200'}`}>
                    <div className="flex flex-col items-center text-center">
                      <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${toneStyles[card.tone].card}`}><UserCheck className={`h-7 w-7 ${toneStyles[card.tone].text}`} /></span>
                      <p className={`mt-3 text-lg font-black ${toneStyles[card.tone].text}`}>{card.code}</p>
                      <p className={`text-sm font-black uppercase ${toneStyles[card.tone].text}`}>{card.title}</p>
                    </div>
                    <ul className="mt-4 space-y-2 text-[11px] font-semibold text-slate-800">{card.actions.map((item) => <li key={item}>• {item}</li>)}</ul>
                    <div className={`mt-4 rounded-lg border p-2 text-center text-xs font-black ${card.done ? toneStyles[card.tone].card : 'border-slate-200 bg-slate-50'}`}>Status: {card.done ? card.statusText : 'Pending'}</div>
                    <p className="mt-2 text-[10px] font-bold text-slate-500">Owner: {card.owner}</p>
                    <p className="text-[10px] font-bold text-slate-500">Time: {stageStamp(card.date)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {approvalCards.map((card) => (
                  <div key={`${card.title}-audit`} className="rounded-lg border border-slate-200 bg-white p-2 text-center shadow-sm">
                    <FileCheck2 className="mx-auto h-4 w-4 text-slate-700" />
                    <p className="mt-1 text-[10px] font-black text-slate-700">Action Logged</p>
                    <p className="text-[10px] font-bold text-slate-500">Audit Trail Captured</p>
                  </div>
                ))}
              </div>
              <div className="mx-[10%] mt-2 border-t-2 border-dashed border-slate-400" />
            </div>
            <WorkflowArrow tone="slate" />
            <WorkflowStageCard id="payroll-stage-release" tone="cyan" title="Payroll Release" icon={Landmark}>
              <div className="space-y-4">
                {releaseSteps.map(([label, done, date, Icon]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? toneStyles.cyan.icon : 'bg-slate-100 text-slate-500'}`}><Icon className="h-5 w-5" /></span>
                    <div><p className="text-xs font-black text-slate-900">{label}</p><p className="text-[10px] font-bold text-slate-500">{stageStamp(date)}</p></div>
                  </div>
                ))}
              </div>
            </WorkflowStageCard>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr_0.85fr]">
        <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
          <h3 className="text-center text-sm font-black uppercase text-blue-800">Payroll Outputs</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(outputs).map(([title, items]) => (
              <div key={title} className="border-r border-slate-100 last:border-r-0">
                <p className="text-xs font-black uppercase text-blue-800">{title}</p>
                <ul className="mt-2 space-y-2 text-xs font-semibold text-slate-700">{items.map((item) => <li key={item}>• {item}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <span className="text-xs font-black uppercase text-blue-800">Export Options:</span>
            <button type="button" onClick={exportExcel} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"><FileText className="h-4 w-4" /> PDF</button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"><Download className="h-4 w-4" /> CSV</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"><Printer className="h-4 w-4" /> Print</button>
          </div>
        </div>
        <div id="payroll-stage-lock" className="scroll-mt-24 rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-orange-800"><Lock className="h-5 w-5" /><h3 className="text-sm font-black uppercase">Payroll Locking Controls</h3></div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><p className="text-xs font-black uppercase text-slate-900">After final approval, system locks:</p><ul className="mt-2 space-y-2 text-xs font-semibold text-slate-700">{['Salary Structures', 'Payroll Transactions', 'Attendance Records', 'Timesheets', 'Overtime Records', 'Payroll Deductions'].map((item) => <li key={item}>• {item}</li>)}</ul></div>
            <div className="border-l border-orange-200 pl-4 text-center text-xs font-black text-orange-800"><p>No changes allowed.</p><p className="mt-2">Any adjustment requires:</p><p className="mt-3">Payroll Reopening Request</p><p className="text-lg">↓</p><p>CFO Approval</p><p className="text-lg">↓</p><p>Audit Trail Created</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-emerald-800"><Settings2 className="h-5 w-5" /><h3 className="text-sm font-black uppercase">Workflow Features</h3></div>
          <ul className="mt-4 space-y-2 text-xs font-semibold text-slate-800">{['Configurable Approval Levels', 'Threshold Based Approvals', 'Delegation of Authority', 'Escalation Rules', 'Audit Trail at Every Step', 'Email / In-App Notifications', 'Approval SLA Monitoring', 'Auto Reminders'].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {item}</li>)}</ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black uppercase text-slate-900">Stage Actions & Role Controls</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Role: {role}. Actions are RBAC checked by the payroll API and audit logged with user, role, action, timestamp, reason, and comments.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickAction('validate-payroll', 'Validate Payroll', 'blue')}
            {quickAction('create-run', 'Run Payroll', 'green')}
            {quickAction('submit-run', 'Submit for Approval', 'violet', true)}
            {quickAction('approve-run', 'Approve', 'green', true)}
            {quickAction('request-revision', 'Return', 'amber', true)}
            {quickAction('reject-run', 'Reject', 'red', true)}
            {quickAction('release-run', 'Release', 'cyan', true)}
            {quickAction('generate-bank-schedule', 'Bank Schedule', 'slate', true)}
            {quickAction('generate-statutory-schedules', 'Statutory Schedules', 'blue')}
            {quickAction('generate-payslips', 'Publish Payslips', 'cyan', true)}
            {quickAction('post-run', 'Post Payroll', 'slate', true)}
            {quickAction('close-period', 'Close Period', 'violet', true)}
            {quickAction('reopen-period', 'Reopen Period', 'red', true)}
            <button type="button" onClick={onAudit} className={`${toneStyles.slate.button} min-h-9 rounded-lg px-3 text-[11px] font-black`}>View Audit Trail</button>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-blue-800"><BarChart3 className="h-5 w-5" /><h3 className="text-sm font-black uppercase">Dashboard Overview</h3></div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            <DashboardMiniKpi label="Payroll Eligible Employees" value={number(payrollEligible)} icon={Users} />
            <DashboardMiniKpi label="Gross Payroll (NGN)" value={money(payload?.summary.grossPay, canViewMoney)} icon={Coins} />
            <DashboardMiniKpi label="Net Payroll (NGN)" value={money(payload?.summary.netPay, canViewMoney)} icon={Banknote} />
            <DashboardMiniKpi label="Tax & Pension Liability" value={money(payload?.summary.deductions, canViewMoney)} icon={Landmark} />
            <DashboardMiniKpi label="Pending Approvals" value={number(pendingApprovals)} icon={CalendarClock} />
            <div className="rounded-lg border border-blue-100 bg-white p-3 text-center"><p className="text-[11px] font-black text-slate-700">Payroll Readiness</p><div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full border-[8px] border-cyan-500 text-sm font-black text-slate-950">{readiness}%</div></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm font-black uppercase text-blue-800">Legend</p>
            {legend.map(([label, color]) => <span key={label} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><span className={`h-2 w-8 rounded-full ${color}`} />{label}</span>)}
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><span className="h-px w-10 bg-slate-900" /> Process Flow</span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><span className="h-px w-10 border-t-2 border-dashed border-slate-500" /> Audit Trail</span>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm"><p className="text-center text-xs font-black uppercase text-blue-900">Key Principles: Integrity | Accuracy | Accountability | Transparency | Compliance | Security</p></div>
      </section>
    </div>
  );
}

function WorkflowSummaryTracker({
  stages,
  onSelect,
}: {
  stages: { label: string; owner: string; done: boolean; current: boolean; targetId: string }[];
  onSelect: (targetId: string) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="relative min-w-[860px] px-2 py-3">
        <div className="absolute left-10 right-10 top-8 h-1 rounded-full bg-slate-200" />
        <div
          className="absolute left-10 top-8 h-1 rounded-full bg-violet-600 transition-all"
          style={{ width: `${Math.max(0, (stages.filter((stage) => stage.done).length - 1) / Math.max(1, stages.length - 1)) * 100}%` }}
        />
        <div className="relative grid grid-cols-6 gap-4">
          {stages.map((stage, index) => {
            const circleClass = stage.done
              ? 'border-violet-600 bg-violet-600 text-white shadow-violet-100'
              : stage.current
                ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-amber-100'
                : 'border-slate-300 bg-white text-slate-400 shadow-slate-100';
            const textClass = stage.done ? 'text-violet-700' : stage.current ? 'text-amber-700' : 'text-slate-500';
            const chipClass = stage.done
              ? 'bg-emerald-100 text-emerald-800'
              : stage.current
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-500';
            return (
              <button
                key={stage.label}
                type="button"
                onClick={() => onSelect(stage.targetId)}
                className="group flex min-h-[108px] flex-col items-center rounded-lg px-2 py-1 text-center outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-violet-500"
                title={`Open ${stage.label} details`}
              >
                <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm ${circleClass}`}>
                  {stage.done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                </span>
                <span className={`mt-2 text-[11px] font-black uppercase leading-tight ${textClass}`}>{stage.label}</span>
                <span className="mt-1 max-w-[130px] truncate text-[10px] font-bold text-slate-500">{stage.owner}</span>
                <span className={`mt-2 rounded-full px-2 py-0.5 text-[10px] font-black ${chipClass}`}>{stage.done ? 'Complete' : stage.current ? 'Current' : 'Pending'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkflowStageCard({ id, tone, title, icon: Icon, children }: { id?: string; tone: Tone; title: string; icon: any; children: any }) {
  return (
    <details id={id} open className={`scroll-mt-24 min-h-[390px] rounded-lg border bg-white p-3 shadow-sm ${toneStyles[tone].card}`}>
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-center text-sm font-black text-slate-950"><Icon className={`h-7 w-7 ${toneStyles[tone].text}`} /><span>{title}</span></summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function WorkflowArrow({ tone }: { tone: Tone }) {
  return <div className="flex items-center justify-center"><ArrowRight className={`h-7 w-7 ${toneStyles[tone].text}`} /></div>;
}

function StageBlock({ icon: Icon, title, items }: { icon: any; title: string; items: string[] }) {
  return (
    <div className="border-b border-slate-200 pb-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
        <div><p className="text-sm font-black text-slate-950">{title}</p><ul className="mt-1 space-y-1 text-xs font-semibold text-slate-700">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>
      </div>
    </div>
  );
}

function DashboardMiniKpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3 text-center">
      <p className="min-h-8 text-[11px] font-black text-slate-700">{label}</p>
      <Icon className="mx-auto mt-2 h-5 w-5 text-blue-700" />
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function PayrollAdministrationControlCenter({
  activeTab,
  payload,
  canViewMoney,
  role,
  runAction,
  busyAction,
}: {
  activeTab: TabConfig;
  payload: PayrollPayload | null;
  canViewMoney: boolean;
  role: Role;
  runAction: (action: string, reason?: string) => void;
  busyAction: string;
}) {
  const records = payload?.records || [];
  const currentRun = payload?.runs[0] || null;
  const runStatus = currentRun?.status || payload?.workflow?.currentStatus || 'Draft';
  const taxPensionLiability = (payload?.summary.deductions || 0);
  const pendingApprovals = ['Submitted', 'Under Review', 'Ready for Approval'].includes(runStatus) ? 1 : 0;
  const permanent = records.filter((record) => /permanent/i.test(`${record.employmentType} ${record.payrollGroup}`));
  const lumpSum = records.filter((record) => /lump|gross/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`));
  const dailyRate = records.filter((record) => record.isDailyRate || /daily|day/i.test(`${record.employmentType} ${record.payrollGroup} ${record.paymentType}`));
  const contract = records.filter((record) => /contract/i.test(`${record.employmentType} ${record.payrollGroup}`) && !dailyRate.includes(record));
  const readyPct = (rows: PayrollRecord[]) => rows.length ? (rows.filter((record) => record.payrollStatus === 'Ready').length / rows.length) * 100 : 0;
  const commandActions = [
    { id: 'validate-payroll', label: 'Validate Payroll', icon: ClipboardCheck, tone: 'blue' as Tone, disabled: !payload?.permissions.canManageRun },
    { id: 'view-exceptions', label: 'View Exceptions', icon: AlertTriangle, tone: 'red' as Tone, disabled: false },
    { id: 'create-run', label: 'Run Payroll', icon: PlayCircle, tone: 'green' as Tone, disabled: !payload?.permissions.canManageRun },
    { id: 'submit-run', label: 'Submit for Approval', icon: Send, tone: 'violet' as Tone, disabled: !payload?.permissions.canManageRun },
    { id: 'approve-run', label: 'Approve Payroll', icon: BadgeCheck, tone: 'green' as Tone, disabled: !payload?.permissions.canApprove },
    { id: 'release-run', label: 'Release Payroll', icon: ShieldCheck, tone: 'cyan' as Tone, disabled: !payload?.permissions.canManageRun && !payload?.permissions.canPost },
    { id: 'generate-payslips', label: 'Publish Payslips', icon: ReceiptText, tone: 'cyan' as Tone, disabled: !payload?.permissions.canManageRun },
    { id: 'generate-report', label: 'Generate Reports', icon: FileBarChart, tone: 'slate' as Tone, disabled: !payload?.permissions.canExport },
  ];
  const workflow = [
    { label: 'Draft', owner: 'Payroll Officer', done: Boolean(currentRun?.createdAt) },
    { label: 'Validated', owner: 'Payroll Supervisor', done: Boolean(currentRun?.validatedAt) || ['Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Computed', owner: 'Payroll Officer', done: ['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'HR Review', owner: 'HR Manager', done: Boolean(currentRun?.submittedAt) || ['Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Finance Review', owner: 'Finance Manager', done: ['Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'CFO Approval', owner: 'CFO', done: Boolean(currentRun?.approvedAt) || ['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Released', owner: 'Payroll / Finance', done: Boolean(currentRun?.releasedAt) || ['Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Payslips Published', owner: 'Payroll Officer', done: Boolean(currentRun?.payslipsGeneratedAt) || ['Published', 'Closed'].includes(runStatus) },
  ];
  const periodBase = new Date();
  const calendarRows = [
    { label: 'Payroll Period', date: payload?.periodLabel || 'Current period', owner: 'Payroll Officer', status: runStatus },
    { label: 'Data Cut-Off', date: new Date(periodBase.getFullYear(), periodBase.getMonth(), 20).toLocaleDateString('en-GB'), owner: 'HR / Payroll', status: 'Open' },
    { label: 'Approval Deadline', date: new Date(periodBase.getFullYear(), periodBase.getMonth(), 24).toLocaleDateString('en-GB'), owner: 'HR, Finance, CFO', status: pendingApprovals ? 'Pending' : 'On Track' },
    { label: 'Payment Date', date: new Date(periodBase.getFullYear(), periodBase.getMonth(), 28).toLocaleDateString('en-GB'), owner: 'Finance', status: ['Approved', 'Locked', 'Posted', 'Published'].includes(runStatus) ? 'Ready' : 'Waiting' },
    { label: 'Payslip Publication', date: new Date(periodBase.getFullYear(), periodBase.getMonth(), 29).toLocaleDateString('en-GB'), owner: 'Payroll Officer', status: ['Published', 'Closed'].includes(runStatus) ? 'Published' : 'Scheduled' },
  ];
  const categoryRows = [
    { label: 'Permanent', rows: permanent, tone: 'blue' as Tone, detail: 'Monthly salary, statutory deductions, pension and PAYE controls' },
    { label: 'Lumpsum', rows: lumpSum, tone: 'violet' as Tone, detail: 'Taxable and non-taxable lump-sum compensation setup' },
    { label: 'Daily Rate', rows: dailyRate, tone: 'amber' as Tone, detail: 'Attendance-driven day-rate payroll and project allocation' },
    { label: 'Contract', rows: contract, tone: 'cyan' as Tone, detail: 'Contract payroll profiles, fixed-term controls, and ESS output' },
  ];
  const analysisGroups = [
    { title: 'Department Payroll', icon: Building2, rows: payload?.breakdowns.byDepartment || [], tone: 'blue' as Tone },
    { title: 'Cost Centre Payroll', icon: Landmark, rows: payload?.breakdowns.byDepartment || [], tone: 'violet' as Tone },
    { title: 'Location Payroll', icon: Network, rows: groupPayrollRows(records, 'location'), tone: 'green' as Tone },
    { title: 'Project / Category Payroll', icon: BriefcaseBusiness, rows: payload?.breakdowns.byPayrollGroup || [], tone: 'amber' as Tone },
  ];
  const approvalLevels = [
    { level: 'Payroll Officer', control: 'Prepare, validate, compute, resolve exceptions', status: 'Configured' },
    { level: 'HR Manager', control: 'Employee changes, eligibility, ESS readiness, comments', status: 'Configured' },
    { level: 'Finance Manager', control: 'Cost centre, budget, bank schedule and journal review', status: 'Configured' },
    { level: 'CFO', control: 'Final approval, rejection, reopening and release authority', status: 'Configured' },
    { level: 'Delegation & Escalation', control: 'Delegated approvals, SLA reminders, audit capture', status: 'Ready' },
  ];
  const outputs = ['PAYE Schedule', 'Pension Schedule', 'NHF Schedule', 'NSITF Schedule', 'ITF Schedule', 'Bank Schedule', 'Payroll Register', 'Payslips', 'Compliance Reports'];
  const enterpriseCapabilities = ['RBAC', 'Multi-Company', 'Multi-Location', 'ESS Integration', 'Document Management', 'Sage Integration', 'API Readiness', 'Notifications', 'Version Control', 'Enterprise Audit Compliance'];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">Payroll Administration & Compensation Control Center</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Exception-focused payroll lifecycle workspace</h3>
            <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">Salary structures, grades, employee pay setup, Sage migration review, and compensation planning remain available, now organized around payroll readiness, approvals, release, statutory outputs, and audit controls.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTab.legacyHref ? <Link href={activeTab.legacyHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800">Open {activeTab.label} <ChevronRight className="h-4 w-4" /></Link> : null}
            <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700">Role: {role}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Payroll Eligible" value={number(payload?.summary.payrollEligible)} detail={`${number(payload?.summary.readyEmployees)} ready`} icon={Users} tone="blue" />
        <MetricCard label="Gross Payroll" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${money(payload?.summary.netPay, canViewMoney)} net`} icon={Banknote} tone="green" />
        <MetricCard label="Tax & Pension Liability" value={money(taxPensionLiability, canViewMoney)} detail="PAYE, pension, NHF, NSITF, ITF" icon={ReceiptText} tone="violet" />
        <MetricCard label="Payroll Exceptions" value={number(payload?.summary.exceptionCount)} detail={`${number(payload?.summary.blockedEmployees)} blocked`} icon={AlertTriangle} tone={(payload?.summary.exceptionCount || 0) ? 'red' : 'green'} />
        <MetricCard label="Payroll Status" value={runStatus} detail={payload?.workflow?.nextOwner || 'Payroll Officer'} icon={ShieldCheck} tone={statusTone(runStatus)} />
        <MetricCard label="Pending Approvals" value={number(pendingApprovals)} detail={payload?.workflow?.approvalStage || 'Draft'} icon={ClipboardCheck} tone={pendingApprovals ? 'amber' : 'green'} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-950">Payroll Command Center</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Validate, compute, approve, release, publish, report, and audit payroll actions from one control surface.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(runStatus)].chip}`}>Current status: {runStatus}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {commandActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" disabled={item.disabled || busyAction === item.id} onClick={() => runAction(item.id)} className={`min-h-20 rounded-lg border p-3 text-left transition ${item.disabled || busyAction === item.id ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : `${toneStyles[item.tone].card} hover:shadow-md`}`}>
                <Icon className={`h-5 w-5 ${item.disabled ? 'text-slate-400' : toneStyles[item.tone].text}`} />
                <p className="mt-2 text-xs font-black text-slate-950">{item.label}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Payroll Workflow Tracker</h3>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {workflow.map((step, index) => (
            <div key={step.label} className={`rounded-lg border p-3 ${step.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black text-slate-950">{index + 1}. {step.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${step.done ? toneStyles.green.chip : toneStyles.slate.chip}`}>{step.done ? 'Done' : 'Open'}</span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">Owner: {step.owner}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Audit: timestamp, comments, version stored</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-950">Payroll Calendar</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Period cut-off, approval, payment, and payslip publication dates.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {calendarRows.map((item) => (
              <div key={item.label} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <p className="text-sm font-black text-slate-950">{item.label}</p>
                <p className="text-sm font-semibold text-slate-700">{item.date}</p>
                <p className="text-xs font-bold text-slate-500">Owner: {item.owner}</p>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[statusTone(item.status)].chip}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-950">Exception Management</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Ownership, severity, resolution tracking, comments, and audit log visibility.</p>
          </div>
          <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
            {(payload?.exceptions || []).slice(0, 8).map((item) => (
              <div key={item.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1.1fr_1fr_auto]">
                <div>
                  <p className="text-sm font-black text-slate-950">{item.employeeName}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.employeeId} / {item.issue}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Owner</p>
                  <p className="text-sm font-bold text-slate-700">{item.owner}</p>
                </div>
                <span className={`h-fit rounded-full px-2.5 py-1 text-[11px] font-black ${item.severity === 'High' ? toneStyles.red.chip : item.severity === 'Medium' ? toneStyles.amber.chip : toneStyles.slate.chip}`}>{item.severity}</span>
              </div>
            ))}
            {!payload?.exceptions?.length ? <div className="p-4 text-sm font-black text-emerald-700">No payroll exceptions detected.</div> : null}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {categoryRows.map((item) => (
          <section key={item.label} className={`rounded-lg border p-4 shadow-sm ${toneStyles[item.tone].card}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">{item.label}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.detail}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${toneStyles[item.tone].chip}`}>{number(item.rows.length)}</span>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-500"><span>Readiness</span><span>{pctFmt.format(readyPct(item.rows))}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80"><div className={`h-full ${toneStyles[item.tone].bar}`} style={{ width: `${readyPct(item.rows)}%` }} /></div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {analysisGroups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneStyles[group.tone].icon}`}><Icon className="h-4 w-4" /></span>
                <h3 className="text-sm font-black text-slate-950">{group.title}</h3>
              </div>
              <div className="mt-3 space-y-2">
                {group.rows.slice(0, 5).map((row) => (
                  <div key={row.label} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-slate-800">{row.label}</p>
                      <p className="text-xs font-black text-slate-950">{number(row.employees)}</p>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{money(row.grossPay, canViewMoney)} gross / {number(row.exceptions)} exceptions</p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Configurable Multi-Level Approval Workflow</h3>
          <div className="mt-3 space-y-2">
            {approvalLevels.map((item) => (
              <div key={item.level} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-black text-slate-950">{item.level}</p><p className="mt-1 text-xs font-semibold text-slate-600">{item.control}</p></div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Payroll Locking Controls</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {['Salary structures locked after final approval', 'Payroll transactions locked after release', 'Bank schedule locked after payment file', 'Payslips versioned after publication', 'Reopening requires CFO approval', 'All changes create audit trail'].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                <p className="text-xs font-bold text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-950">Statutory Outputs, Integrations & Compliance</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Output packs, enterprise platform readiness, document control, notifications, and audit compliance.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">API + Sage ready</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {outputs.map((item) => <div key={item} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-black text-blue-800">{item}</div>)}
          {enterpriseCapabilities.map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-black text-slate-700">{item}</div>)}
        </div>
      </section>
    </div>
  );
}

const groupPayrollRows = (records: PayrollRecord[], key: keyof PayrollRecord) => Array.from(
  records.reduce((map, record) => {
    const label = String(record[key] || 'Unassigned');
    const current = map.get(label) || { label, employees: 0, grossPay: 0, netPay: 0, exceptions: 0 };
    current.employees += 1;
    current.grossPay += record.grossPay || 0;
    current.netPay += record.netPay || 0;
    current.exceptions += record.exceptionCount || 0;
    map.set(label, current);
    return map;
  }, new Map<string, { label: string; employees: number; grossPay: number; netPay: number; exceptions: number }>()).values(),
).sort((a, b) => b.employees - a.employees);

export default function PayrollManagementClient({ initialNow, initialSection = 'dashboard' }: { initialNow: string; initialSection?: string }) {
  const [sectionId, setSectionId] = useState<SectionId>(sectionById(initialSection).id);
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState('');
  const [periodTab, setPeriodTab] = useState(payrollPeriodTabs[0].id);
  const [confirmAction, setConfirmAction] = useState<PayrollAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  const section = sectionById(sectionId);
  const activeTabId = activeTabs[section.id] || section.tabs[0].id;
  const activeTab = section.tabs.find((tab) => tab.id === activeTabId) || section.tabs[0];
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const currentRun = payload?.runs[0] || null;
  const lastLoaded = payload?.generatedAt || initialNow;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = await readApiResponse<PayrollPayload>(res);
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Payroll request failed (${res.status})`);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payroll management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (sectionId !== 'payroll-computation-workflow') return;
    const interval = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, role]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.payrollStatus !== status) return false;
      if (!q) return true;
      return [
        record.employeeId,
        record.fullName,
        record.department,
        record.jobTitle,
        record.payrollGroup,
        record.salaryGrade,
        record.salaryStructure,
        record.isDailyRate ? 'daily rate contract' : '',
        record.ratePerDay,
        record.ratePerHour,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [payload?.records, query, status]);

  const runAction = async (action: string, reason = '') => {
    setBusyAction(action);
    setToast('');
    try {
      const res = await fetch('/api/hris/payroll-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ action, runId: currentRun?.id, reason, actor: role }),
      });
      const json = await readApiResponse<{ run: PayrollRun }>(res);
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Payroll action failed');
      setToast(`${action.replace('-run', '').replace('-', ' ')} completed.`);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Payroll action failed');
    } finally {
      setBusyAction('');
    }
  };

  const triggerAction = (actionItem: PayrollAction) => {
    if (actionItem.id === 'view-audit') {
      setAuditOpen(true);
      return;
    }
    if (actionItem.id === 'export-csv') {
      exportCsv();
      return;
    }
    if (actionItem.id === 'export-excel') {
      exportExcel();
      return;
    }
    if (actionItem.sensitive) {
      setActionReason('');
      setConfirmAction(actionItem);
      return;
    }
    void runAction(actionItem.id);
  };

  const confirmSensitiveAction = () => {
    if (!confirmAction) return;
    if (confirmAction.reasonRequired && !actionReason.trim()) return;
    const actionToRun = confirmAction;
    setConfirmAction(null);
    void runAction(actionToRun.id, actionReason.trim());
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/payroll-management?format=csv';
  };

  const exportExcel = () => {
    window.location.href = '/api/hris/payroll-management?format=xls';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
              <WalletCards className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">{section.id === 'dashboard' ? 'Payroll' : section.title}</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">{section.id === 'dashboard' ? 'Review the current payroll, fix issues, approve, release, and publish payslips from one simple workspace.' : section.description}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">Period: {payload?.periodLabel || 'Loading'}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">Source: {payload?.dataSource?.source || 'DLE_Enterprise HRIS'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Employees: {number(payload?.dataSource?.employeeCount || payload?.summary.totalEmployees)}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {new Date(lastLoaded).toLocaleString('en-GB')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">
            {roleOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <ActionButton label={loading ? 'Refreshing' : 'Refresh'} icon={RefreshCcw} onClick={() => void load()} disabled={loading} tone="blue" />
          <ActionButton label="Export CSV" icon={Download} onClick={exportCsv} disabled={!payload?.permissions.canExport} tone="slate" />
          <ActionButton label="Export Excel" icon={FileSpreadsheet} onClick={exportExcel} disabled={!payload?.permissions.canExport} tone="green" />
        </div>
      </div>

      {error ? <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ready Employees" value={number(payload?.summary.payrollEligible)} detail={`${number(payload?.summary.totalEmployees)} employees loaded`} icon={Users} tone="blue" />
        <MetricCard label="Gross Pay" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${money(payload?.summary.netPay, canViewMoney)} net pay`} icon={Banknote} tone="green" />
        <MetricCard label="Deductions" value={money(payload?.summary.deductions, canViewMoney)} detail="PAYE, pension and statutory items" icon={ReceiptText} tone="violet" />
        <MetricCard label="Issues" value={number(payload?.summary.exceptionCount)} detail={`${number(payload?.summary.blockedEmployees)} blocked, ${number(payload?.summary.reviewEmployees)} to review`} icon={AlertTriangle} tone={(payload?.summary.exceptionCount || 0) > 0 ? 'red' : 'green'} />
      </div>

      {section.id === 'dashboard' ? (
        <PayrollNextStepPanel payload={payload} currentRun={currentRun} canViewMoney={canViewMoney} onAction={triggerAction} busyAction={busyAction} role={role} />
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm xl:sticky xl:top-20">
          <nav className="grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Payroll module pages">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = section.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSectionId(item.id);
                    window.history.pushState(null, '', sectionHref(item.id));
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-xs font-black transition-colors ${active ? `${toneStyles[item.tone].button}` : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <section className={`rounded-lg border p-4 ${toneStyles[section.tone].card}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles[section.tone].icon}`}>
                    <section.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-slate-950">{section.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{section.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(payload?.controls || []).map((control) => <span key={control.id} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[control.tone].chip}`}>{control.label}: {control.status}</span>)}
              </div>
            </div>
          </section>

          {section.id !== 'salary-management' && section.id !== 'payroll-computation-workflow' ? (
            <PayrollCommandBar
              section={section}
              activeTab={activeTab}
              role={role}
              payload={payload}
              busyAction={busyAction}
              onAction={triggerAction}
            />
          ) : null}

          {section.id !== 'payroll-computation-workflow' ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex min-w-max gap-1">
                {section.tabs.map((tab) => (
                  <button key={tab.id} type="button" onClick={() => setActiveTabs((prev) => ({ ...prev, [section.id]: tab.id }))} className={`min-h-10 rounded-lg px-3 text-xs font-black transition-colors ${activeTab.id === tab.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            {section.id === 'dashboard' ? (
              <DashboardWorkspace payload={payload} canViewMoney={canViewMoney} runAction={runAction} busyAction={busyAction} currentRun={currentRun} filteredRecords={filteredRecords} query={query} setQuery={setQuery} status={status} setStatus={setStatus} />
            ) : section.id === 'payroll-computation-workflow' ? (
              <PayrollComputationWorkflowPage payload={payload} canViewMoney={canViewMoney} role={role} runAction={runAction} busyAction={busyAction} onAudit={() => setAuditOpen(true)} exportCsv={exportCsv} exportExcel={exportExcel} />
            ) : section.id === 'salary-management' ? (
              <PaySetupWorkspace activeTab={activeTab} payload={payload} canViewMoney={canViewMoney} />
            ) : section.id === 'payroll-processing' ? (
              <ProcessPayrollWorkspace activeTab={activeTab} payload={payload} canViewMoney={canViewMoney} runAction={runAction} busyAction={busyAction} />
            ) : (
              <FeaturePanel tab={activeTab} section={section} payload={payload} canViewMoney={canViewMoney} />
            )}
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-black text-slate-950">System controls and compliance coverage</summary>
            <p className="mt-2 text-xs font-semibold text-slate-500">These controls stay available for audit, administration, and implementation reviews.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {enterpriseRequirements.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </details>
        </main>
      </div>
      {confirmAction ? (
        <ConfirmationModal
          actionItem={confirmAction}
          payload={payload}
          reason={actionReason}
          setReason={setActionReason}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmSensitiveAction}
        />
      ) : null}
      {auditOpen ? <AuditPanel payload={payload} onClose={() => setAuditOpen(false)} /> : null}
    </div>
  );
}

function DashboardWorkspace({
  payload,
  canViewMoney,
  runAction,
  busyAction,
  currentRun,
  filteredRecords,
  query,
  setQuery,
  status,
  setStatus,
}: {
  payload: PayrollPayload | null;
  canViewMoney: boolean;
  runAction: (action: string) => void;
  busyAction: string;
  currentRun: PayrollRun | null;
  filteredRecords: PayrollRecord[];
  query: string;
  setQuery: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
}) {
  const runStatus = currentRun?.status || payload?.workflow?.currentStatus || 'Draft';
  const issues = payload?.exceptions || [];
  const readiness = payload?.summary.totalEmployees ? Math.round(((payload?.summary.readyEmployees || 0) / payload.summary.totalEmployees) * 100) : 0;
  const workflow = [
    { label: 'Draft', done: Boolean(currentRun?.createdAt) },
    { label: 'Validated', done: Boolean(currentRun?.validatedAt) || ['Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Computed', done: ['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'HR Review', done: Boolean(currentRun?.submittedAt) || ['Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Finance Review', done: ['Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Approved', done: Boolean(currentRun?.approvedAt) || ['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Released', done: Boolean(currentRun?.releasedAt) || ['Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(runStatus) },
    { label: 'Payslips', done: Boolean(currentRun?.payslipsGeneratedAt) || ['Published', 'Closed'].includes(runStatus) },
  ];
  const quickActions = [
    { label: 'Validate Payroll', action: 'validate-payroll', icon: ClipboardCheck, tone: 'blue' as Tone, disabled: !payload?.permissions.canManageRun },
    { label: 'Review Issues', action: 'view-exceptions', icon: AlertTriangle, tone: issues.length ? 'red' as Tone : 'green' as Tone, disabled: false },
    { label: 'Submit Approval', action: 'submit-run', icon: Send, tone: 'amber' as Tone, disabled: !payload?.permissions.canManageRun },
    { label: 'Publish Payslips', action: 'generate-payslips', icon: ReceiptText, tone: 'cyan' as Tone, disabled: !payload?.permissions.canManageRun },
  ];
  const activity = [
    { label: 'Payroll data loaded', detail: payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-GB') : 'Loading' },
    { label: `Status is ${runStatus}`, detail: payload?.workflow?.nextOwner ? `Next owner: ${payload.workflow.nextOwner}` : 'No workflow owner assigned' },
    { label: `${number(payload?.summary.readyEmployees)} records ready`, detail: `${number(payload?.summary.reviewEmployees)} review, ${number(payload?.summary.blockedEmployees)} blocked` },
    { label: 'Audit trail active', detail: `${number(payload?.auditTrail?.length)} logged payroll actions` },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Payroll Dashboard</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Control room for {payload?.periodLabel || 'current payroll'}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">Review status, clear issues, approve, release, and publish payslips without digging through setup screens.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{payload?.periodLabel || 'Loading'}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(runStatus)].chip}`}>{runStatus}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Run: {currentRun?.id || 'Not started'}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-blue-800">Payroll Summary</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">{readiness}% ready for payroll</h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">{number(payload?.summary.readyEmployees)} ready, {number(payload?.summary.reviewEmployees)} to review, {number(payload?.summary.blockedEmployees)} blocked.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
              <MiniDashboardCard label="Ready Employees" value={number(payload?.summary.readyEmployees)} tone="blue" />
              <MiniDashboardCard label="Gross Pay" value={money(payload?.summary.grossPay, canViewMoney)} tone="green" />
              <MiniDashboardCard label="Net Pay" value={money(payload?.summary.netPay, canViewMoney)} tone="cyan" />
              <MiniDashboardCard label="Issues" value={number(issues.length)} tone={issues.length ? 'red' : 'green'} />
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <div className="flex min-w-[760px] items-start gap-2">
              {workflow.map((step, index) => (
                <div key={step.label} className="flex flex-1 items-start gap-2">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black ${step.done ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-500'}`}>
                      {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className={`mt-2 text-[10px] font-black uppercase leading-tight ${step.done ? 'text-blue-700' : 'text-slate-500'}`}>{step.label}</span>
                  </div>
                  {index < workflow.length - 1 ? <div className={`mt-4 h-0.5 flex-1 rounded-full ${step.done ? 'bg-blue-600' : 'bg-slate-200'}`} /> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Quick Actions</h3>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.action} type="button" disabled={item.disabled || busyAction === item.action} onClick={() => runAction(item.action)} className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-xs font-black ${item.disabled || busyAction === item.action ? 'cursor-not-allowed bg-slate-100 text-slate-400' : toneStyles[item.tone].button}`}>
                  <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" />{item.label}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">Issues to Fix</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Only items blocking approval or release appear here.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${issues.length ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{number(issues.length)} open</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {issues.slice(0, 5).map((issue) => (
              <div key={issue.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-black text-slate-950">{issue.issue}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{issue.employeeName} - {issue.employeeId} - Owner: {issue.owner}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${issue.severity === 'High' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{issue.severity}</span>
              </div>
            ))}
            {!issues.length ? <div className="p-4 text-sm font-black text-emerald-800">No open payroll issues.</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Payroll Summary</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <InfoTile label="Employees" value={number(payload?.summary.totalEmployees)} detail={`${number(payload?.summary.payrollEligible)} eligible`} tone="blue" />
              <InfoTile label="Deductions" value={money(payload?.summary.deductions, canViewMoney)} detail="Tax and statutory" tone="violet" />
              <InfoTile label="Coverage" value={`${pctFmt.format(payload?.summary.payrollCoveragePct || 0)}%`} detail="Assigned setup" tone="cyan" />
              <InfoTile label="Approval" value={currentRun?.approvedBy || 'Pending'} detail={currentRun?.approvedAt ? new Date(currentRun.approvedAt).toLocaleString('en-GB') : payload?.workflow?.nextOwner || 'Awaiting workflow'} tone="amber" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Recent Activity</h3>
            <div className="mt-3 space-y-3">
              {activity.map((item) => (
                <div key={item.label} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  <div><p className="text-sm font-black text-slate-800">{item.label}</p><p className="text-xs font-semibold text-slate-500">{item.detail}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer border-b border-slate-100 p-4 text-sm font-black text-slate-950">Employee payroll register</summary>
        <div className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-950">Employee records</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">Use this when you need employee-level detail.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_160px]">
              <Link href="/hris/payroll/daily-rate-pay" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900 hover:bg-white">
                <CalendarClock className="h-4 w-4" /> Daily Rate List
              </Link>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, group, rate, department" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query ? <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Ready', 'Review', 'Blocked'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1220px] w-full text-left">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
              <tr>{['Employee', 'Group', 'Type', 'Rate / Structure', 'Gross', 'Deductions', 'Net', 'Status', 'Exceptions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.slice(0, 80).map((record) => (
                <tr key={record.employeeId} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><p className="text-sm font-black text-slate-950">{record.fullName}</p><p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p></td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">{record.payrollGroup}<br /><span className="text-slate-400">{record.isDailyRate ? 'Daily rate structure' : record.salaryGrade}</span></td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">{record.employmentType}<br /><span className="text-slate-400">{record.paymentRun}</span></td>
                  <td className="px-4 py-3 text-sm font-black text-slate-900">{payrollRate(record, canViewMoney)}</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.deductions, canViewMoney)}</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.netPay, canViewMoney)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[statusTone(record.payrollStatus)].chip}`}>{record.payrollStatus}</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{record.exceptions.length ? record.exceptions.slice(0, 2).join('; ') : 'Clear'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function PayrollExceptionCenter({ payload, onAction }: { payload: PayrollPayload | null; onAction: (action: string, reason?: string) => void }) {
  const exceptions = payload?.exceptions || [];
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-950">Issues to Fix</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Resolve these before approving or releasing payroll.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${exceptions.length ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{number(exceptions.length)} exceptions</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4">
        {exceptions.slice(0, 6).map((item) => (
          <div key={item.id} className={`rounded-lg border p-3 ${item.severity === 'High' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-black text-slate-950">{item.employeeName}</p><p className="mt-1 text-xs font-semibold text-slate-600">{item.employeeId} · Owner: {item.owner}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.severity === 'High' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{item.severity}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-800">{item.issue}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['View Details', 'Resolve'].map((label) => (
                <button key={label} type="button" onClick={() => onAction(label.toLowerCase().replace(/\s+/g, '-'), item.issue)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50">{label}</button>
              ))}
              <details className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <summary className="cursor-pointer text-[11px] font-black text-slate-700">More</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Assign Owner', 'Override with Reason', 'Export Exception', 'Add Comment', 'View Resolution History'].map((label) => (
                    <button key={label} type="button" onClick={() => onAction(label.toLowerCase().replace(/\s+/g, '-'), item.issue)} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100">{label}</button>
                  ))}
                </div>
              </details>
            </div>
          </div>
        ))}
        {!exceptions.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">No payroll exceptions detected.</div> : null}
      </div>
    </section>
  );
}

function PayrollCommandBar({ section, activeTab, role, payload, busyAction, onAction }: { section: SectionConfig; activeTab: TabConfig; role: Role; payload: PayrollPayload | null; busyAction: string; onAction: (action: PayrollAction) => void }) {
  const actions = actionsFor(section, activeTab);
  const currentStatus = payload?.workflow?.currentStatus || payload?.runs[0]?.status || 'Draft';
  const blocked = payload?.workflow?.blockedActions || [];
  const primaryIds = ['validate-payroll', 'view-exceptions', 'create-run', 'submit-run', 'approve-run', 'release-run', 'generate-payslips', 'generate-report'];
  const visibleActions = actions.filter((item) => primaryIds.includes(item.id)).slice(0, 6);
  const advancedActions = actions.filter((item) => !visibleActions.some((visible) => visible.id === item.id));
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">Actions</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Status: <span className="font-black text-slate-800">{currentStatus}</span> · Stage: <span className="font-black text-slate-800">{payload?.workflow?.approvalStage || 'Draft'}</span> · Next owner: <span className="font-black text-slate-800">{payload?.workflow?.nextOwner || 'Payroll Officer'}</span>
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Role: {role}</span>
      </div>
      {blocked.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black uppercase text-amber-800">Blocked Progress</p>
          <div className="mt-2 grid grid-cols-1 gap-1">
            {blocked.map((item) => <p key={item} className="text-xs font-semibold text-amber-800">{item}</p>)}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {visibleActions.map((item) => {
          const auth = canRunAction(item, role, payload);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => auth.allowed && onAction(item)}
              disabled={!auth.allowed || busyAction === item.id}
              title={auth.reason || item.label}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-black transition-colors ${
                !auth.allowed || busyAction === item.id
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                  : item.group === 'primary'
                    ? toneStyles[section.tone].button
                    : item.group === 'workflow'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : item.group === 'audit'
                        ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs font-black uppercase text-slate-700">Advanced actions and workflow detail</summary>
        <WorkflowStepper payload={payload} onAction={onAction} />
        {advancedActions.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {advancedActions.map((item) => {
              const auth = canRunAction(item, role, payload);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => auth.allowed && onAction(item)}
                  disabled={!auth.allowed || busyAction === item.id}
                  title={auth.reason || item.label}
                  className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-[11px] font-black transition-colors ${
                    !auth.allowed || busyAction === item.id ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </details>
    </section>
  );
}

const workflowSteps = [
  ['Period Created', 'Payroll Officer', 'create-period'],
  ['Period Opened', 'Payroll Officer', 'open-period'],
  ['Master Data Validated', 'Payroll Supervisor', 'validate-payroll'],
  ['Payroll Processed', 'Payroll Officer', 'create-run'],
  ['Exceptions Resolved', 'Payroll Officer', 'view-exceptions'],
  ['Submitted for Approval', 'Payroll Supervisor', 'submit-run'],
  ['Approved', 'HR / Finance / CFO', 'approve-run'],
  ['Payroll Released', 'Payroll / Finance', 'release-run'],
  ['Payslips Generated', 'Payroll Officer', 'generate-payslips'],
  ['Bank Schedule Generated', 'Finance Manager', 'generate-bank-schedule'],
  ['Journal Posted', 'Finance Manager', 'post-run'],
  ['Statutory Reports Generated', 'Payroll Officer', 'generate-statutory-schedules'],
  ['Period Closed', 'Payroll Supervisor', 'close-period'],
];

function WorkflowStepper({ payload, onAction }: { payload: PayrollPayload | null; onAction: (action: PayrollAction) => void }) {
  const run = payload?.runs[0];
  const status = run?.status || 'Draft';
  const stepDone = (actionId: string) => {
    if (!run) return false;
    if (actionId === 'create-period') return Boolean(run.createdAt);
    if (actionId === 'open-period') return ['Open', 'Validation', 'Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'validate-payroll') return Boolean(run.validatedAt) || ['Validated', 'Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'create-run') return ['Computed', 'Ready for Approval', 'Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'view-exceptions') return (payload?.summary.exceptionCount || 0) === 0;
    if (actionId === 'submit-run') return Boolean(run.submittedAt) || ['Submitted', 'Under Review', 'Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'approve-run') return Boolean(run.approvedAt) || ['Approved', 'Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'release-run') return Boolean(run.releasedAt) || ['Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(status);
    if (actionId === 'generate-payslips') return Boolean(run.payslipsGeneratedAt) || ['Published', 'Closed'].includes(status);
    if (actionId === 'generate-bank-schedule') return Boolean(run.bankScheduleGeneratedAt);
    if (actionId === 'generate-statutory-schedules') return Boolean(run.statutorySchedulesGeneratedAt);
    if (actionId === 'post-run') return Boolean(run.postedAt) || ['Posted', 'Closed'].includes(status);
    if (actionId === 'close-period') return status === 'Closed';
    return false;
  };
  const stepTimestamp = (actionId: string) => {
    if (!run) return payload?.generatedAt || 'Pending';
    const values: Record<string, string | null | undefined> = {
      'create-period': run.createdAt,
      'open-period': run.createdAt,
      'validate-payroll': run.validatedAt,
      'create-run': run.createdAt,
      'view-exceptions': (payload?.summary.exceptionCount || 0) === 0 ? run.validatedAt || run.createdAt : null,
      'submit-run': run.submittedAt,
      'approve-run': run.approvedAt,
      'release-run': run.releasedAt,
      'generate-payslips': run.payslipsGeneratedAt,
      'generate-bank-schedule': run.bankScheduleGeneratedAt,
      'generate-statutory-schedules': run.statutorySchedulesGeneratedAt,
      'post-run': run.postedAt,
      'close-period': status === 'Closed' ? run.lockedAt || run.postedAt : null,
    };
    return values[actionId] ? new Date(values[actionId] as string).toLocaleString('en-GB') : 'Pending';
  };
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
      {workflowSteps.map(([label, owner, actionId], index) => {
        const done = stepDone(actionId);
        return (
          <div key={label} className={`rounded-lg border p-3 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black text-slate-950">{index + 1}. {label}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Owner: {owner}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{stepTimestamp(actionId)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{done ? 'Done' : 'Open'}</span>
            </div>
            {!done ? <button type="button" onClick={() => onAction(action(actionId, label, 'workflow', viewRoles, ['approve-run', 'release-run', 'close-period', 'post-run'].includes(actionId)))} className="mt-2 text-[11px] font-black text-blue-700 hover:underline">Run action</button> : null}
          </div>
        );
      })}
    </div>
  );
}

function ConfirmationModal({ actionItem, payload, reason, setReason, onCancel, onConfirm }: { actionItem: PayrollAction; payload: PayrollPayload | null; reason: string; setReason: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const requiresReason = actionItem.reasonRequired || ['reject-run', 'request-revision', 'reopen-period', 'reverse-payroll', 'reverse-journal-posting'].includes(actionItem.id);
  const canConfirm = !requiresReason || reason.trim().length > 2;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-100 p-4">
          <h3 className="text-lg font-black text-slate-950">Confirm {actionItem.label}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">Review the impact before continuing. This action will be audit logged.</p>
        </div>
        <div className="space-y-3 p-4">
          <InfoTile label="Payroll Period" value={payload?.periodLabel || 'Current Period'} detail={payload?.runs[0]?.id || 'No run selected'} tone="blue" />
          <InfoTile label="Affected Employees" value={number(payload?.summary.payrollEligible)} detail={`${number(payload?.summary.exceptionCount)} exceptions currently visible`} tone={(payload?.summary.exceptionCount || 0) ? 'amber' : 'green'} />
          <InfoTile label="Financial Amount" value={money(payload?.summary.netPay, payload?.permissions.canViewMoney)} detail="Current net payroll exposure" tone="violet" />
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">Sensitive payroll actions can affect employee pay, ESS visibility, bank files, journals, statutory schedules, and period locks.</div>
          {requiresReason ? (
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">Required reason</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-blue-500" placeholder="Enter approval, rejection, reopening, reversal, or correction reason" />
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm} className="min-h-10 rounded-lg bg-slate-900 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm Action</button>
        </div>
      </div>
    </div>
  );
}

function AuditPanel({ payload, onClose }: { payload: PayrollPayload | null; onClose: () => void }) {
  const rows = payload?.auditTrail || [];
  return (
    <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-4">
        <div><h3 className="text-lg font-black text-slate-950">Payroll Audit Trail</h3><p className="text-xs font-semibold text-slate-500">User, role, action, record, timestamp, reason, and device/IP where available.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Close</button>
      </div>
      <div className="space-y-2 p-4">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-black text-slate-950">{row.action}</p><p className="mt-1 text-xs font-semibold text-slate-600">{row.record} · {row.role} · {row.user}</p></div>
              <span className="text-[11px] font-bold text-slate-500">{new Date(row.at).toLocaleString('en-GB')}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">Old: {row.oldValue || '-'} · New: {row.newValue || '-'}</p>
            {row.reason || row.comment ? <p className="mt-1 text-xs font-semibold text-slate-600">Reason: {row.reason || row.comment}</p> : null}
            {row.ip ? <p className="mt-1 text-[11px] font-semibold text-slate-400">IP/device: {row.ip}</p> : null}
          </div>
        )) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">No payroll audit actions have been logged in this session yet.</div>}
      </div>
    </div>
  );
}

function PayrollNextStepPanel({
  payload,
  currentRun,
  canViewMoney,
  role,
  busyAction,
  onAction,
}: {
  payload: PayrollPayload | null;
  currentRun: PayrollRun | null;
  canViewMoney: boolean;
  role: Role;
  busyAction: string;
  onAction: (action: PayrollAction) => void;
}) {
  const status = currentRun?.status || payload?.workflow?.currentStatus || 'Draft';
  const exceptions = payload?.summary.exceptionCount || 0;
  const nextAction = exceptions > 0
    ? action('view-exceptions', 'Review Issues', 'secondary')
    : status === 'Draft'
      ? action('validate-payroll', 'Validate Payroll', 'workflow', payrollMakerRoles)
      : ['Validated', 'Computed', 'Ready for Approval'].includes(status)
        ? action('submit-run', 'Submit for Approval', 'workflow', payrollMakerRoles, true)
        : ['Submitted', 'Under Review'].includes(status)
          ? action('approve-run', 'Approve Payroll', 'workflow', payrollApprovalRoles, true)
          : status === 'Approved'
            ? action('release-run', 'Release Payroll', 'workflow', [...payrollMakerRoles, ...financeRoles], true)
            : ['Released', 'Locked'].includes(status)
              ? action('generate-payslips', 'Publish Payslips', 'workflow', payrollMakerRoles, true)
              : action('generate-report', 'Generate Reports', 'secondary');
  const auth = canRunAction(nextAction, role, payload);
  const readiness = payload?.summary.totalEmployees ? Math.round(((payload?.summary.readyEmployees || 0) / payload.summary.totalEmployees) * 100) : 0;
  return (
    <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase text-blue-800">Next step</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{exceptions > 0 ? 'Fix payroll issues before approval' : nextAction.label}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Current status is <span className="font-black text-slate-900">{status}</span>. {payload?.workflow?.nextOwner ? `Next owner: ${payload.workflow.nextOwner}.` : `Active role: ${role}.`}
          </p>
        </div>
        <button
          type="button"
          disabled={!auth.allowed || busyAction === nextAction.id}
          onClick={() => auth.allowed && onAction(nextAction)}
          title={auth.reason || nextAction.label}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${
            !auth.allowed || busyAction === nextAction.id ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {nextAction.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <InfoTile label="Readiness" value={`${readiness}%`} detail={`${number(payload?.summary.readyEmployees)} ready records`} tone={readiness >= 95 ? 'green' : 'amber'} />
        <InfoTile label="Payroll Value" value={money(payload?.summary.netPay, canViewMoney)} detail="Net payroll estimate" tone="green" />
        <InfoTile label="Approvals" value={['Submitted', 'Under Review'].includes(status) ? 'Open' : status === 'Approved' ? 'Approved' : 'Not due'} detail={payload?.workflow?.nextOwner || 'No active approver'} tone="violet" />
        <InfoTile label="Issues" value={number(exceptions)} detail={exceptions ? 'Needs review' : 'No open issues'} tone={exceptions ? 'red' : 'green'} />
      </div>
    </section>
  );
}

function InfoTile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: Tone }) {
  return (
    <div className={`rounded-lg border p-4 ${toneStyles[tone].card}`}>
      <p className={`text-xs font-black uppercase tracking-normal ${toneStyles[tone].text}`}>{label}</p>
      <p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
    </div>
  );
}

function PayrollPeriodManagementPanel({ payload, activeTabId, setActiveTabId }: { payload: PayrollPayload | null; activeTabId: string; setActiveTabId: (value: string) => void }) {
  const activeTab = payrollPeriodTabs.find((tab) => tab.id === activeTabId) || payrollPeriodTabs[0];
  const currentRun = payload?.runs[0] || null;
  const periodCode = currentRun?.id || `payroll-${payload?.period || 'period'}`;
  const periodName = payload?.periodLabel || 'Current Payroll Period';
  const employeeCategories = payload?.breakdowns.byEmploymentType.map((item) => item.label).slice(0, 6) || ['Permanent', 'Lumpsum', 'Daily Rate'];
  const completionChecks = [
    ['Employees processed', `${number(payload?.summary.payrollEligible)} eligible employees`, (payload?.summary.blockedEmployees || 0) === 0],
    ['Payslips generated', 'Generation queue available', Boolean(currentRun && ['Approved', 'Locked', 'Posted'].includes(currentRun.status))],
    ['Approvals completed', currentRun?.approvedBy || 'Awaiting approval', Boolean(currentRun?.approvedAt)],
    ['Bank schedule generated', 'Finance integration ready', Boolean(currentRun && ['Locked', 'Posted'].includes(currentRun.status))],
    ['Payroll journal posted', currentRun?.postedAt ? new Date(currentRun.postedAt).toLocaleString('en-GB') : 'Awaiting posting', Boolean(currentRun?.postedAt)],
    ['Statutory schedules generated', 'PAYE, pension, NHF, NSITF, ITF mapped', Boolean(payload?.summary.deductions)],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Payroll Period Management</h3>
            <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">Create, validate, approve, close, reopen, lock, report, and audit payroll periods across frequencies, companies, locations, departments, and employee categories.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">Current: {periodName}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(currentRun?.status || 'Draft')].chip}`}>{currentRun?.status || 'Draft'}</span>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex min-w-max gap-1">
          {payrollPeriodTabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTabId(tab.id)} className={`min-h-10 rounded-lg px-3 text-xs font-black transition-colors ${activeTab.id === tab.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">{activeTab.label}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">{activeTab.description}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Audit + RBAC enforced</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeTab.items.map((item) => (
              <div key={item} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"><CheckCircle2 className="h-4 w-4" /></span>
                  <div><p className="text-sm font-black text-slate-950">{item}</p><p className="mt-1 text-xs font-semibold text-slate-600">Workflow-ready, notification-enabled, and future Sage ERP integration-ready.</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Current Period Control</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <InfoTile label="Period Code" value={periodCode} detail="Duplicate guarded" tone="blue" />
            <InfoTile label="Period Name" value={periodName} detail="Calendar mapped" tone="green" />
            <InfoTile label="Payment Date" value="Configured per calendar" detail="Bank schedule ready" tone="violet" />
            <InfoTile label="Payroll Type" value="Monthly / Weekly / Daily" detail="Frequency aware" tone="amber" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-black uppercase text-slate-500">Eligible Categories</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {employeeCategories.map((item) => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{item}</span>)}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Status Lifecycle</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {payrollPeriodStatuses.map((item) => <span key={item} className={`rounded-lg px-3 py-2 text-xs font-black ${toneStyles[statusTone(item)].chip}`}>{item}</span>)}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Closing Checklist</h3>
          <div className="mt-3 space-y-2">
            {completionChecks.map(([label, detail, ok]) => (
              <div key={String(label)} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div><p className="text-xs font-black text-slate-900">{label}</p><p className="text-[11px] font-semibold text-slate-500">{detail}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Enterprise Readiness</h3>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {payrollPeriodReadiness.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
