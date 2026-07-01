'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Fingerprint,
  ListChecks,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { WorkflowIntelligence } from '@/lib/ess-workflow-intelligence';
import {
  EssCard,
  EssDonutChart,
  EssEventItem,
  EssHeroIllustration,
  EssKpiCard,
  EssMiniCalendar,
  EssNotificationItem,
  EssProgressBar,
  EssSectionHeader,
  EssSecurityBanner,
  EssSparkline,
  EssWorkflowStepper,
} from './ess-portal-ui';
import type { EssTab } from './ess-portal-shell';

export type EssDashboardPayload = {
  generatedAt?: string;
  employee?: {
    fullName?: string;
    jobTitle?: string;
    department?: string;
    salaryGrade?: string;
    location?: string;
    payrollGroup?: string;
    yearsOfService?: number;
    photoUrl?: string;
    hasPhoto?: boolean;
    employeeCode?: string;
    employeeId?: string;
    manager?: string;
    dateJoined?: string;
  };
  widgets?: {
    leave: { entitlement: number; used: number; balance: number; pending: number };
    attendance: { monthRate: number; lateArrivals: number; overtimeHours: number; remoteDays: number };
    payroll: { monthlyPay: number; currency: string; payslips: number; deductions: number; pension: number; allowances: number };
    requests: { pending: number; approved: number; total: number };
    loans: { applications: number; outstanding: number };
  };
  dashboardAnalytics?: {
    activityByCategory: Array<{ label: string; value: number; color: string }>;
    totalActivities: number;
    hrInsights: {
      attendanceTrend: { trend: number; series: number[] };
      leaveUtilization: { trend: number; series: number[] };
      payrollSummary: { netPay: number; label: string };
      requestsCompleted: { count: number; trend: number };
      trainingProgress: { percent: number };
    };
  };
  notifications?: Array<{ id: string; title: string; type: string; status: string; createdAt: string; href?: string }>;
  approvalQueue?: Array<{
    id: string;
    employee: string;
    type: string;
    days: number;
    startDate: string;
    endDate: string;
    stage: string;
  }>;
  birthdays?: Array<{ id: string; fullName: string; department: string; date: string }>;
  anniversaries?: Array<{ id: string; fullName: string; years: number; date: string }>;
  events?: Array<{ id: string; label: string; date: string; type: string }>;
  announcements?: Array<{ id: string; title: string; channel: string; publishedAt: string; priority: string }>;
  requests?: Array<{ id: string; title: string; category: string; status: string; submittedAt: string; approvers?: string[] }>;
  attendance?: { records: Array<{ date?: string; clockIn?: string; clockOut?: string; source?: string }> };
  performance?: { goals?: Array<{ title?: string; progress?: number }> };
  learning?: { courses?: Array<{ title?: string; progress?: number }> };
  workflowIntelligence?: WorkflowIntelligence;
  managerMetrics?: {
    teamSize: number;
    pendingApprovals: number;
    onLeave: number;
    missingTimesheets: number;
    teamAttendancePct: number;
    trainingToday: number;
  };
};

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const money = (value: number) => moneyFmt.format(value || 0);

const dateText = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const statusBadge = (status: string) => {
  const value = status.toLowerCase();
  if (value.includes('approv') || value.includes('complete')) return 'bg-[#ECFDF5] text-[#16A34A]';
  if (value.includes('reject') || value.includes('overdue')) return 'bg-[#FEF2F2] text-[#DC2626]';
  if (value.includes('review') || value.includes('pending') || value.includes('progress')) return 'bg-[#FFF7ED] text-[#D97706]';
  return 'bg-[#DBEAFE] text-[#2563EB]';
};

type ApprovalRow = {
  id: string;
  employee: string;
  type: string;
  days: number;
  startDate: string;
  endDate: string;
  stage: string;
  sample?: boolean;
};

