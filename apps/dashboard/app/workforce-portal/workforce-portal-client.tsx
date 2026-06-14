'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { NotificationCenter } from '@/components/layout/notification-center';
import { EnterpriseUserProfile } from '@hris/components/layout/enterprise-user-profile';
import {
  Activity,
  ArrowRight,
  Building2,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileArchive,
  FileText,
  Fingerprint,
  Globe2,
  GraduationCap,
  Languages,
  Landmark,
  LockKeyhole,
  Megaphone,
  Plane,
  RefreshCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Target,
  UserRound,
  WalletCards,
} from 'lucide-react';

type EssRequest = {
  id: string;
  employeeId: string;
  category: string;
  title: string;
  status: string;
  priority: string;
  submittedAt: string;
  updatedAt: string;
  approvers: string[];
  comments: Array<{ at: string; actor: string; comment: string }>;
};
type LoanProduct = { id: string; label: string; type: string; interestRate: number; maxPrincipalMultiple: number; maxTenorMonths: number };
type SimpleRecord = Record<string, string | number | boolean | null>;
type Payload = {
  generatedAt: string;
  locale: string;
  security: Record<string, string>;
  employee: { employeeId: string; employeeCode: string; fullName: string; jobTitle: string; department: string; businessUnit: string; location: string; manager: string; email: string; phone: string; photoUrl: string; yearsOfService: number; payrollGroup: string; salaryGrade: string };
  widgets: {
    leave: { entitlement: number; used: number; balance: number; pending: number };
    attendance: { monthRate: number; lateArrivals: number; overtimeHours: number; remoteDays: number };
    payroll: { monthlyPay: number; currency: string; payslips: number; deductions: number; pension: number; allowances: number };
    requests: { pending: number; approved: number; total: number };
    loans: { applications: number; outstanding: number };
  };
  announcements: Array<{ id: string; title: string; channel: string; publishedAt: string; priority: string }>;
  notifications: Array<{ id: string; title: string; type: string; status: string; createdAt: string }>;
  birthdays: Array<{ id: string; fullName: string; department: string; date: string }>;
  anniversaries: Array<{ id: string; fullName: string; years: number; date: string }>;
  events: Array<{ id: string; label: string; date: string; type: string }>;
  documents: Array<{ id: string; title: string; category: string; version: string; status: string }>;
  profileSections: Array<{ id: string; label: string; status: string; approvalRequired: boolean; fields: string[] }>;
  leave: {
    balances: SimpleRecord[];
    calendar: SimpleRecord[];
    history: SimpleRecord[];
    workflows: SimpleRecord[];
    allowance: SimpleRecord[];
    approvals: SimpleRecord[];
    reports: SimpleRecord[];
    notifications: SimpleRecord[];
    security: SimpleRecord[];
  };
  attendance: { records: SimpleRecord[]; shifts: SimpleRecord[]; timesheets: SimpleRecord[] };
  payrollHistory: SimpleRecord[];
  performance: { goals: SimpleRecord[]; kpis: SimpleRecord[]; reviews: SimpleRecord[]; developmentPlans: SimpleRecord[] };
  learning: { courses: SimpleRecord[]; materials: SimpleRecord[]; certifications: SimpleRecord[] };
  claims: SimpleRecord[];
  loanManagement: { products: LoanProduct[]; applications: SimpleRecord[]; repaymentSchedules: SimpleRecord[]; history: SimpleRecord[] };
  travel: SimpleRecord[];
  assets: SimpleRecord[];
  exitServices: { resignation: SimpleRecord; clearance: SimpleRecord[]; exitInterview: SimpleRecord; finalSettlement: SimpleRecord };
  businessRules: SimpleRecord[];
  auditTrail: SimpleRecord[];
  reports: SimpleRecord[];
  moduleCatalog: string[];
  serviceCatalog: Array<{ id: string; label: string; area: string; workflow: string[]; slaHours: number }>;
  requests: EssRequest[];
  integrations: string[];
  analytics: Array<{ label: string; value: number; unit: string }>;
};
type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };
type Tab = 'dashboard' | 'profile' | 'leave' | 'time' | 'payroll' | 'documents' | 'performance' | 'learning' | 'claims' | 'loans' | 'services' | 'travel' | 'assets' | 'communication' | 'workflow' | 'exit' | 'security';

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-GB');
const money = (value: number) => moneyFmt.format(value || 0);
const stableDateTime = (value: string) => {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};
const dateText = (value: string) => {
  const iso = new Date(value).toISOString();
  return `${iso.slice(8, 10)} ${iso.slice(5, 7)} ${iso.slice(0, 4)}`;
};
const statusTone = (status: string) => {
  if (['Approved', 'Closed'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (status === 'Rejected') return 'bg-red-100 text-red-800';
  if (status.includes('Review') || status === 'Submitted') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};
const statusSurface = (status: string) => {
  if (['Approved', 'Closed', 'Current', 'Ready', 'Delivered', 'Active', 'Completed', 'Valid', 'On Track'].includes(status)) return 'border-emerald-200 bg-emerald-50';
  if (['Rejected', 'Restricted', 'Overdue'].includes(status)) return 'border-red-200 bg-red-50';
  if (status.includes('Review') || ['Submitted', 'Pending', 'Renewal Due', 'Acknowledgement Due', 'Required'].includes(status)) return 'border-amber-200 bg-amber-50';
  if (status.includes('Policy') || status.includes('Payroll')) return 'border-blue-200 bg-blue-50';
  return 'border-slate-200 bg-white';
};
const areaTone = (value: string) => {
  const text = value.toLowerCase();
  if (text.includes('leave') || text.includes('balance')) return { section: 'border-emerald-200 bg-emerald-50/45', header: 'border-emerald-100 bg-emerald-50/80', item: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-700' };
  if (text.includes('attendance') || text.includes('time') || text.includes('shift')) return { section: 'border-sky-200 bg-sky-50/45', header: 'border-sky-100 bg-sky-50/80', item: 'border-sky-200 bg-sky-50', icon: 'text-sky-700' };
  if (text.includes('payroll') || text.includes('pay') || text.includes('pension') || text.includes('payslip')) return { section: 'border-violet-200 bg-violet-50/45', header: 'border-violet-100 bg-violet-50/80', item: 'border-violet-200 bg-violet-50', icon: 'text-violet-700' };
  if (text.includes('loan')) return { section: 'border-cyan-200 bg-cyan-50/45', header: 'border-cyan-100 bg-cyan-50/80', item: 'border-cyan-200 bg-cyan-50', icon: 'text-cyan-700' };
  if (text.includes('claim') || text.includes('reimbursement') || text.includes('travel')) return { section: 'border-orange-200 bg-orange-50/45', header: 'border-orange-100 bg-orange-50/80', item: 'border-orange-200 bg-orange-50', icon: 'text-orange-700' };
  if (text.includes('document') || text.includes('version') || text.includes('letter')) return { section: 'border-indigo-200 bg-indigo-50/45', header: 'border-indigo-100 bg-indigo-50/80', item: 'border-indigo-200 bg-indigo-50', icon: 'text-indigo-700' };
  if (text.includes('performance') || text.includes('goal') || text.includes('kpi')) return { section: 'border-rose-200 bg-rose-50/45', header: 'border-rose-100 bg-rose-50/80', item: 'border-rose-200 bg-rose-50', icon: 'text-rose-700' };
  if (text.includes('learning') || text.includes('training') || text.includes('certification')) return { section: 'border-teal-200 bg-teal-50/45', header: 'border-teal-100 bg-teal-50/80', item: 'border-teal-200 bg-teal-50', icon: 'text-teal-700' };
  if (text.includes('asset') || text.includes('directory') || text.includes('organization')) return { section: 'border-lime-200 bg-lime-50/45', header: 'border-lime-100 bg-lime-50/80', item: 'border-lime-200 bg-lime-50', icon: 'text-lime-700' };
  if (text.includes('security') || text.includes('audit') || text.includes('workflow') || text.includes('approval')) return { section: 'border-amber-200 bg-amber-50/45', header: 'border-amber-100 bg-amber-50/80', item: 'border-amber-200 bg-amber-50', icon: 'text-amber-700' };
  return { section: 'border-slate-200 bg-white', header: 'border-slate-100 bg-slate-50/70', item: 'border-slate-200 bg-slate-50', icon: 'text-blue-700' };
};
const metricSurface = (tone: string) => {
  if (tone.includes('emerald')) return 'border-emerald-200 bg-emerald-50';
  if (tone.includes('blue')) return 'border-blue-200 bg-blue-50';
  if (tone.includes('violet')) return 'border-violet-200 bg-violet-50';
  if (tone.includes('amber')) return 'border-amber-200 bg-amber-50';
  if (tone.includes('cyan')) return 'border-cyan-200 bg-cyan-50';
  return 'border-slate-200 bg-white';
};

const navItems: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'leave', label: 'Leave', icon: CalendarCheck },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'payroll', label: 'Payroll', icon: Banknote },
  { id: 'documents', label: 'Documents', icon: FileArchive },
  { id: 'performance', label: 'Performance', icon: Target },
  { id: 'learning', label: 'Learning', icon: GraduationCap },
  { id: 'claims', label: 'Claims', icon: WalletCards },
  { id: 'loans', label: 'Loans', icon: Landmark },
  { id: 'services', label: 'Services', icon: ClipboardList },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'assets', label: 'Assets', icon: BriefcaseBusiness },
  { id: 'communication', label: 'Comms', icon: Megaphone },
  { id: 'workflow', label: 'Workflow', icon: ClipboardList },
  { id: 'exit', label: 'Exit', icon: FileText },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${metricSurface(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const tone = areaTone(title);
  return (
    <section className={`rounded-lg border shadow-sm ${tone.section}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${tone.header}`}>
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DataList({ rows, titleKey = 'title', subtitleKeys = [], statusKey = 'status' }: { rows: SimpleRecord[]; titleKey?: string; subtitleKeys?: string[]; statusKey?: string }) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const status = String(row[statusKey] ?? row.type ?? row.category ?? row.label ?? row.title ?? '');
        const surface = row[statusKey] !== undefined ? statusSurface(status) : areaTone(status).item;
        return (
        <div key={String(row.id || row.title || row.label || index)} className={`rounded-lg border p-3 ${surface}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{String(row[titleKey] || row.label || row.type || row.name || row.id || 'Record')}</p>
              {subtitleKeys.length ? <p className="mt-1 text-xs font-semibold text-slate-500">{subtitleKeys.map((key) => String(row[key] ?? '')).filter(Boolean).join(' - ')}</p> : null}
            </div>
            {row[statusKey] !== undefined ? <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(String(row[statusKey]))}`}>{String(row[statusKey])}</span> : null}
          </div>
        </div>
      );
      })}
      {!rows.length && <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">No records found.</div>}
    </div>
  );
}

