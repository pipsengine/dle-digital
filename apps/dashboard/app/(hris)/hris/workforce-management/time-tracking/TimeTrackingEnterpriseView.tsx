'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  Banknote,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History,
  LayoutGrid,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { AnalyticsCard } from '../../payroll/overtime-pay/overtime-pay-ui';
import { DonutChart, HorizontalBarChart, MetadataPill } from '../../payroll/employee-salary-setup/salary-setup-ui';
import { DualLineChart, HealthScoreRing } from '../../payroll/salary-structure/salary-structure-ui';
import { SimpleLineChart } from '../shift-and-scheduling/shift-scheduling-ui';
import type { TimeRecordRow } from './TimeTrackingClient';
import {
  AiOperationsCenter,
  AttendanceSourceStatus,
  BulkActionToolbar,
  EmployeeAvatar,
  ExceptionCountBadge,
  LiveWorkforceStatus,
  RowActionsButton,
  TimeKpiStrip,
  TimePageIcon,
  TimeStatusBadge,
  TimeTrackingWorkflow,
  WorkforceUtilizationPanel,
} from './time-tracking-ui';
import type { SetupTone } from '../../payroll/employee-salary-setup/salary-setup-ui';

export type TimeTrackingEnterpriseViewProps = {
  initialNow: string;
  loading: boolean;
  error: string;
  toast: string;
  payloadGeneratedAt?: string;
  source?: string;
  role: string;
  roles: string[];
  onRoleChange: (role: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  canExport: boolean;
  summary: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    timesheetHours: number;
    overtimeHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    productivityPct: number;
    attendanceExceptions: number;
  };
  workflowStages: Array<{ id: string; label: string; pct: number; count: string; owner: string; status: 'completed' | 'waiting' | 'pending' }>;
  overallCompletion: number;
  liveStatus: Array<{ label: string; count: number; pct: number; tone: SetupTone }>;
  aiOperations: Array<{ label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }>;
  utilizationPct: number;
  utilizationMetrics: Array<{ label: string; value: string }>;
  dateRangeLabel: string;
  groupBy: string;
  onGroupByChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  department: string;
  onDepartmentChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  employeeFilter: string;
  onEmployeeFilterChange: (value: string) => void;
  departmentOptions: string[];
  locationOptions: string[];
  employeeOptions: string[];
  compactView: boolean;
  onCompactViewChange: (value: boolean) => void;
  records: TimeRecordRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectedRows: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAllPage: () => void;
  onBulkAction: (action: string) => void;
  bulkBusy: string;
  attendanceTrend: { labels: string[]; seriesA: number[]; seriesB: number[] };
  overtimeTrend: { labels: string[]; values: number[] };
  departmentProductivity: Array<{ label: string; value: number; color?: string }>;
  exceptionTrend: { labels: string[]; values: number[] };
  topProjects: Array<{ label: string; value: number; color?: string }>;
  payrollReadiness: { ready: number; total: number };
  labourForecast: number;
  productivityIndex: number;
  number: (value: number) => string;
  hours: (value: number) => string;
  money: (value: number) => string;
};

const inputClass =
  'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#0F172A] outline-none transition-shadow focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20';

const REGISTER_HEADERS = [
  { id: 'select', label: '' },
  { id: 'employee', label: 'Employee' },
  { id: 'workcenter', label: 'Work Center / Department' },
  { id: 'clock', label: 'Clock In / Clock Out' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'project', label: 'Project / Task / Cost Centre' },
  { id: 'hrs', label: 'HRS' },
  { id: 'ot', label: 'OT' },
  { id: 'idle', label: 'Idle' },
  { id: 'status', label: 'Status' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'actions', label: '' },
] as const;

