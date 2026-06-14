'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Banknote, Download, Layers3, RefreshCcw, Search, ShieldCheck, TrendingUp, Users, X } from 'lucide-react';

type Role = 'Payroll Officer' | 'Finance Controller' | 'HR Director' | 'HR Manager' | 'Executive Management' | 'Auditor' | 'Employee';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';

type PayrollRecord = {
  employeeId: string;
  fullName: string;
  department: string;
  jobTitle: string;
  employmentType: string;
  employmentStatus: string;
  payrollGroup: string;
  salaryGrade: string;
  payCurrency: string;
  payrollStatus: 'Ready' | 'Review' | 'Blocked';
  basePay: number | null;
  allowances: number | null;
  grossPay: number | null;
  netPay: number | null;
  exceptions: string[];
};

type PayrollPayload = {
  generatedAt: string;
  source: string;
  role: Role;
  periodLabel: string;
  permissions: { canViewMoney: boolean; canExport: boolean };
  summary: { totalEmployees: number; payrollEligible: number; grossPay: number; netPay: number; exceptionCount: number };
  records: PayrollRecord[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

type GradeBand = {
  grade: string;
  employees: number;
  minPay: number;
  midpoint: number;
  maxPay: number;
  averagePay: number;
  totalGross: number;
  totalNet: number;
  exceptions: number;
  belowBand: number;
  aboveBand: number;
  compaRatio: number;
  health: 'Healthy' | 'Review' | 'Critical';
};

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

const healthTone = (health: GradeBand['health']): Tone => (health === 'Healthy' ? 'green' : health === 'Critical' ? 'red' : 'amber');

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

const buildBands = (records: PayrollRecord[]): GradeBand[] => {
  const byGrade = new Map<string, PayrollRecord[]>();
  for (const record of records) {
    const grade = record.salaryGrade || 'Unassigned';
    byGrade.set(grade, [...(byGrade.get(grade) || []), record]);
  }

  return Array.from(byGrade.entries())
    .map(([grade, rows]) => {
      const pays = rows.map((row) => Number(row.basePay || 0)).filter((value) => value > 0).sort((a, b) => a - b);
      const minPay = pays[0] || 0;
      const maxPay = pays[pays.length - 1] || 0;
      const averagePay = pays.length ? pays.reduce((sum, value) => sum + value, 0) / pays.length : 0;
      const midpoint = minPay && maxPay ? (minPay + maxPay) / 2 : averagePay;
      const lowerGuard = midpoint ? midpoint * 0.75 : 0;
      const upperGuard = midpoint ? midpoint * 1.25 : 0;
      const belowBand = pays.filter((value) => lowerGuard && value < lowerGuard).length;
      const aboveBand = pays.filter((value) => upperGuard && value > upperGuard).length;
      const exceptions = rows.reduce((sum, row) => sum + row.exceptions.length, 0);
      const compaRatio = midpoint ? (averagePay / midpoint) * 100 : 0;
      const health: GradeBand['health'] = exceptions > rows.length || belowBand + aboveBand > Math.max(1, rows.length * 0.25) ? 'Critical' : compaRatio < 80 || compaRatio > 120 || exceptions > 0 ? 'Review' : 'Healthy';
      return {
        grade,
        employees: rows.length,
        minPay,
        midpoint,
        maxPay,
        averagePay,
        totalGross: rows.reduce((sum, row) => sum + Number(row.grossPay || 0), 0),
        totalNet: rows.reduce((sum, row) => sum + Number(row.netPay || 0), 0),
        exceptions,
        belowBand,
        aboveBand,
        compaRatio,
        health,
      };
    })
    .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));
};