function ActionGrid({ items }: { items: Array<[string, any, string?]> }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {items.map(([label, Icon, detail]) => {
        const tone = areaTone(label);
        return (
        <button key={label} type="button" className={`flex min-h-20 flex-col items-start justify-between rounded-lg border p-3 text-left hover:bg-white ${tone.item}`}>
          <Icon className={`h-5 w-5 ${tone.icon}`} />
          <span className="text-xs font-black text-slate-800">{label}</span>
          {detail ? <span className="text-[11px] font-semibold text-slate-500">{detail}</span> : null}
        </button>
      );
      })}
    </div>
  );
}

const leaveTabs = ['Leave Dashboard', 'Apply Leave', 'My Applications', 'Leave Calendar', 'Leave History', 'Approvals', 'Policy & Entitlement'] as const;
type LeaveTab = typeof leaveTabs[number];

const leaveRequiresAttachment = (type: string) => ['Sick Leave', 'Maternity Leave', 'Exam Leave', 'Compassionate Leave'].includes(type);
const dayMs = 24 * 60 * 60 * 1000;
const calcLeaveDays = (from: string, to: string, basis: string) => {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  if (basis === 'Calendar days') return Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  let days = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
    if (![0, 6].includes(d.getDay())) days += 1;
  }
  return days;
};

