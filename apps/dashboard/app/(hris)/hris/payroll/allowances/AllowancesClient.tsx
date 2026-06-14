'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, BriefcaseBusiness, CheckCircle2, Download, Gift, Layers3, RefreshCcw, Search, ShieldCheck, Users, X } from 'lucide-react';

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
  exceptions: string[];
  basePay: number | null;
  allowances: number | null;
  grossPay: number | null;
  netPay: number | null;
};

type PayrollPayload = {
  generatedAt: string;
  source: string;
  periodLabel: string;
  permissions: { canViewMoney: boolean; canExport: boolean };
  summary: { totalEmployees: number; payrollEligible: number; grossPay: number; netPay: number; exceptionCount: number };
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

const allowanceTone = (record: PayrollRecord): Tone => {
  const base = Number(record.basePay || 0);
  const allowance = Number(record.allowances || 0);
  if (!base || allowance <= 0) return 'red';
  const ratio = (allowance / base) * 100;
  if (ratio > 35) return 'amber';
  return 'green';
};

const allowanceComponents = (record: PayrollRecord) => {
  const total = Number(record.allowances || 0);
  const type = String(record.employmentType || '').toLowerCase();
  const transportRate = type.includes('daily') ? 0.35 : type.includes('it') || type.includes('nysc') ? 0.5 : 0.3;
  const housingRate = type.includes('daily') || type.includes('it') || type.includes('nysc') ? 0 : 0.45;
  const fieldRate = type.includes('daily') || String(record.location || '').toLowerCase().includes('site') ? 0.2 : 0.1;
  const transport = total * transportRate;
  const housing = total * housingRate;
  const field = total * fieldRate;
  const other = Math.max(0, total - transport - housing - field);
  return { transport, housing, field, other };
};

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

export default function AllowancesClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<PayrollPayload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Allowances request failed (${res.status})`);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load allowances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const groups = useMemo(() => ['All', ...Array.from(new Set((payload?.records || []).map((record) => record.payrollGroup))).sort()], [payload?.records]);
  const types = useMemo(() => ['All', ...Array.from(new Set((payload?.records || []).map((record) => record.employmentType))).sort()], [payload?.records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (group !== 'All' && record.payrollGroup !== group) return false;
      if (type !== 'All' && record.employmentType !== type) return false;
      if (status !== 'All') {
        const tone = allowanceTone(record);
        if (status === 'Clear' && tone !== 'green') return false;
        if (status === 'Review' && tone !== 'amber') return false;
        if (status === 'Missing' && tone !== 'red') return false;
      }
      if (!q) return true;
      return [record.employeeId, record.fullName, record.department, record.jobTitle, record.payrollGroup, record.salaryGrade].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [group, payload?.records, query, status, type]);

  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const totalAllowances = filtered.reduce((sum, record) => sum + Number(record.allowances || 0), 0);
  const totalBase = filtered.reduce((sum, record) => sum + Number(record.basePay || 0), 0);
  const missingAllowances = filtered.filter((record) => !record.allowances || record.allowances <= 0).length;
  const reviewAllowances = filtered.filter((record) => allowanceTone(record) === 'amber').length;
  const averageRatio = totalBase ? (totalAllowances / totalBase) * 100 : 0;
  const components = filtered.reduce(
    (sum, record) => {
      const c = allowanceComponents(record);
      return { transport: sum.transport + c.transport, housing: sum.housing + c.housing, field: sum.field + c.field, other: sum.other + c.other };
    },
    { transport: 0, housing: 0, field: 0, other: 0 }
  );
  const lastLoaded = payload?.generatedAt || initialNow;

  const breakdown = useMemo(() => {
    const map = new Map<string, { label: string; employees: number; allowances: number; basePay: number; missing: number }>();
    for (const record of filtered) {
      const label = record.payrollGroup || 'Unassigned';
      const current = map.get(label) || { label, employees: 0, allowances: 0, basePay: 0, missing: 0 };
      current.employees += 1;
      current.allowances += Number(record.allowances || 0);
      current.basePay += Number(record.basePay || 0);
      current.missing += !record.allowances || record.allowances <= 0 ? 1 : 0;
      map.set(label, current);
    }
    return Array.from(map.values()).sort((a, b) => b.allowances - a.allowances);
  }, [filtered]);

  const exportCsv = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Type', 'Payroll Group', 'Grade', 'Base Pay', 'Allowance', 'Allowance Ratio', 'Gross Pay', 'Status'];
    const lines = filtered.map((record) => {
      const ratio = record.basePay ? (Number(record.allowances || 0) / record.basePay) * 100 : 0;
      const tone = allowanceTone(record);
      const label = tone === 'green' ? 'Clear' : tone === 'amber' ? 'Review' : 'Missing';
      return [record.employeeId, record.fullName, record.department, record.employmentType, record.payrollGroup, record.salaryGrade, record.basePay, record.allowances, ratio.toFixed(1), record.grossPay, label]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payroll-allowances.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Gift className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Allowances</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                Allowance governance by employee, payroll group, employment type, salary grade, and payroll readiness.
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
            {['Payroll Officer', 'Finance Controller', 'HR Director', 'HR Manager', 'Executive Management', 'Auditor', 'Employee'].map((item) => <option key={item}>{item}</option>)}
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
        <MetricCard label="Allowance Value" value={money(totalAllowances, canViewMoney)} detail={`${number(filtered.length)} employees in current scope`} icon={Banknote} tone="green" />
        <MetricCard label="Allowance Ratio" value={`${pctFmt.format(averageRatio)}%`} detail="Allowance value as percentage of base pay" icon={Layers3} tone={averageRatio > 35 ? 'amber' : 'blue'} />
        <MetricCard label="Missing Allowances" value={number(missingAllowances)} detail="Employees with no allowance value" icon={AlertTriangle} tone={missingAllowances ? 'red' : 'green'} />
        <MetricCard label="Review Required" value={number(reviewAllowances)} detail="Allowance ratio above review threshold" icon={ShieldCheck} tone={reviewAllowances ? 'amber' : 'green'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Transport" value={money(components.transport, canViewMoney)} detail="Estimated transport component" icon={BriefcaseBusiness} tone="blue" />
        <MetricCard label="Housing" value={money(components.housing, canViewMoney)} detail="Estimated housing component" icon={Users} tone="violet" />
        <MetricCard label="Field/Site" value={money(components.field, canViewMoney)} detail="Estimated field allowance" icon={CheckCircle2} tone="cyan" />
        <MetricCard label="Other" value={money(components.other, canViewMoney)} detail="Other allowance balance" icon={Gift} tone="slate" />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_180px_180px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, department, grade, payroll group" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
              {groups.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
              {types.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
              {['All', 'Clear', 'Review', 'Missing'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
              <tr>{['Employee', 'Type', 'Group', 'Base Pay', 'Allowance', 'Ratio', 'Gross Pay', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 140).map((record) => {
                const tone = allowanceTone(record);
                const ratio = record.basePay ? (Number(record.allowances || 0) / record.basePay) * 100 : 0;
                const label = tone === 'green' ? 'Clear' : tone === 'amber' ? 'Review' : 'Missing';
                return (
                  <tr key={record.employeeId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-950">{record.fullName}</p>
                      <p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.employmentType}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.payrollGroup}<br /><span className="text-xs text-slate-400">{record.salaryGrade}</span></td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.basePay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.allowances, canViewMoney)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${toneStyles[tone].bar}`} style={{ width: `${Math.min(100, Math.max(4, ratio))}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-800">{pctFmt.format(ratio)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {breakdown.slice(0, 9).map((item) => {
          const ratio = item.basePay ? (item.allowances / item.basePay) * 100 : 0;
          const tone: Tone = item.missing ? 'red' : ratio > 35 ? 'amber' : 'green';
          return (
            <div key={item.label} className={`rounded-2xl border p-4 sm:p-5 ${toneStyles[tone].card}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-slate-600">Payroll Group</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{item.label}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{number(item.employees)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Allowances</p>
                  <p className="mt-1 font-black text-slate-950">{money(item.allowances, canViewMoney)}</p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Ratio</p>
                  <p className="mt-1 font-black text-slate-950">{pctFmt.format(ratio)}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
