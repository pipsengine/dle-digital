'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CalendarDays, CheckCircle2, Clock3, Download, Moon, RefreshCcw, Save, Search, TimerReset, Users, X } from 'lucide-react';

type Role = 'Payroll Officer' | 'Finance Controller' | 'HR Director' | 'HR Manager' | 'Executive Management' | 'Auditor' | 'Employee';
type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'slate';
type DayType = 'Weekday' | 'Saturday' | 'Sunday' | 'Public Holiday';

type OvertimeRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  location: string;
  employmentType: string;
  payrollGroup: string;
  salaryGrade: string;
  payCurrency: string;
  date: string;
  dayType: DayType;
  multiplier: number;
  timesheetStatus: string;
  payrollReady: boolean;
  standardHours: number;
  workedHours: number;
  overtimeHours: number;
  payableHours: number;
  hourlyRate: number | null;
  grossPay: number | null;
  status: 'Ready' | 'Review' | 'Blocked';
  issues: string[];
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  permissions: { canViewMoney: boolean; canConfigureHolidays: boolean; canExport: boolean };
  publicHolidays: string[];
  rule: {
    weekdayMultiplier: number;
    saturdayMultiplier: number;
    sundayMultiplier: number;
    publicHolidayMultiplier: number;
    weekdayBasis: string;
    specialDayBasis: string;
  };
  summary: {
    records: number;
    payableRecords: number;
    payableHours: number;
    weekdayHours: number;
    specialDayHours: number;
    grossPay: number;
    ready: number;
    review: number;
    blocked: number;
    missingRates: number;
    pendingTimesheets: number;
  };
  records: OvertimeRecord[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const money = (value: number | null | undefined, canView = true) => (!canView || value === null || value === undefined ? 'Restricted' : moneyFmt.format(value));
const number = (value: number | null | undefined) => numberFmt.format(value || 0);

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
const dayTone = (dayType: DayType): Tone => (dayType === 'Weekday' ? 'blue' : dayType === 'Public Holiday' ? 'violet' : 'cyan');

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

export default function OvertimePayClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [dayType, setDayType] = useState('All');
  const [holidayText, setHolidayText] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll/overtime-pay', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Overtime pay request failed (${res.status})`);
      const data = json.data;
      setPayload(data);
      setHolidayText(data.publicHolidays.join('\n'));
      setSelectedId((current) => current || data.records[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load overtime pay');
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
      if (dayType !== 'All' && record.dayType !== dayType) return false;
      if (!q) return true;
      return [record.employeeId, record.employeeName, record.department, record.jobTitle, record.location, record.date, record.dayType].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [payload?.records, query, status, dayType]);

  const selected = (payload?.records || []).find((record) => record.id === selectedId) || filtered[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const lastLoaded = payload?.generatedAt || initialNow;

  const saveHolidays = async () => {
    setSaving(true);
    setToast('');
    try {
      const publicHolidays = holidayText.split(/[\n,; ]+/).map((item) => item.trim()).filter(Boolean);
      const res = await fetch('/api/hris/payroll/overtime-pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ publicHolidays }),
      });
      const json = (await res.json()) as ApiResponse<{ updated: boolean; publicHolidays: string[] }>;
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to save public holidays');
      setToast('Public holiday overtime dates updated.');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Unable to save public holidays');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/payroll/overtime-pay?format=csv';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <TimerReset className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Overtime Pay</h1>
              <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-600">
                Calculate payroll overtime from approved timesheets using 1.5x for weekdays and 2x for Saturdays, Sundays, and configured public holidays.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold text-violet-800">Weekday: {payload?.rule.weekdayMultiplier || 1.5}x overtime hours</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-extrabold text-cyan-800">Weekend/Holiday: {payload?.rule.saturdayMultiplier || 2}x worked hours</span>
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
        <MetricCard label="Payable Overtime" value={number(payload?.summary.payableHours)} detail={`${number(payload?.summary.payableRecords)} payable timesheet lines`} icon={TimerReset} tone="violet" />
        <MetricCard label="Weekday 1.5x" value={number(payload?.summary.weekdayHours)} detail="Hours above standard day" icon={Clock3} tone="blue" />
        <MetricCard label="Weekend/Holiday 2x" value={number(payload?.summary.specialDayHours)} detail="All hours worked on special days" icon={Moon} tone="cyan" />
        <MetricCard label="Overtime Gross Pay" value={money(payload?.summary.grossPay, canViewMoney)} detail={`${number(payload?.summary.missingRates)} missing rates`} icon={Banknote} tone={(payload?.summary.missingRates || 0) ? 'amber' : 'green'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Ready" value={number(payload?.summary.ready)} detail="Rate and payroll-ready timesheet available" icon={CheckCircle2} tone="green" />
        <MetricCard label="Review" value={number(payload?.summary.review)} detail="Needs payroll validation" icon={AlertTriangle} tone="amber" />
        <MetricCard label="Pending Timesheets" value={number(payload?.summary.pendingTimesheets)} detail="Timesheets not yet payroll-ready" icon={Users} tone={(payload?.summary.pendingTimesheets || 0) ? 'red' : 'green'} />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_160px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, department, date, day type" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm font-semibold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Ready', 'Review', 'Blocked'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={dayType} onChange={(e) => setDayType(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none">
                {['All', 'Weekday', 'Saturday', 'Sunday', 'Public Holiday'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full text-left">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-normal text-slate-500">
                <tr>{['Employee', 'Date', 'Day Type', 'Multiplier', 'Worked', 'Payable', 'Rate', 'Gross Pay', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 220).map((record) => {
                  const tone = statusTone(record.status);
                  const specialTone = dayTone(record.dayType);
                  return (
                    <tr key={record.id} onClick={() => setSelectedId(record.id)} className={`cursor-pointer hover:bg-slate-50 ${selected?.id === record.id ? 'bg-violet-50/70' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-950">{record.employeeName}</p>
                        <p className="text-xs font-semibold text-slate-500">{record.employeeId} - {record.department}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{record.date}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[specialTone].chip}`}>{record.dayType}</span></td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{record.multiplier}x</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{number(record.workedHours)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{number(record.payableHours)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.hourlyRate, canViewMoney)}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{money(record.grossPay, canViewMoney)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${toneStyles[tone].chip}`}>{record.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h2 className="text-sm font-black text-slate-950">Public Holiday Dates</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Dates listed here receive the 2x overtime factor.</p>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <label className="block">
                <span className="text-xs font-black text-slate-600">YYYY-MM-DD, one per line</span>
                <textarea value={holidayText} onChange={(e) => setHolidayText(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-dle-blue focus:ring-2 focus:ring-dle-blue/20" />
              </label>
              <button type="button" onClick={() => void saveHolidays()} disabled={saving || !payload?.permissions.canConfigureHolidays} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                <Save className="h-4 w-4" />
                {saving ? 'Saving' : 'Save Public Holidays'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h2 className="text-sm font-black text-slate-950">Selected Overtime Line</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Payroll calculation detail for the selected row.</p>
            </div>
            {selected ? (
              <div className="space-y-4 p-4 sm:p-5">
                <div className={`rounded-2xl border p-4 ${toneStyles[dayTone(selected.dayType)].card}`}>
                  <p className="text-xs font-black uppercase tracking-normal text-slate-600">Selected Employee</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{selected.employeeName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{selected.employeeId} - {selected.jobTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-black text-blue-800">Basis</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{selected.dayType === 'Weekday' ? 'Overtime hours' : 'Hours worked'}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-black text-emerald-800">Calculated Pay</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{money(selected.grossPay, canViewMoney)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-600">
                  <p className="rounded-xl bg-slate-50 p-3">Worked: <span className="font-black text-slate-950">{number(selected.workedHours)}</span></p>
                  <p className="rounded-xl bg-slate-50 p-3">Payable: <span className="font-black text-slate-950">{number(selected.payableHours)}</span></p>
                  <p className="rounded-xl bg-slate-50 p-3">Rate: <span className="font-black text-slate-950">{money(selected.hourlyRate, canViewMoney)}</span></p>
                  <p className="rounded-xl bg-slate-50 p-3">Factor: <span className="font-black text-slate-950">{selected.multiplier}x</span></p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-normal text-slate-600">Readiness</p>
                  <div className="mt-3 space-y-2">
                    {selected.issues.length ? selected.issues.map((issue) => <p key={issue} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{issue}</p>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Ready for overtime payroll calculation.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 text-sm font-bold text-slate-500">No overtime line selected.</div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