function EssLeaveWorkspace({ payload, employee }: { payload: Payload | null; employee?: Payload['employee'] }) {
  const [active, setActive] = useState<LeaveTab>('Leave Dashboard');
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [reliever, setReliever] = useState('');
  const [handover, setHandover] = useState('');
  const [contact, setContact] = useState(employee?.phone || '');
  const [address, setAddress] = useState(employee?.location || '');
  const [ack, setAck] = useState(false);
  const selected = (payload?.leave.balances || []).find((item) => String(item.type) === leaveType) || payload?.leave.balances?.[0];
  const basis = String(selected?.basis || 'Working days');
  const days = calcLeaveDays(startDate, endDate, basis);
  const balance = Number(selected?.balance || 0);
  const allowanceEligible = leaveType === 'Annual Leave' && days >= 10;
  const usesCarryForward = leaveType === 'Carry Forward Leave';
  const validations = [
    ...(days > balance ? ['Selected days exceed available balance.'] : []),
    ...(leaveType === 'Annual Leave' && String(selected?.eligibilityStatus || '').toLowerCase().includes('locked') ? ['Annual Leave is available only after confirmation of appointment.'] : []),
    ...(leaveRequiresAttachment(leaveType) ? ['Attachment is mandatory for this leave type.'] : []),
    ...(usesCarryForward && endDate > `${new Date().getFullYear()}-03-31` ? ['Carry Forward Leave must be consumed on or before 31 March.'] : []),
    ...(leaveType === 'Annual Leave' && days > 0 && days < 10 ? ['This request does not qualify for Leave Allowance.'] : []),
    ...(!ack ? ['Policy acknowledgement is required before submission.'] : []),
  ];

  const metricRows = [
    ['Annual Leave Balance', payload?.leave.balances.find((x) => x.type === 'Annual Leave')?.balance ?? 0, 'Current entitlement'],
    ['Sick Leave Balance', payload?.leave.balances.find((x) => x.type === 'Sick Leave')?.balance ?? 0, 'Working days'],
    ['Casual Leave Balance', payload?.leave.balances.find((x) => x.type === 'Casual Leave')?.balance ?? 0, 'Working days'],
    ['Compassionate Balance', payload?.leave.balances.find((x) => x.type === 'Compassionate Leave')?.balance ?? 0, 'Working days'],
    ['Exam Leave Balance', payload?.leave.balances.find((x) => x.type === 'Exam Leave')?.balance ?? 0, 'Working days'],
    ['Maternity Balance', payload?.leave.balances.find((x) => x.type === 'Maternity Leave')?.balance ?? 0, 'Calendar days'],
    ['Carry Forward', payload?.leave.balances.find((x) => x.type === 'Carry Forward Leave')?.balance ?? 0, 'Expires 31 Mar'],
    ['Pending Applications', payload?.widgets.requests.pending ?? 0, 'Workflow queue'],
    ['Approved This Year', payload?.widgets.requests.approved ?? 0, 'Approved requests'],
    ['Leave Allowance', allowanceEligible ? 'Eligible' : 'Conditional', '10+ annual days'],
    ['Next Scheduled Leave', String(payload?.leave.calendar[0]?.from || '-'), 'Approved schedule'],
    ['Return-to-Work Pending', 0, 'No pending action'],
  ];

  return (
    <section className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {leaveTabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActive(tab)} className={`h-10 shrink-0 rounded-lg px-3 text-xs font-black ${active === tab ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{tab}</button>
        ))}
      </div>

      {active === 'Leave Dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {metricRows.map(([label, value, detail]) => <MetricCard key={String(label)} label={String(label)} value={String(value)} detail={String(detail)} icon={CalendarCheck} tone="bg-emerald-100 text-emerald-700" />)}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(payload?.leave.balances || []).map((item) => (
              <button key={String(item.id)} type="button" onClick={() => { setLeaveType(String(item.type)); setActive('Apply Leave'); }} className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{String(item.type)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{String(item.policyNote)}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusTone(String(item.eligibilityStatus))}`}>{String(item.eligibilityStatus)}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <p><span className="font-black text-slate-500">Entitlement:</span> {String(item.entitlement)} {String(item.basis).toLowerCase()}</p>
                  <p><span className="font-black text-slate-500">Used:</span> {String(item.used)} days</p>
                  <p><span className="font-black text-slate-500">Pending:</span> {String(item.pending)} days</p>
                  <p><span className="font-black text-slate-500">Balance:</span> {String(item.balance)} days</p>
                </div>
                {item.expiryDate ? <p className="mt-2 text-xs font-bold text-amber-700">Expires: {String(item.expiryDate)}</p> : null}
                <p className="mt-3 text-xs font-bold text-blue-700">{String(item.allowanceStatus)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {active === 'Apply Leave' && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Guided Leave Application</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">{(payload?.leave.balances || []).map((item) => <option key={String(item.id)}>{String(item.type)}</option>)}</select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
              <input value={`${days} ${basis.toLowerCase()}`} readOnly className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800" />
              <input value={reliever} onChange={(e) => setReliever(e.target.value)} placeholder="Reliever / acting person" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact number while on leave" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Leave address / location" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold md:col-span-2" />
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="min-h-24 rounded-lg border border-slate-200 p-3 text-sm font-bold md:col-span-2" />
              <textarea value={handover} onChange={(e) => setHandover(e.target.value)} placeholder="Handover notes" className="min-h-24 rounded-lg border border-slate-200 p-3 text-sm font-bold md:col-span-2" />
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600 md:col-span-2">Attachment upload placeholder {leaveRequiresAttachment(leaveType) ? '(mandatory for this leave type)' : '(optional)'}</div>
              <label className="flex items-start gap-2 text-sm font-bold text-slate-700 md:col-span-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" /> I acknowledge Dorman Long leave policy, balance, allowance, reliever, and audit requirements.</label>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Policy Validation</h3>
            <p className="text-xs font-semibold text-slate-600">Allowance: {allowanceEligible && !usesCarryForward ? 'Eligible after approval and payroll notification' : 'Not eligible for this selection'}</p>
            <p className="text-xs font-semibold text-slate-600">Available balance: {balance} days</p>
            <div className="space-y-2">{validations.map((item, index) => <div key={`${item}-${index}`} className={`rounded-lg border px-3 py-2 text-xs font-bold ${item.includes('does not qualify') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{item}</div>)}</div>
            {!validations.length ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{'Ready to submit. Workflow: Employee -> Supervisor -> Manager/GM -> HR -> Payroll when applicable -> Completed.'}</div> : null}
            <button type="button" disabled={Boolean(validations.filter((item) => !item.includes('does not qualify')).length)} className="h-11 w-full rounded-lg bg-blue-600 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-500">Submit Leave Application</button>
          </div>
        </section>
      )}

      {active === 'My Applications' && <DataList rows={(payload?.requests.filter((item) => item.category === 'Leave').map((item) => ({ id: item.id, title: item.title, status: item.status, submittedAt: item.submittedAt, updatedAt: item.updatedAt, approvers: item.approvers.join(', ') })) || [])} titleKey="title" subtitleKeys={['status', 'submittedAt', 'updatedAt', 'approvers']} />}
      {active === 'Leave Calendar' && <section className="grid grid-cols-1 gap-4 xl:grid-cols-2"><InfoListLike title="Calendar" rows={payload?.leave.calendar || []} keys={['label', 'from', 'to', 'status', 'scope']} /><InfoListLike title="Notifications" rows={payload?.leave.notifications || []} keys={['title', 'channel', 'status']} /></section>}
      {active === 'Leave History' && <DataList rows={payload?.leave.history || []} titleKey="type" subtitleKeys={['from', 'to', 'days', 'approvalStage', 'allowanceStatus']} />}
      {active === 'Approvals' && <section className="grid grid-cols-1 gap-4 xl:grid-cols-2"><InfoListLike title="Approval Workflow" rows={payload?.leave.workflows || []} keys={['stage', 'owner', 'status', 'sla']} /><InfoListLike title="Manager/HR Queue" rows={payload?.leave.approvals || []} keys={['employee', 'type', 'days', 'stage', 'status', 'conflict']} /></section>}
      {active === 'Policy & Entitlement' && <section className="grid grid-cols-1 gap-4 xl:grid-cols-2"><InfoListLike title="Payroll & Allowance" rows={payload?.leave.allowance || []} keys={['label', 'value', 'status']} /><InfoListLike title="Reports & RBAC" rows={[...(payload?.leave.reports || []), ...(payload?.leave.security || [])]} keys={['title', 'role', 'access', 'format', 'status']} /></section>}
    </section>
  );
}

function InfoListLike({ title, rows, keys }: { title: string; rows: SimpleRecord[]; keys: string[] }) {
  return (
    <Section title={title}>
      <div className="space-y-3">
        {rows.map((row, index) => <div key={`${title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{String(row[keys[0]] || row[keys[1]] || 'Record')}</p><p className="mt-1 text-xs font-semibold text-slate-600">{keys.slice(1).map((key) => row[key]).filter(Boolean).join(' - ')}</p></div>)}
      </div>
    </Section>
  );
}

export default function WorkforcePortalClient({ initialNow }: { initialNow: string }) {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [locale, setLocale] = useState('en-NG');
  const [requestCategory, setRequestCategory] = useState('Leave Application');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestPriority, setRequestPriority] = useState('Normal');
  const [loanProductId, setLoanProductId] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanTenorMonths, setLoanTenorMonths] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workforce-portal', { headers: { 'x-ess-locale': locale }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Workforce portal request failed (${res.status})`);
      setPayload(json.data);
      if (!loanProductId && json.data.loanManagement.products[0]) {
        setLoanProductId(json.data.loanManagement.products[0].id);
        setLoanTenorMonths(String(Math.min(3, json.data.loanManagement.products[0].maxTenorMonths)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workforce portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [locale]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as Tab | null;
    if (requestedTab && navItems.some((item) => item.id === requestedTab)) setTab(requestedTab);
  }, [searchParams]);

  const submitRequest = async () => {
    if (!payload) return;
    setSaving(true);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/workforce-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: requestCategory, title: requestTitle, priority: requestPriority }),
      });
      const json = (await res.json()) as ApiResponse<{ request: EssRequest }>;
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to submit request');
      setToast('Request submitted and routed to the configured workflow.');
      setRequestTitle('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request');
    } finally {
      setSaving(false);
    }
  };

  const submitLoanApplication = async () => {
    if (!payload) return;
    setSaving(true);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/payroll/loan-applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': 'Employee' },
        body: JSON.stringify({ productId: loanProductId, principal: Number(loanPrincipal), tenorMonths: Number(loanTenorMonths), purpose: loanPurpose }),
      });
      const json = (await res.json()) as ApiResponse<{ application: SimpleRecord }>;
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to submit loan application');
      setToast('Loan application submitted for approval.');
      setLoanPrincipal('');
      setLoanPurpose('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit loan application');
    } finally {
      setSaving(false);
    }
  };

  const employee = payload?.employee;
  const widgets = payload?.widgets;
  const employeeCode = employee?.employeeCode || employee?.employeeId;
  const selectedLoanProduct = payload?.loanManagement.products.find((product) => product.id === loanProductId) || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-32 overflow-hidden rounded-md border border-slate-200 bg-white">
              <Image src="/brand/dorman-long-logo.jpg" alt="Dorman Long" fill className="object-contain p-1" priority />
            </div>
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <h1 className="truncate text-base font-black text-slate-950 sm:text-lg">Employee Self-Service Portal</h1>
              <p className="truncate text-xs font-semibold text-slate-500">{employee ? `${employee.fullName} - ${employee.department}` : 'Loading employee workspace'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/" aria-label="Go to enterprise landing page" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 sm:px-3">
              <Building2 className="h-4 w-4" /><span className="hidden sm:inline">Enterprise Home</span>
            </Link>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 outline-none">
              {['en-NG', 'fr-FR', 'ar', 'es-ES'].map((item) => <option key={item}>{item}</option>)}
            </select>
            <NotificationCenter scope="notifications" />
            <NotificationCenter scope="messages" />
            <EnterpriseUserProfile
              context="ess"
              name={employee?.fullName}
              role={employee?.jobTitle || 'Employee Self-Service'}
              employeeCode={employeeCode}
              department={employee?.department}
              photoUrl={employee?.photoUrl}
              profileHref="/workforce-portal?tab=profile"
            />
            <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh ESS data" className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-2 text-xs font-extrabold text-white disabled:cursor-wait disabled:opacity-60 sm:px-3">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {navItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex h-10 items-center gap-2 rounded-lg px-3 text-left text-xs font-black transition-colors ${tab === item.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            ))}
          </nav>
          <div className="mt-3 hidden rounded-lg border border-emerald-200 bg-emerald-50 p-3 lg:block">
            <p className="text-xs font-black uppercase tracking-normal text-slate-500">Access Context</p>
            <div className="mt-3 space-y-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-emerald-600" />RBAC Employee</div>
              <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-emerald-600" />MFA enabled</div>
              <div className="flex items-center gap-2"><Languages className="h-4 w-4 text-blue-600" />{locale}</div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div>}
          {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{toast}</div>}

          <section className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/40 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">Standalone ESS Module</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Cloud-ready</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Loaded {stableDateTime(payload?.generatedAt || initialNow)}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">My HR workspace</h2>
                <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
                  Secure access to profile, leave, time, payroll, documents, learning, claims, loans, travel, assets, communications, workflow tracking, and exit services.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setTab('services')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"><Send className="h-4 w-4" />New Request</button>
                  <button type="button" onClick={() => setTab('loans')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-cyan-900 hover:bg-white"><Landmark className="h-4 w-4" />Apply for Loan</button>
                  <button type="button" onClick={() => setTab('payroll')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-900 hover:bg-white"><Download className="h-4 w-4" />Payslips</button>
                </div>
              </div>
              <div className="border-t border-blue-200 bg-white/80 p-5 lg:border-l lg:border-t-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <Image src="/brand/dorman-long-logo.jpg" alt="" fill className="object-contain p-2" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{employee?.fullName || 'Employee'}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{employee?.jobTitle}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    ['Grade', employee?.salaryGrade],
                    ['Location', employee?.location],
                    ['Payroll', employee?.payrollGroup],
                    ['Service', `${employee?.yearsOfService || 0} yrs`],
                  ].map(([label, value]) => {
                    const tone = areaTone(String(label));
                    return (
                    <div key={label} className={`rounded-lg border p-3 ${tone.item}`}>
                      <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">{label}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-800">{value || 'N/A'}</p>
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          </section>

          {tab === 'dashboard' && widgets && (
            <>
              <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Leave Balance" value={`${widgets.leave.balance} days`} detail={`${widgets.leave.used}/${widgets.leave.entitlement} used`} icon={CalendarCheck} tone="bg-emerald-100 text-emerald-700" />
                <MetricCard label="Attendance" value={`${widgets.attendance.monthRate}%`} detail={`${widgets.attendance.overtimeHours} overtime hours`} icon={Clock} tone="bg-blue-100 text-blue-700" />
                <MetricCard label="Monthly Pay" value={money(widgets.payroll.monthlyPay)} detail={`${money(widgets.payroll.deductions)} deductions`} icon={Banknote} tone="bg-violet-100 text-violet-700" />
                <MetricCard label="Requests" value={String(widgets.requests.pending)} detail={`${widgets.requests.approved} approved, ${widgets.requests.total} total`} icon={ClipboardList} tone="bg-amber-100 text-amber-700" />
                <MetricCard label="Loan Balance" value={money(widgets.loans.outstanding)} detail={`${widgets.loans.applications} loan applications`} icon={Landmark} tone="bg-cyan-100 text-cyan-700" />
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Section title="Personalized Quick Actions">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      ['Apply Leave', CalendarCheck, 'leave'],
                      ['Clock In / Out', Fingerprint, 'time'],
                      ['Submit Claim', WalletCards, 'services'],
                      ['Request Letter', FileText, 'services'],
                      ['Enroll Training', GraduationCap, 'services'],
                      ['Report Asset', BriefcaseBusiness, 'services'],
                      ['Travel Request', Plane, 'services'],
                      ['Track Workflow', ClipboardList, 'services'],
                    ].map(([label, Icon, target]) => {
                      const tone = areaTone(String(label));
                      return (
                      <button key={String(label)} type="button" onClick={() => setTab(target as Tab)} className={`flex min-h-20 flex-col items-start justify-between rounded-lg border p-3 text-left hover:bg-white ${tone.item}`}>
                        <Icon className={`h-5 w-5 ${tone.icon}`} />
                        <span className="text-xs font-black text-slate-800">{String(label)}</span>
                      </button>
                    );
                    })}
                  </div>
                </Section>
                <Section title="Announcements & Events" action={<Bell className="h-4 w-4 text-slate-400" />}>
                  <div className="space-y-3">
                    {payload?.notifications.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div><p className="text-sm font-black text-slate-900">{item.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.type} - {dateText(item.createdAt)}</p></div>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-blue-800">{item.status}</span>
                      </div>
                    ))}
                    {payload?.announcements.map((item) => (
                      <div key={item.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${areaTone(item.channel).item}`}>
                        <div><p className="text-sm font-black text-slate-900">{item.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.channel} - {dateText(item.publishedAt)}</p></div>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-800">{item.priority}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {payload?.birthdays.map((item) => <div key={item.id} className="rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Birthday: {item.fullName} - {dateText(item.date)}</div>)}
                      {payload?.anniversaries.map((item) => <div key={item.id} className="rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-800">Anniversary: {item.fullName} - {item.years} yrs</div>)}
                    </div>
                    {payload?.events.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-1 text-sm">
                        <span className="font-bold text-slate-700">{item.label}</span>
                        <span className="text-xs font-semibold text-slate-500">{dateText(item.date)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </section>
            </>
          )}

          {tab === 'profile' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Section title="Profile Management">
                <div className="space-y-3">
                  {(payload?.profileSections || []).map((section) => (
                    <div key={section.id} className={`rounded-lg border p-3 ${areaTone(section.label).item}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-black text-slate-900">{section.label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{section.status}{section.approvalRequired ? ' - approval workflow applies' : ''}</p></div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {section.fields.map((field) => <span key={field} className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{field}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Profile Actions & Approval Controls">
                <ActionGrid items={[
                  ['Update personal data', UserRound, 'Routes to HR'],
                  ['Change contact details', Smartphone, 'Routes to HR'],
                  ['Upload profile photo', FileArchive, 'Approval required'],
                  ['Update bank details', Landmark, 'Encrypted workflow'],
                  ['Add qualification', GraduationCap, 'Attach evidence'],
                  ['Add certification', BadgeCheck, 'Expiry tracked'],
                ]} />
              </Section>
            </section>
          )}

          {tab === 'leave' && widgets && (
            <EssLeaveWorkspace payload={payload} employee={employee} />
          )}

          {tab === 'time' && widgets && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Section title="Attendance Records & Analytics">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Attendance Rate" value={`${widgets.attendance.monthRate}%`} detail={`${widgets.attendance.lateArrivals} late arrivals`} icon={Activity} tone="bg-blue-100 text-blue-700" />
                  <MetricCard label="Overtime" value={`${widgets.attendance.overtimeHours}h`} detail={`${widgets.attendance.remoteDays} remote work days`} icon={Clock} tone="bg-amber-100 text-amber-700" />
                </div>
                <div className="mt-4"><DataList rows={payload?.attendance.records || []} titleKey="date" subtitleKeys={['clockIn', 'clockOut', 'source']} /></div>
              </Section>
              <Section title="Clock-In, Shifts, Timesheets & Time Requests">
                <ActionGrid items={[
                  ['Clock-in / clock-out', Fingerprint, 'Biometric/mobile'],
                  ['Overtime request', Clock, 'Routes to manager'],
                  ['Attendance regularization', ClipboardList, 'Exception approval'],
                  ['Remote work tracking', Smartphone, 'Location-aware'],
                ]} />
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DataList rows={payload?.attendance.shifts || []} titleKey="name" subtitleKeys={['start', 'end', 'location']} statusKey="name" />
                  <DataList rows={payload?.attendance.timesheets || []} titleKey="week" subtitleKeys={['hours', 'overtime']} />
                </div>
              </Section>
            </section>
          )}

          {tab === 'payroll' && widgets && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <Section title="Payroll Self-Service">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <MetricCard label="Gross Pay" value={money(widgets.payroll.monthlyPay)} detail="Current month" icon={Banknote} tone="bg-violet-100 text-violet-700" />
                  <MetricCard label="Allowances" value={money(widgets.payroll.allowances)} detail="Payroll configured" icon={WalletCards} tone="bg-emerald-100 text-emerald-700" />
                  <MetricCard label="Tax / Deductions" value={money(widgets.payroll.deductions)} detail="PAYE and statutory deductions" icon={FileText} tone="bg-amber-100 text-amber-700" />
                  <MetricCard label="Pension" value={money(widgets.payroll.pension)} detail="Employee contribution" icon={Landmark} tone="bg-cyan-100 text-cyan-700" />
                </div>
              </Section>
              <Section title="Payslips, Loans & Salary Actions">
                <div className="space-y-3">
                  {['View payslip history', 'Download current payslip', 'View tax deductions', 'View pension contributions', 'View loan deductions', 'Salary information request'].map((item) => (
                    <button key={item} type="button" className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-black text-slate-800 hover:bg-white ${areaTone(item).item}`}>
                      <span>{item}</span><ArrowRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-normal text-slate-500">Payroll History</p>
                  <DataList rows={payload?.payrollHistory || []} titleKey="period" subtitleKeys={['grossPay', 'deductions', 'netPay']} />
                </div>
              </Section>
            </section>
          )}

          {tab === 'documents' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <Section title="Document Management">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {payload?.documents.map((doc) => (
                    <div key={doc.id} className={`rounded-lg border p-4 ${statusSurface(doc.status)}`}>
                      <FileArchive className="h-5 w-5 text-indigo-700" />
                      <p className="mt-3 text-sm font-black text-slate-900">{doc.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{doc.category} - {doc.version}</p>
                      <span className="mt-3 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">{doc.status}</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Versioning, Access & Acknowledgement">
                <DataList rows={payload?.documents || []} titleKey="title" subtitleKeys={['category', 'version']} />
              </Section>
            </section>
          )}

          {tab === 'performance' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Section title="Goals, KPIs & Performance Reviews">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DataList rows={payload?.performance.goals || []} titleKey="title" subtitleKeys={['progress', 'dueDate']} />
                  <DataList rows={payload?.performance.kpis || []} titleKey="label" subtitleKeys={['value', 'target']} statusKey="label" />
                </div>
              </Section>
              <Section title="Appraisals, Self-Assessments & Development Plans">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DataList rows={payload?.performance.reviews || []} titleKey="cycle" subtitleKeys={['form', 'score']} />
                  <DataList rows={payload?.performance.developmentPlans || []} titleKey="title" subtitleKeys={['owner']} />
                </div>
              </Section>
            </section>
          )}

          {tab === 'learning' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Section title="Training Enrollment & Course Registration"><DataList rows={payload?.learning.courses || []} titleKey="title" subtitleKeys={['date', 'type']} /></Section>
              <Section title="Learning Materials, Assessments & Feedback"><DataList rows={payload?.learning.materials || []} titleKey="title" subtitleKeys={['type']} /></Section>
              <Section title="Certifications"><DataList rows={payload?.learning.certifications || []} titleKey="title" subtitleKeys={['expiresAt']} /></Section>
            </section>
          )}

          {tab === 'claims' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
              <Section title="Claims & Reimbursements">
                <ActionGrid items={[
                  ['Travel claim', Plane, 'Attach receipts'],
                  ['Expense claim', WalletCards, 'Cost center aware'],
                  ['Medical reimbursement', FileText, 'Evidence required'],
                  ['Advance request', Banknote, 'Finance approval'],
                ]} />
              </Section>
              <Section title="Claim Approvals, Uploads & Status Tracking">
                <DataList rows={payload?.claims || []} titleKey="type" subtitleKeys={['amount', 'submittedAt', 'attachmentStatus']} />
              </Section>
            </section>
          )}

          {tab === 'loans' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr_1fr]">
              <Section title="New Loan Application">
                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Applicant</label>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3">
                    <p className="text-sm font-black text-slate-900">{employee?.fullName || 'Signed-in employee'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{employeeCode} - {employee?.department || 'Department'}</p>
                  </div>
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Product</label>
                  <select value={loanProductId} onChange={(e) => setLoanProductId(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                    {(payload?.loanManagement.products || []).map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Amount</label>
                      <input value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} inputMode="decimal" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Tenor</label>
                      <input value={loanTenorMonths} onChange={(e) => setLoanTenorMonths(e.target.value)} inputMode="numeric" className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none" />
                    </div>
                  </div>
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Purpose</label>
                  <textarea value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none" />
                  <button type="button" onClick={submitLoanApplication} disabled={saving || !loanProductId || !loanPrincipal || !loanTenorMonths || !loanPurpose.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" />{saving ? 'Submitting' : 'Submit Application'}</button>
                  <p className="text-xs font-semibold text-slate-500">{selectedLoanProduct ? `${selectedLoanProduct.maxTenorMonths} months max, ${selectedLoanProduct.maxPrincipalMultiple}x base pay cap` : 'Loan products are loaded from payroll policy.'}</p>
                </div>
              </Section>
              <Section title="My Loan Applications"><DataList rows={payload?.loanManagement.applications || []} titleKey="productId" subtitleKeys={['principal', 'tenorMonths', 'requestedAt']} statusKey="approvalStatus" /></Section>
              <Section title="Repayment Schedules & Balances"><DataList rows={payload?.loanManagement.repaymentSchedules || []} titleKey="productId" subtitleKeys={['dueDate', 'amount', 'balance']} /></Section>
            </section>
          )}

          {tab === 'travel' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
              <Section title="Travel Management">
                <ActionGrid items={[
                  ['Travel request', Plane, 'Route for approval'],
                  ['Travel advance', Banknote, 'Finance workflow'],
                  ['Trip report', FileText, 'Post-trip evidence'],
                  ['Travel settlement', WalletCards, 'Close advance'],
                ]} />
              </Section>
              <Section title="Requests, Approvals, Advances & Settlements">
                <DataList rows={payload?.travel || []} titleKey="destination" subtitleKeys={['purpose', 'advance', 'tripReport']} />
              </Section>
            </section>
          )}

          {tab === 'assets' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <Section title="Assigned Assets">
                <DataList rows={payload?.assets || []} titleKey="name" subtitleKeys={['tag', 'acknowledgement', 'condition']} />
              </Section>
              <Section title="Asset Actions">
                <ActionGrid items={[
                  ['Acknowledge receipt', BadgeCheck, 'Digital evidence'],
                  ['Request replacement', RefreshCcw, 'Approval required'],
                  ['Report damage', FileText, 'Incident trail'],
                  ['Return asset', BriefcaseBusiness, 'Exit/transfer'],
                ]} />
              </Section>
            </section>
          )}

          {tab === 'services' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
              <Section title="Submit Employee Request">
                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Service</label>
                  <select value={requestCategory} onChange={(e) => setRequestCategory(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                    {(payload?.serviceCatalog || []).map((item) => <option key={item.id}>{item.label}</option>)}
                  </select>
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Request title</label>
                  <input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none" placeholder="Briefly describe the request" />
                  <label className="block text-xs font-black uppercase tracking-normal text-slate-500">Priority</label>
                  <select value={requestPriority} onChange={(e) => setRequestPriority(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                    {['Low', 'Normal', 'High'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <button type="button" onClick={submitRequest} disabled={saving || !requestTitle.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" />{saving ? 'Submitting' : 'Submit Request'}</button>
                </div>
              </Section>
              <Section title="Workflow & Approval Tracking">
                <div className="space-y-3">
                  {(payload?.requests || []).map((item) => (
                    <div key={item.id} className={`rounded-lg border p-4 ${statusSurface(item.status)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-sm font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.category} - {dateText(item.submittedAt)}</p></div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusTone(item.status)}`}>{item.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.approvers.map((approver) => <span key={approver} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">{approver}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </section>
          )}

          {tab === 'communication' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Section title="Announcements, Circulars & Notices">
                <DataList rows={payload?.announcements || []} titleKey="title" subtitleKeys={['channel', 'publishedAt']} statusKey="priority" />
              </Section>
              <Section title="Surveys, Feedback & Policy Updates">
                <DataList rows={[
                  { id: 'survey-001', title: 'Employee engagement pulse survey', type: 'Survey', status: 'Open' },
                  { id: 'feedback-001', title: 'Workforce portal feedback form', type: 'Feedback', status: 'Open' },
                  { id: 'policy-001', title: 'Remote work policy update', type: 'Policy', status: 'Acknowledgement Due' },
                ]} titleKey="title" subtitleKeys={['type']} />
              </Section>
              <Section title="System Notifications">
                <DataList rows={payload?.notifications || []} titleKey="title" subtitleKeys={['type', 'createdAt']} />
              </Section>
            </section>
          )}

          {tab === 'workflow' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <Section title="Workflow & Approval Tracking">
                <div className="space-y-3">
                  {(payload?.requests || []).map((item) => (
                    <div key={item.id} className={`rounded-lg border p-4 ${statusSurface(item.status)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-sm font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.category} - {dateText(item.submittedAt)} - updated {dateText(item.updatedAt)}</p></div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusTone(item.status)}`}>{item.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.approvers.map((approver) => <span key={approver} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">{approver}</span>)}
                      </div>
                      <div className="mt-3 space-y-2">
                        {item.comments.map((comment) => <div key={`${item.id}-${comment.at}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-slate-700">{comment.actor}: {comment.comment}</div>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Pending Actions, Escalations & Notification Trail">
                <DataList rows={[
                  { id: 'act-001', title: 'Line manager approval pending', status: 'Pending', owner: 'Line Manager' },
                  { id: 'esc-001', title: 'SLA escalation rule', status: 'Active', owner: 'Workflow Engine' },
                  { id: 'ntf-approval', title: 'Email and in-app notification sent', status: 'Delivered', owner: 'Notification Service' },
                ]} titleKey="title" subtitleKeys={['owner']} />
              </Section>
            </section>
          )}

          {tab === 'exit' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
              <Section title="Employee Exit & Separation Services">
                <ActionGrid items={[
                  ['Submit resignation', FileText, 'Notice period checked'],
                  ['Exit interview', ClipboardList, 'Questionnaire'],
                  ['Track final settlement', Banknote, 'Payroll/finance'],
                  ['Asset return', BriefcaseBusiness, 'Clearance item'],
                ]} />
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase tracking-normal text-slate-500">Resignation Status</p>
                  <p className="mt-2 text-sm font-black text-slate-950">{String(payload?.exitServices.resignation.status || 'Not submitted')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Notice period: {String(payload?.exitServices.resignation.noticePeriodDays || 0)} days</p>
                </div>
              </Section>
              <Section title="Clearance, Asset Return, Interview & Final Settlement">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DataList rows={payload?.exitServices.clearance || []} titleKey="unit" />
                  <DataList rows={[payload?.exitServices.exitInterview || {}, payload?.exitServices.finalSettlement || {}]} titleKey="form" subtitleKeys={['payrollPeriod']} />
                </div>
              </Section>
            </section>
          )}

          {tab === 'security' && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Section title="Enterprise Security & Access">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {Object.entries(payload?.security || {}).map(([label, value]) => (
                    <div key={label} className={`rounded-lg border p-4 ${areaTone(label).item}`}>
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <p className="mt-3 text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Analytics, Reports & Integrations">
                <div className="grid grid-cols-2 gap-3">
                  {payload?.analytics.map((item) => (
                    <div key={item.label} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-2xl font-black text-slate-950">{numFmt.format(item.value)}{item.unit}</p>
                      <p className="mt-1 text-xs font-bold text-slate-600">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {payload?.integrations.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800"><Globe2 className="h-3 w-3" />{item}</span>)}
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs font-semibold text-slate-600">
                  <Smartphone className="h-4 w-4 text-blue-600" />Responsive web and mobile access enabled for employee transactions.
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-normal text-slate-500">Report Generation</p>
                  <DataList rows={payload?.reports || []} titleKey="title" subtitleKeys={['format']} />
                </div>
              </Section>
              <Section title="Configurable Rules, Audit Trail & Activity Logging">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DataList rows={payload?.businessRules || []} titleKey="name" subtitleKeys={['configurable']} />
                  <DataList rows={payload?.auditTrail || []} titleKey="action" subtitleKeys={['actor', 'channel', 'at']} statusKey="channel" />
                </div>
              </Section>
            </section>
          )}

        </main>
      </div>
    </div>
  );
}