export function TimeTrackingEnterpriseView(props: TimeTrackingEnterpriseViewProps) {
  const totalPages = Math.max(1, Math.ceil(props.totalRows / props.pageSize));
  const pageStart = props.totalRows ? (props.page - 1) * props.pageSize + 1 : 0;
  const pageEnd = Math.min(props.page * props.pageSize, props.totalRows);
  const allPageSelected = props.records.length > 0 && props.records.every((r) => props.selectedRows.has(r.id));
  const payrollPct = props.payrollReadiness.total
    ? Math.round((props.payrollReadiness.ready / props.payrollReadiness.total) * 100)
    : 0;

  const kpiItems = [
    {
      label: 'Employees',
      value: props.number(props.summary.totalEmployees),
      subtitle: 'Active workforce directory',
      icon: Users,
      tone: 'blue' as SetupTone,
      trend: 4.2,
    },
    {
      label: 'Attendance Today',
      value: props.number(props.summary.presentToday),
      subtitle: `${props.number(props.summary.lateToday)} late · ${props.number(props.summary.absentToday)} absent`,
      icon: CalendarCheck,
      tone: 'green' as SetupTone,
      trend: -7.1,
    },
    {
      label: 'Timesheet Hours',
      value: props.hours(props.summary.timesheetHours),
      subtitle: `${props.hours(props.summary.overtimeHours)} overtime`,
      icon: Clock,
      tone: 'cyan' as SetupTone,
      trend: 8.4,
    },
    {
      label: 'Pending Approvals',
      value: props.number(props.summary.pendingApprovals),
      subtitle: 'Workflow queue',
      icon: BadgeCheck,
      tone: 'amber' as SetupTone,
      trend: -3.3,
    },
    {
      label: 'Payroll Ready',
      value: props.hours(props.summary.payrollReadyHours),
      subtitle: 'Approved workforce hours',
      icon: Banknote,
      tone: 'violet' as SetupTone,
      trend: 5.6,
    },
    {
      label: 'Productivity',
      value: `${props.summary.productivityPct}%`,
      subtitle: `${props.number(props.summary.attendanceExceptions)} exceptions`,
      icon: TrendingUp,
      tone: (props.summary.productivityPct >= 70 ? 'green' : 'red') as SetupTone,
      trend: -2.8,
    },
  ];

  return (
    <div className="min-h-full bg-[#F8FAFC] pb-8">
      <div className="mx-auto max-w-[1680px] px-6 pt-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <TimePageIcon />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#0F172A]">Time Tracking Command Center</h1>
                  <Star className="h-5 w-5 text-[#F59E0B]" />
                </div>
                <p className="mt-2 max-w-4xl text-[15px] font-medium leading-[1.4] text-[#475569]">
                  Track attendance, project hours, job costing, field activities, productivity and payroll readiness.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">Live</span>
                  <span className="inline-flex items-center rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">DLE Enterprise HRIS</span>
                  <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">Biometric Sync: Active</span>
                  <MetadataPill label="Last updated" value={new Date(props.payloadGeneratedAt || props.initialNow).toLocaleString('en-GB')} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={props.role} onChange={(e) => props.onRoleChange(e.target.value)} className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] outline-none focus:border-[#2563EB]">
              {props.roles.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" onClick={props.onRefresh} disabled={props.loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-60">
              <RefreshCcw className={`h-4 w-4 ${props.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={props.onExport} disabled={!props.canExport} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]">
              <History className="h-4 w-4" />
              View History
            </button>
            <Link href="/hris/workforce-management/shift-and-scheduling" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F172A] px-4 text-sm font-semibold text-white hover:bg-[#1E293B]">
              Schedule Shift
            </Link>
          </div>
        </div>

        {props.error ? <div className="mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{props.error}</div> : null}
        {props.toast ? <div className="mt-5 rounded-xl border border-[#93C5FD] bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1D4ED8]">{props.toast}</div> : null}

        {/* KPI strip */}
        <div className="mt-6">
          <TimeKpiStrip items={kpiItems} />
        </div>

        {/* Workflow + middle panels */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            <TimeTrackingWorkflow stages={props.workflowStages} overallPct={props.overallCompletion} />
            <LiveWorkforceStatus items={props.liveStatus} />
          </div>
          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <AiOperationsCenter items={props.aiOperations} />
            <AttendanceSourceStatus
              items={[
                { label: 'Biometric System', status: 'Synced', tone: 'green' },
                { label: 'Mobile Capture', status: 'Live', tone: 'green' },
                { label: 'Timesheet System', status: 'Live', tone: 'blue' },
                { label: 'HRIS Core', status: 'Synced', tone: 'green' },
                { label: 'Payroll Integration', status: 'Ready', tone: 'violet' },
              ]}
            />
            <WorkforceUtilizationPanel utilizationPct={props.utilizationPct} metrics={props.utilizationMetrics} />
          </aside>
        </div>

        {/* Register workspace */}
        <section className="mt-6 overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#EDF2F7] px-5 py-4">
            <h2 className="text-xl font-semibold text-[#0F172A]">Employee Time Tracking Register</h2>
            <p className="mt-1 text-xs font-medium text-[#64748B]">Live attendance, timesheet capture, project allocation, approval status, payroll readiness, and exceptions.</p>
          </div>

          {/* Filter bar */}
          <div className="border-b border-[#EDF2F7] px-5 py-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,220px)_repeat(4,minmax(140px,1fr))_auto_auto]">
              <span className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#0F172A]">
                {props.dateRangeLabel}
              </span>
              <select value={props.groupBy} onChange={(e) => props.onGroupByChange(e.target.value)} className={inputClass}>
                {['Work Center', 'Department', 'Location', 'Shift'].map((opt) => (
                  <option key={opt} value={opt}>{opt === props.groupBy ? `Group By: ${opt}` : opt}</option>
                ))}
              </select>
              <select value={props.department} onChange={(e) => props.onDepartmentChange(e.target.value)} className={inputClass}>
                {props.departmentOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === 'All' ? 'Department' : opt}</option>
                ))}
              </select>
              <select value={props.location} onChange={(e) => props.onLocationChange(e.target.value)} className={inputClass}>
                {props.locationOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === 'All' ? 'Location' : opt}</option>
                ))}
              </select>
              <select value={props.employeeFilter} onChange={(e) => props.onEmployeeFilterChange(e.target.value)} className={inputClass}>
                {props.employeeOptions.slice(0, 50).map((opt) => (
                  <option key={opt} value={opt}>{opt === 'All' ? 'Employee' : opt}</option>
                ))}
              </select>
              <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]">
                <SlidersHorizontal className="h-4 w-4" />
                More Filters
              </button>
              <button
                type="button"
                onClick={() => props.onCompactViewChange(!props.compactView)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${props.compactView ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC]'}`}
              >
                <LayoutGrid className="h-4 w-4" />
                Compact
              </button>
            </div>
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)} placeholder="Search employee, department, site, project..." className={`${inputClass} pl-10 pr-10`} />
              {props.query ? (
                <button type="button" onClick={() => props.onQueryChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="px-5 pt-4">
            <BulkActionToolbar selectedCount={props.selectedRows.size} onAction={props.onBulkAction} busy={props.bulkBusy} />
          </div>

          <div className="max-h-[560px] overflow-auto px-5 pb-4">
            <table className="min-w-[1400px] w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                <tr>
                  {REGISTER_HEADERS.map((head) => (
                    <th
                      key={head.id}
                      className={`px-3 py-3 ${head.id === 'employee' ? 'sticky left-10 z-20 min-w-[180px] bg-[#F8FAFC]' : ''} ${head.id === 'select' ? 'sticky left-0 z-30 w-10 bg-[#F8FAFC]' : ''}`}
                    >
                      {head.id === 'select' ? (
                        <input type="checkbox" checked={allPageSelected} onChange={props.onToggleAllPage} className="rounded border-[#CBD5E1]" aria-label="Select all on page" />
                      ) : (
                        head.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y divide-[#EDF2F7] bg-white text-[15px] ${props.compactView ? 'text-[13px]' : ''}`}>
                {props.records.map((record) => {
                  const selected = props.selectedRows.has(record.id);
                  return (
                    <tr key={record.id} className={`transition-colors hover:bg-[#F8FAFC] ${selected ? 'bg-[#EFF6FF]' : ''}`}>
                      <td className={`sticky left-0 z-[1] px-3 py-3 ${selected ? 'bg-[#EFF6FF]' : 'bg-white'}`}>
                        <input type="checkbox" checked={selected} onChange={() => props.onToggleRow(record.id)} className="rounded border-[#CBD5E1]" />
                      </td>
                      <td className={`sticky left-10 z-[1] px-3 py-3 ${selected ? 'bg-[#EFF6FF]' : 'bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar name={record.employeeName} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-[#0F172A]">{record.employeeName}</div>
                            <div className="truncate text-xs font-medium text-[#64748B]">{record.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#0F172A]">{record.site || record.location}</div>
                        <div className="text-xs text-[#64748B]">{record.department}</div>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="font-semibold text-[#0F172A]">IN: {record.timeIn || '—'}</div>
                        <div className="text-[#64748B]">OUT: {record.timeOut || '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <TimeStatusBadge label={record.attendanceStatus} kind="attendance" />
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="font-medium text-[#2563EB]">{record.projectCode}</div>
                        <div className="text-xs text-[#64748B]">{record.costCentre}</div>
                      </td>
                      <td className="px-3 py-3 font-bold text-[#0F172A]">{props.number(record.hoursWorked)}</td>
                      <td className="px-3 py-3 font-bold text-[#F97316]">{props.number(record.overtimeHours)}</td>
                      <td className="px-3 py-3 font-medium text-[#64748B]">{props.number(record.idleHours)}</td>
                      <td className="px-3 py-3">
                        <TimeStatusBadge label={record.timeStatus} kind="workflow" />
                      </td>
                      <td className="px-3 py-3">
                        <TimeStatusBadge label={record.payrollStatus} kind="payroll" />
                      </td>
                      <td className="px-3 py-3">
                        <ExceptionCountBadge count={record.exceptions.length} />
                      </td>
                      <td className="px-3 py-3">
                        <RowActionsButton />
                      </td>
                    </tr>
                  );
                })}
                {!props.records.length ? (
                  <tr>
                    <td colSpan={REGISTER_HEADERS.length} className="px-4 py-12 text-center text-sm font-medium text-[#64748B]">
                      {props.loading ? 'Loading time tracking records…' : 'No records match the current filters.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EDF2F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-[#64748B]">
              Showing {pageStart} to {pageEnd} of {props.number(props.totalRows)} entries
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => props.onPageChange(p)}
                  className={`inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                    props.page === p ? 'bg-[#2563EB] text-white' : 'border border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button type="button" disabled={props.page >= totalPages} onClick={() => props.onPageChange(props.page + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Bottom analytics */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <AnalyticsCard title="Attendance Trend">
            <DualLineChart labels={props.attendanceTrend.labels} seriesA={props.attendanceTrend.seriesA} seriesB={props.attendanceTrend.seriesB} nameA="This Week" nameB="Last Week" />
          </AnalyticsCard>
          <AnalyticsCard title="Overtime Trend [HRS]">
            <SimpleLineChart values={props.overtimeTrend.values} labels={props.overtimeTrend.labels} />
          </AnalyticsCard>
          <AnalyticsCard title="Department Productivity">
            <HorizontalBarChart rows={props.departmentProductivity} />
          </AnalyticsCard>
          <AnalyticsCard title="Payroll Readiness">
            <DonutChart
              rows={[
                { label: 'Ready', value: props.payrollReadiness.ready, color: '#10B981' },
                { label: 'Pending', value: Math.max(props.payrollReadiness.total - props.payrollReadiness.ready, 0), color: '#F59E0B' },
              ]}
              centerValue={`${payrollPct}%`}
              centerLabel="Ready"
            />
          </AnalyticsCard>
          <AnalyticsCard title="Exception Trend">
            <SimpleLineChart values={props.exceptionTrend.values} labels={props.exceptionTrend.labels} />
          </AnalyticsCard>
          <AnalyticsCard title="Top Projects by Hours">
            <HorizontalBarChart rows={props.topProjects} />
          </AnalyticsCard>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnalyticsCard title="Labour Cost Forecast">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[#0F172A]">{props.money(props.labourForecast * 1_000_000)}</p>
                <p className="mt-1 text-sm font-medium text-[#10B981]">+6.3% forecast vs prior period</p>
              </div>
              <SimpleLineChart values={[18, 20, 19, 22, 24, 24.8]} labels={['W1', 'W2', 'W3', 'W4', 'W5', 'W6']} />
            </div>
          </AnalyticsCard>
          <AnalyticsCard title="Productivity Index">
            <div className="flex items-center justify-center gap-6 py-4">
              <HealthScoreRing score={props.productivityIndex} size={88} />
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Workforce productivity index</p>
                <p className="mt-1 text-xs text-[#10B981]">+5.2% vs last week</p>
              </div>
            </div>
          </AnalyticsCard>
        </div>
      </div>
    </div>
  );
}
