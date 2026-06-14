'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Banknote, CheckCircle2, Download, RefreshCcw, Search, Settings2, ShieldCheck, UserCog, Users, X } from 'lucide-react';

type Role = 'Payroll Officer' | 'Finance Controller' | 'HR Director' | 'HR Manager' | 'Executive Management' | 'Auditor' | 'Employee';
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

type PayrollPayload = {
  generatedAt: string;
  source: string;
  periodLabel: string;
  permissions: { canViewMoney: boolean; canExport: boolean };
  summary: { totalEmployees: number; payrollEligible: number; readyEmployees: number; reviewEmployees: number; blockedEmployees: number; payrollCoveragePct: number; grossPay: number; netPay: number; exceptionCount: number };
  records: PayrollRecord[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB');
const pctFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const money = (value: number | null | undefined, canView = true) => (!canView || value === null || value === undefined ? 'Restricted' : moneyFmt.format(value));
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

const statusTone = (status: string): Tone => (status === 'Ready' ? 'green' : status === 'Blocked' ? 'red' : status === 'Review' ? 'amber' : 'blue');

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${styles.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-slate-600">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
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

export default function EmployeeSalarySetupClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [group, setGroup] = useState('All');
  const [grade, setGrade] = useState('All');
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<PayrollPayload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Employee salary setup request failed (${res.status})`);
      const data = json.data;
      setPayload(data);
      setSelectedId((current) => current || data.records[0]?.employeeId || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load employee salary setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const payrollGroups = useMemo(() => ['All', ...Array.from(new Set((payload?.records || []).map((record) => record.payrollGroup))).sort()], [payload?.records]);
  const salaryGrades = useMemo(() => ['All', ...Array.from(new Set((payload?.records || []).map((record) => record.salaryGrade))).sort()], [payload?.records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.payrollStatus !== status) return false;
      if (group !== 'All' && record.payrollGroup !== group) return false;
      if (grade !== 'All' && record.salaryGrade !== grade) return false;
      if (!q) return true;
      return [record.employeeId, record.fullName, record.department, record.jobTitle, record.payrollGroup, record.salaryGrade].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [grade, group, payload?.records, query, status]);

  const selected = (payload?.records || []).find((record) => record.employeeId === selectedId) || filtered[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const assigned = (payload?.records || []).filter((record) => record.setupAssignedToPayroll).length;
  const missingPay = (payload?.records || []).filter((record) => !record.basePay || record.basePay <= 0).length;
  const lastLoaded = payload?.generatedAt || initialNow;

  const exportCsv = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Job Title', 'Payroll Group', 'Salary Grade', 'Currency', 'Payment Run', 'Payment Type', 'Base Pay', 'Gross Pay', 'Net Pay', 'Status', 'Exceptions'];
    const lines = filtered.map((record) =>
      [record.employeeId, record.fullName, record.department, record.jobTitle, record.payrollGroup, record.salaryGrade, record.payCurrency, record.paymentRun, record.paymentType, record.basePay, record.grossPay, record.netPay, record.payrollStatus, record.exceptions.join('; ')]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-salary-setup.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <UserCog className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Employee Salary Setup</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                Employee-level payroll assignment, salary grade, pay amount, deduction estimate, payment run, and exception readiness.
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
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" onClick={exportCsv} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Employees" value={number(payload?.summary.totalEmployees || 0)} detail={`${number(payload?.summary.payrollEligible || 0)} eligible for payroll`} icon={Users} tone="blue" />
        <MetricCard label="Assigned to Payroll" value={number(assigned)} detail={`${pctFmt.format(payload?.summary.payrollCoveragePct || 0)}% setup coverage`} icon={ShieldCheck} tone={(payload?.summary.payrollCoveragePct || 0) >= 95 ? 'green' : 'amber'} />
        <MetricCard label="Missing Pay" value={number(missingPay)} detail="Base or period salary not available" icon={AlertTriangle} tone={missingPay ? 'red' : 'green'} />
        <MetricCard label="Net Payroll" value={money(payload?.summary.netPay, canViewMoney)} detail="Role-aware salary visibility" icon={Banknote} tone="violet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Ready" value={number(payload?.summary.readyEmployees || 0)} detail="Employee setup can proceed to payroll" icon={CheckCircle2} tone="green" />
        <MetricCard label="Review" value={number(payload?.summary.reviewEmployees || 0)} detail="Validation needed before close" icon={BadgeCheck} tone="amber" />
        <MetricCard label="Blocked" value={number(payload?.summary.blockedEmployees || 0)} detail="Resolve before posting" icon={AlertTriangle} tone="red" />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_150px_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, department, grade, payroll group" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Ready', 'Review', 'Blocked'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {payrollGroups.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {salaryGrades.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>{['Employee', 'Grade', 'Group', 'Base Pay', 'Gross', 'Net', 'Setup', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 120).map((record) => {
                  const tone = statusTone(record.payrollStatus);
                  return (
                    <tr key={record.employeeId} onClick={() => setSelectedId(record.employeeId)} className={`cursor-pointer hover:bg-slate-50 ${selected?.employeeId === record.employeeId ? 'bg-blue-50/60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-950">{record.fullName}</p>
                        <p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.salaryGrade}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.payrollGroup}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.basePay, canViewMoney)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.netPay, canViewMoney)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${record.setupAssignedToPayroll ? toneStyles.green.chip : toneStyles.red.chip}`}>{record.setupAssignedToPayroll ? 'Assigned' : 'Missing'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{record.payrollStatus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Settings2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-950">Setup Detail</h2>
                <p className="text-xs font-semibold text-slate-500">Selected employee salary setup.</p>
              </div>
            </div>
          </div>
          {selected ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className={`rounded-2xl border p-4 ${toneStyles[statusTone(selected.payrollStatus)].card}`}>
                <p className="text-xs font-black uppercase tracking-normal text-slate-600">Employee</p>
                <p className="mt-1 text-lg font-black text-slate-950">{selected.fullName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{selected.employeeId} - {selected.jobTitle}</p>
              </div>
              {[
                ['Payroll Group', selected.payrollGroup],
                ['Salary Grade', selected.salaryGrade],
                ['Currency', selected.payCurrency],
                ['Payment Run', selected.paymentRun],
                ['Payment Type', selected.paymentType],
                ['Employment Type', selected.employmentType],
                ['Employment Status', selected.employmentStatus],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="text-xs font-black text-slate-500">{label}</span>
                  <span className="text-right text-xs font-black text-slate-900">{value}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-black text-emerald-800">Gross</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{money(selected.grossPay, canViewMoney)}</p>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <p className="text-xs font-black text-violet-800">Net</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{money(selected.netPay, canViewMoney)}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-normal text-slate-600">Exceptions</p>
                <div className="mt-3 space-y-2">
                  {selected.exceptions.length ? selected.exceptions.map((issue) => <p key={issue} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{issue}</p>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">No setup exception detected.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm font-bold text-slate-500">No employee selected.</div>
          )}
        </aside>
      </section>
    </div>
  );
}
