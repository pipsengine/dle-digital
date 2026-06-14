'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  PlayCircle,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

type LeaveRole = 'Leave Administrator' | 'HR Officer' | 'HR Manager' | 'Department Manager' | 'Supervisor' | 'Payroll Officer' | 'Employee' | 'Executive' | 'System Administrator';
type LeaveTone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';
type LeaveAction = { id: string; label: string; roles: LeaveRole[]; requiresReason?: boolean; sensitive?: boolean };
type AppRecord = {
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
  status: string;
  stage: string;
  approvalStatus: string;
  policyComplianceStatus: string;
  balanceImpact: number;
  availableBalance: number;
  actingOfficer: string;
  supportingDocuments: number;
  exceptions: string[];
  auditCount: number;
};
type BalanceRecord = {
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
  status: string;
  exceptions: string[];
};
type LeaveTypeRule = {
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
type AuditEntry = { id: string; at: string; user: string; role: string; action: string; record: string; oldValue: string | null; newValue: string | null; comments?: string; reason?: string };
type SectionArea = 'Dashboard' | 'Transactions' | 'Planning & Balances' | 'Administration' | 'Reports & Analytics';
type SectionConfig = { id: string; label: string; area: SectionArea; description: string; actions: string[]; controls: string[]; reports?: string[] };
type Payload = {
  generatedAt: string;
  source: string;
  role: LeaveRole;
  section: string;
  permissions: { canApply: boolean; canApprove: boolean; canAdminister: boolean; canProcessFinancials: boolean; canConfigure: boolean; canExport: boolean; canViewAudit: boolean };
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
  applications: AppRecord[];
  balances: BalanceRecord[];
  leaveTypes: LeaveTypeRule[];
  calendar: Array<Record<string, string | number>>;
  blockedPeriods: Array<Record<string, string>>;
  workflowMatrix: Array<Record<string, string>>;
  reports: Array<Record<string, string>>;
  notifications: Array<Record<string, string>>;
  auditTrail: AuditEntry[];
  integrations: Array<Record<string, string>>;
  operationalSections: SectionConfig[];
};
type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: LeaveRole[] = ['Leave Administrator', 'HR Officer', 'HR Manager', 'Department Manager', 'Supervisor', 'Payroll Officer', 'Employee', 'Executive', 'System Administrator'];
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB');
const money = (value: number | undefined) => moneyFmt.format(value || 0);
const number = (value: number | undefined) => numberFmt.format(value || 0);
const stableDateTime = (value: string) => {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

const toneStyles: Record<LeaveTone, { card: string; icon: string; chip: string; button: string }> = {
  blue: { card: 'border-blue-200 bg-blue-50', icon: 'bg-blue-600 text-white', chip: 'bg-blue-100 text-blue-800', button: 'bg-blue-600 text-white hover:bg-blue-700' },
  green: { card: 'border-emerald-200 bg-emerald-50', icon: 'bg-emerald-600 text-white', chip: 'bg-emerald-100 text-emerald-800', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  amber: { card: 'border-amber-200 bg-amber-50', icon: 'bg-amber-500 text-white', chip: 'bg-amber-100 text-amber-800', button: 'bg-amber-500 text-white hover:bg-amber-600' },
  red: { card: 'border-red-200 bg-red-50', icon: 'bg-red-600 text-white', chip: 'bg-red-100 text-red-800', button: 'bg-red-600 text-white hover:bg-red-700' },
  violet: { card: 'border-violet-200 bg-violet-50', icon: 'bg-violet-600 text-white', chip: 'bg-violet-100 text-violet-800', button: 'bg-violet-600 text-white hover:bg-violet-700' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', icon: 'bg-cyan-600 text-white', chip: 'bg-cyan-100 text-cyan-800', button: 'bg-cyan-600 text-white hover:bg-cyan-700' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'bg-slate-900 text-white', chip: 'bg-slate-100 text-slate-800', button: 'bg-slate-900 text-white hover:bg-slate-800' },
};

const statusTone = (value: string): LeaveTone => {
  const text = String(value || '').toLowerCase();
  if (text.includes('block') || text.includes('reject') || text.includes('cancel') || text.includes('exception')) return 'red';
  if (text.includes('pending') || text.includes('review') || text.includes('draft') || text.includes('attention')) return 'amber';
  if (text.includes('approve') || text.includes('complete') || text.includes('healthy') || text.includes('compliant')) return 'green';
  return 'blue';
};

const actionIcon = (id: string) => {
  if (id.includes('approve')) return BadgeCheck;
  if (id.includes('reject') || id.includes('cancel') || id.includes('withdraw')) return XCircle;
  if (id.includes('report') || id.includes('export')) return Download;
  if (id.includes('audit') || id.includes('history')) return History;
  if (id.includes('accrual') || id.includes('carry')) return RotateCcw;
  if (id.includes('calendar') || id.includes('schedule')) return CalendarDays;
  if (id.includes('payroll') || id.includes('encash')) return Banknote;
  if (id.includes('delegate') || id.includes('reassign')) return UserCheck;
  return PlayCircle;
};

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: LeaveTone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-slate-600">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function StatusPanel({ payload }: { payload: Payload | null }) {
  const rows = [
    ['Current leave status', payload?.current.leaveStatus || 'Loading'],
    ['Available actions', payload?.current.availableActions.join(', ') || 'Loading'],
    ['Next required action', payload?.current.nextRequiredAction || 'Loading'],
    ['Approval status', payload?.current.approvalStatus || 'Loading'],
    ['Policy compliance status', payload?.current.policyComplianceStatus || 'Loading'],
    ['Leave balance impact', payload?.current.leaveBalanceImpact || 'Loading'],
    ['Audit history', payload?.current.auditHistory || 'Loading'],
    ['Workflow progress', payload?.current.workflowProgress || 'Loading'],
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-950">Operational Status</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Every leave page exposes status, action, workflow, compliance, balance, audit, and exceptions.</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
            <p className="mt-1 line-clamp-2 text-xs font-extrabold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      {payload?.current.exceptionIndicators.length ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-black uppercase text-red-800">Exception Indicators</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.current.exceptionIndicators.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{item}</span>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const workspaces: Array<{ id: string; label: SectionArea; defaultSection: string; description: string }> = [
  { id: 'dashboard', label: 'Dashboard', defaultSection: 'dashboard', description: 'Executive overview, command center metrics, exceptions, workflow status, and leave governance signals.' },
  { id: 'transactions', label: 'Transactions', defaultSection: 'applications', description: 'Employee requests, manager approvals, recalls, cancellations, encashments, workflow actions, and audit-ready transaction controls.' },
  { id: 'planning-and-balances', label: 'Planning & Balances', defaultSection: 'leave-calendar', description: 'Calendars, team coverage planning, balance administration, holiday controls, liability values, and scheduling governance.' },
  { id: 'administration', label: 'Administration', defaultSection: 'leave-types', description: 'Configurable leave types, policies, accruals, carry-forward, adjustments, year-end processing, RBAC, and compliance controls.' },
  { id: 'reports-and-analytics', label: 'Reports & Analytics', defaultSection: 'leave-reports', description: 'Operational reports, utilization, liability, trends, approval analytics, exports, and scheduled reporting.' },
];

const workspaceForSection = (section: string, payload: Payload | null) => {
  const direct = workspaces.find((item) => item.id === section);
  if (direct) return direct;
  const config = payload?.operationalSections.find((item) => item.id === section);
  return workspaces.find((item) => item.label === config?.area) || workspaces[0];
};

export default function LeaveManagementClient({ initialNow, initialSection = 'dashboard' }: { initialNow: string; initialSection?: string }) {
  const [role, setRole] = useState<LeaveRole>('Leave Administrator');
  const [section, setSection] = useState(initialSection);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  const activeSection = useMemo(() => payload?.operationalSections.find((item) => item.id === section) || payload?.operationalSections[0], [payload?.operationalSections, section]);
  const activeWorkspace = useMemo(() => workspaceForSection(section, payload), [payload, section]);
  const workspaceTabs = useMemo(() => (payload?.operationalSections || []).filter((item) => item.area === activeWorkspace.label && item.id !== 'dashboard'), [activeWorkspace.label, payload?.operationalSections]);

  const load = async (nextSection = section, nextRole = role) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hris/leave-management?section=${encodeURIComponent(nextSection)}`, { headers: { 'x-hris-role': nextRole }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Leave request failed (${res.status})`);
      setPayload(json.data);
      if (json.data.section !== nextSection) setSection(json.data.section);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Leave Management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(section, role);
  }, [section, role]);

  const runAction = async (action: LeaveAction) => {
    if (action.id === 'view-audit-trail' || action.id === 'view-history') {
      setAuditOpen(true);
      return;
    }
    setBusyAction(action.id);
    setToast('');
    try {
      const res = await fetch('/api/hris/leave-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: action.id,
          section,
          actor: role,
          record: payload?.applications[0]?.id || section,
          reason: action.requiresReason ? `${action.label} requested from Leave Management` : undefined,
          comments: `${action.label} executed from ${activeSection?.label || section}`,
          days: action.id === 'encash' ? 3 : 1,
          approved: action.id === 'process-carry-forward' ? true : undefined,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ message: string; payload: Payload }>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `${action.label} failed`);
      setToast(json.data.message);
      setPayload(json.data.payload);
    } catch (event) {
      setToast(event instanceof Error ? event.message : `${action.label} failed`);
    } finally {
      setBusyAction('');
    }
  };

  const filteredApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.applications || []).filter((item) => !q || [item.id, item.employeeId, item.fullName, item.department, item.leaveType, item.status, item.stage].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [payload?.applications, query]);

  const filteredBalances = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.balances || []).filter((item) => !q || [item.employeeId, item.fullName, item.department, item.leaveType, item.status].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [payload?.balances, query]);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Leave Management</h1>
              <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">
                Enterprise leave administration, planning, workflow, compliance, reporting, payroll integration, audit, notifications, and ESS self-service.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">Production workflow ready</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">{payload?.source || 'Loading source'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {stableDateTime(payload?.generatedAt || initialNow)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(event) => setRole(event.target.value as LeaveRole)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" onClick={() => { window.location.href = '/api/hris/leave-management?format=csv'; }} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Employees" value={number(payload?.summary.totalEmployees)} detail="Multi-company workforce scope" icon={Users} tone="blue" />
        <MetricCard label="On Leave" value={number(payload?.summary.employeesOnLeave)} detail={`${number(payload?.summary.returningToday)} returning today`} icon={CalendarClock} tone="green" />
        <MetricCard label="Pending Applications" value={number(payload?.summary.pendingApplications)} detail={`${number(payload?.summary.pendingApprovals)} approvals pending`} icon={ClipboardCheck} tone={(payload?.summary.pendingApprovals || 0) ? 'amber' : 'green'} />
        <MetricCard label="Leave Utilization" value={`${number(payload?.summary.leaveUtilizationPct)}%`} detail="Used against accrued balance" icon={FileSpreadsheet} tone="violet" />
        <MetricCard label="Leave Liability" value={money(payload?.summary.leaveLiability)} detail={`${number(payload?.summary.exceptionCount)} exception indicators`} icon={Banknote} tone={(payload?.summary.exceptionCount || 0) ? 'red' : 'cyan'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-black uppercase text-slate-500">Leave Management</p>
          <nav className="grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Leave Management pages">
            {workspaces.map((item) => (
              <Link
                key={item.id}
                href={`/hris/leave-management/${item.id}`}
                onClick={() => setSection(item.defaultSection)}
                className={`rounded-xl px-3 py-2.5 text-xs font-black transition-colors ${activeWorkspace.id === item.id ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">{activeWorkspace.label}</h2>
                <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">{activeWorkspace.description}</p>
                {activeSection && activeSection.id !== 'dashboard' ? <p className="mt-2 text-xs font-black uppercase tracking-normal text-emerald-700">{activeSection.label}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(payload?.actions || []).map((item) => {
                  const Icon = actionIcon(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => void runAction(item)} disabled={busyAction === item.id} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold ${item.sensitive ? toneStyles.amber.button : toneStyles.blue.button} disabled:cursor-wait disabled:opacity-60`}>
                      <Icon className="h-4 w-4" />
                      {busyAction === item.id ? 'Processing' : item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {workspaceTabs.length ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {workspaceTabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`h-10 shrink-0 rounded-xl px-3 text-xs font-black transition-colors ${section === item.id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <StatusPanel payload={payload} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MetricCard label="Encashment Requests" value={number(payload?.summary.encashmentRequests)} detail="Payroll earning integration ready" icon={Banknote} tone="cyan" />
            <MetricCard label="Recall Requests" value={number(payload?.summary.recallRequests)} detail="Manager -> HR -> employee notification" icon={RotateCcw} tone="amber" />
            <MetricCard label="Cancellation Requests" value={number(payload?.summary.cancellationRequests)} detail="Balance restoration workflow" icon={XCircle} tone="red" />
          </div>

          <div className="relative">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leave requests, employees, departments, types, workflow status..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            {query ? <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
          </div>

          {section === 'dashboard' ? <DashboardView payload={payload} /> : null}
          {section === 'applications' ? <ApplicationView rows={filteredApplications} /> : null}
          {section === 'approvals' ? <ApprovalView rows={filteredApplications} /> : null}
          {section === 'leave-calendar' ? <CalendarView payload={payload} /> : null}
          {section === 'leave-balances' ? <BalanceView rows={filteredBalances} /> : null}
          {section === 'leave-types' ? <LeaveTypeView payload={payload} /> : null}
          {['recalls', 'cancellations', 'encashments', 'team-leave-planner', 'holiday-calendar', 'leave-policies', 'leave-accruals', 'carry-forward-processing', 'balance-adjustments', 'leave-year-end-processing', 'leave-reports', 'leave-utilization', 'leave-liability', 'leave-trends', 'approval-reports'].includes(section) ? <OperationalView payload={payload} section={section} /> : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoList title="Notifications" icon={Bell} rows={payload?.notifications || []} primaryKey="event" secondaryKeys={['channels', 'status']} />
            <InfoList title="Integration Readiness" icon={Lock} rows={payload?.integrations || []} primaryKey="system" secondaryKeys={['status', 'purpose']} />
          </section>
        </main>
      </div>

      {auditOpen ? <AuditPanel rows={payload?.auditTrail || []} onClose={() => setAuditOpen(false)} /> : null}
    </div>
  );
}

function DashboardView({ payload }: { payload: Payload | null }) {
  return (
    <div className="space-y-4">
      <LeaveTypeDashboardCards payload={payload} />
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InfoList title="Upcoming Leave Schedule" icon={CalendarDays} rows={payload?.calendar || []} primaryKey="label" secondaryKeys={['from', 'to', 'status']} />
        <InfoList title="Workflow Matrix" icon={ShieldCheck} rows={payload?.workflowMatrix || []} primaryKey="dimension" secondaryKeys={['rule']} />
      </section>
    </div>
  );
}

function LeaveTypeDashboardCards({ payload }: { payload: Payload | null }) {
  const rows = payload?.leaveTypes || [];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">Dorman Long Leave Policy</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Entitlements, eligibility, payroll allowance, carry-forward, ESS visibility, and approval controls.</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Policy configured</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{item.entitlementDays}</p>
                <p className="text-xs font-bold text-slate-500">{item.durationBasis}</p>
              </div>
              <Chip value={item.active ? 'Active' : 'Inactive'} />
            </div>
            <p className="mt-3 line-clamp-3 text-xs font-semibold text-slate-600">{item.eligibility}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApplicationView({ rows }: { rows: AppRecord[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <TableHeader title="Leave Applications" detail="Draft, submitted, review, approved, rejected, withdrawn, cancelled, and completed requests." />
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Request', 'Employee', 'Type', 'Dates', 'Days', 'Balance', 'Stage', 'Compliance', 'Exceptions'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">{rows.map((item) => <ApplicationRow key={item.id} item={item} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function ApprovalView({ rows }: { rows: AppRecord[] }) {
  const approvalRows = rows.filter((item) => !['Approved', 'Completed', 'Cancelled', 'Rejected'].includes(item.status));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <TableHeader title="Leave Approval Queue" detail="Employee -> Supervisor -> Manager -> HR -> Final Approval, with configurable matrix controls." />
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Request', 'Employee', 'Manager', 'Type', 'Duration', 'Approval Status', 'Stage', 'Action Risk'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">{approvalRows.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-black text-slate-900">{item.id}</td><td className="px-4 py-3"><div className="font-black text-slate-950">{item.fullName}</div><div className="text-xs font-semibold text-slate-500">{item.department}</div></td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.managerName}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.leaveType}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.days} days</td><td className="px-4 py-3"><Chip value={item.approvalStatus} /></td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.stage}</td><td className="px-4 py-3"><Chip value={item.policyComplianceStatus} /></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function CalendarView({ payload }: { payload: Payload | null }) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <InfoList title="Published Leave Calendar" icon={CalendarDays} rows={payload?.calendar || []} primaryKey="label" secondaryKeys={['from', 'to', 'department', 'location', 'status']} />
      <InfoList title="Blocked & Reserved Periods" icon={Archive} rows={payload?.blockedPeriods || []} primaryKey="name" secondaryKeys={['from', 'to', 'scope', 'status']} />
    </section>
  );
}

function BalanceView({ rows }: { rows: BalanceRecord[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <TableHeader title="Leave Balance Administration" detail="Current, accrued, used, pending, forfeited, carry-forward, liability, history, imports, exports, and recalculation readiness." />
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Employee', 'Type', 'Current', 'Accrued', 'Used', 'Pending', 'Forfeited', 'Carry Forward', 'Liability', 'Status'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">{rows.slice(0, 80).map((item) => <tr key={`${item.employeeId}-${item.leaveType}`} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-black text-slate-950">{item.fullName}</div><div className="text-xs font-semibold text-slate-500">{item.employeeId} - {item.department}</div></td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.leaveType}</td><td className="px-4 py-3 text-sm font-black text-slate-900">{item.currentBalance}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.accruedBalance}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.usedBalance}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.pendingBalance}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.forfeitedBalance}</td><td className="px-4 py-3 text-sm font-bold text-slate-700">{item.carryForwardBalance}</td><td className="px-4 py-3 text-sm font-black text-slate-900">{money(item.liabilityValue)}</td><td className="px-4 py-3"><Chip value={item.status} /></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function LeaveTypeView({ payload }: { payload: Payload | null }) {
  const rows = payload?.leaveTypes || [];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <TableHeader title="Leave Types" detail="Centralized configurable records for statutory, company, unpaid, paid, evidence-based, and future leave categories." />
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Leave Type', 'Entitlement', 'Eligibility', 'Categories', 'Documents', 'Approvals', 'Accrual', 'Carry Forward', 'Allowance', 'Status'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-black text-slate-950">{item.name}</div><div className="text-xs font-semibold text-slate-500">{item.genderRestriction} eligibility</div></td>
                <td className="px-4 py-3 text-sm font-black text-slate-900">{item.entitlementDays} {item.durationBasis.toLowerCase()}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.eligibility}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.categoryRestrictions.join(', ') || 'All'}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.documentRequirements.join(', ') || 'None'}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.approvalLevels.join(' -> ')}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.accrualRule}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.carryForwardRule}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.allowanceRule}</td>
                <td className="px-4 py-3"><Chip value={item.active ? 'Active' : 'Inactive'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OperationalView({ payload, section }: { payload: Payload | null; section: string }) {
  const config = payload?.operationalSections.find((item) => item.id === section);
  const rows = (config?.reports?.length ? config.reports.map((item) => ({ control: item, value: 'Report-ready' })) : config?.controls.map((item) => ({ control: item, value: 'Configured' }))) || [];
  return <InfoList title={config?.label || 'Leave Operations'} icon={CheckCircle2} rows={rows} primaryKey="control" secondaryKeys={['value']} />;
}

function ApplicationRow({ item }: { item: AppRecord }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3"><div className="font-black text-slate-950">{item.id}</div><div className="text-xs font-semibold text-slate-500">{item.status}</div></td>
      <td className="px-4 py-3"><div className="font-black text-slate-950">{item.fullName}</div><div className="text-xs font-semibold text-slate-500">{item.employeeId} - {item.department}</div></td>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.leaveType}</td>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.startDate} to {item.endDate}</td>
      <td className="px-4 py-3 text-sm font-black text-slate-900">{item.days}</td>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.availableBalance} available, {item.balanceImpact} impact</td>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.stage}</td>
      <td className="px-4 py-3"><Chip value={item.policyComplianceStatus} /></td>
      <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.exceptions.length ? item.exceptions.join(', ') : 'None'}</td>
    </tr>
  );
}

function InfoList({ title, icon: Icon, rows, primaryKey, secondaryKeys }: { title: string; icon: any; rows: Array<Record<string, any>>; primaryKey: string; secondaryKeys: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row, index) => (
          <div key={`${String(row[primaryKey])}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-950">{String(row[primaryKey] || '')}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{secondaryKeys.map((key) => row[key]).filter(Boolean).join(' - ')}</p>
          </div>
        ))}
        {!rows.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No records available.</div> : null}
      </div>
    </section>
  );
}

function TableHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-b border-slate-100 p-4">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function Chip({ value }: { value: string }) {
  const styles = toneStyles[statusTone(value)];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles.chip}`}>{value}</span>;
}

function AuditPanel({ rows, onClose }: { rows: AuditEntry[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Leave Audit Trail</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">User, action, time, old value, new value, comments, reason, and workflow history.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4">
          <div className="space-y-3">
            {rows.length ? rows.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">{item.action} - {item.record}</p>
                  <span className="text-xs font-bold text-slate-500">{stableDateTime(item.at)}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.user} / {item.role}</p>
                <p className="mt-2 text-xs font-semibold text-slate-700">{item.newValue || item.comments || 'Action logged'}</p>
                {item.reason ? <p className="mt-1 text-xs font-bold text-amber-700">Reason: {item.reason}</p> : null}
              </div>
            )) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No leave audit actions have been logged in this session yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
