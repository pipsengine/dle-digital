'use client';

import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react';
import { AnalyticsCard } from '../../payroll/overtime-pay/overtime-pay-ui';
import { DonutChart, HorizontalBarChart, MetadataPill, WorkspaceTabs } from '../../payroll/employee-salary-setup/salary-setup-ui';
import type { CalendarRow, ShiftScheduleRow, ViewMode } from './ShiftSchedulingClient';
import {
  AiRecommendations,
  defaultShiftActionItems,
  EmployeeAvatar,
  HolidaysTimeline,
  MobileRosterPreview,
  RowActionsButton,
  shiftCellStyles,
  ShiftActionsList,
  ShiftCard,
  ShiftKpiStrip,
  ShiftPageIcon,
  ShiftPanel,
  SimpleLineChart,
} from './shift-scheduling-ui';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';

export type ShiftSchedulingEnterpriseViewProps = {
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
  canSchedule: boolean;
  onPublishRoster: () => void;
  publishBusy: boolean;
  draftCount: number;
  summary: {
    totalEmployees: number;
    scheduledToday: number;
    timesheetHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    productivityPct: number;
  };
  tab: string;
  onTabChange: (tab: string) => void;
  tabBadges?: Partial<Record<string, number>>;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  rangeLabel: string;
  dayHeaders: Array<{ id: string; label: string; date: number }>;
  showCalendarControls: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  shiftSchedules: ShiftScheduleRow[];
  visibleSchedules: ShiftScheduleRow[];
  rosterFilter: 'all' | 'draft' | 'published';
  onRosterFilterChange: (value: 'all' | 'draft' | 'published') => void;
  query: string;
  onQueryChange: (value: string) => void;
  department: string;
  onDepartmentChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  workCenter: string;
  onWorkCenterChange: (value: string) => void;
  departmentOptions: string[];
  locationOptions: string[];
  workCenterOptions: string[];
  calendarRows: CalendarRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  coverageStats: { staffed: number; understaffed: number; uncovered: number; pct: number };
  aiRecommendations: Array<{ label: string; count: number; tone: 'red' | 'amber' | 'blue' }>;
  shiftDistribution: Array<{ label: string; value: number; color?: string }>;
  departmentCoverage: Array<{ label: string; value: number; color?: string }>;
  overtimeTrend: { labels: string[]; values: number[] };
  absenceSummary: Array<{ label: string; value: number; color?: string }>;
  number: (value: number) => string;
  hours: (value: number) => string;
};

const inputClass =
  'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#0F172A] outline-none transition-shadow focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20';

const WORKSPACE_TABS = [
  { id: 'shifts', label: 'Shifts' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'templates', label: 'Templates' },
  { id: 'rotations', label: 'Rotations' },
  { id: 'shift-trades', label: 'Shift Trades' },
  { id: 'rules', label: 'Rules' },
] as const;

const VIEW_MODES = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: '2week', label: '2 Week' },
  { id: 'month', label: 'Month' },
] as const;

const SHIFT_TEMPLATES = [
  { id: 'day', name: 'Day Shift', time: '08:00 – 16:00', hours: 8, color: shiftCellStyles.day.text },
  { id: 'evening', name: 'Evening Shift', time: '16:00 – 00:00', hours: 8, color: shiftCellStyles.evening.text },
  { id: 'night', name: 'Night Shift', time: '00:00 – 08:00', hours: 8, color: shiftCellStyles.night.text },
  { id: 'split', name: 'Split Shift', time: '06:00 – 14:00 / 14:00 – 22:00', hours: 16, color: '#2563EB' },
];

const ROTATION_PATTERNS = [
  { id: '2-2-3', name: '2-2-3 Rotation', cycle: '2 days on · 2 off · 3 on', departments: 'Production, Welding' },
  { id: '4-on-4-off', name: '4 On / 4 Off', cycle: '4 consecutive shifts then 4 rest days', departments: 'Fabrication' },
  { id: 'panama', name: 'Panama Schedule', cycle: '2-2-3 with alternating weekends', departments: 'Operations' },
];

