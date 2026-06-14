'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BadgeCheck, Banknote, CalendarCheck, CalendarClock, CheckCircle2, Clock, Download, ExternalLink, History, Lock, PlayCircle, RefreshCcw, Send, ShieldCheck, TrendingUp, Users, X, XCircle } from 'lucide-react';

type Role = 'Employee' | 'Supervisor' | 'Manager' | 'General Manager' | 'HR Officer' | 'HR Manager' | 'Payroll Officer' | 'Payroll Manager' | 'Executive Management' | 'Administrator' | 'Super Administrator';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';
type Action = { id: string; label: string; roles: Role[]; requiresReason?: boolean; sensitive?: boolean };
type Section = { id: string; label: string; description: string; tabs: Array<{ id: string; label: string; controls: string[] }>; actions: string[] };
type RecordRow = { id: string; employeeId: string; employeeName: string; department: string; location: string; site: string; shift: string; attendanceStatus: string; timeStatus: string; approvalStatus: string; payrollStatus: string; productivityStatus: string; hoursWorked: number; overtimeHours: number; exceptions: string[] };
type AuditEntry = { id: string; at: string; user: string; role: string; action: string; record: string; oldValue: string | null; newValue: string | null; reason?: string; comments?: string };
type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  section: string;
  tab: string;
  permissions: { canCapture: boolean; canApprove: boolean; canSchedule: boolean; canPostPayroll: boolean; canConfigure: boolean; canExport: boolean; canAudit: boolean };
  summary: { totalEmployees: number; presentToday: number; absentToday: number; lateToday: number; earlyDepartures: number; missingPunches: number; onLeaveToday: number; attendanceExceptions: number; timesheetHours: number; overtimeHours: number; pendingApprovals: number; payrollReadyHours: number; shiftConflicts: number; productivityPct: number };
  current: { workforceStatus: string; availableActions: string[]; nextRequiredAction: string; approvalStatus: string; complianceStatus: string; payrollImpact: string; auditHistory: string; workflowProgress: string; exceptionIndicators: string[] };
  sections: Section[];
  actions: Action[];
  records: RecordRow[];
  auditTrail: AuditEntry[];
};
type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: Role[] = ['Employee', 'Supervisor', 'Manager', 'General Manager', 'HR Officer', 'HR Manager', 'Payroll Officer', 'Payroll Manager', 'Executive Management', 'Administrator', 'Super Administrator'];
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
  if (text.includes('exception') || text.includes('absent') || text.includes('block') || text.includes('reject') || text.includes('missing')) return 'red';
  if (text.includes('late') || text.includes('pending') || text.includes('review') || text.includes('warning')) return 'amber';
  if (text.includes('present') || text.includes('ready') || text.includes('productive') || text.includes('approved') || text.includes('compliant')) return 'green';
  return 'blue';
};
const actionIcon = (id: string) => {
  if (id.includes('approve')) return BadgeCheck;
  if (id.includes('reject')) return XCircle;
  if (id.includes('payroll')) return Banknote;
  if (id.includes('report') || id.includes('export')) return Download;
  if (id.includes('audit') || id.includes('history')) return History;
  if (id.includes('lock')) return Lock;
  if (id.includes('schedule') || id.includes('roster')) return CalendarClock;
  if (id.includes('submit')) return Send;
  return PlayCircle;
};

const timesheetQuickLinks = [
  { label: 'Timesheet Entry', href: '/hris/workforce-management/timesheet-entry' },
  { label: 'Timesheet Period', href: '/hris/workforce-management/timesheet-period' },
  { label: 'Timesheet Approval', href: '/hris/workforce-management/timesheet-approval' },
  { label: 'Timesheet Reports', href: '/hris/workforce-management/timesheet-reports' },
];

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
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

