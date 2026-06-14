'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CalendarCheck, CheckCircle2, Clock, Download, RefreshCcw, Save, Search, Timer, Users, X } from 'lucide-react';

type Role = 'Payroll Officer' | 'Finance Controller' | 'HR Director' | 'HR Manager' | 'Executive Management' | 'Auditor' | 'Employee';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';

type DailyRateRecord = {
  employeeDbId: number;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  location: string;
  payrollGroup: string;
  salaryGrade: string;
  payCurrency: string;
  paymentRun: string;
  paymentType: string;
  payMode: 'Daily' | 'Hourly';
  ratePerDay: number | null;
  ratePerHour: number | null;
  hoursPerDay: number;
  daysWorked: number;
  attendanceHours: number;
  bookedHours: number;
  idleHours: number;
  payrollReadyDays: number;
  payrollReadyHours: number;
  grossPay: number | null;
  latestPayrollUpdate: string | null;
  setupAssignedToPayroll: boolean;
  status: 'Ready' | 'Review' | 'Blocked';
  issues: string[];
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  permissions: { canViewMoney: boolean; canUpdateRates: boolean; canExport: boolean };
  summary: {
    dailyRateEmployees: number;
    daysWorked: number;
    attendanceHours: number;
    payrollReadyDays: number;
    grossPay: number;
    ready: number;
    review: number;
    blocked: number;
    missingRates: number;
    missingTimesheets: number;
  };
  records: DailyRateRecord[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB');

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

export default function DailyRatePayClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ payMode: 'Daily', ratePerDay: '', ratePerHour: '', hoursPerDay: '8', payrollGroup: 'Daily Rate', salaryGrade: 'Daily Rate' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll/daily-rate-pay', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Daily rate pay request failed (${res.status})`);
      const data = json.data;
      setPayload(data);
      setSelectedId((current) => current || data.records[0]?.employeeId || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load daily rate pay');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.status !== status) return false;
      if (!q) return true;
      return [record.employeeId, record.employeeName, record.department, record.jobTitle, record.payrollGroup].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [payload?.records, query, status]);

  const selected = (payload?.records || []).find((record) => record.employeeId === selectedId) || filtered[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const lastLoaded = payload?.generatedAt || initialNow;

  useEffect(() => {
    if (!selected) return;
    setForm({
      payMode: selected.payMode || 'Daily',
      ratePerDay: selected.ratePerDay ? String(selected.ratePerDay) : '',
      ratePerHour: selected.ratePerHour ? String(selected.ratePerHour) : '',
      hoursPerDay: '8',
      payrollGroup: selected.payrollGroup || 'Daily Rate',
      salaryGrade: selected.salaryGrade || 'Daily Rate',
    });
  }, [selected?.employeeId]);

  const saveRate = async () => {
    if (!selected) return;
    setSaving(true);
    setToast('');
    try {
      const res = await fetch('/api/hris/payroll/daily-rate-pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          employeeDbId: selected.employeeDbId,
          payMode: form.payMode,
          ratePerDay: form.ratePerDay,
          ratePerHour: form.ratePerHour,
          hoursPerDay: form.hoursPerDay,
          payrollGroup: form.payrollGroup,
          salaryGrade: form.salaryGrade,
          payCurrency: selected.payCurrency,
          paymentRun: 'Daily Timesheet',
        }),
      });
      const json = (await res.json()) as ApiResponse<{ updated: boolean }>;
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to save rate');
      setToast('Daily rate pay setup updated.');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Unable to save rate');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/payroll/daily-rate-pay?format=csv';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600 text-white">
              <Timer className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Daily Rate Pay</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                Calculate Daily Rate employee pay from daily timesheets using day rates or hourly rates controlled by Payroll.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">Source: {payload?.source || 'Daily Timesheet'}</span>
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
      {toast && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{toast}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Daily Rate Employees" value={number(payload?.summary.dailyRateEmployees || 0)} detail="Employees with C/Daily Rate classification" icon={Users} tone="blue" />
        <MetricCard label="Timesheet Days" value={number(payload?.summary.daysWorked || 0)} detail={`${number(payload?.summary.attendanceHours || 0)} attendance hours`} icon={CalendarCheck} tone="cyan" />
        <MetricCard label="Calculated Pay" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${number(payload?.summary.payrollReadyDays || 0)} payroll-ready days`} icon={Banknote} tone="green" />
        <MetricCard label="Missing Setup" value={number(payload?.summary.missingRates || 0)} detail={`${number(payload?.summary.missingTimesheets || 0)} without timesheets`} icon={AlertTriangle} tone={(payload?.summary.missingRates || 0) ? 'red' : 'green'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Ready" value={number(payload?.summary.ready || 0)} detail="Rate and payroll-ready timesheet available" icon={CheckCircle2} tone="green" />
        <MetricCard label="Review" value={number(payload?.summary.review || 0)} detail="Non-blocking validation required" icon={Clock} tone="amber" />
        <MetricCard label="Blocked" value={number(payload?.summary.blocked || 0)} detail="Missing rate or daily timesheet" icon={AlertTriangle} tone="red" />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_170px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search daily rate employee, department, job title" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Ready', 'Review', 'Blocked'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>{['Employee', 'Mode', 'Rate', 'Days', 'Hours', 'Ready Days', 'Calculated Pay', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 160).map((record) => {
                  const tone = statusTone(record.status);
                  return (
                    <tr key={record.employeeId} onClick={() => setSelectedId(record.employeeId)} className={`cursor-pointer hover:bg-slate-50 ${selected?.employeeId === record.employeeId ? 'bg-cyan-50/70' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-950">{record.employeeName}</p>
                        <p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.payMode}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{record.payMode === 'Hourly' ? money(record.ratePerHour, canViewMoney) : money(record.ratePerDay, canViewMoney)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(record.daysWorked)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(record.attendanceHours)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(record.payrollReadyDays)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{record.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <h2 className="text-sm font-black text-slate-950">Update Daily Pay</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Set day or hourly rate used for timesheet-derived pay.</p>
          </div>
          {selected ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className={`rounded-2xl border p-4 ${toneStyles[statusTone(selected.status)].card}`}>
                <p className="text-xs font-black uppercase tracking-normal text-slate-600">Selected Employee</p>
                <p className="mt-1 text-lg font-black text-slate-950">{selected.employeeName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{selected.employeeId} - {selected.jobTitle}</p>
              </div>

              <label className="block">
                <span className="text-xs font-black text-slate-600">Pay Mode</span>
                <select value={form.payMode} onChange={(e) => setForm((prev) => ({ ...prev, payMode: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none">
                  <option>Daily</option>
                  <option>Hourly</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">Day Rate</span>
                  <input value={form.ratePerDay} onChange={(e) => setForm((prev) => ({ ...prev, ratePerDay: e.target.value }))} disabled={form.payMode === 'Hourly'} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none disabled:bg-slate-100" />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-600">Hourly Rate</span>
                  <input value={form.ratePerHour} onChange={(e) => setForm((prev) => ({ ...prev, ratePerHour: e.target.value }))} disabled={form.payMode === 'Daily'} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none disabled:bg-slate-100" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">Paid Hours Per Day</span>
                  <input value="8" disabled className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-700 outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-600">Payroll Group</span>
                  <input value={form.payrollGroup} onChange={(e) => setForm((prev) => ({ ...prev, payrollGroup: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-black text-slate-600">Salary Grade</span>
                <input value={form.salaryGrade} onChange={(e) => setForm((prev) => ({ ...prev, salaryGrade: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                  <p className="text-xs font-black text-cyan-800">Timesheet</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{number(selected.daysWorked)} days</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-black text-emerald-800">Pay</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{money(selected.grossPay, canViewMoney)}</p>
                </div>
              </div>

              <button type="button" onClick={() => void saveRate()} disabled={saving || !payload?.permissions.canUpdateRates} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                <Save className="h-4 w-4" />
                {saving ? 'Saving' : 'Save Daily Pay Setup'}
              </button>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-normal text-slate-600">Readiness</p>
                <div className="mt-3 space-y-2">
                  {selected.issues.length ? selected.issues.map((issue) => <p key={issue} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{issue}</p>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Ready for daily payroll calculation.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm font-bold text-slate-500">No Daily Rate employee selected.</div>
          )}
        </aside>
      </section>
    </div>
  );
}