const SHIFT_TRADES = [
  { id: 'st-1', from: 'ITORO SAVIOUR', to: 'JIMMY UDO', date: '2026-06-25', shift: 'Day Shift', status: 'Pending' },
  { id: 'st-2', from: 'JEREMIAH DAVID', to: 'TIMOTHY O. ADEKANMI', date: '2026-06-26', shift: 'Evening Shift', status: 'Pending' },
  { id: 'st-3', from: 'TORTIN DUBU', to: 'ITORO SAVIOUR', date: '2026-06-27', shift: 'Day Shift', status: 'Approved' },
  { id: 'st-4', from: 'JIMMY UDO', to: 'JEREMIAH DAVID', date: '2026-06-28', shift: 'Night Shift', status: 'Pending' },
  { id: 'st-5', from: 'TIMOTHY O. ADEKANMI', to: 'TORTIN DUBU', date: '2026-06-29', shift: 'Day Shift', status: 'Pending' },
];

const SCHEDULING_RULES = [
  { id: 'max-hours', rule: 'Maximum 12 hours per shift', scope: 'All departments', status: 'Active' },
  { id: 'rest-period', rule: 'Minimum 11 hours rest between shifts', scope: 'All employees', status: 'Active' },
  { id: 'ot-cap', rule: 'Overtime capped at 20 hours per week', scope: 'Operations', status: 'Active' },
  { id: 'weekend', rule: 'Weekend shifts require supervisor approval', scope: 'Production', status: 'Active' },
  { id: 'skill-match', rule: 'Skill certification required for night shift', scope: 'Welding, Fabrication', status: 'Enforced' },
];

const statusChipClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'published' || normalized === 'approved' || normalized === 'active' || normalized === 'enforced') {
    return 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]';
  }
  if (normalized === 'draft' || normalized === 'pending') {
    return 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]';
  }
  if (normalized === 'conflict' || normalized === 'rejected') {
    return 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]';
  }
  return 'border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]';
};