export default function WorkforceManagementClient({ initialNow, initialSection = 'attendance', initialTab }: { initialNow: string; initialSection?: string; initialTab?: string }) {
  const [role, setRole] = useState<Role>('HR Manager');
  const [section, setSection] = useState(initialSection);
  const [tab, setTab] = useState(initialTab || '');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  const activeSection = useMemo(() => payload?.sections.find((item) => item.id === section) || payload?.sections[0], [payload?.sections, section]);
  const activeTab = useMemo(() => activeSection?.tabs.find((item) => item.id === (tab || payload?.tab)) || activeSection?.tabs[0], [activeSection, payload?.tab, tab]);

  const load = async (nextSection = section, nextTab = tab, nextRole = role) => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/hris/workforce-management?section=${encodeURIComponent(nextSection)}${nextTab ? `&tab=${encodeURIComponent(nextTab)}` : ''}`;
      const res = await fetch(url, { headers: { 'x-hris-role': nextRole }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Workforce request failed (${res.status})`);
      setPayload(json.data);
      if (!nextTab) setTab(json.data.tab);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Workforce Management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(section, tab, role);
  }, [section, tab, role]);

  const chooseSection = (id: string) => {
    const next = payload?.sections.find((item) => item.id === id);
    setSection(id);
    setTab(next?.tabs[0]?.id || '');
  };

  const runAction = async (action: Action) => {
    if (action.id === 'view-audit-trail' || action.id === 'view-history') {
      setAuditOpen(true);
      return;
    }
    if (action.id === 'export') {
      window.open('/api/hris/workforce-management?format=csv', '_self');
      return;
    }
    setBusyAction(action.id);
    setToast('');
    try {
      const res = await fetch('/api/hris/workforce-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: action.id,
          section,
          tab: activeTab?.id,
          actor: role,
          record: payload?.records[0]?.id || section,
          reason: action.requiresReason ? `${action.label} requested from Workforce Management` : undefined,
          comments: `${action.label} executed from ${activeSection?.label || section}`,
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
    return (payload?.records || []).filter((item) => !q || [item.employeeId, item.employeeName, item.department, item.location, item.site, item.shift, item.attendanceStatus, item.timeStatus, item.approvalStatus, item.payrollStatus].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [payload?.records, query]);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><Users className="h-6 w-6" /></span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Workforce Management</h1>
              <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">Central hub for attendance, timesheets, approvals, corrections, overtime, payroll-ready hours, and workforce reports.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">{payload?.source || 'Loading source'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {new Date(payload?.generatedAt || initialNow).toLocaleString('en-GB')}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">{roles.map((item) => <option key={item}>{item}</option>)}</select>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing' : 'Refresh'}</button>
          <button type="button" onClick={() => { window.open('/api/hris/workforce-management?format=csv', '_self'); }} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Download className="h-4 w-4" />Export</button>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Employees" value={number(payload?.summary.totalEmployees)} detail="Directory-integrated workforce" icon={Users} tone="blue" />
        <MetricCard label="Attendance Today" value={number(payload?.summary.presentToday)} detail={`${number(payload?.summary.lateToday)} late arrivals, ${number(payload?.summary.absentToday)} absences`} icon={CalendarCheck} tone="green" />
        <MetricCard label="Timesheet Hours" value={hours(payload?.summary.timesheetHours)} detail={`${hours(payload?.summary.overtimeHours)} overtime`} icon={Clock} tone="cyan" />
        <MetricCard label="Pending Approvals" value={number(payload?.summary.pendingApprovals)} detail="Workflow queue" icon={BadgeCheck} tone={(payload?.summary.pendingApprovals || 0) ? 'amber' : 'green'} />
        <MetricCard label="Payroll Ready" value={hours(payload?.summary.payrollReadyHours)} detail="Approved workforce hours" icon={Banknote} tone="violet" />
        <MetricCard label="Productivity" value={`${number(payload?.summary.productivityPct)}%`} detail={`${number(payload?.summary.attendanceExceptions)} exceptions`} icon={TrendingUp} tone={(payload?.summary.attendanceExceptions || 0) ? 'red' : 'green'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-black uppercase text-slate-500">Workforce Pages</p>
          <nav className="grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Workforce Management pages">
            {(payload?.sections || []).map((item) => (
              <Link key={item.id} href={`/hris/workforce-management/${item.id}`} onClick={() => chooseSection(item.id)} className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${section === item.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="px-2 pb-2 text-xs font-black uppercase text-slate-500">Timesheet</p>
            <nav className="grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Timesheet functions">
              {timesheetQuickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700">{item.label}</Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">{activeSection?.label || 'Attendance'}</h2>
                <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">{activeSection?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(payload?.actions || []).map((item) => {
                  const Icon = actionIcon(item.id);
                  return <button key={item.id} type="button" onClick={() => void runAction(item)} disabled={busyAction === item.id} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold ${item.sensitive ? toneStyles.amber.button : toneStyles.blue.button} disabled:cursor-wait disabled:opacity-60`}><Icon className="h-4 w-4" />{busyAction === item.id ? 'Processing' : item.label}</button>;
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(activeSection?.tabs || []).map((item) => (
                <Link key={item.id} href={`/hris/workforce-management/${section}?tab=${item.id}`} onClick={() => setTab(item.id)} className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${activeTab?.id === item.id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{item.label}</Link>
              ))}
            </div>
          </section>

          <StatusPanel payload={payload} />
          {section === 'attendance' ? <AttendanceOperations payload={payload} /> : null}

          <ControlsPanel title={`${activeTab?.label || 'Selected'} Controls`} rows={activeTab?.controls || []} />

          {section === 'time-tracking' ? <TimesheetAccess /> : null}

          <div className="relative">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, department, site, shift, attendance, approval, payroll..." className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            {query ? <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
          </div>

          <RecordsTable rows={filteredRecords} />

        </main>
      </div>

      {auditOpen ? <AuditPanel rows={payload?.auditTrail || []} onClose={() => setAuditOpen(false)} /> : null}
    </div>
  );
}

function AttendanceOperations({ payload }: { payload: Payload | null }) {
  const rows = [
    { label: 'Valid Presence', value: payload?.summary.presentToday || 0, detail: 'Employees with valid attendance presence today', tone: 'green' as Tone, icon: CheckCircle2 },
    { label: 'Late Arrivals', value: payload?.summary.lateToday || 0, detail: 'Employees who arrived after scheduled start', tone: (payload?.summary.lateToday || 0) ? 'amber' as Tone : 'green' as Tone, icon: Clock },
    { label: 'Absences', value: payload?.summary.absentToday || 0, detail: 'Employees absent without a valid attendance transaction', tone: (payload?.summary.absentToday || 0) ? 'red' as Tone : 'green' as Tone, icon: XCircle },
    { label: 'Early Departures', value: payload?.summary.earlyDepartures || 0, detail: 'Employees who checked out before scheduled end', tone: (payload?.summary.earlyDepartures || 0) ? 'amber' as Tone : 'green' as Tone, icon: CalendarClock },
    { label: 'Missing Punches', value: payload?.summary.missingPunches || 0, detail: 'Missing clock-in or clock-out records', tone: (payload?.summary.missingPunches || 0) ? 'red' as Tone : 'green' as Tone, icon: AlertTriangle },
    { label: 'On Leave / Excused', value: payload?.summary.onLeaveToday || 0, detail: 'Approved leave or excused attendance status', tone: 'blue' as Tone, icon: ShieldCheck },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">Attendance Operations</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Daily attendance controls for presence, late arrivals, absences, early departures, missing punches, leave, and exceptions.</p>
        </div>
        <CalendarCheck className="h-5 w-5 text-blue-600" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => <MetricCard key={item.label} label={item.label} value={number(item.value)} detail={item.detail} icon={item.icon} tone={item.tone} />)}
      </div>
    </section>
  );
}

function TimesheetAccess() {
  const details = new Map([
    ['Timesheet Entry', 'Create, edit, save draft, submit, validate, and reopen timesheets.'],
    ['Timesheet Approval', 'Supervisor, project manager, HR, and payroll approval workflow.'],
    ['Timesheet Period', 'Open the current month period from the 16th of the previous month to the 15th of the current month.'],
    ['Timesheet Reports', 'Summary, employee, project, payroll hours, and reconciliation reports.'],
  ]);
  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">Timesheet Workbench</h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">Existing detailed timesheet screens remain active and are now linked from Workforce Management.</p>
        </div>
        <Clock className="h-5 w-5 text-blue-700" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {timesheetQuickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-blue-200 bg-white p-3 transition-colors hover:bg-blue-50">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-950">{item.label}</p>
              <ExternalLink className="h-4 w-4 text-blue-700" />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">{details.get(item.label)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusPanel({ payload }: { payload: Payload | null }) {
  const rows = [
    ['Workforce status', payload?.current.workforceStatus || 'Loading'],
    ['Available actions', payload?.current.availableActions.join(', ') || 'Loading'],
    ['Next required action', payload?.current.nextRequiredAction || 'Loading'],
    ['Approval status', payload?.current.approvalStatus || 'Loading'],
    ['Compliance status', payload?.current.complianceStatus || 'Loading'],
    ['Payroll impact', payload?.current.payrollImpact || 'Loading'],
    ['Audit history', payload?.current.auditHistory || 'Loading'],
    ['Workflow progress', payload?.current.workflowProgress || 'Loading'],
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">Operational Status</h2><p className="mt-1 text-xs font-semibold text-slate-500">Centralized status, workflow, compliance, payroll impact, audit, and exceptions across attendance and time operations.</p></div><ShieldCheck className="h-5 w-5 text-blue-600" /></div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{rows.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 line-clamp-2 text-xs font-extrabold text-slate-900">{value}</p></div>)}</div>
      {payload?.current.exceptionIndicators.length ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-xs font-black uppercase text-red-800">Exception Indicators</p><div className="mt-2 flex flex-wrap gap-2">{payload.current.exceptionIndicators.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{item}</span>)}</div></div> : null}
    </section>
  );
}

function RecordsTable({ rows }: { rows: RecordRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4"><h3 className="text-base font-black text-slate-950">Workforce Operations Register</h3><p className="mt-1 text-xs font-semibold text-slate-500">Unified attendance, time, approval, payroll, productivity, shift, site, and exception posture.</p></div>
      <div className="overflow-x-auto">
        <table className="min-w-[1220px] w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{['Employee', 'Location / Site', 'Shift', 'Attendance', 'Time', 'Approval', 'Payroll', 'Hours', 'Overtime', 'Productivity', 'Exceptions'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-black text-slate-950">{item.employeeName}</div><div className="text-xs font-semibold text-slate-500">{item.employeeId} - {item.department}</div></td>
                <td className="px-4 py-3"><div className="text-sm font-bold text-slate-700">{item.location}</div><div className="text-xs font-semibold text-slate-500">{item.site}</div></td>
                <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.shift}</td>
                <td className="px-4 py-3"><Chip value={item.attendanceStatus} /></td>
                <td className="px-4 py-3"><Chip value={item.timeStatus} /></td>
                <td className="px-4 py-3"><Chip value={item.approvalStatus} /></td>
                <td className="px-4 py-3"><Chip value={item.payrollStatus} /></td>
                <td className="px-4 py-3 text-sm font-black text-slate-900">{hours(item.hoursWorked)}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-700">{hours(item.overtimeHours)}</td>
                <td className="px-4 py-3"><Chip value={item.productivityStatus} /></td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.exceptions.length ? item.exceptions.join(', ') : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ControlsPanel({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h3 className="text-base font-black text-slate-950">{title}</h3><ShieldCheck className="h-5 w-5 text-slate-400" /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rows.map((row) => <span key={row} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{row}</span>)}
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
        <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h3 className="text-lg font-black text-slate-950">Workforce Audit Trail</h3><p className="mt-1 text-xs font-semibold text-slate-500">Attendance, time, shift, overtime, approval, correction, payroll, security, and activity logs.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[65vh] overflow-y-auto p-4"><div className="space-y-3">{rows.length ? rows.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-950">{item.action} - {item.record}</p><span className="text-xs font-bold text-slate-500">{new Date(item.at).toLocaleString('en-GB')}</span></div><p className="mt-1 text-xs font-semibold text-slate-600">{item.user} / {item.role}</p><p className="mt-2 text-xs font-semibold text-slate-700">{item.newValue || item.comments || 'Action logged'}</p>{item.reason ? <p className="mt-1 text-xs font-bold text-amber-700">Reason: {item.reason}</p> : null}</div>) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No workforce audit actions have been logged in this session yet.</div>}</div></div>
      </div>
    </div>
  );
}