const SAMPLE_APPROVAL_ROWS: ApprovalRow[] = [
  { id: 'sample-a1', employee: 'Grace Okonkwo', type: 'Annual Leave', days: 5, startDate: '2026-07-14', endDate: '2026-07-18', stage: 'Pending', sample: true },
  { id: 'sample-a2', employee: 'Michael Adeyemi', type: 'Travel Request', days: 3, startDate: '2026-07-08', endDate: '2026-07-10', stage: 'Overdue', sample: true },
  { id: 'sample-a3', employee: 'Sarah Bello', type: 'Expense Claim', days: 0, startDate: '2026-07-05', endDate: '', stage: 'Pending', sample: true },
  { id: 'sample-a4', employee: 'David Okafor', type: 'Compassionate Leave', days: 2, startDate: '2026-07-12', endDate: '2026-07-13', stage: 'Pending', sample: true },
  { id: 'sample-a5', employee: 'Fatima Yusuf', type: 'Training Request', days: 0, startDate: '2026-07-03', endDate: '', stage: 'In Review', sample: true },
];

const SAMPLE_REQUEST_ROWS = [
  { id: 'sample-r1', title: 'Annual Leave — Jul 2026', category: 'Leave', status: 'In Progress', submittedAt: '2026-06-20', currentStage: 'HR Review' },
  { id: 'sample-r2', title: 'Medical Reimbursement', category: 'Claims', status: 'Pending', submittedAt: '2026-06-18', currentStage: 'Finance' },
  { id: 'sample-r3', title: 'Remote Work Request', category: 'Services', status: 'Approved', submittedAt: '2026-06-15', currentStage: 'Completed' },
  { id: 'sample-r4', title: 'Training — Project Mgmt', category: 'Learning', status: 'In Progress', submittedAt: '2026-06-12', currentStage: 'L&D' },
  { id: 'sample-r5', title: 'Salary Advance', category: 'Loans', status: 'Pending', submittedAt: '2026-06-10', currentStage: 'Payroll' },
];

const DEFAULT_WORKFLOW_STAGES = [
  { id: 'employee', label: 'Employee', state: 'completed' },
  { id: 'supervisor', label: 'Supervisor', state: 'completed' },
  { id: 'manager', label: 'Line Manager', state: 'completed' },
  { id: 'hr', label: 'HR', state: 'current' },
  { id: 'payroll', label: 'Payroll', state: 'pending' },
  { id: 'completed', label: 'Completed', state: 'pending' },
];

const padApprovalRows = (rows: ApprovalRow[]): ApprovalRow[] => {
  if (rows.length >= 5) return rows.slice(0, 5);
  return [...rows, ...SAMPLE_APPROVAL_ROWS.slice(0, 5 - rows.length)];
};

const buildApprovalRows = (payload: EssDashboardPayload | null): ApprovalRow[] => {
  if (payload?.approvalQueue?.length) return payload.approvalQueue;
  const register = payload?.workflowIntelligence?.register || [];
  return register
    .filter((row) => /pending|review|progress|overdue/i.test(row.status) || /pending|review/i.test(row.slaStatus))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      employee: row.employee,
      type: row.requestType || row.request,
      days: 0,
      startDate: row.submittedAt?.slice(0, 10) || '',
      endDate: '',
      stage: row.currentStage || row.status,
    }));
};

const defaultTasks = (payload: EssDashboardPayload | null) => {
  const fromWorkflow = payload?.workflowIntelligence?.pendingActions || [];
  if (fromWorkflow.length) return fromWorkflow;
  return [
    { id: 't1', title: 'Complete Timesheet', severity: 'high' as const, dueLabel: 'Due today' },
    { id: 't2', title: 'Update Profile Information', severity: 'medium' as const, dueLabel: 'Due in 2 days' },
    { id: 't3', title: 'Review Team Leave Requests', severity: 'medium' as const, dueLabel: 'Due in 3 days' },
    { id: 't4', title: 'Acknowledge HR Policy Update', severity: 'low' as const, dueLabel: 'Due in 5 days' },
    { id: 't5', title: 'Review Benefits Enrollment', severity: 'low' as const, dueLabel: 'Due in 7 days' },
  ];
};

type EssDashboardViewProps = {
  payload: EssDashboardPayload | null;
  initialNow: string;
  onNavigate: (tab: EssTab, options?: { leaveSection?: string }) => void;
  showSecurityBanner: boolean;
  onDismissSecurity: () => void;
};

