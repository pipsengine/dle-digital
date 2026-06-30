'use client';

import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Fingerprint,
  GraduationCap,
  Landmark,
  MoreHorizontal,
  Plane,
  Send,
  WalletCards,
  ChevronRight,
} from 'lucide-react';
import {
  EssCard,
  EssDonutChart,
  EssEventItem,
  EssHeroIllustration,
  EssInsightCard,
  EssKpiCard,
  EssNotificationItem,
  EssProgressBar,
  EssQuickActionCard,
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
};

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const money = (value: number) => moneyFmt.format(value || 0);
const moneyShort = (value: number) => {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
  return money(value);
};

const stableDateTime = (value: string) => {
  const iso = new Date(value).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
};

const dateText = (value: string) => {
  const iso = new Date(value).toISOString();
  return `${iso.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};

const notificationIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('leave') || t.includes('workflow')) return { Icon: CalendarCheck, bg: '#ECFDF5', color: '#10B981' };
  if (t.includes('document')) return { Icon: FileText, bg: '#EFF6FF', color: '#2563EB' };
  if (t.includes('payroll')) return { Icon: Banknote, bg: '#F5F3FF', color: '#7C3AED' };
  return { Icon: ClipboardList, bg: '#FFFBEB', color: '#F59E0B' };
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
  const analytics = payload?.dashboardAnalytics;
  const approvalCount = payload?.approvalQueue?.length || 0;
  const firstName = employee?.fullName?.split(' ').find((part) => part.length > 2 && !/^(mr|mrs|ms|dr)\.?$/i.test(part)) || employee?.fullName?.split(' ').pop() || 'there';

  const activityRows = analytics?.activityByCategory || [
    { label: 'Leave', value: 0, color: '#10B981' },
    { label: 'Claims', value: 0, color: '#2563EB' },
    { label: 'Requests', value: 0, color: '#7C3AED' },
    { label: 'Documents', value: 0, color: '#F59E0B' },
    { label: 'Others', value: 0, color: '#94A3B8' },
  ];

  const insights = analytics?.hrInsights || {
    attendanceTrend: { trend: 0, series: [0, 0, 0, 0, 0, widgets?.attendance?.monthRate || 0] },
    leaveUtilization: { trend: 0, series: [0, 0, 0, 0, 0, widgets?.leave?.used || 0] },
    payrollSummary: { netPay: widgets?.payroll?.monthlyPay || 0, label: 'Net Pay' },
    requestsCompleted: { count: widgets?.requests?.approved || 0, trend: 0 },
    trainingProgress: { percent: 0 },
  };

  const netPay = insights.payrollSummary.netPay;

  return (
    <div className="space-y-5">
      <div
        className="overflow-hidden rounded-[20px] shadow-[0_20px_60px_rgba(15,23,42,0.10)]"
        style={{ background: 'linear-gradient(135deg, #0E1B3D 0%, #0F2D6B 35%, #1e40af 70%, #2563EB 100%)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#2563EB]/30 px-3 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20">Standalone ESS Module</span>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[12px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">Cloud-ready</span>
              <span className="text-[12px] text-white/50">Last synchronized: {stableDateTime(payload?.generatedAt || initialNow)}</span>
            </div>
            <h2 className="mt-5 text-[36px] font-bold leading-tight tracking-tight text-white">Welcome back, {firstName} 👋</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">
              Your secure digital workplace for leave, time, payroll, documents, learning, claims, and HR services — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate('services')} className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-white px-5 text-[14px] font-semibold text-[#0F2D6B] shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition hover:bg-white/95">
                <Send className="h-4 w-4" /> New Request
              </button>
              <button type="button" onClick={() => onNavigate('loans')} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-white/25 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                <Landmark className="h-4 w-4" /> Apply for Loan
              </button>
              <button type="button" onClick={() => onNavigate('payroll')} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-white/25 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/20">
                <Download className="h-4 w-4" /> View Payslips
              </button>
            </div>
          </div>
          <div className="relative hidden p-6 lg:block">
            <EssHeroIllustration />
          </div>
        </div>
      </div>

      {widgets ? (
        <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${approvalCount > 0 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          {approvalCount > 0 ? (
            <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-left">
              <EssKpiCard label="Pending Approvals" value={String(approvalCount)} subtitle="Leave requests awaiting your action" icon={ClipboardList} accent="#F59E0B" iconBg="#FFFBEB" />
            </button>
          ) : null}
          <EssKpiCard label="Leave Balance" value={`${widgets.leave.balance} days`} subtitle={`${widgets.leave.used}/${widgets.leave.entitlement} used`} icon={CalendarCheck} accent="#10B981" iconBg="#ECFDF5" />
          <EssKpiCard label="Attendance" value={`${widgets.attendance.monthRate}%`} subtitle={`${widgets.attendance.overtimeHours} overtime hours`} icon={Clock} accent="#2563EB" iconBg="#DBEAFE" />
          <EssKpiCard label="Monthly Pay" value={money(widgets.payroll.monthlyPay)} subtitle="Latest released net pay" icon={Banknote} accent="#7C3AED" iconBg="#F5F3FF" />
          <EssKpiCard label="Requests" value={String(widgets.requests.pending)} subtitle={`${widgets.requests.approved} approved, ${widgets.requests.total} total`} icon={ClipboardList} accent="#F59E0B" iconBg="#FFFBEB" />
        </section>
      ) : null}

      {(payload?.approvalQueue || []).length ? (
        <EssCard className="p-5 sm:p-6">
          <EssSectionHeader
            title="Pending Approvals"
            action={(
              <button type="button" onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })} className="text-[13px] font-semibold text-[#2563EB] hover:underline">
                Open leave approvals
              </button>
            )}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payload?.approvalQueue?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('leave', { leaveSection: 'Approvals' })}
                className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-100/70"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{item.stage}</p>
                <p className="mt-2 text-[16px] font-bold text-[#0F172A]">{item.employee}</p>
                <p className="mt-1 text-[13px] font-semibold text-[#475569]">{item.type} · {item.days} day(s)</p>
                <p className="mt-1 text-[12px] text-[#64748B]">{item.startDate} to {item.endDate}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]">
                  Review in ESS <ChevronRight className="h-3.5 w-3.5" />
                </p>
              </button>
            ))}
          </div>
        </EssCard>
      ) : null}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <EssCard className="p-5 sm:p-6">
          <EssSectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { title: 'Apply Leave', desc: 'Request time off', icon: CalendarCheck, tab: 'leave' as EssTab, accent: '#10B981', bg: '#ECFDF5' },
              { title: 'Clock In / Out', desc: 'Record attendance', icon: Fingerprint, tab: 'time' as EssTab, accent: '#2563EB', bg: '#DBEAFE' },
              { title: 'Submit Claim', desc: 'Expense & benefits', icon: WalletCards, tab: 'claims' as EssTab, accent: '#F97316', bg: '#FFF7ED' },
              { title: 'Request Letter', desc: 'HR correspondence', icon: FileText, tab: 'services' as EssTab, accent: '#7C3AED', bg: '#F5F3FF' },
              { title: 'Enroll Training', desc: 'Learning programs', icon: GraduationCap, tab: 'learning' as EssTab, accent: '#06B6D4', bg: '#ECFEFF' },
              { title: 'Report Asset', desc: 'Equipment issues', icon: BriefcaseBusiness, tab: 'assets' as EssTab, accent: '#10B981', bg: '#ECFDF5' },
              { title: 'Travel Request', desc: 'Trip authorization', icon: Plane, tab: 'travel' as EssTab, accent: '#2563EB', bg: '#DBEAFE' },
              { title: 'Track Workflow', desc: 'Approval status', icon: ClipboardList, tab: 'workflow' as EssTab, accent: '#F59E0B', bg: '#FFFBEB' },
            ].map((action) => (
              <EssQuickActionCard key={action.title} title={action.title} description={action.desc} icon={action.icon} accent={action.accent} iconBg={action.bg} onClick={() => onNavigate(action.tab)} />
            ))}
          </div>
        </EssCard>

        <EssCard className="p-5 sm:p-6">
          <EssSectionHeader title="My Activity Overview" action={<button type="button" onClick={() => onNavigate('workflow')} className="text-[13px] font-semibold text-[#2563EB] hover:underline">View all</button>} />
          <EssDonutChart rows={activityRows} centerLabel="Total Activities" centerValue={String(analytics?.totalActivities ?? activityRows.reduce((s, r) => s + r.value, 0))} />
        </EssCard>
      </section>

      <section>
        <EssSectionHeader title="HR Insights" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <EssInsightCard label="Attendance Trend" trend={insights.attendanceTrend.trend}>
            <EssSparkline data={insights.attendanceTrend.series} color="#10B981" />
          </EssInsightCard>
          <EssInsightCard label="Leave Utilization" trend={insights.leaveUtilization.trend}>
            <EssSparkline data={insights.leaveUtilization.series} color="#EF4444" />
          </EssInsightCard>
          <EssInsightCard label="Payroll Summary">
            <p className="text-[22px] font-bold text-[#0F172A]">{moneyShort(netPay)}</p>
            <p className="text-[12px] text-[#94A3B8]">{insights.payrollSummary.label}</p>
          </EssInsightCard>
          <EssInsightCard label="Requests Completed" trend={insights.requestsCompleted.trend}>
            <p className="text-[28px] font-bold text-[#0F172A]">{insights.requestsCompleted.count}</p>
          </EssInsightCard>
          <EssInsightCard label="Training Progress">
            <p className="mb-2 text-[22px] font-bold text-[#0F172A]">{insights.trainingProgress.percent}%</p>
            <EssProgressBar value={insights.trainingProgress.percent} />
          </EssInsightCard>
        </div>
      </section>

      {showSecurityBanner ? <EssSecurityBanner onManage={() => onNavigate('security')} onDismiss={onDismissSecurity} /> : null}
    </div>
  );
}

export function EssRightPanel({ payload, onNavigate }: { payload: EssDashboardPayload | null; onNavigate: (tab: EssTab, options?: { leaveSection?: string }) => void }) {
  const employee = payload?.employee;

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[12px] font-medium text-emerald-600">Online</span>
          </div>
          <button type="button" onClick={() => onNavigate('profile')} aria-label="Open profile" className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F5F8FC] hover:text-[#475569]">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <h3 className="mt-3 text-[15px] font-bold text-[#0F172A]">Employee Summary</h3>
        <p className="mt-0.5 text-[12px] text-[#94A3B8]">{employee?.department || '—'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['Grade', employee?.salaryGrade],
            ['Location', employee?.location],
            ['Payroll', employee?.payrollGroup],
            ['Service', `${employee?.yearsOfService || 0} years`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[14px] border border-[#E9EEF5] bg-[#F5F8FC] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-[#0F172A]">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <EssCard className="p-5">
        <EssSectionHeader title="My Tasks & Notifications" action={<button type="button" className="text-[13px] font-semibold text-[#2563EB] hover:underline">View all</button>} />
        <div className="space-y-2">
          {(payload?.notifications || []).slice(0, 4).map((item) => {
            const { Icon, bg, color } = notificationIcon(item.type);
            const openItem = () => {
              if (item.href) {
                if (item.href.includes('tab=leave')) {
                  const leaveSection = item.href.includes('leaveSection=Approvals') ? 'Approvals' : 'applications';
                  onNavigate('leave', { leaveSection });
                  return;
                }
                if (item.href.includes('tab=profile')) {
                  onNavigate('profile');
                  return;
                }
                if (item.href.includes('tab=payroll')) {
                  onNavigate('payroll');
                  return;
                }
              }
              if (/leave|workflow|approval/i.test(`${item.type} ${item.title}`)) {
                onNavigate('leave', { leaveSection: /approval required/i.test(item.title) ? 'Approvals' : 'applications' });
                return;
              }
              if (/profile/i.test(item.title)) {
                onNavigate('profile');
                return;
              }
              if (/payroll|payslip/i.test(`${item.type} ${item.title}`)) {
                onNavigate('payroll');
              }
            };
            return (
              <EssNotificationItem
                key={item.id}
                title={item.title}
                meta={`${item.type} · ${dateText(item.createdAt)}`}
                status={item.status}
                icon={Icon}
                iconBg={bg}
                iconColor={color}
                onClick={openItem}
              />
            );
          })}
        </div>
        <div className="mt-3 space-y-1.5">
          {payload?.birthdays?.map((item) => (
            <p key={item.id} className="text-[12px] font-semibold text-[#10B981]">Birthday: {item.fullName} — {dateText(item.date)}</p>
          ))}
          {payload?.anniversaries?.map((item) => (
            <p key={item.id} className="text-[12px] font-semibold text-[#F59E0B]">Anniversary: {item.fullName} — {item.years} yrs</p>
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
    </div>
  );
}
