'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Lock,
  MapPin,
  PlayCircle,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

type TimeRole = 'Payroll Officer' | 'HR Officer' | 'HR Manager' | 'Supervisor' | 'Department Manager' | 'Project Manager' | 'Site Manager' | 'Employee' | 'Finance Team' | 'System Administrator';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';
type TimeAction = { id: string; label: string; roles: TimeRole[]; requiresReason?: boolean; sensitive?: boolean };
type TimeRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  projectCode: string;
  projectName: string;
  workPackage: string;
  costCenter: string;
  site: string;
  task: string;
  hoursWorked: number;
  overtimeHours: number;
  billableHours: number;
  nonBillableHours: number;
  status: string;
  workflowStage: string;
  approvalStatus: string;
  payrollStatus: string;
  validationStatus: string;
  exceptions: string[];
};
type AuditEntry = { id: string; at: string; user: string; role: string; action: string; record: string; oldValue: string | null; newValue: string | null; comments?: string; reason?: string };
type SectionConfig = { id: string; label: string; description: string; actions: string[]; controls: string[]; reports?: string[] };
type Payload = {
  generatedAt: string;
  source: string;
  role: TimeRole;
  section: string;
  period: { id: string; name: string; startDate: string; endDate: string; status: string };
  permissions: { canCreate: boolean; canSubmit: boolean; canApprove: boolean; canSchedule: boolean; canPostPayroll: boolean; canConfigure: boolean; canExport: boolean; canViewAudit: boolean };
  summary: {
    totalEmployees: number;
    timesheets: number;
    submittedTimesheets: number;
    approvedTimesheets: number;
    lockedTimesheets: number;
    totalHours: number;
    overtimeHours: number;
    billableHours: number;
    nonBillableHours: number;
    missingHours: number;
    attendanceExceptions: number;
    payrollReadyHours: number;
    blockedTransactions: number;
    pendingApprovals: number;
  };
  current: {
    timeStatus: string;
    availableActions: string[];
    nextRequiredAction: string;
    approvalStatus: string;
    validationStatus: string;
    payrollImpact: string;
    auditHistory: string;
    workflowProgress: string;
    exceptionIndicators: string[];
  };
  actions: TimeAction[];
  records: TimeRecord[];
  sections: SectionConfig[];
  workflowMatrix: Array<Record<string, string>>;
  schedules: Array<Record<string, string | number>>;
  reports: Array<Record<string, string>>;
  notifications: Array<Record<string, string>>;
  integrations: Array<Record<string, string>>;
  auditTrail: AuditEntry[];
};
type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: TimeRole[] = ['Payroll Officer', 'HR Officer', 'HR Manager', 'Supervisor', 'Department Manager', 'Project Manager', 'Site Manager', 'Employee', 'Finance Team', 'System Administrator'];
const numberFmt = new Intl.NumberFormat('en-GB');
const number = (value: number | undefined) => numberFmt.format(value || 0);
const hours = (value: number | undefined) => `${number(value)} hrs`;