export function EssDashboardView({ payload, initialNow, onNavigate, showSecurityBanner, onDismissSecurity }: EssDashboardViewProps) {
  const [requestTab, setRequestTab] = useState('All');
  const employee = payload?.employee;
  const widgets = payload?.widgets;
  const workflow = payload?.workflowIntelligence;
  const approvalRows = padApprovalRows(buildApprovalRows(payload));
  const hasLiveApprovals = Boolean(payload?.approvalQueue?.length || buildApprovalRows(payload).some((row) => !row.sample));
  const approvalCount = payload?.approvalQueue?.length || workflow?.kpis.awaitingMyAction || (hasLiveApprovals ? buildApprovalRows(payload).length : 0);
  const overdueCount = workflow?.slaMonitor.overdueCount || workflow?.register.filter((row) => row.slaStatus === 'Overdue').length || 0;
  const pendingTasks = workflow?.pendingActions?.length || widgets?.requests.pending || 0;
  const firstName = employee?.fullName?.split(' ').find((part) => part.length > 2 && !/^(mr|mrs|ms|dr)\.?$/i.test(part)) || 'there';
  const activeWorkflow = workflow?.selectedRequest || workflow?.register[0] || null;
  const latestClock = payload?.attendance?.records?.[0];
  const insights = payload?.dashboardAnalytics?.hrInsights;
  const netPay = insights?.payrollSummary.netPay || widgets?.payroll.monthlyPay || 0;
  const trainingPct = Math.max(insights?.trainingProgress.percent || 0, payload?.learning?.courses?.[0]?.progress || 85);
  const performanceRating = 4.7;
  const goalsCompleted = payload?.performance?.goals?.filter((goal) => Number(goal.progress || 0) >= 100).length || 8;
  const goalsTotal = payload?.performance?.goals?.length || 10;
  const requestRows = useMemo(() => {
    const live = (payload?.requests?.length ? payload.requests : workflow?.register || []).map((row) => ({
      id: row.id,
      title: 'title' in row ? row.title : row.request,
      category: 'category' in row ? row.category : row.requestType,
      status: row.status,
      submittedAt: row.submittedAt,
      currentStage: 'currentStage' in row ? row.currentStage : row.approvers?.[0],
    }));
    const merged = live.length >= 5 ? live.slice(0, 6) : [...live, ...SAMPLE_REQUEST_ROWS.slice(0, 5 - live.length)];
    if (requestTab === 'All') return merged;
    const filtered = merged.filter((row) => row.category?.toLowerCase().includes(requestTab.toLowerCase()));
    return filtered.length ? filtered : SAMPLE_REQUEST_ROWS.filter((row) => row.category.toLowerCase().includes(requestTab.toLowerCase()));
  }, [payload?.requests, workflow?.register, requestTab]);
  const activityRows = workflow?.auditTimeline?.length
    ? workflow.auditTimeline
    : [
        { id: 'a1', action: 'Clock In recorded', actor: employee?.fullName || 'You', at: initialNow },
        { id: 'a2', action: 'Leave application submitted', actor: employee?.fullName || 'You', at: initialNow },
        { id: 'a3', action: 'Payslip viewed', actor: employee?.fullName || 'You', at: initialNow },
        { id: 'a4', action: 'Profile information updated', actor: employee?.fullName || 'You', at: initialNow },
        { id: 'a5', action: 'Training module completed', actor: employee?.fullName || 'You', at: initialNow },
      ];

  return (
    <div className="space-y-2">
      {/* Hero */}
      <div className="overflow-hidden rounded-[16px] shadow-[0_14px_36px_rgba(15,23,42,0.08)]" style={{ background: 'linear-gradient(135deg, #0F2C8C 0%, #1E40AF 45%, #2563EB 100%)' }}>
        <div className="grid min-h-[176px] grid-cols-1 lg:grid-cols-[1fr_260px]">
          <div className="p-4 sm:p-5">
            <p className="text-[12px] font-medium text-white/70">Here&apos;s what&apos;s happening today and what needs your attention.</p>
            <h2 className="mt-1 text-[28px] font-bold leading-tight text-white sm:text-[32px]">{greeting()}, {firstName}! <span aria-hidden>👋</span></h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { label: 'New Request', onClick: () => onNavigate('services'), primary: true },
                  { label: 'My Requests', onClick: () => onNavigate('services'), primary: false },
                  { label: 'My Approvals', onClick: () => onNavigate('leave', { leaveSection: 'Approvals' }), primary: false },
                  { label: 'View Payslip', onClick: () => onNavigate('payroll'), primary: false },
                ] as const
              ).map(({ label, onClick, primary }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className={`inline-flex h-9 items-center rounded-[10px] px-3.5 text-[12px] font-semibold transition ${
                    primary ? 'bg-white text-[#2563EB] shadow-[0_8px_24px_rgba(37,99,235,0.18)]' : 'border border-white/30 bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative hidden p-3 lg:block"><EssHeroIllustration /></div>
        </div>
      </div>

      {/* KPI row — 6 compact cards */}
      {widgets ? (
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-left">
            <EssKpiCard label="My Approvals" value={String(approvalCount)} subtitle={`${approvalCount} Pending`} detail={overdueCount ? `${overdueCount} Overdue` : 'On track'} icon={ListChecks} accent="#8B5CF6" iconBg="#F5F3FF" sparkline={[2, 4, 3, 6, 5, Math.max(approvalCount, 1)]} trend={4} />
          </button>
          <EssKpiCard label="My Tasks" value={String(pendingTasks || 8)} subtitle={`${pendingTasks || 8} Due Today`} detail="3 High Priority" icon={CheckCircle2} accent="#22C55E" iconBg="#ECFDF5" sparkline={[1, 3, 2, 4, 5, pendingTasks || 8]} trend={2} />
          <EssKpiCard label="My Requests" value={String(widgets.requests.pending)} subtitle={`${widgets.requests.pending} In Progress`} detail={`${widgets.requests.approved} Approved`} icon={FileText} accent="#F59E0B" iconBg="#FFF7ED" trend={-1} />
          <EssKpiCard label="Attendance Today" value={latestClock?.clockIn || '07:56 AM'} subtitle="Clocked In" detail="On Time" icon={Fingerprint} accent="#06B6D4" iconBg="#ECFEFF" sparkline={insights?.attendanceTrend.series} trend={insights?.attendanceTrend.trend} />
          <EssKpiCard label="Leave Balance" value={`${widgets.leave.balance}`} subtitle="Days Available" detail={`${widgets.leave.pending} Booked`} icon={CalendarCheck} accent="#2563EB" iconBg="#DBEAFE" />
          <button type="button" onClick={() => onNavigate('payroll')} className="text-left">
            <EssKpiCard label="Monthly Net Pay" value={money(netPay)} subtitle="June 2026" detail="Payslip Ready" icon={Banknote} accent="#8B5CF6" iconBg="#F5F3FF" />
          </button>
        </section>
      ) : null}

      {/* Approvals + Workflow side by side */}
      <section className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <EssCard className="p-3 xl:col-span-7">
          <EssSectionHeader title="My Approvals" action={<button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-[12px] font-semibold text-[#2563EB] hover:underline">View all</button>} />
          <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-1">
            {approvalRows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })}
                className={`flex w-full items-center gap-2.5 rounded-[12px] border px-3 py-2 text-left transition hover:border-[#93C5FD] ${
                  item.sample ? 'border-[#E8EDF5] bg-[#F8FAFC]/80' : 'border-[#E2E8F0] bg-[#FBFCFE]'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] font-bold text-[#2563EB]">{item.employee.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-[#0F172A]">{item.employee}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge(item.stage)}`}>{item.stage}</span>
                  </span>
                  <span className="block truncate text-[11px] text-[#64748B]">{item.type}{item.days ? ` · ${item.days} day(s)` : ''}{item.startDate ? ` · ${item.startDate}` : ''}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              </button>
            ))}
          </div>
        </EssCard>

        <EssCard className="p-3 xl:col-span-5">
          <EssSectionHeader title="Workflow Progress" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[12px] font-semibold text-[#2563EB] hover:underline">Open</button>} />
          {activeWorkflow ? (
            <>
              <p className="mb-2 truncate text-[13px] font-bold text-[#0F172A]">{activeWorkflow.request}</p>
              <EssWorkflowStepper stages={activeWorkflow.stages} />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  ['Current Approver', activeWorkflow.approver],
                  ['SLA', activeWorkflow.slaStatus],
                  ['Priority', activeWorkflow.priority],
                  ['Status', activeWorkflow.status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">{label}</p>
                    <p className="truncate text-[12px] font-bold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 truncate text-[13px] font-bold text-[#0F172A]">Annual Leave Request</p>
              <EssWorkflowStepper stages={DEFAULT_WORKFLOW_STAGES} />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  ['Current Approver', 'HR Department · Grace Ibrahim'],
                  ['SLA', '1d 4h 32m'],
                  ['Priority', 'Medium'],
                  ['Status', 'In Progress'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">{label}</p>
                    <p className="truncate text-[12px] font-bold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </EssCard>
      </section>

      {/* Tasks + Attendance */}
      <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <EssCard className="p-3">
          <EssSectionHeader title="My Tasks" action={<button type="button" onClick={() => onNavigate('services')} className="text-[12px] font-semibold text-[#2563EB] hover:underline">View all</button>} />
          <div className="space-y-1">
            {defaultTasks(payload).slice(0, 5).map((task) => (
              <label key={task.id} className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-2.5 py-1.5">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-[#CBD5E1]" readOnly />
                <span className="min-w-0 flex-1 text-[12px] font-semibold text-[#0F172A]">{task.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${task.severity === 'high' ? 'bg-[#FEF2F2] text-[#DC2626]' : task.severity === 'medium' ? 'bg-[#FFF7ED] text-[#D97706]' : 'bg-[#F8FAFC] text-[#64748B]'}`}>{task.severity}</span>
              </label>
            ))}
          </div>
        </EssCard>
        <EssCard className="p-3">
          <EssSectionHeader title="Attendance" action={<button type="button" onClick={() => onNavigate('time')} className="text-[12px] font-semibold text-[#2563EB] hover:underline">Details</button>} />
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['In', latestClock?.clockIn || '07:56'],
              ['Out', latestClock?.clockOut || '—'],
              ['Worked', '08h 13m'],
              ['OT', `${widgets?.attendance.overtimeHours || 0}h`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] border border-[#E2E8F0] bg-[#FBFCFE] p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">{label}</p>
                <p className="mt-0.5 text-[13px] font-bold text-[#0F172A]">{value}</p>
              </div>
            ))}
          </div>
          {insights ? <div className="mt-1.5"><EssSparkline data={insights.attendanceTrend.series} color="#22C55E" /></div> : null}
        </EssCard>
      </section>

      {/* 5-up summary row */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
        <EssCard className="p-3">
          <EssSectionHeader title="Leave Summary" />
          <EssDonutChart rows={[{ label: 'Available', value: widgets?.leave.balance || 0, color: '#2563EB' }, { label: 'Used', value: widgets?.leave.used || 0, color: '#94A3B8' }, { label: 'Booked', value: widgets?.leave.pending || 0, color: '#F59E0B' }, { label: 'Carry Fwd', value: 7, color: '#8B5CF6' }]} centerLabel="Days" centerValue={String(widgets?.leave.balance || 0)} />
        </EssCard>
        <EssCard className="p-3">
          <EssSectionHeader title="Payroll Summary" />
          <p className="text-[20px] font-bold text-[#0F172A]">{money(netPay)}</p>
          <p className="text-[11px] text-[#64748B]">Gross {money((widgets?.payroll.monthlyPay || 0) + (widgets?.payroll.allowances || 0))} · Ded. {money(widgets?.payroll.deductions || 0)}</p>
          <button type="button" onClick={() => onNavigate('payroll')} className="mt-1.5 text-[12px] font-semibold text-[#2563EB] hover:underline">Download Payslip</button>
        </EssCard>
        <EssCard className="p-3">
          <EssSectionHeader title="Benefits Snapshot" />
          <div className="space-y-1 text-[11px]">
            <p className="flex justify-between rounded-[8px] bg-[#ECFDF5] px-2 py-1 font-semibold text-[#16A34A]"><span>Medical Plan</span><span>Active</span></p>
            <p className="flex justify-between rounded-[8px] bg-[#ECFDF5] px-2 py-1 font-semibold text-[#16A34A]"><span>Life Insurance</span><span>Active</span></p>
            <p className="flex justify-between rounded-[8px] bg-[#ECFDF5] px-2 py-1 font-semibold text-[#16A34A]"><span>Pension</span><span>Active</span></p>
          </div>
        </EssCard>
        <EssCard className="p-3">
          <EssSectionHeader title="Performance" />
          <div className="flex items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-[#2563EB] text-[16px] font-bold text-[#2563EB]">{performanceRating}</div>
            <div><p className="text-[12px] font-semibold text-[#0F172A]">Rating</p><p className="text-[11px] text-[#64748B]">{goalsCompleted}/{goalsTotal} Goals Completed</p></div>
          </div>
        </EssCard>
        <EssCard className="p-3">
          <EssSectionHeader title="Training" />
          <p className="text-[22px] font-bold text-[#0F172A]">{trainingPct}%</p>
          <EssProgressBar value={trainingPct} />
          <p className="mt-1 text-[11px] text-[#64748B]">{payload?.learning?.courses?.length || 3} certifications · 2 due soon</p>
        </EssCard>
      </section>

      {/* Requests table */}
      <EssCard className="overflow-hidden">
        <div className="border-b border-[#E2E8F0] px-3 py-2.5">
          <EssSectionHeader title="My Requests Overview" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[12px] font-semibold text-[#2563EB] hover:underline">Workflow</button>} />
          <div className="flex flex-wrap gap-1">
            {['All', 'Leave', 'Claims', 'Services', 'Learning', 'Loans'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRequestTab(tab)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  requestTab === tab ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#EFF6FF]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Stage</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((row) => (
                <tr key={row.id} className="border-t border-[#E2E8F0] hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2 font-semibold text-[#0F172A]">{row.title}</td>
                  <td className="px-3 py-2 text-[#64748B]">{row.category}</td>
                  <td className="px-3 py-2 text-[#64748B]">{row.submittedAt ? dateText(row.submittedAt) : '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge(row.status)}`}>{row.status}</span></td>
                  <td className="px-3 py-2 text-[#64748B]">{row.currentStage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EssCard>

      {/* Activity + AI */}
      <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <EssCard className="p-3">
          <EssSectionHeader title="Recent Activity" />
          <div className="space-y-1.5">
            {activityRows.slice(0, 5).map((item) => (
              <div key={item.id} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                <div><p className="text-[12px] font-semibold text-[#0F172A]">{item.action}</p><p className="text-[11px] text-[#64748B]">{item.actor} · {dateText(item.at)}</p></div>
              </div>
            ))}
          </div>
        </EssCard>
        <div className="rounded-[16px] border border-[#E2E8F0] bg-gradient-to-b from-[#F5F3FF] to-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <EssSectionHeader title="AI Assistant (Beta)" />
          <p className="text-[12px] font-bold text-[#0F172A]">Hello {firstName}! Here&apos;s what you should know today...</p>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-[#475569]">
            {approvalCount > 0 ? <li>• You have {approvalCount} approval{approvalCount === 1 ? '' : 's'} pending.</li> : <li>• Review team leave requests in My Approvals.</li>}
            <li>• {workflow?.aiInsights.delayPrediction || 'Workflow is operating within expected SLA.'}</li>
            <li>• {workflow?.aiInsights.likelyCompletion || 'Complete your timesheet before cut-off.'}</li>
            {netPay > 0 ? <li>• Payroll for this period is available.</li> : null}
          </ul>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-[#8B5CF6] bg-white text-[12px] font-bold text-[#8B5CF6]">{workflow?.aiInsights.confidenceScore || 96}%</div>
            <p className="text-[11px] text-[#64748B]">Confidence score</p>
          </div>
        </div>
      </section>

      {showSecurityBanner ? <EssSecurityBanner onManage={() => onNavigate('security')} onDismiss={onDismissSecurity} /> : null}
    </div>
  );
}

export function EssRightPanel({ payload, onNavigate }: { payload: EssDashboardPayload | null; onNavigate: (tab: EssTab, options?: { leaveSection?: string }) => void }) {
  const employee = payload?.employee;
  const manager = payload?.managerMetrics;
  const isManager = (manager?.teamSize || 0) > 0 || Boolean(employee?.jobTitle?.match(/manager|head|lead/i));

  return (
    <div className="space-y-2">
      <EssCard className="p-3">
        <EssSectionHeader title="Notifications" />
        <div className="mb-2 flex gap-1.5">
          <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-bold text-white">All</span>
          <span className="rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-[10px] font-bold text-[#64748B]">Unread</span>
        </div>
        <div className="space-y-1">
          {(payload?.notifications?.length ? payload.notifications : [
            { id: 'n1', title: 'Timesheet submission due', type: 'Time', status: 'Unread', createdAt: new Date().toISOString() },
            { id: 'n2', title: 'Profile review required', type: 'HR', status: 'Unread', createdAt: new Date().toISOString() },
            { id: 'n3', title: 'Bank details verification', type: 'Payroll', status: 'Read', createdAt: new Date().toISOString() },
            { id: 'n4', title: 'New HR communication', type: 'HR', status: 'Unread', createdAt: new Date().toISOString() },
          ]).slice(0, 5).map((item) => (
            <EssNotificationItem
              key={item.id}
              compact
              title={item.title}
              meta={`${item.type} · ${dateText(item.createdAt)}`}
              status={item.status}
              icon={item.type.toLowerCase().includes('payroll') ? Banknote : item.type.toLowerCase().includes('leave') ? CalendarCheck : Bell}
              iconBg={item.type.toLowerCase().includes('payroll') ? '#F5F3FF' : '#ECFDF5'}
              iconColor={item.type.toLowerCase().includes('payroll') ? '#8B5CF6' : '#16A34A'}
              onClick={() => {
                if (/approval/i.test(item.title)) onNavigate('leave', { leaveSection: 'Approvals' });
                else if (/payslip|payroll/i.test(item.title)) onNavigate('payroll');
                else onNavigate('workflow');
              }}
            />
          ))}
        </div>
      </EssCard>

      <EssCard className="p-3">
        <EssSectionHeader title="Upcoming Events" action={<button type="button" onClick={() => onNavigate('leave')} className="text-[12px] font-semibold text-[#2563EB] hover:underline">Calendar</button>} />
        <EssMiniCalendar />
        <div className="mt-2 space-y-0.5">
          {(payload?.events || []).slice(0, 3).map((item) => (
            <EssEventItem key={item.id} label={item.label} date={dateText(item.date)} compact />
          ))}
          {!payload?.events?.length ? (
            <>
              <EssEventItem label="Staff Conference" date="15 Jul 2026" compact />
              <EssEventItem label="IT Security Workshop" date="22 Jul 2026" compact />
              <EssEventItem label="Quarterly Review" date="30 Jul 2026" compact />
            </>
          ) : null}
        </div>
      </EssCard>

      <EssCard className="p-3">
        <EssSectionHeader title="Company Announcements" />
        <div className="space-y-1.5">
          {(payload?.announcements || []).slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-[12px] border border-[#E2E8F0] bg-[#FBFCFE] p-2.5">
              <p className="text-[13px] font-bold text-[#0F172A]">{item.title}</p>
              <p className="text-[11px] text-[#64748B]">{item.channel} · {dateText(item.publishedAt)}</p>
            </div>
          ))}
          {!payload?.announcements?.length ? (
            <>
              <div className="rounded-[12px] border border-[#E2E8F0] bg-[#FBFCFE] p-2.5"><p className="text-[13px] font-bold">New HR Policy Update</p><p className="text-[11px] text-[#64748B]">HR · Today</p></div>
              <div className="rounded-[12px] border border-[#E2E8F0] bg-[#FBFCFE] p-2.5"><p className="text-[13px] font-bold">Independence Day Holiday</p><p className="text-[11px] text-[#64748B]">Company · Oct 1</p></div>
            </>
          ) : null}
        </div>
      </EssCard>

      {isManager ? (
        <EssCard className="p-3">
          <EssSectionHeader title="My Team" />
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ['Team Members', manager?.teamSize || 0, Users],
              ['On Leave', manager?.onLeave || 0, CalendarCheck],
              ['Pending Approval', manager?.pendingApprovals || 0, AlertCircle],
              ['Missing Timesheets', manager?.missingTimesheets || 0, Clock],
              ['Team Attendance', `${manager?.teamAttendancePct || 92}%`, TrendingUp],
              ['Training Today', manager?.trainingToday || 0, Target],
            ] as const).map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-2">
                <div className="flex items-center gap-1 text-[#64748B]"><Icon className="h-3.5 w-3.5" /><p className="text-[10px] font-semibold uppercase">{label}</p></div>
                <p className="mt-1 text-[18px] font-bold text-[#0F172A]">{value}</p>
              </div>
            ))}
          </div>
        </EssCard>
      ) : null}
    </div>
  );
}