export default function SalaryStructureClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState('All');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<PayrollPayload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Salary structure request failed (${res.status})`);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load salary structure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const bands = useMemo(() => buildBands(payload?.records || []), [payload?.records]);
  const filteredBands = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bands.filter((band) => {
      if (health !== 'All' && band.health !== health) return false;
      if (!q) return true;
      return band.grade.toLowerCase().includes(q);
    });
  }, [bands, health, query]);

  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const healthy = bands.filter((band) => band.health === 'Healthy').length;
  const review = bands.filter((band) => band.health === 'Review').length;
  const critical = bands.filter((band) => band.health === 'Critical').length;
  const averageCompa = bands.length ? bands.reduce((sum, band) => sum + band.compaRatio, 0) / bands.length : 0;
  const lastLoaded = payload?.generatedAt || initialNow;

  const exportCsv = () => {
    const headers = ['Grade', 'Employees', 'Minimum Pay', 'Midpoint', 'Maximum Pay', 'Average Pay', 'Compa Ratio', 'Gross Pay', 'Net Pay', 'Exceptions', 'Health'];
    const lines = filteredBands.map((band) =>
      [band.grade, band.employees, band.minPay, band.midpoint, band.maxPay, band.averagePay, band.compaRatio.toFixed(1), band.totalGross, band.totalNet, band.exceptions, band.health]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'salary-structure.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Layers3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Salary Structure</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                Live salary-grade bands, payroll cost distribution, compa-ratio monitoring, and exception governance.
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
        <MetricCard label="Salary Grades" value={number(bands.length)} detail={`${number(payload?.summary.payrollEligible || 0)} payroll-eligible employees`} icon={Layers3} tone="blue" />
        <MetricCard label="Average Compa Ratio" value={`${pctFmt.format(averageCompa)}%`} detail="Average pay against grade midpoint" icon={TrendingUp} tone={averageCompa >= 80 && averageCompa <= 120 ? 'green' : 'amber'} />
        <MetricCard label="Gross Payroll" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${money(payload?.summary.netPay, canViewMoney)} net payroll`} icon={Banknote} tone="violet" />
        <MetricCard label="Structure Exceptions" value={number(bands.reduce((sum, band) => sum + band.exceptions, 0))} detail={`${critical} critical grades, ${review} review grades`} icon={AlertTriangle} tone={critical ? 'red' : review ? 'amber' : 'green'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Healthy Bands" value={number(healthy)} detail="Within expected pay distribution" icon={ShieldCheck} tone="green" />
        <MetricCard label="Review Bands" value={number(review)} detail="Needs payroll or HR validation" icon={BadgeCheck} tone="amber" />
        <MetricCard label="Critical Bands" value={number(critical)} detail="Resolve before compensation approval" icon={AlertTriangle} tone="red" />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-950">Grade Band Register</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Salary structure derived from current employee payroll setup and salary grade data.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search grade" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={health} onChange={(e) => setHealth(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Healthy', 'Review', 'Critical'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
              <tr>
                {['Grade', 'Employees', 'Min', 'Midpoint', 'Max', 'Average', 'Compa', 'Gross', 'Net', 'Health'].map((head) => (
                  <th key={head} className="px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBands.map((band) => {
                const tone = healthTone(band.health);
                return (
                  <tr key={band.grade} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-950">{band.grade}</p>
                      <p className="text-xs font-semibold text-slate-500">{band.exceptions} exceptions</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{number(band.employees)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{money(band.minPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{money(band.midpoint, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{money(band.maxPay, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{money(band.averagePay, canViewMoney)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${toneStyles[tone].bar}`} style={{ width: `${Math.min(100, Math.max(4, band.compaRatio))}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-800">{pctFmt.format(band.compaRatio)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{money(band.totalGross, canViewMoney)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{money(band.totalNet, canViewMoney)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{band.health}</span>
                    </td>
                  </tr>
                );
              })}
              {!filteredBands.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm font-bold text-slate-500">No salary bands match the current filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {filteredBands.slice(0, 9).map((band) => {
          const tone = healthTone(band.health);
          return (
            <div key={band.grade} className={`rounded-2xl border p-4 sm:p-5 ${toneStyles[tone].card}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-slate-600">Grade Band</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{band.grade}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{band.health}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Employees</p>
                  <p className="mt-1 font-black text-slate-950">{number(band.employees)}</p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Compa Ratio</p>
                  <p className="mt-1 font-black text-slate-950">{pctFmt.format(band.compaRatio)}%</p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Average Pay</p>
                  <p className="mt-1 font-black text-slate-950">{money(band.averagePay, canViewMoney)}</p>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="font-black text-slate-500">Outliers</p>
                  <p className="mt-1 font-black text-slate-950">{number(band.belowBand + band.aboveBand)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
