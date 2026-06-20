'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Download,
  History,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  TimerReset,
  X,
  XCircle,
} from 'lucide-react';

type Role =
  | 'Employee'
  | 'Supervisor'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Payroll Manager'
  | 'Finance Controller'
  | 'Executive Management'
  | 'Administrator'
  | 'Super Administrator';
type Status = 'Draft' | 'Submitted' | 'Supervisor Approved' | 'HR Approved' | 'Payroll Ready' | 'Payroll Posted' | 'Returned' | 'Rejected' | 'Blocked';
type DayType = 'Weekday' | 'Saturday' | 'Sunday' | 'Public Holiday';
type Action = 'submit' | 'approve-supervisor' | 'approve-hr' | 'mark-payroll-ready' | 'post-payroll' | 'return' | 'reject' | 'reopen';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';

type OvertimeRecord = {
  id: string;
  sourceLineId: string;
  headerId: string;
  periodId: string;
  date: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  location: string;
  supervisor: string;
  workCenter: string;
  employmentType: string;
  salaryGrade: string;
  dayType: DayType;
  workedHours: number;
  standardHours: number;
  overtimeHours: number;
  payableHours: number;
  multiplier: number;
  hourlyRate: number;
  grossPay: number;
  earningCode: string;
  earningName: string;
  timesheetStatus: string;
  payrollReady: boolean;
  status: Status;
  currentOwner: string;
  severity: 'Low' | 'Medium' | 'High';
  issues: string[];
  projectCodes: string[];
  lastActionAt: string | null;
  workflow: Array<{ stage: 'Employee' | 'Supervisor' | 'HR' | 'Payroll'; status: 'Pending' | 'Completed' | 'Returned' | 'Rejected' | 'Blocked'; owner: string; actedAt: string | null }>;
  auditTrail: Array<{ id: string; at: string; actor: string; role: Role; action: string; oldStatus: Status | null; newStatus: Status; comment: string | null }>;
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  dataSource: { source: string; databaseAvailable: boolean; warning: string | null; employeeCount: number };
  permissions: { canSubmit: boolean; canSupervisorApprove: boolean; canHrApprove: boolean; canPayroll: boolean; canExport: boolean; canViewMoney: boolean; canAudit: boolean };
  summary: {
    records: number;
    submitted: number;
    supervisorApproved: number;
    hrApproved: number;
    payrollReady: number;
    payrollPosted: number;
    returned: number;
    rejected: number;
    blocked: number;
    payableHours: number;
    grossPay: number;
    pendingApprovals: number;
  };
  filterOptions: { statuses: Status[]; departments: string[]; locations: string[]; dayTypes: DayType[] };
  records: OvertimeRecord[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: Role[] = ['Employee', 'Supervisor', 'HR Officer', 'HR Manager', 'Payroll Officer', 'Payroll Manager', 'Finance Controller', 'Executive Management', 'Administrator', 'Super Administrator'];
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const number = (value: number | null | undefined) => numberFmt.format(value || 0);
const money = (value: number | null | undefined, canView = true) => (!canView ? 'Restricted' : moneyFmt.format(value || 0));

const toneStyles: Record<Tone, { card: string; chip: string; icon: string; button: string }> = {
  blue: { card: 'border-blue-200 bg-blue-50', chip: 'bg-blue-100 text-blue-800', icon: 'bg-blue-600 text-white', button: 'bg-blue-600 text-white hover:bg-blue-700' },
  green: { card: 'border-emerald-200 bg-emerald-50', chip: 'bg-emerald-100 text-emerald-800', icon: 'bg-emerald-600 text-white', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  amber: { card: 'border-amber-200 bg-amber-50', chip: 'bg-amber-100 text-amber-800', icon: 'bg-amber-500 text-white', button: 'bg-amber-500 text-white hover:bg-amber-600' },
  red: { card: 'border-red-200 bg-red-50', chip: 'bg-red-100 text-red-800', icon: 'bg-red-600 text-white', button: 'bg-red-600 text-white hover:bg-red-700' },
  violet: { card: 'border-violet-200 bg-violet-50', chip: 'bg-violet-100 text-violet-800', icon: 'bg-violet-600 text-white', button: 'bg-violet-600 text-white hover:bg-violet-700' },
  cyan: { card: 'border-cyan-200 bg-cyan-50', chip: 'bg-cyan-100 text-cyan-800', icon: 'bg-cyan-600 text-white', button: 'bg-cyan-600 text-white hover:bg-cyan-700' },
  slate: { card: 'border-slate-200 bg-slate-50', chip: 'bg-slate-100 text-slate-800', icon: 'bg-slate-900 text-white', button: 'bg-slate-900 text-white hover:bg-slate-800' },
};

const statusTone = (status: Status): Tone => {
  if (['Payroll Posted', 'Payroll Ready', 'HR Approved', 'Supervisor Approved'].includes(status)) return 'green';
  if (status === 'Submitted') return 'blue';
  if (status === 'Returned') return 'amber';
  if (['Rejected', 'Blocked'].includes(status)) return 'red';
  return 'slate';
};
const workflowTone = (status: string): Tone => status === 'Completed' ? 'green' : status === 'Blocked' || status === 'Rejected' ? 'red' : status === 'Returned' ? 'amber' : 'slate';

const actionLabels: Record<Action, string> = {
  submit: 'Submit',
  'approve-supervisor': 'Supervisor Approve',
  'approve-hr': 'HR Approve',
  'mark-payroll-ready': 'Mark Payroll Ready',
  'post-payroll': 'Post Payroll',
  return: 'Return',
  reject: 'Reject',
  reopen: 'Reopen',
};

const actionIcon = (action: Action) => {
  if (action.includes('approve')) return BadgeCheck;
  if (action.includes('payroll')) return Banknote;
  if (action === 'return' || action === 'reopen') return RotateCcw;
  if (action === 'reject') return XCircle;
  return Send;
};

function allowedActions(record: OvertimeRecord, payload: Payload | null): Action[] {
  if (!payload) return [];
  const actions: Action[] = [];
  if (['Draft', 'Returned'].includes(record.status) && payload.permissions.canSubmit) actions.push('submit');
  if (record.status === 'Submitted' && payload.permissions.canSupervisorApprove) actions.push('approve-supervisor');
  if (record.status === 'Supervisor Approved' && payload.permissions.canHrApprove) actions.push('approve-hr');
  if (record.status === 'HR Approved' && payload.permissions.canPayroll) actions.push('mark-payroll-ready');
  if (record.status === 'Payroll Ready' && payload.permissions.canPayroll) actions.push('post-payroll');
  if (['Returned', 'Rejected', 'Blocked'].includes(record.status) && payload.permissions.canHrApprove) actions.push('reopen');
  if (!['Payroll Posted', 'Rejected'].includes(record.status) && (payload.permissions.canSupervisorApprove || payload.permissions.canHrApprove || payload.permissions.canPayroll)) actions.push('return', 'reject');
  return actions;
}

export default function OvertimeManagementClient({ initialNow }: { initialNow: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [role, setRole] = useState<Role>('HR Manager');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [dayType, setDayType] = useState<'All' | DayType>('All');
  const [selectedId, setSelectedId] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    employeeId: '',
    date: new Date(initialNow).toISOString().slice(0, 10),
    dayType: 'Weekday' as DayType,
    workedHours: '10',
    payableHours: '',
    projectCode: '',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Overtime management failed (${res.status})`);
      const data = json.data;
      setPayload(data);
      setSelectedId((current) => current || data.records[0]?.id || '');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load overtime management.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.status !== status) return false;
      if (department !== 'All' && record.department !== department) return false;
      if (location !== 'All' && record.location !== location) return false;
      if (dayType !== 'All' && record.dayType !== dayType) return false;
      if (!q) return true;
      return [record.employeeId, record.employeeName, record.department, record.location, record.supervisor, record.workCenter, record.status, record.projectCodes.join(' ')].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [payload?.records, query, status, department, location, dayType]);

  const selected = payload?.records.find((record) => record.id === selectedId) || filtered[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);

  const runAction = async (recordId: string, action: Action) => {
    setBusy(`${recordId}-${action}`);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ id: recordId, action, actor: role, comment }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `${actionLabels[action]} failed`);
      setPayload(json.data);
      setToast(`${actionLabels[action]} completed.`);
      setComment('');
    } catch (event) {
      setError(event instanceof Error ? event.message : `${actionLabels[action]} failed.`);
    } finally {
      setBusy('');
    }
  };

  const runBulk = async (action: Action) => {
    const ids = Array.from(selectedRows);
    if (!ids.length) return;
    for (const id of ids) await runAction(id, action);
    setSelectedRows(new Set());
  };

  const toggleRow = (id: string) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/workforce-management/overtime-management?format=csv';
  };

  const createRequest = async () => {
    setBusy('create-request');
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: 'create-request',
          actor: role,
          employeeId: requestForm.employeeId,
          date: requestForm.date,
          dayType: requestForm.dayType,
          workedHours: Number(requestForm.workedHours || 0),
          payableHours: requestForm.payableHours ? Number(requestForm.payableHours) : undefined,
          projectCode: requestForm.projectCode,
          reason: requestForm.reason,
        }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to create overtime request.');
      setPayload(json.data);
      setSelectedId(json.data.records[0]?.id || '');
      setToast('Overtime request created.');
      setShowRequest(false);
      setRequestForm((current) => ({ ...current, employeeId: '', workedHours: '10', payableHours: '', projectCode: '', reason: '' }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to create overtime request.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <TimerReset className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Overtime Management</h1>
              <p className="mt-1 max-w-5xl text-sm font-semibold text-slate-600">Request, validate, approve, return, reject, and release overtime from timesheets into payroll-ready processing with full audit control.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {new Date(payload?.generatedAt || initialNow).toLocaleString('en-GB')}</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">HRIS DB: {payload?.dataSource.databaseAvailable ? 'Available' : 'Checking'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" onClick={() => setShowRequest((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />New Overtime Request</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          <button type="button" onClick={exportCsv} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"><Download className="h-4 w-4" />Export</button>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div> : null}

      {showRequest ? (
        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">New Overtime Request</h2>
              <p className="text-xs font-semibold text-slate-600">Create exceptional overtime not yet captured from a payroll-ready timesheet. Timesheet overtime still syncs automatically.</p>
            </div>
            <button type="button" onClick={() => setShowRequest(false)} className="self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Close</button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label="Employee code">
              <input value={requestForm.employeeId} onChange={(event) => setRequestForm((current) => ({ ...current, employeeId: event.target.value }))} placeholder="e.g. C2422 or P0146" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
            <Field label="Date">
              <input type="date" value={requestForm.date} onChange={(event) => setRequestForm((current) => ({ ...current, date: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
            <Field label="Day type">
              <Select value={requestForm.dayType} onChange={(value) => setRequestForm((current) => ({ ...current, dayType: value as DayType }))} options={payload?.filterOptions.dayTypes || ['Weekday', 'Saturday', 'Sunday', 'Public Holiday']} />
            </Field>
            <Field label="Worked hours">
              <input type="number" min="0" step="0.5" value={requestForm.workedHours} onChange={(event) => setRequestForm((current) => ({ ...current, workedHours: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
            <Field label="Payable hours">
              <input type="number" min="0" step="0.5" value={requestForm.payableHours} onChange={(event) => setRequestForm((current) => ({ ...current, payableHours: event.target.value }))} placeholder="Auto" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
            <Field label="Project code">
              <input value={requestForm.projectCode} onChange={(event) => setRequestForm((current) => ({ ...current, projectCode: event.target.value }))} placeholder="Optional" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <Field label="Reason / justification">
              <input value={requestForm.reason} onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Operational reason, approving supervisor, or work reference" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </Field>
            <button type="button" onClick={() => void createRequest()} disabled={busy === 'create-request'} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">Create Request</button>
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Overtime Lines" value={number(payload?.summary.records)} detail="Synced from timesheets" icon={TimerReset} tone="violet" />
        <MetricCard label="Pending Approvals" value={number(payload?.summary.pendingApprovals)} detail={`${number(payload?.summary.submitted)} supervisor, ${number(payload?.summary.supervisorApproved)} HR`} icon={BadgeCheck} tone={(payload?.summary.pendingApprovals || 0) ? 'amber' : 'green'} />
        <MetricCard label="Payroll Ready" value={number(payload?.summary.payrollReady)} detail={`${number(payload?.summary.payrollPosted)} posted`} icon={Banknote} tone="green" />
        <MetricCard label="Blocked / Returned" value={`${number((payload?.summary.blocked || 0) + (payload?.summary.returned || 0))}`} detail={`${number(payload?.summary.rejected)} rejected`} icon={AlertTriangle} tone={(payload?.summary.blocked || payload?.summary.returned) ? 'red' : 'green'} />
        <MetricCard label="Gross Exposure" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${number(payload?.summary.payableHours)} payable hours`} icon={ShieldCheck} tone="cyan" />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_180px_180px_180px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, supervisor, department, project, status..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            {query ? <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
          </label>
          <Select value={status} onChange={(value) => setStatus(value as 'All' | Status)} options={['All', ...(payload?.filterOptions.statuses || [])]} labels={{ All: 'All Statuses' }} />
          <Select value={department} onChange={setDepartment} options={['All', ...(payload?.filterOptions.departments || [])]} labels={{ All: 'All Departments' }} />
          <Select value={location} onChange={setLocation} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
          <Select value={dayType} onChange={(value) => setDayType(value as 'All' | DayType)} options={['All', ...(payload?.filterOptions.dayTypes || [])]} labels={{ All: 'All Day Types' }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500">{selectedRows.size} selected / {filtered.length} visible</div>
          <div className="flex flex-wrap gap-2">
            {(['approve-supervisor', 'approve-hr', 'mark-payroll-ready', 'post-payroll'] as Action[]).map((action) => (
              <button key={action} type="button" onClick={() => void runBulk(action)} disabled={!selectedRows.size || Boolean(busy)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{actionLabels[action]}</button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black text-slate-950">Overtime Approval Register</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Timesheet overtime lines with workflow status, owner, pay impact, and exception posture.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>{['', 'Employee', 'Date', 'Day Type', 'Hours', 'Payable', 'Gross', 'Owner', 'Timesheet', 'Workflow', 'Issues'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => (
                  <tr key={record.id} onClick={() => setSelectedId(record.id)} className={`cursor-pointer hover:bg-slate-50 ${selected?.id === record.id ? 'bg-violet-50/70' : ''}`}>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.has(record.id)} onChange={() => toggleRow(record.id)} />
                    </td>
                    <td className="px-4 py-3"><div className="text-sm font-black text-slate-950">{record.employeeName}</div><div className="text-xs font-semibold text-slate-500">{record.employeeId} / {record.department}</div></td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.date}</td>
                    <td className="px-4 py-3"><Chip value={record.dayType} tone={record.dayType === 'Weekday' ? 'blue' : 'cyan'} /></td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{number(record.workedHours)}h</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{number(record.payableHours)}h</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.currentOwner}</td>
                    <td className="px-4 py-3"><Chip value={record.timesheetStatus} tone={record.payrollReady ? 'green' : 'amber'} /></td>
                    <td className="px-4 py-3"><Chip value={record.status} tone={statusTone(record.status)} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{record.issues.length ? record.issues.join(', ') : 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-black text-slate-950">Selected Overtime</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Review calculation, workflow, exceptions, and approvals.</p>
            </div>
            {selected ? (
              <div className="space-y-4 p-4">
                <div className={`rounded-2xl border p-4 ${toneStyles[statusTone(selected.status)].card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-600">{selected.employeeId}</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{selected.employeeName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{selected.jobTitle} / {selected.location}</p>
                    </div>
                    <Chip value={selected.status} tone={statusTone(selected.status)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Detail label="Worked" value={`${number(selected.workedHours)}h`} />
                  <Detail label="Payable" value={`${number(selected.payableHours)}h`} />
                  <Detail label="Factor" value={`${number(selected.multiplier)}x`} />
                  <Detail label="Gross Pay" value={money(selected.grossPay, canViewMoney)} />
                  <Detail label="Rate" value={money(selected.hourlyRate, canViewMoney)} />
                  <Detail label="Earning Code" value={selected.earningCode} />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Workflow Tracker</p>
                  <div className="mt-3 space-y-2">
                    {selected.workflow.map((step) => (
                      <div key={step.stage} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-black text-slate-950">{step.stage}</p>
                          <p className="text-xs font-semibold text-slate-500">{step.owner}{step.actedAt ? ` / ${new Date(step.actedAt).toLocaleString('en-GB')}` : ''}</p>
                        </div>
                        <Chip value={step.status} tone={workflowTone(step.status)} />
                      </div>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">Comment</span>
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Required for return/reject; optional for approvals." />
                </label>
                <div className="flex flex-wrap gap-2">
                  {allowedActions(selected, payload).map((action) => {
                    const Icon = actionIcon(action);
                    const tone = action === 'reject' ? 'red' : action === 'return' || action === 'reopen' ? 'amber' : action.includes('payroll') ? 'violet' : 'green';
                    return (
                      <button key={action} type="button" disabled={Boolean(busy)} onClick={() => void runAction(selected.id, action)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${toneStyles[tone].button} disabled:cursor-wait disabled:opacity-50`}>
                        <Icon className="h-4 w-4" />
                        {busy === `${selected.id}-${action}` ? 'Processing' : actionLabels[action]}
                      </button>
                    );
                  })}
                </div>
                <ExceptionList record={selected} />
              </div>
            ) : (
              <div className="p-4 text-sm font-bold text-slate-500">No overtime line selected.</div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950"><History className="h-4 w-4 text-slate-500" />Audit Trail</h2>
            </div>
            <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
              {selected?.auditTrail.length ? selected.auditTrail.map((audit) => (
                <div key={audit.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{audit.action}</p>
                    <span className="text-xs font-bold text-slate-500">{new Date(audit.at).toLocaleString('en-GB')}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{audit.actor} / {audit.role}</p>
                  <p className="mt-1 text-xs font-bold text-slate-700">{audit.oldStatus || 'New'} to {audit.newStatus}</p>
                  {audit.comment ? <p className="mt-2 text-xs font-semibold text-slate-600">{audit.comment}</p> : null}
                </div>
              )) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No overtime workflow action has been logged for this line yet.</div>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`rounded-2xl border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-600">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

function Chip({ value, tone }: { value: string; tone: Tone }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{value}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="text-[11px] font-black uppercase text-slate-500">{label}</span><div className="mt-1">{children}</div></label>;
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
      {options.map((option) => <option key={option} value={option}>{labels?.[option] || option}</option>)}
    </select>
  );
}

function ExceptionList({ record }: { record: OvertimeRecord }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-black uppercase text-slate-500">Exceptions</p>
      <div className="mt-3 space-y-2">
        {record.issues.length ? record.issues.map((issue) => <p key={issue} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{issue}</p>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />No overtime exceptions detected.</p>}
      </div>
    </div>
  );
}