const toneStyles: Record<Tone, { card: string; icon: string; chip: string; button: string }> = {
  blue: { card: 'border-blue-200 bg-blue-50', icon: 'bg-blue-600 text-white', chip: 'bg-blue-100 text-blue-800', button: 'bg-blue-600 text-white hover:bg-blue-700' },
  green: { card: 'border-emerald-200 bg-emerald-50', icon: 'bg-emerald-600 text-white', chip: 'bg-emerald-100 text-emerald-800', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  amber: { card: 'border-amber-200 bg-amber-50', icon: 'bg-amber-500 text-white', chip: 'bg-amber-100 text-amber-800', button: 'bg-amber-500 text-white hover:bg-amber-600' },
  red: { card: 'border-red-200 bg-red-50', icon: 'bg-red-600 text-white', chip: 'bg-red-100 text-red-800', button: 'bg-red-600 text-white hover:bg-red-700' },
  violet: { card: 'border-violet-200 bg-violet-50', icon: 'bg-violet-600 text-white', chip: 'bg-violet-100 text-violet-800', button: 'bg-violet-600 text-white hover:bg-violet-700' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', icon: 'bg-cyan-600 text-white', chip: 'bg-cyan-100 text-cyan-800', button: 'bg-cyan-600 text-white hover:bg-cyan-700' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'bg-slate-900 text-white', chip: 'bg-slate-100 text-slate-800', button: 'bg-slate-900 text-white hover:bg-slate-800' },
};

const statusTone = (value: string): Tone => {
  const text = String(value || '').toLowerCase();
  if (text.includes('block') || text.includes('reject') || text.includes('error') || text.includes('missing')) return 'red';
  if (text.includes('pending') || text.includes('warning') || text.includes('submitted') || text.includes('draft')) return 'amber';
  if (text.includes('approve') || text.includes('valid') || text.includes('ready') || text.includes('posted') || text.includes('locked')) return 'green';
  return 'blue';
};

const actionIcon = (id: string) => {
  if (id.includes('approve')) return BadgeCheck;
  if (id.includes('reject') || id.includes('cancel')) return XCircle;
  if (id.includes('export') || id.includes('generate')) return Download;
  if (id.includes('audit') || id.includes('history')) return History;
  if (id.includes('lock')) return Lock;
  if (id.includes('schedule') || id.includes('publish')) return CalendarClock;
  if (id.includes('payroll')) return Banknote;
  if (id.includes('recalculate') || id.includes('reconcile')) return RotateCcw;
  if (id.includes('submit')) return Send;
  return PlayCircle;
};

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`rounded-2xl border p-4 ${styles.card}`}>
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

export default function TimeAndLogsManagementClient({ initialNow, initialSection = 'timesheet-entry' }: { initialNow: string; initialSection?: string }) {
  const [role, setRole] = useState<TimeRole>('HR Manager');
  const [section, setSection] = useState(initialSection);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  const activeSection = useMemo(() => payload?.sections.find((item) => item.id === section) || payload?.sections[0], [payload?.sections, section]);

  const load = async (nextSection = section, nextRole = role) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hris/time-and-logs?section=${encodeURIComponent(nextSection)}`, { headers: { 'x-hris-role': nextRole }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Time & Logs request failed (${res.status})`);
      setPayload(json.data);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Time & Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(section, role);
  }, [section, role]);

  const runAction = async (action: TimeAction) => {
    if (action.id === 'view-audit-trail' || action.id === 'view-history') {
      setAuditOpen(true);
      return;
    }
    setBusyAction(action.id);
    setToast('');
    try {
      const res = await fetch('/api/hris/time-and-logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: action.id,
          section,
          actor: role,
          record: payload?.records[0]?.id || section,
          reason: action.requiresReason ? `${action.label} requested from Time & Logs` : undefined,
          comments: `${action.label} executed from ${activeSection?.label || section}`,
          approved: true,
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

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((item) => !q || [item.id, item.employeeId, item.employeeName, item.department, item.projectCode, item.projectName, item.site, item.status, item.validationStatus].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [payload?.records, query]);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Clock className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Time & Logs</h1>
              <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">
                Enterprise workforce time management for timesheets, approvals, projects, sites, overtime, shifts, rosters, corrections, payroll, costing, audit, and reporting.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">Period: {payload?.period.name || 'Loading'} / {payload?.period.status || 'Loading'}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">{payload?.source || 'Loading source'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {new Date(payload?.generatedAt || initialNow).toLocaleString('en-GB')}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(event) => setRole(event.target.value as TimeRole)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" onClick={() => { window.location.href = '/api/hris/time-and-logs?format=csv'; }} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Employees" value={number(payload?.summary.totalEmployees)} detail={`${number(payload?.summary.timesheets)} timesheet records`} icon={Users} tone="blue" />
        <MetricCard label="Total Hours" value={hours(payload?.summary.totalHours)} detail={`${hours(payload?.summary.billableHours)} billable`} icon={Clock} tone="green" />
        <MetricCard label="Overtime" value={hours(payload?.summary.overtimeHours)} detail="Policy approval required before payroll" icon={CalendarClock} tone={(payload?.summary.overtimeHours || 0) ? 'amber' : 'green'} />
        <MetricCard label="Pending Approvals" value={number(payload?.summary.pendingApprovals)} detail={`${number(payload?.summary.submittedTimesheets)} submitted`} icon={ClipboardCheck} tone={(payload?.summary.pendingApprovals || 0) ? 'amber' : 'green'} />
        <MetricCard label="Blocked" value={number(payload?.summary.blockedTransactions)} detail={`${number(payload?.summary.attendanceExceptions)} attendance/time exceptions`} icon={AlertTriangle} tone={(payload?.summary.blockedTransactions || 0) ? 'red' : 'green'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-black uppercase text-slate-500">Time & Logs Menu</p>
          <nav className="grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Time & Logs pages">
            {(payload?.sections || []).map((item) => (
              <Link key={item.id} href={`/hris/time-and-logs/${item.id}`} onClick={() => setSection(item.id)} className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${section === item.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">{activeSection?.label || 'Timesheet Entry'}</h2>
                <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">{activeSection?.description}</p>
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
          </section>

          <StatusPanel payload={payload} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <MetricCard label="Payroll Ready Hours" value={hours(payload?.summary.payrollReadyHours)} detail="Approved and ready for posting" icon={Banknote} tone="cyan" />
            <MetricCard label="Missing Hours" value={number(payload?.summary.missingHours)} detail="Must be resolved before approval" icon={XCircle} tone={(payload?.summary.missingHours || 0) ? 'red' : 'green'} />
            <MetricCard label="Locked Timesheets" value={number(payload?.summary.lockedTimesheets)} detail="Protected from edit until unlocked" icon={Lock} tone="violet" />
          </div>

          <div className="relative">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, project, department, site, status, validation..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            {query ? <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
          </div>

          <RecordsView rows={filteredRecords} section={section} />

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoList title="Workflow Matrix" icon={ShieldCheck} rows={payload?.workflowMatrix || []} primaryKey="dimension" secondaryKeys={['rule']} />
            <InfoList title="Schedules, Shifts & Rosters" icon={CalendarClock} rows={payload?.schedules || []} primaryKey="name" secondaryKeys={['start', 'end', 'category', 'status']} />
            <InfoList title="Reports" icon={FileSpreadsheet} rows={payload?.reports || []} primaryKey="name" secondaryKeys={['format', 'status']} />
            <InfoList title="Notifications" icon={Bell} rows={payload?.notifications || []} primaryKey="event" secondaryKeys={['channels', 'status']} />
            <InfoList title="Integration Readiness" icon={MapPin} rows={payload?.integrations || []} primaryKey="system" secondaryKeys={['status', 'purpose']} />
            <InfoList title="Production Controls" icon={CheckCircle2} rows={(activeSection?.controls || []).map((control) => ({ control, status: 'Enforced / workflow-ready' }))} primaryKey="control" secondaryKeys={['status']} />
          </section>
        </main>
      </div>

      {auditOpen ? <AuditPanel rows={payload?.auditTrail || []} onClose={() => setAuditOpen(false)} /> : null}
    </div>
  );
}

function StatusPanel({ payload }: { payload: Payload | null }) {
  const rows = [
    ['Current time status', payload?.current.timeStatus || 'Loading'],
    ['Available actions', payload?.current.availableActions.join(', ') || 'Loading'],
    ['Next required action', payload?.current.nextRequiredAction || 'Loading'],
    ['Approval status', payload?.current.approvalStatus || 'Loading'],
    ['Validation status', payload?.current.validationStatus || 'Loading'],
    ['Payroll impact', payload?.current.payrollImpact || 'Loading'],
    ['Audit history', payload?.current.auditHistory || 'Loading'],
    ['Workflow progress', payload?.current.workflowProgress || 'Loading'],
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-950">Operational Status</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Every Time & Logs page exposes status, actions, workflow, validation, payroll impact, audit, and exceptions.</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-blue-600" />
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
            {payload.current.exceptionIndicators.map((item) => <span key={item} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{item}</span>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RecordsView({ rows, section }: { rows: TimeRecord[]; section: string }) {
  const title = section.includes('project') ? 'Project Time Logs' : section.includes('department') ? 'Department Time Logs' : section.includes('field') ? 'Field Work Logs' : section.includes('overtime') ? 'Overtime Logs' : 'Time Transactions';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">Project allocation, cost center, site, task, hours, overtime, approval, payroll, validation, and exceptions.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{['Employee', 'Project', 'Site / Cost Center', 'Task', 'Hours', 'Overtime', 'Billable', 'Workflow', 'Payroll', 'Validation', 'Exceptions'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.slice(0, 120).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-black text-slate-950">{item.employeeName}</div><div className="text-xs font-semibold text-slate-500">{item.employeeId} - {item.department}</div></td>
                <td className="px-4 py-3"><div className="text-sm font-black text-slate-900">{item.projectCode}</div><div className="text-xs font-semibold text-slate-500">{item.projectName}</div></td>
                <td className="px-4 py-3"><div className="text-sm font-bold text-slate-700">{item.site}</div><div className="text-xs font-semibold text-slate-500">{item.costCenter}</div></td>
                <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.task}</td>
                <td className="px-4 py-3 text-sm font-black text-slate-900">{hours(item.hoursWorked)}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-700">{hours(item.overtimeHours)}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-700">{hours(item.billableHours)}</td>
                <td className="px-4 py-3"><Chip value={`${item.status} / ${item.workflowStage}`} /></td>
                <td className="px-4 py-3"><Chip value={item.payrollStatus} /></td>
                <td className="px-4 py-3"><Chip value={item.validationStatus} /></td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.exceptions.length ? item.exceptions.join(', ') : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
            <h3 className="text-lg font-black text-slate-950">Time & Logs Audit Trail</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Timesheet creation, edits, approvals, overtime, shift, roster, corrections, payroll postings, and change history.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4">
          <div className="space-y-3">
            {rows.length ? rows.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">{item.action} - {item.record}</p>
                  <span className="text-xs font-bold text-slate-500">{new Date(item.at).toLocaleString('en-GB')}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.user} / {item.role}</p>
                <p className="mt-2 text-xs font-semibold text-slate-700">{item.newValue || item.comments || 'Action logged'}</p>
                {item.reason ? <p className="mt-1 text-xs font-bold text-amber-700">Reason: {item.reason}</p> : null}
              </div>
            )) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No Time & Logs audit actions have been logged in this session yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
