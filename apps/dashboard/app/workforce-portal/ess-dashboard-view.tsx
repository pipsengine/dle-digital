'use client';

import {
  AlertCircle,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Fingerprint,
  GraduationCap,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import type { WorkflowIntelligence } from '@/lib/ess-workflow-intelligence';
import {
  EssCard,
  EssDonutChart,
  EssEventItem,
  EssHeroIllustration,
  EssKpiCard,
  EssNotificationItem,
  EssProgressBar,
  EssSectionHeader,
  EssSecurityBanner,
  EssSparkline,
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
  if (value.includes('reject')) return 'bg-[#FEF2F2] text-[#DC2626]';
  if (value.includes('review') || value.includes('pending') || value.includes('progress')) return 'bg-[#FFF7ED] text-[#D97706]';
  return 'bg-[#DBEAFE] text-[#2563EB]';
};

const stageTone = (state: string) => {
  if (state === 'completed') return 'border-[#22C55E] bg-[#ECFDF5] text-[#16A34A]';
  if (state === 'current') return 'border-[#2563EB] bg-[#DBEAFE] text-[#2563EB] ring-2 ring-[#2563EB]/30';
  if (state === 'rejected') return 'border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]';
  return 'border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]';
};

type EssDashboardViewProps = {
  payload: EssDashboardPayload | null;
  initialNow: string;
  onNavigate: (tab: EssTab, options?: { leaveSection?: string }) => void;
  showSecurityBanner: boolean;
  onDismissSecurity: () => void;
};

export function EssDashboardView({ payload, initialNow, onNavigate, showSecurityBanner, onDismissSecurity }: EssDashboardViewProps) {
  const employee = payload?.employee;
  const widgets = payload?.widgets;
  const workflow = payload?.workflowIntelligence;
  const approvalQueue = payload?.approvalQueue || [];
  const approvalCount = approvalQueue.length;
  const pendingTasks = workflow?.pendingActions?.length || Math.max(0, (widgets?.requests.pending || 0));
  const firstName = employee?.fullName?.split(' ').find((part) => part.length > 2 && !/^(mr|mrs|ms|dr)\.?$/i.test(part)) || 'there';
  const selectedWorkflow = workflow?.selectedRequest;
  const latestClock = payload?.attendance?.records?.[0];
  const insights = payload?.dashboardAnalytics?.hrInsights;
  const netPay = insights?.payrollSummary.netPay || widgets?.payroll.monthlyPay || 0;
  const trainingPct = insights?.trainingProgress.percent || 0;
  const performanceRating = 4.7;
  const goalsCompleted = payload?.performance?.goals?.filter((goal) => Number(goal.progress || 0) >= 100).length || 8;
  const goalsTotal = payload?.performance?.goals?.length || 10;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div
        className="overflow-hidden rounded-[20px] shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
        style={{ background: 'linear-gradient(135deg, #0F2C8C 0%, #1E40AF 45%, #2563EB 100%)', minHeight: 230 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="p-6 sm:p-8">
            <p className="text-[13px] font-medium text-white/70">Daily summary · {dateText(payload?.generatedAt || initialNow)}</p>
            <h2 className="mt-2 text-[34px] font-bold leading-tight tracking-tight text-white sm:text-[40px]">
              {greeting()}, {firstName}! <span aria-hidden>👋</span>
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-white/80">
              Your enterprise command center for approvals, attendance, leave, payroll, and HR services.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate('services')} className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-white px-5 text-[14px] font-semibold text-[#2563EB] shadow-[0_8px_24px_rgba(37,99,235,0.18)] transition hover:-translate-y-px">
                New Request
              </button>
              <button type="button" onClick={() => onNavigate('services')} className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/30 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                My Requests
              </button>
              <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/30 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                My Approvals {approvalCount > 0 ? `(${approvalCount})` : ''}
              </button>
              <button type="button" onClick={() => onNavigate('payroll')} className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/30 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                View Payslip
              </button>
            </div>
          </div>
          <div className="relative hidden p-6 lg:block">
            <EssHeroIllustration />
          </div>
        </div>
      </div>

      {/* Executive KPI Row */}
      {widgets ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-left">
            <EssKpiCard label="My Approvals" value={String(approvalCount)} subtitle={`${workflow?.kpis.escalations || 0} escalations`} icon={ListChecks} accent="#8B5CF6" iconBg="#F5F3FF" />
          </button>
          <EssKpiCard label="My Tasks" value={String(pendingTasks)} subtitle={`${widgets.requests.pending} awaiting action`} icon={CheckCircle2} accent="#22C55E" iconBg="#ECFDF5" />
          <EssKpiCard label="My Requests" value={String(widgets.requests.pending)} subtitle={`${widgets.requests.approved} approved`} icon={FileText} accent="#F59E0B" iconBg="#FFF7ED" />
          <EssKpiCard label="Attendance Today" value={latestClock?.clockIn || '—'} subtitle={`${widgets.attendance.monthRate}% month rate`} icon={Fingerprint} accent="#06B6D4" iconBg="#ECFEFF" />
          <EssKpiCard label="Leave Balance" value={`${widgets.leave.balance}d`} subtitle={`${widgets.leave.used}/${widgets.leave.entitlement} used`} icon={CalendarCheck} accent="#2563EB" iconBg="#DBEAFE" />
          <EssKpiCard label="Monthly Net Pay" value={money(netPay)} subtitle="Latest released payslip" icon={Banknote} accent="#8B5CF6" iconBg="#F5F3FF" />
          <button type="button" onClick={() => onNavigate('payroll')} className="text-left">
            <EssKpiCard label="Payslip Status" value={netPay > 0 ? 'Ready' : 'Pending'} subtitle={`${widgets.payroll.payslips} payslips`} icon={Download} accent="#16A34A" iconBg="#ECFDF5" />
          </button>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* My Approvals */}
          <EssCard className="p-5 sm:p-6">
            <EssSectionHeader
              title="My Approvals"
              action={(
                <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-[13px] font-semibold text-[#2563EB] hover:underline">
                  View all
                </button>
              )}
            />
            {approvalQueue.length ? (
              <div className="space-y-3">
                {approvalQueue.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })}
                    className="flex w-full items-center gap-4 rounded-[16px] border border-[#E2E8F0] bg-[#FBFCFE] p-4 text-left transition hover:border-[#93C5FD] hover:shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[14px] font-bold text-[#2563EB]">
                      {item.employee.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-[#0F172A]">{item.employee}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(item.stage)}`}>{item.stage}</span>
                      </span>
                      <span className="mt-1 block text-[13px] text-[#64748B]">{item.type} · {item.days} day(s) · {item.startDate} to {item.endDate}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#94A3B8]" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-[16px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center text-[14px] text-[#64748B]">No pending approvals right now.</p>
            )}
          </EssCard>

          {/* Workflow Progress */}
          {selectedWorkflow ? (
            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Workflow Progress" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Open workflow</button>} />
              <p className="mb-4 text-[15px] font-bold text-[#0F172A]">{selectedWorkflow.request}</p>
              <div className="flex flex-wrap items-center gap-2">
                {selectedWorkflow.stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-2">
                    <div className={`rounded-[14px] border px-3 py-2 text-center text-[11px] font-bold ${stageTone(stage.state)} ${stage.state === 'current' ? 'animate-pulse' : ''}`}>
                      <p>{stage.label}</p>
                      <p className="mt-0.5 font-medium opacity-80">{stage.owner}</p>
                    </div>
                    {index < selectedWorkflow.stages.length - 1 ? <span className="text-[#94A3B8]">→</span> : null}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Current Approver', selectedWorkflow.approver],
                  ['Priority', selectedWorkflow.priority],
                  ['Status', selectedWorkflow.status],
                  ['SLA', selectedWorkflow.slaStatus],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
                    <p className="mt-1 text-[13px] font-bold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </EssCard>
          ) : null}

          {/* My Tasks + Summary cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="My Tasks" />
              <div className="space-y-2">
                {(workflow?.pendingActions || []).slice(0, 5).map((task) => (
                  <label key={task.id} className="flex items-start gap-3 rounded-[14px] border border-[#E2E8F0] bg-white p-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[#CBD5E1]" readOnly />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-[#0F172A]">{task.title}</span>
                      <span className="mt-1 flex flex-wrap gap-2 text-[12px] text-[#64748B]">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${task.severity === 'high' ? 'bg-[#FEF2F2] text-[#DC2626]' : task.severity === 'medium' ? 'bg-[#FFF7ED] text-[#D97706]' : 'bg-[#F8FAFC] text-[#64748B]'}`}>{task.severity}</span>
                        <span>{task.dueLabel}</span>
                      </span>
                    </span>
                  </label>
                ))}
                {!workflow?.pendingActions?.length ? (
                  <p className="text-[13px] text-[#64748B]">Complete your timesheet and review pending requests.</p>
                ) : null}
              </div>
            </EssCard>

            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Attendance Summary" action={<button type="button" onClick={() => onNavigate('time')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">View details</button>} />
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Clock In', latestClock?.clockIn || '—'],
                  ['Clock Out', latestClock?.clockOut || '—'],
                  ['Worked Hours', `${widgets?.attendance.overtimeHours ? widgets.attendance.overtimeHours + 8 : 8}h`],
                  ['Overtime', `${widgets?.attendance.overtimeHours || 0}h`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] border border-[#E2E8F0] bg-[#FBFCFE] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
                    <p className="mt-1 text-[18px] font-bold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
              {insights ? <div className="mt-4"><EssSparkline data={insights.attendanceTrend.series} color="#22C55E" /></div> : null}
            </EssCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Leave Summary" action={<button type="button" onClick={() => onNavigate('leave')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Calendar</button>} />
              <EssDonutChart
                rows={[
                  { label: 'Available', value: widgets?.leave.balance || 0, color: '#2563EB' },
                  { label: 'Used', value: widgets?.leave.used || 0, color: '#94A3B8' },
                  { label: 'Pending', value: widgets?.leave.pending || 0, color: '#F59E0B' },
                ]}
                centerLabel="Days left"
                centerValue={String(widgets?.leave.balance || 0)}
              />
            </EssCard>

            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Payroll Summary" action={<button type="button" onClick={() => onNavigate('payroll')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Download</button>} />
              <div className="space-y-2">
                <p className="text-[28px] font-bold text-[#0F172A]">{money(netPay)}</p>
                <p className="text-[12px] text-[#64748B]">Net pay · Gross {money((widgets?.payroll.monthlyPay || 0) + (widgets?.payroll.allowances || 0))}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-[12px] bg-[#F8FAFC] p-2"><p className="text-[10px] text-[#94A3B8]">Pension</p><p className="font-bold text-[#0F172A]">{money(widgets?.payroll.pension || 0)}</p></div>
                  <div className="rounded-[12px] bg-[#F8FAFC] p-2"><p className="text-[10px] text-[#94A3B8]">Deductions</p><p className="font-bold text-[#0F172A]">{money(widgets?.payroll.deductions || 0)}</p></div>
                </div>
              </div>
            </EssCard>

            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Benefits Snapshot" />
              <div className="space-y-2 text-[13px]">
                <p className="flex justify-between rounded-[12px] bg-[#ECFDF5] px-3 py-2 font-semibold text-[#16A34A]"><span>Medical Plan</span><span>Active</span></p>
                <p className="flex justify-between rounded-[12px] bg-[#ECFDF5] px-3 py-2 font-semibold text-[#16A34A]"><span>Life Insurance</span><span>Active</span></p>
                <p className="flex justify-between rounded-[12px] bg-[#F8FAFC] px-3 py-2 font-semibold text-[#0F172A]"><span>Loan Balance</span><span>{money(payload?.widgets?.loans.outstanding || 0)}</span></p>
              </div>
            </EssCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Performance" action={<button type="button" onClick={() => onNavigate('performance')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Open</button>} />
              <div className="flex items-center gap-6">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-[#2563EB] bg-[#DBEAFE]">
                  <span className="text-[22px] font-bold text-[#2563EB]">{performanceRating}</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#0F172A]">Rating</p>
                  <p className="text-[13px] text-[#64748B]">{goalsCompleted}/{goalsTotal} goals completed</p>
                  <p className="mt-2 text-[12px] font-semibold text-[#16A34A]">Manager review on track</p>
                </div>
              </div>
            </EssCard>

            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Training" action={<button type="button" onClick={() => onNavigate('learning')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Learning</button>} />
              <p className="text-[28px] font-bold text-[#0F172A]">{trainingPct}%</p>
              <p className="mb-3 text-[13px] text-[#64748B]">Course completion</p>
              <EssProgressBar value={trainingPct} />
              <p className="mt-3 text-[12px] text-[#64748B]">{payload?.learning?.courses?.length || 0} active courses</p>
            </EssCard>
          </div>

          {/* Requests Table */}
          <EssCard className="overflow-hidden p-0">
            <div className="border-b border-[#E2E8F0] px-5 py-4 sm:px-6">
              <EssSectionHeader title="My Requests Overview" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Workflow</button>} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3">Request</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.requests || workflow?.register || []).slice(0, 8).map((row: { id: string; title?: string; request?: string; category?: string; requestType?: string; submittedAt?: string; status: string; approvers?: string[]; currentStage?: string }) => (
                    <tr key={row.id} className="border-t border-[#E2E8F0] transition hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-semibold text-[#0F172A]">{row.title || row.request}</td>
                      <td className="px-5 py-3 text-[#64748B]">{row.category || row.requestType}</td>
                      <td className="px-5 py-3 text-[#64748B]">{row.submittedAt ? dateText(row.submittedAt) : '—'}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(row.status)}`}>{row.status}</span></td>
                      <td className="px-5 py-3 text-[#64748B]">{row.approvers?.[0] || row.currentStage || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </EssCard>

          {/* Recent Activity + AI */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EssCard className="p-5 sm:p-6">
              <EssSectionHeader title="Recent Activity" />
              <div className="space-y-3">
                {(workflow?.auditTimeline || []).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2563EB]" />
                    <div>
                      <p className="text-[14px] font-semibold text-[#0F172A]">{item.action}</p>
                      <p className="text-[12px] text-[#64748B]">{item.actor} · {dateText(item.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </EssCard>

            <div className="rounded-[20px] border border-[#E5E7EB] bg-gradient-to-b from-[#F5F3FF] to-white p-5 sm:p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <EssSectionHeader title="AI Assistant" />
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#8B5CF6] text-white"><Sparkles className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#0F172A]">Hello {firstName}!</p>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-[#475569]">
                    {approvalCount > 0 ? <li>• You have {approvalCount} approval{approvalCount === 1 ? '' : 's'} pending.</li> : null}
                    <li>• {workflow?.aiInsights.delayPrediction || 'Workflow is operating within expected SLA.'}</li>
                    <li>• {workflow?.aiInsights.likelyCompletion || 'Complete your timesheet before cut-off.'}</li>
                    {netPay > 0 ? <li>• Payroll for this period is available.</li> : null}
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-[#8B5CF6] bg-white">
                  <span className="text-[14px] font-bold text-[#8B5CF6]">{workflow?.aiInsights.confidenceScore || 96}%</span>
                </div>
                <p className="text-[13px] text-[#64748B]">Confidence score for workflow recommendations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Inline right column on smaller xl layouts handled by EssRightPanel in shell */}
      </div>

      {showSecurityBanner ? <EssSecurityBanner onManage={() => onNavigate('security')} onDismiss={onDismissSecurity} /> : null}
    </div>
  );
}

export function EssRightPanel({ payload, onNavigate }: { payload: EssDashboardPayload | null; onNavigate: (tab: EssTab, options?: { leaveSection?: string }) => void }) {
  const employee = payload?.employee;
  const manager = payload?.managerMetrics;
  const isManager = (manager?.teamSize || 0) > 0;

  return (
    <div className="space-y-5">
      <EssCard className="p-5">
        <EssSectionHeader title="Notifications" action={<button type="button" className="text-[13px] font-semibold text-[#2563EB]">View all</button>} />
        <div className="mb-3 flex gap-2">
          <span className="rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-white">All</span>
          <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold text-[#64748B]">Unread</span>
        </div>
        <div className="space-y-2">
          {(payload?.notifications || []).slice(0, 4).map((item) => (
            <EssNotificationItem
              key={item.id}
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

      <EssCard className="p-5">
        <EssSectionHeader title="Upcoming Events" action={<button type="button" onClick={() => onNavigate('leave')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Calendar</button>} />
        <div className="space-y-1">
          {(payload?.events || []).map((item) => (
            <EssEventItem key={item.id} label={item.label} date={dateText(item.date)} />
          ))}
        </div>
      </EssCard>

      <EssCard className="p-5">
        <EssSectionHeader title="Company Announcements" />
        <div className="space-y-2">
          {(payload?.announcements || []).slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-[14px] border border-[#E2E8F0] bg-[#FBFCFE] p-3">
              <p className="text-[14px] font-bold text-[#0F172A]">{item.title}</p>
              <p className="mt-1 text-[12px] text-[#64748B]">{item.channel} · {dateText(item.publishedAt)}</p>
            </div>
          ))}
          {!payload?.announcements?.length ? (
            <p className="text-[13px] text-[#64748B]">No new announcements.</p>
          ) : null}
        </div>
      </EssCard>

      {isManager ? (
        <EssCard className="p-5">
          <EssSectionHeader title="My Team" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">Manager view</button>} />
          <div className="grid grid-cols-2 gap-2">
            {([
              ['Team Members', manager?.teamSize || 0, Users],
              ['On Leave', manager?.onLeave || 0, CalendarCheck],
              ['Pending Approval', manager?.pendingApprovals || 0, AlertCircle],
              ['Missing Timesheets', manager?.missingTimesheets || 0, Clock],
              ['Team Attendance', `${manager?.teamAttendancePct || 0}%`, TrendingUp],
              ['Training Today', manager?.trainingToday || 0, GraduationCap],
            ] as const).map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Icon className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
                </div>
                <p className="mt-2 text-[20px] font-bold text-[#0F172A]">{value}</p>
              </div>
            ))}
          </div>
        </EssCard>
      ) : null}

      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <h3 className="text-[15px] font-bold text-[#0F172A]">Employee Summary</h3>
        <p className="mt-0.5 text-[12px] text-[#94A3B8]">{employee?.department || '—'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['Grade', employee?.salaryGrade],
            ['Location', employee?.location],
            ['Payroll', employee?.payrollGroup],
            ['Service', `${employee?.yearsOfService || 0} years`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-[14px] border border-[#E9EEF5] bg-[#F5F8FC] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-[#0F172A]">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
