'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Lock,
  PlayCircle,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type Role = 'Super Admin' | 'HR Director' | 'HR Manager' | 'HR Officer' | 'Payroll Officer' | 'Finance Controller' | 'Executive Management' | 'Auditor' | 'Employee';
type PayrollRunStatus = 'Draft' | 'Validation' | 'Ready for Approval' | 'Approved' | 'Locked' | 'Posted';
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
  approvedAt: string | null;
  approvedBy: string | null;
  lockedAt: string | null;
  postedAt: string | null;
};

type PayrollPayload = {
  generatedAt: string;
  source: string;
  role: Role;
  permissions: { canViewMoney: boolean; canManageRun: boolean; canApprove: boolean; canPost: boolean; canExport: boolean };
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
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB');
const pctFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const money = (value: number | null | undefined, canView = true) => {
  if (!canView || value === null || value === undefined) return 'Restricted';
  return moneyFmt.format(value);
};

const number = (value: number) => numberFmt.format(value);

const toneStyles: Record<Tone, { card: string; icon: string; chip: string; bar: string }> = {
  blue: { card: 'bg-blue-50 border-blue-200', icon: 'bg-blue-600 text-white', chip: 'bg-blue-100 text-blue-800', bar: 'bg-blue-600' },
  green: { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-600 text-white', chip: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-600' },
  amber: { card: 'bg-amber-50 border-amber-200', icon: 'bg-amber-500 text-white', chip: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  red: { card: 'bg-red-50 border-red-200', icon: 'bg-red-600 text-white', chip: 'bg-red-100 text-red-800', bar: 'bg-red-600' },
  violet: { card: 'bg-violet-50 border-violet-200', icon: 'bg-violet-600 text-white', chip: 'bg-violet-100 text-violet-800', bar: 'bg-violet-600' },
  cyan: { card: 'bg-cyan-50 border-cyan-200', icon: 'bg-cyan-600 text-white', chip: 'bg-cyan-100 text-cyan-800', bar: 'bg-cyan-600' },
  slate: { card: 'bg-slate-50 border-slate-200', icon: 'bg-slate-800 text-white', chip: 'bg-slate-100 text-slate-800', bar: 'bg-slate-700' },
};

const statusTone = (status: string): Tone => {
  if (status === 'Ready' || status === 'Approved' || status === 'Posted') return 'green';
  if (status === 'Blocked' || status === 'Validation') return 'red';
  if (status === 'Review') return 'amber';
  if (status === 'Locked') return 'violet';
  return 'blue';
};

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${styles.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-normal text-slate-600">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950 truncate">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${styles.bar}`} />
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, tone = 'slate' }: { label: string; icon: any; onClick: () => void; disabled?: boolean; tone?: Tone }) {
  const active = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition-colors ${
        disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : `${active.icon} border-transparent hover:brightness-95`
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function PayrollManagementClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [group, setGroup] = useState('All');
  const [tab, setTab] = useState<'employees' | 'exceptions' | 'runs'>('employees');
  const [busyAction, setBusyAction] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<PayrollPayload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Payroll request failed (${res.status})`);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payroll management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.payrollStatus !== status) return false;
      if (group !== 'All' && record.payrollGroup !== group) return false;
      if (!q) return true;
      return [record.employeeId, record.fullName, record.department, record.jobTitle, record.payrollGroup, record.salaryGrade].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [group, payload?.records, query, status]);

  const payrollGroups = useMemo(() => ['All', ...Array.from(new Set((payload?.records || []).map((record) => record.payrollGroup))).sort()], [payload?.records]);
  const currentRun = payload?.runs[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const lastLoaded = payload?.generatedAt || initialNow;

  const runAction = async (action: string) => {
    if (!currentRun && action !== 'create-run') return;
    setBusyAction(action);
    setToast('');
    try {
      const res = await fetch('/api/hris/payroll-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ action, runId: currentRun?.id }),
      });
      const json = (await res.json()) as ApiResponse<{ run: PayrollRun }>;
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Payroll action failed');
      setToast(`${action.replace('-run', '').replace('-', ' ')} completed.`);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Payroll action failed');
    } finally {
      setBusyAction('');
    }
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/payroll-management?format=csv';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <WalletCards className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Payroll Management</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                End-to-end payroll readiness, validation, approval, posting, exceptions, and workforce cost governance.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">Period: {payload?.periodLabel || 'Loading'}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">Source: {payload?.source || 'DLE_Enterprise HRIS'}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">Loaded: {new Date(lastLoaded).toLocaleString('en-GB')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-800 outline-none">
            {['Payroll Officer', 'Finance Controller', 'HR Director', 'HR Manager', 'Executive Management', 'Auditor', 'Employee'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ActionButton label={loading ? 'Refreshing' : 'Refresh'} icon={RefreshCcw} onClick={() => void load()} disabled={loading} tone="blue" />
          <ActionButton label="Export" icon={Download} onClick={exportCsv} disabled={!payload?.permissions.canExport} tone="slate" />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}
      {toast && (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
          {toast}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Payroll Eligible" value={number(payload?.summary.payrollEligible || 0)} detail={`${number(payload?.summary.totalEmployees || 0)} employees in HRIS`} icon={Users} tone="blue" />
        <MetricCard label="Net Payroll" value={money(payload?.summary.netPay, canViewMoney)} detail={`${money(payload?.summary.grossPay, canViewMoney)} gross`} icon={Banknote} tone="green" />
        <MetricCard label="Deductions" value={money(payload?.summary.deductions, canViewMoney)} detail="PAYE, pension, and other deductions" icon={FileSpreadsheet} tone="violet" />
        <MetricCard label="Exceptions" value={number(payload?.summary.exceptionCount || 0)} detail={`${number(payload?.summary.blockedEmployees || 0)} blocked employees`} icon={AlertTriangle} tone={(payload?.summary.exceptionCount || 0) > 0 ? 'red' : 'green'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {(payload?.controls || []).map((control) => {
          const styles = toneStyles[control.tone];
          return (
            <div key={control.id} className={`rounded-2xl border p-4 ${styles.card}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-slate-600">{control.label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{control.status}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${styles.chip}`}>Control</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-950">Payroll Run Control</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Create, approve, lock, and post the current payroll run with role-based controls.</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${toneStyles[statusTone(currentRun?.status || 'Draft')].chip}`}>{currentRun?.status || 'Draft'}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-normal text-blue-800">Run ID</p>
              <p className="mt-2 break-words text-sm font-black text-slate-950">{currentRun?.id || `payroll-${payload?.period || ''}`}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Created by {currentRun?.createdBy || 'System'}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-normal text-emerald-800">Run Value</p>
              <p className="mt-2 text-sm font-black text-slate-950">{money(currentRun?.netPay, canViewMoney)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{number(currentRun?.employeeCount || 0)} employees</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-black uppercase tracking-normal text-violet-800">Approval</p>
              <p className="mt-2 text-sm font-black text-slate-950">{currentRun?.approvedBy || 'Pending'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{currentRun?.approvedAt ? new Date(currentRun.approvedAt).toLocaleString('en-GB') : 'Awaiting approval'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4 sm:p-5">
            <ActionButton label="Recalculate Run" icon={PlayCircle} onClick={() => void runAction('create-run')} disabled={busyAction === 'create-run' || !payload?.permissions.canManageRun} tone="blue" />
            <ActionButton label="Approve" icon={BadgeCheck} onClick={() => void runAction('approve-run')} disabled={busyAction === 'approve-run' || !payload?.permissions.canApprove} tone="green" />
            <ActionButton label="Lock" icon={Lock} onClick={() => void runAction('lock-run')} disabled={busyAction === 'lock-run' || !payload?.permissions.canManageRun} tone="violet" />
            <ActionButton label="Post to Finance" icon={Send} onClick={() => void runAction('post-run')} disabled={busyAction === 'post-run' || !payload?.permissions.canPost} tone="slate" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <h2 className="text-sm font-black text-slate-950">Payroll Intelligence</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Readiness signals for payroll, HR, and finance teams.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5">
            {[
              { label: 'Coverage', value: `${pctFmt.format(payload?.summary.payrollCoveragePct || 0)}%`, detail: 'Employees assigned to payroll setup', icon: ShieldCheck, tone: 'cyan' as Tone },
              { label: 'Ready Records', value: number(payload?.summary.readyEmployees || 0), detail: 'No payroll-blocking exceptions', icon: CheckCircle2, tone: 'green' as Tone },
              { label: 'Review Queue', value: number(payload?.summary.reviewEmployees || 0), detail: 'Payroll can continue after validation', icon: Sparkles, tone: 'amber' as Tone },
              { label: 'Blocked Records', value: number(payload?.summary.blockedEmployees || 0), detail: 'Must be resolved before final posting', icon: AlertTriangle, tone: 'red' as Tone },
            ].map((item) => (
              <MetricCard key={item.label} {...item} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-950">Payroll Workspace</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Search employees, resolve exceptions, and monitor run approvals across devices.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['employees', 'exceptions', 'runs'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`h-9 rounded-xl px-3 text-xs font-black capitalize ${tab === item ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {tab === 'employees' && (
            <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_180px_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, group, grade, department" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Ready', 'Review', 'Blocked'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {payrollGroups.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {tab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>
                  {['Employee', 'Group', 'Type', 'Gross', 'Deductions', 'Net', 'Status', 'Exceptions'].map((head) => (
                    <th key={head} className="px-4 py-3">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.slice(0, 80).map((record) => (
                  <tr key={record.employeeId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-950">{record.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{record.payrollGroup}<br /><span className="text-slate-400">{record.salaryGrade}</span></td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{record.employmentType}<br /><span className="text-slate-400">{record.paymentRun}</span></td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.deductions, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.netPay, canViewMoney)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[statusTone(record.payrollStatus)].chip}`}>{record.payrollStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{record.exceptions.length ? record.exceptions.slice(0, 2).join('; ') : 'Clear'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exceptions' && (
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 lg:grid-cols-2">
            {(payload?.exceptions || []).slice(0, 60).map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 ${toneStyles[statusTone(item.severity === 'High' ? 'Blocked' : 'Review')].card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.employeeName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{item.employeeId} - Owner: {item.owner}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[statusTone(item.severity === 'High' ? 'Blocked' : 'Review')].chip}`}>{item.severity}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">{item.issue}</p>
              </div>
            ))}
            {payload?.exceptions.length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-black text-emerald-800">No payroll exceptions detected.</div>}
          </div>
        )}

        {tab === 'runs' && (
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-5">
            {(payload?.runs || []).map((run) => (
              <div key={run.id} className={`rounded-2xl border p-4 ${toneStyles[statusTone(run.status)].card}`}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-center">
                  <div className="md:col-span-2">
                    <p className="text-sm font-black text-slate-950">{run.id}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">Period {run.period} - Created by {run.createdBy}</p>
                  </div>
                  <p className="text-sm font-black text-slate-900">{number(run.employeeCount)} employees</p>
                  <p className="text-sm font-black text-slate-900">{money(run.netPay, canViewMoney)}</p>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[statusTone(run.status)].chip}`}>{run.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[
          { title: 'Payroll Groups', rows: payload?.breakdowns.byPayrollGroup || [], tone: 'blue' as Tone },
          { title: 'Employment Types', rows: payload?.breakdowns.byEmploymentType || [], tone: 'green' as Tone },
          { title: 'Top Departments', rows: payload?.breakdowns.byDepartment || [], tone: 'violet' as Tone },
        ].map((section) => (
          <section key={section.title} className={`rounded-2xl border p-4 sm:p-5 ${toneStyles[section.tone].card}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-950">{section.title}</h2>
              <Filter className="h-4 w-4 text-slate-500" />
            </div>
            <div className="space-y-3">
              {section.rows.slice(0, 6).map((row) => (
                <div key={row.label} className="rounded-xl bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-black text-slate-800">{row.label}</p>
                    <p className="text-xs font-black text-slate-950">{number(row.employees)}</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full ${toneStyles[section.tone].bar}`} style={{ width: `${Math.min(100, Math.max(8, (row.employees / Math.max(1, payload?.summary.totalEmployees || 1)) * 100))}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-600">{money(row.netPay, canViewMoney)} net - {number(row.exceptions)} exceptions</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