function ScheduleTable({ rows, emptyMessage }: { rows: ShiftScheduleRow[]; emptyMessage: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-6 py-12 text-center text-sm font-medium text-[#64748B]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[16px] border border-[#EDF2F7]">
      <table className="min-w-[960px] w-full text-left">
        <thead className="bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
          <tr>
            {['Employee', 'Department / Site', 'Shift', 'Period', 'Time', 'Supervisor', 'Status', 'Notes'].map((head) => (
              <th key={head} className="px-4 py-3">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EDF2F7] bg-white text-[15px]">
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-[#F8FAFC]">
              <td className="px-4 py-3">
                <div className="font-semibold text-[#0F172A]">{item.employeeName}</div>
                <div className="text-xs text-[#64748B]">{item.employeeId}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-[#475569]">{item.department}</div>
                <div className="text-xs text-[#64748B]">{item.site}</div>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                  {item.shift}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-[#475569]">
                {item.startDate} to {item.endDate}
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-[#0F172A]">
                {item.scheduledStart.slice(0, 5)} – {item.scheduledEnd.slice(0, 5)}
              </td>
              <td className="px-4 py-3 text-sm text-[#475569]">{item.supervisor}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChipClass(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-[#64748B]">{item.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const UPCOMING_HOLIDAYS = [
  { date: 'Jun 16, 2026', label: 'Eid al-Adha' },
  { date: 'Oct 1, 2026', label: 'Independence Day' },
  { date: 'Dec 25, 2026', label: 'Christmas Day' },
];

export function ShiftSchedulingEnterpriseView(props: ShiftSchedulingEnterpriseViewProps) {
  const kpiItems = [
    {
      label: 'Total Employees',
      value: props.number(props.summary.totalEmployees),
      subtitle: 'Active workforce directory',
      icon: Users,
      tone: 'blue' as Tone,
      trend: 1.2,
    },
    {
      label: 'Scheduled Today',
      value: props.number(props.summary.scheduledToday),
      subtitle: 'Published roster coverage',
      icon: CalendarCheck,
      tone: 'green' as Tone,
      trend: 3.4,
    },
    {
      label: 'Timesheet Hours',
      value: props.hours(props.summary.timesheetHours),
      subtitle: 'Captured this period',
      icon: CalendarCheck,
      tone: 'cyan' as Tone,
      trend: 2.1,
    },
    {
      label: 'Pending Approvals',
      value: props.number(props.summary.pendingApprovals),
      subtitle: 'Awaiting supervisor / HR',
      icon: CalendarCheck,
      tone: 'amber' as Tone,
      trend: -0.8,
    },
    {
      label: 'Payroll Ready',
      value: props.hours(props.summary.payrollReadyHours),
      subtitle: 'Approved for payroll',
      icon: CalendarCheck,
      tone: 'violet' as Tone,
      trend: 4.2,
    },
    {
      label: 'Productivity',
      value: `${props.summary.productivityPct}%`,
      subtitle: 'Workforce productivity index',
      icon: Users,
      tone: (props.summary.productivityPct >= 70 ? 'green' : 'red') as Tone,
      trend: -1.5,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(props.totalRows / props.pageSize));
  const pageStart = props.totalRows ? (props.page - 1) * props.pageSize + 1 : 0;
  const pageEnd = Math.min(props.page * props.pageSize, props.totalRows);
  const calendarColSpan = props.dayHeaders.length + 4;

  return (
    <div className="min-h-full bg-[#F8FAFC] pb-8">
      <div className="mx-auto max-w-[1680px] px-6 pt-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <ShiftPageIcon />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#0F172A]">Shift & Scheduling</h1>
                  <Star className="h-5 w-5 text-[#F59E0B]" />
                </div>
                <p className="mt-2 max-w-4xl text-[15px] font-medium leading-[1.4] text-[#475569]">
                  Plan, manage, and optimize shifts, schedules, and workforce coverage across locations.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">
                    Live
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">
                    DLE Enterprise HRIS
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">
                    Biometric Sync: Active
                  </span>
                  <MetadataPill
                    label="Last updated"
                    value={new Date(props.payloadGeneratedAt || props.initialNow).toLocaleString('en-GB')}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={props.role}
              onChange={(e) => props.onRoleChange(e.target.value)}
              className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#0F172A] outline-none focus:border-[#2563EB]"
            >
              {props.roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={props.onRefresh}
              disabled={props.loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${props.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              disabled={!props.canSchedule}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              Schedule Shift
            </button>
            <button
              type="button"
              onClick={props.onPublishRoster}
              disabled={!props.canSchedule || props.publishBusy || !props.draftCount}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#2563EB] bg-white px-4 text-sm font-semibold text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-50"
            >
              Publish Roster
              {props.draftCount ? (
                <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">{props.draftCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={props.onExport}
              disabled={!props.canExport}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F172A] px-4 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {props.error ? (
          <div className="mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{props.error}</div>
        ) : null}
        {props.toast ? (
          <div className="mt-5 rounded-xl border border-[#93C5FD] bg-[#DBEAFE] px-4 py-3 text-sm font-semibold text-[#1D4ED8]">{props.toast}</div>
        ) : null}

        {/* KPI strip */}
        <div className="mt-6">
          <ShiftKpiStrip items={kpiItems} />
        </div>

        {/* Workspace */}
        <div className="mt-6">
          <ShiftPanel
            title="Shift & Scheduling Workspace"
            subtitle="Create shift assignments, publish rosters, monitor workforce coverage by department/location, and maintain scheduling auditability."
          >
            <WorkspaceTabs
              tabs={[...WORKSPACE_TABS]}
              active={props.tab}
              onChange={props.onTabChange}
              badges={props.tabBadges}
            />

            {/* Control bar — calendar navigation only on Shifts tab */}
            {props.showCalendarControls ? (
              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {VIEW_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => props.onViewModeChange(mode.id)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        props.viewMode === mode.id
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={props.onPrevWeek} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC]">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="inline-flex h-10 min-w-[200px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#0F172A]">
                    {props.rangeLabel}
                  </span>
                  <button type="button" onClick={props.onNextWeek} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569] hover:bg-[#F8FAFC]">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium text-[#64748B]">
                {props.tab === 'assignments' && 'Review and manage individual shift assignments across employees.'}
                {props.tab === 'rosters' && 'Publish and monitor roster schedules by draft or published status.'}
                {props.tab === 'templates' && 'Reusable shift templates for quick roster building.'}
                {props.tab === 'rotations' && 'Rotation patterns applied across departments and work centers.'}
                {props.tab === 'shift-trades' && 'Pending and approved shift swap requests between employees.'}
                {props.tab === 'rules' && 'Scheduling policy rules enforced during assignment and publication.'}
              </p>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_repeat(3,minmax(140px,180px))_auto]">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={props.query}
                  onChange={(e) => props.onQueryChange(e.target.value)}
                  placeholder="Search employee..."
                  className={`${inputClass} pl-10 pr-10`}
                />
                {props.query ? (
                  <button type="button" onClick={() => props.onQueryChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>
              <select value={props.workCenter} onChange={(e) => props.onWorkCenterChange(e.target.value)} className={inputClass}>
                {props.workCenterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'All' ? 'Work Center' : opt}
                  </option>
                ))}
              </select>
              <select value={props.department} onChange={(e) => props.onDepartmentChange(e.target.value)} className={inputClass}>
                {props.departmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'All' ? 'Department' : opt}
                  </option>
                ))}
              </select>
              <select value={props.location} onChange={(e) => props.onLocationChange(e.target.value)} className={inputClass}>
                {props.locationOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'All' ? 'Location' : opt}
                  </option>
                ))}
              </select>
              <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]">
                <SlidersHorizontal className="h-4 w-4" />
                More Filters
              </button>
            </div>

            {/* Main workspace content */}
            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
              <div className="min-w-0">
                {props.tab === 'shifts' ? (
                  <div className="overflow-hidden rounded-[16px] border border-[#EDF2F7]">
                    <div className="max-h-[520px] overflow-auto">
                      <table className="min-w-[1100px] w-full text-left">
                        <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                          <tr>
                            {[
                              { id: 'employee', label: 'Employee' },
                              ...props.dayHeaders.map((day) => ({ id: day.id, label: day.label, sub: day.date })),
                              { id: 'hrs', label: 'HRS' },
                              { id: 'ot', label: 'OT' },
                              { id: 'actions', label: '' },
                            ].map((head) => (
                              <th
                                key={head.id}
                                className={`px-2 py-3 ${head.id === 'employee' ? 'sticky left-0 z-20 min-w-[200px] bg-[#F8FAFC]' : 'min-w-[88px] text-center'}`}
                              >
                                <div>{head.label}</div>
                                {'sub' in head && head.sub ? (
                                  <div className="mt-0.5 text-[11px] font-medium normal-case text-[#94A3B8]">{head.sub}</div>
                                ) : null}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EDF2F7] bg-white text-[15px]">
                          {props.calendarRows.map((row) => (
                            <tr key={row.id} className="transition-colors hover:bg-[#F8FAFC]">
                              <td className="sticky left-0 z-[1] bg-white px-2 py-3">
                                <div className="flex items-center gap-3">
                                  <EmployeeAvatar name={row.employeeName} />
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-[#0F172A]">{row.employeeName}</div>
                                    <div className="truncate text-xs font-medium text-[#64748B]">
                                      {row.employeeId} · {row.role}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {row.days.map((cell, dayIndex) => (
                                <td key={`${row.id}-${props.dayHeaders[dayIndex]?.id || dayIndex}`} className="px-1.5 py-2 align-top">
                                  <ShiftCard cell={cell} />
                                </td>
                              ))}
                              <td className="px-2 py-3 text-center text-sm font-bold text-[#0F172A]">{row.totalHours}</td>
                              <td className="px-2 py-3 text-center text-sm font-bold text-[#F97316]">{row.totalOt}</td>
                              <td className="px-2 py-3 text-center">
                                <RowActionsButton />
                              </td>
                            </tr>
                          ))}
                          {!props.calendarRows.length ? (
                            <tr>
                              <td colSpan={calendarColSpan} className="px-4 py-12 text-center text-sm font-medium text-[#64748B]">
                                {props.loading ? 'Loading schedule…' : 'No employees match the current filters.'}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-[#EDF2F7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-medium text-[#64748B]">
                        Showing {pageStart} to {pageEnd} of {props.number(props.totalRows)} entries
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={props.page <= 1}
                          onClick={() => props.onPageChange(props.page - 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] disabled:opacity-40"
                        >
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
                        <button
                          type="button"
                          disabled={props.page >= totalPages}
                          onClick={() => props.onPageChange(props.page + 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {props.tab === 'assignments' ? (
                  <ScheduleTable rows={props.shiftSchedules} emptyMessage="No shift assignments yet. Use Schedule Shift to create assignments." />
                ) : null}

                {props.tab === 'rosters' ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(['all', 'draft', 'published'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => props.onRosterFilterChange(filter)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                            props.rosterFilter === filter
                              ? 'bg-[#2563EB] text-white'
                              : 'border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <ScheduleTable
                      rows={props.visibleSchedules}
                      emptyMessage="No roster entries for this filter. Publish draft assignments to populate the roster."
                    />
                  </>
                ) : null}

                {props.tab === 'templates' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {SHIFT_TEMPLATES.map((template) => (
                      <div key={template.id} className="rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#0F172A]">{template.name}</p>
                            <p className="mt-1 text-sm text-[#64748B]">{template.time}</p>
                          </div>
                          <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-semibold text-[#475569]">
                            {template.hours}h
                          </span>
                        </div>
                        <button type="button" className="mt-4 text-xs font-semibold text-[#2563EB] hover:underline">
                          Apply template
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {props.tab === 'rotations' ? (
                  <div className="space-y-3">
                    {ROTATION_PATTERNS.map((pattern) => (
                      <div key={pattern.id} className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-[#0F172A]">{pattern.name}</p>
                            <p className="mt-1 text-sm text-[#64748B]">{pattern.cycle}</p>
                            <p className="mt-1 text-xs text-[#94A3B8]">Departments: {pattern.departments}</p>
                          </div>
                          <button type="button" className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF]">
                            View pattern
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {props.tab === 'shift-trades' ? (
                  <div className="overflow-hidden rounded-[16px] border border-[#EDF2F7]">
                    <table className="min-w-[760px] w-full text-left">
                      <thead className="bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                        <tr>
                          {['From', 'To', 'Date', 'Shift', 'Status', 'Action'].map((head) => (
                            <th key={head} className="px-4 py-3">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDF2F7] bg-white text-[15px]">
                        {SHIFT_TRADES.map((trade) => (
                          <tr key={trade.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{trade.from}</td>
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{trade.to}</td>
                            <td className="px-4 py-3 text-sm text-[#475569]">{trade.date}</td>
                            <td className="px-4 py-3 text-sm text-[#475569]">{trade.shift}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChipClass(trade.status)}`}>
                                {trade.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {trade.status === 'Pending' ? (
                                <div className="flex gap-2">
                                  <button type="button" className="rounded-lg bg-[#10B981] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#059669]">
                                    Approve
                                  </button>
                                  <button type="button" className="rounded-lg bg-[#EF4444] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#DC2626]">
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[#94A3B8]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {props.tab === 'rules' ? (
                  <div className="overflow-hidden rounded-[16px] border border-[#EDF2F7]">
                    <table className="min-w-[760px] w-full text-left">
                      <thead className="bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                        <tr>
                          {['Rule', 'Scope', 'Status', 'Action'].map((head) => (
                            <th key={head} className="px-4 py-3">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDF2F7] bg-white text-[15px]">
                        {SCHEDULING_RULES.map((rule) => (
                          <tr key={rule.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{rule.rule}</td>
                            <td className="px-4 py-3 text-sm text-[#64748B]">{rule.scope}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChipClass(rule.status)}`}>
                                {rule.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button type="button" className="text-xs font-semibold text-[#2563EB] hover:underline">
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <h3 className="text-base font-semibold text-[#0F172A]">Coverage Overview</h3>
                  <DonutChart
                    rows={[
                      { label: 'Staffed', value: props.coverageStats.staffed, color: '#10B981' },
                      { label: 'Understaffed', value: props.coverageStats.understaffed, color: '#F59E0B' },
                      { label: 'Uncovered', value: props.coverageStats.uncovered, color: '#EF4444' },
                    ]}
                    centerValue={`${props.coverageStats.pct}%`}
                    centerLabel="Coverage"
                  />
                </div>
                <AiRecommendations items={props.aiRecommendations} />
                <ShiftActionsList items={defaultShiftActionItems} />
                <MobileRosterPreview />
              </aside>
            </div>
          </ShiftPanel>
        </div>

        {/* Bottom analytics */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AnalyticsCard title="Shift Distribution">
            <DonutChart
              rows={props.shiftDistribution}
              centerValue={`${props.number(props.shiftDistribution.reduce((s, r) => s + r.value, 0))}`}
              centerLabel="Shifts"
            />
          </AnalyticsCard>
          <AnalyticsCard title="Overtime Trend [HRS]">
            <SimpleLineChart values={props.overtimeTrend.values} labels={props.overtimeTrend.labels} />
          </AnalyticsCard>
          <AnalyticsCard title="Department Coverage">
            <HorizontalBarChart rows={props.departmentCoverage} />
          </AnalyticsCard>
          <AnalyticsCard title="Absence Summary">
            <DonutChart
              rows={props.absenceSummary}
              centerValue={props.number(props.absenceSummary.reduce((s, r) => s + r.value, 0))}
              centerLabel="Absences"
            />
          </AnalyticsCard>
          <AnalyticsCard title="Upcoming Holidays">
            <HolidaysTimeline items={UPCOMING_HOLIDAYS} />
          </AnalyticsCard>
        </div>
      </div>
    </div>
  );
}
