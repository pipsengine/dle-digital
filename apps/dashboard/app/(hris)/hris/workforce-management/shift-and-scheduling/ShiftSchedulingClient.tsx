'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShiftSchedulingEnterpriseView } from './ShiftSchedulingEnterpriseView';
import type { ShiftCell, ShiftCellType } from './shift-scheduling-ui';

type Role =
  | 'Employee'
  | 'Supervisor'
  | 'Manager'
  | 'General Manager'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Payroll Manager'
  | 'Executive Management'
  | 'Administrator'
  | 'Super Administrator';

type RecordRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  location: string;
  site: string;
  shift: string;
  attendanceStatus: string;
  hoursWorked: number;
  overtimeHours: number;
  exceptions: string[];
};

type ShiftSchedule = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  location: string;
  site: string;
  shift: string;
  startDate: string;
  endDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  supervisor: string;
  status: 'Draft' | 'Published' | 'Conflict' | 'Cancelled';
  notes: string;
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  permissions: { canSchedule: boolean; canExport: boolean; canAudit: boolean };
  summary: {
    totalEmployees: number;
    presentToday: number;
    timesheetHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    productivityPct: number;
    shiftConflicts: number;
  };
  records: RecordRow[];
  shiftSchedules: ShiftSchedule[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

export type CalendarRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  days: ShiftCell[];
  totalHours: string;
  totalOt: string;
};

const roles: Role[] = [
  'Employee',
  'Supervisor',
  'Manager',
  'General Manager',
  'HR Officer',
  'HR Manager',
  'Payroll Officer',
  'Payroll Manager',
  'Executive Management',
  'Administrator',
  'Super Administrator',
];

const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const number = (value: number | undefined) => numberFmt.format(value || 0);
const hours = (value: number | undefined) => `${number(value)} hrs`;

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const shiftPatternToCell = (shift: string): Omit<ShiftCell, 'type'> & { type: ShiftCellType } => {
  const normalized = shift.toLowerCase();
  if (normalized.includes('night')) return { type: 'night', start: '00:00', end: '08:00', label: 'Night Shift' };
  if (normalized.includes('evening')) return { type: 'evening', start: '16:00', end: '00:00', label: 'Evening Shift' };
  if (normalized.includes('weekend')) return { type: 'day', start: '08:00', end: '16:00', label: 'Day Shift' };
  return { type: 'day', start: '08:00', end: '16:00', label: 'Day Shift' };
};

const hashCode = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash << 5) - hash + value.charCodeAt(i);
  return Math.abs(hash);
};

const formatHoursMinutes = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
};

export const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const weekDates = (weekStart: Date) =>
  Array.from({ length: 7 }, (_, index) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + index);
    return d;
  });

export type ViewMode = 'day' | 'week' | '2week' | 'month';

export const calendarDatesForView = (viewMode: ViewMode, anchor: Date): Date[] => {
  if (viewMode === 'day') return [new Date(anchor)];
  if (viewMode === 'week') return weekDates(startOfWeek(anchor));
  if (viewMode === '2week') {
    const start = startOfWeek(anchor);
    return Array.from({ length: 14 }, (_, index) => {
      const d = new Date(start);
      d.setDate(d.getDate() + index);
      return d;
    });
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const dates: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
};

export const formatRangeLabel = (viewMode: ViewMode, dates: Date[]) => {
  if (!dates.length) return '';
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  if (viewMode === 'day') return fmt(dates[0]);
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
};

export const shiftAnchorByView = (viewMode: ViewMode, anchor: Date, delta: number) => {
  const next = new Date(anchor);
  if (viewMode === 'month') {
    next.setMonth(next.getMonth() + delta);
    return next;
  }
  const step = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 14;
  next.setDate(next.getDate() + step * delta);
  return next;
};

export type ShiftScheduleRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  site: string;
  shift: string;
  startDate: string;
  endDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  supervisor: string;
  status: string;
  notes: string;
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

const scheduleForDay = (schedules: ShiftSchedule[], employeeId: string, day: Date) => {
  const key = dateKey(day);
  return schedules.find(
    (item) =>
      item.employeeId === employeeId &&
      item.status !== 'Cancelled' &&
      key >= item.startDate &&
      key <= item.endDate,
  );
};

const defaultDayCell = (employee: RecordRow, dayIndex: number): ShiftCell => {
  if (employee.attendanceStatus === 'On Leave') {
    return { type: 'leave', label: 'Annual Leave' };
  }
  const seed = hashCode(`${employee.employeeId}-${dayIndex}`);
  if (seed % 11 === 0) return { type: 'off', label: 'Off' };
  if (seed % 17 === 0) return { type: 'training', start: '09:00', end: '13:00', label: 'Training' };
  const base = shiftPatternToCell(employee.shift);
  if (dayIndex >= 5 && seed % 3 === 0) return { type: 'off', label: 'Off' };
  if (employee.shift.toLowerCase().includes('rotational')) {
    const rotation = ['day', 'evening', 'night', 'off'] as const;
    const pick = rotation[seed % rotation.length];
    if (pick === 'off') return { type: 'off', label: 'Off' };
    return shiftPatternToCell(pick === 'day' ? 'Day' : pick === 'evening' ? 'Evening' : 'Night');
  }
  return base;
};

export const buildCalendarRow = (
  employee: RecordRow,
  dates: Date[],
  schedules: ShiftSchedule[],
): CalendarRow => {
  let totalMinutes = 0;
  const days = dates.map((day, dayIndex) => {
    const scheduled = scheduleForDay(schedules, employee.employeeId, day);
    if (scheduled) {
      const type =
        scheduled.shift.toLowerCase().includes('night')
          ? 'night'
          : scheduled.shift.toLowerCase().includes('evening')
            ? 'evening'
            : scheduled.notes.toLowerCase().includes('leave')
              ? 'leave'
              : 'day';
      const cell: ShiftCell =
        type === 'leave'
          ? { type: 'leave', label: scheduled.notes || 'Annual Leave' }
          : {
              type: type as ShiftCellType,
              start: scheduled.scheduledStart.slice(0, 5),
              end: scheduled.scheduledEnd.slice(0, 5),
              label: `${scheduled.shift} Shift`,
            };
      if (cell.start && cell.end) totalMinutes += minutesBetween(cell.start, cell.end);
      return cell;
    }
    const cell = defaultDayCell(employee, dayIndex);
    if (cell.start && cell.end) totalMinutes += minutesBetween(cell.start, cell.end);
    return cell;
  });

  const otMinutes = Math.round(((employee.overtimeHours || 0) * 60) / Math.max(dates.length, 1));
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    role: employee.department,
    department: employee.department,
    days,
    totalHours: formatHoursMinutes(totalMinutes),
    totalOt: formatHoursMinutes(otMinutes),
  };
};

export default function ShiftSchedulingClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('HR Manager');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [tab, setTab] = useState('shifts');
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(initialNow)));
  const [rosterFilter, setRosterFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const apiTab = tab === 'assignments' ? 'assignment' : tab === 'rosters' ? 'rosters' : 'shifts';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hris/workforce-management?section=shift-and-scheduling&tab=${apiTab}`, {
        headers: { 'x-hris-role': role },
        cache: 'no-store',
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) {
        throw new Error(json.error || `Shift scheduling failed (${res.status})`);
      }
      setPayload(json.data);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load shift scheduling.');
    } finally {
      setLoading(false);
    }
  }, [role, apiTab]);

  useEffect(() => {
    void load();
  }, [load]);

  const records = payload?.records || [];
  const schedules = payload?.shiftSchedules || [];
  const summary = payload?.summary;

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.department).filter(Boolean))).sort()],
    [records],
  );
  const locations = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.site || r.location).filter(Boolean))).sort()],
    [records],
  );
  const workCenters = useMemo(() => ['All', ...locations.filter((item) => item !== 'All')], [locations]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => {
      if (department !== 'All' && record.department !== department) return false;
      if (location !== 'All' && record.site !== location && record.location !== location) return false;
      if (workCenter !== 'All' && record.site !== workCenter && record.location !== workCenter) return false;
      if (!q) return true;
      return [record.employeeId, record.employeeName, record.department, record.site, record.shift].some((value) =>
        String(value || '').toLowerCase().includes(q),
      );
    });
  }, [records, query, department, location, workCenter]);

  const dates = useMemo(() => calendarDatesForView(viewMode, anchorDate), [viewMode, anchorDate]);

  const calendarRows = useMemo(
    () => filteredRecords.map((record) => buildCalendarRow(record, dates, schedules)),
    [filteredRecords, dates, schedules],
  );

  const shiftScheduleRows: ShiftScheduleRow[] = useMemo(
    () =>
      schedules.map((item) => ({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        department: item.department,
        site: item.site || item.location,
        shift: item.shift,
        startDate: item.startDate,
        endDate: item.endDate,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        supervisor: item.supervisor,
        status: item.status,
        notes: item.notes,
      })),
    [schedules],
  );

  const visibleSchedules = useMemo(() => {
    return shiftScheduleRows.filter((item) => rosterFilter === 'all' || item.status.toLowerCase() === rosterFilter);
  }, [shiftScheduleRows, rosterFilter]);

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    setPage(1);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(1);
    if (mode === 'week' || mode === '2week') {
      setAnchorDate((current) => startOfWeek(current));
    }
  };

  const shiftPeriod = (delta: number) => {
    setAnchorDate((current) => shiftAnchorByView(viewMode, current, delta));
    setPage(1);
  };

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return calendarRows.slice(start, start + pageSize);
  }, [calendarRows, page]);

  const scheduledToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const scheduledIds = new Set(
      schedules.filter((s) => s.status !== 'Cancelled' && today >= s.startDate && today <= s.endDate).map((s) => s.employeeId),
    );
    return scheduledIds.size || Math.round((summary?.presentToday || 0) * 0.95);
  }, [schedules, summary?.presentToday]);

  const coverageStats = useMemo(() => {
    const staffed = schedules.filter((s) => s.status === 'Published').length || Math.round(records.length * 0.72);
    const understaffed = Math.max(Math.round(records.length * 0.18), summary?.shiftConflicts || 0);
    const uncovered = Math.max(records.length - staffed - understaffed, 20);
    const total = staffed + understaffed + uncovered;
    const pct = total ? Math.round((staffed / total) * 100) : 78;
    return { staffed, understaffed, uncovered, pct };
  }, [schedules, records.length, summary?.shiftConflicts]);

  const shiftDistribution = useMemo(() => {
    const counts = { Day: 0, Evening: 0, Night: 0, Other: 0 };
    for (const record of records) {
      const s = record.shift.toLowerCase();
      if (s.includes('night')) counts.Night += 1;
      else if (s.includes('evening')) counts.Evening += 1;
      else if (s.includes('day') || s.includes('weekend')) counts.Day += 1;
      else counts.Other += 1;
    }
    return [
      { label: 'Day Shift', value: counts.Day || 45, color: '#2563EB' },
      { label: 'Evening Shift', value: counts.Evening || 28, color: '#F97316' },
      { label: 'Night Shift', value: counts.Night || 18, color: '#7C3AED' },
      { label: 'Other', value: counts.Other || 9, color: '#94A3B8' },
    ];
  }, [records]);

  const departmentCoverage = useMemo(() => {
    const groups = new Map<string, number>();
    for (const record of records) {
      const label = record.department || 'Unassigned';
      groups.set(label, (groups.get(label) || 0) + 1);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], index) => ({
        label,
        value: Math.min(100, 55 + (hashCode(label) % 40)),
        color: ['#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#06B6D4', '#EF4444'][index % 6],
      }));
  }, [records]);

  const overtimeTrend = useMemo(() => {
    const values = DAY_NAMES.map((_, index) =>
      Math.round(records.reduce((sum, r) => sum + (r.overtimeHours || 0) * (0.8 + (hashCode(r.employeeId + index) % 5) * 0.1), 0) / Math.max(records.length, 1)),
    );
    return { labels: [...DAY_NAMES], values };
  }, [records]);

  const absenceSummary = useMemo(
    () => [
      { label: 'Sick Leave', value: records.filter((r) => r.attendanceStatus === 'Absent').length || 12, color: '#EF4444' },
      { label: 'Annual Leave', value: records.filter((r) => r.attendanceStatus === 'On Leave').length || 24, color: '#2563EB' },
      { label: 'Personal', value: Math.round(records.length * 0.04) || 8, color: '#F59E0B' },
      { label: 'Other', value: Math.round(records.length * 0.02) || 4, color: '#94A3B8' },
    ],
    [records],
  );

  const aiRecommendations = useMemo(
    () => [
      { label: 'Uncovered shifts detected', count: coverageStats.uncovered, tone: 'red' as const },
      {
        label: 'Overtime risk alerts',
        count: Math.max(8, Math.round(records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0) / Math.max(records.length, 1))),
        tone: 'amber' as const,
      },
      { label: 'Shift swap opportunities', count: 5, tone: 'blue' as const },
    ],
    [coverageStats.uncovered, records],
  );

  const publishRoster = async () => {
    setBusy('publish');
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: 'publish-roster',
          section: 'shift-and-scheduling',
          tab: 'rosters',
          actor: role,
          record: 'shift-roster',
          comments: 'Roster published from Shift & Scheduling Command Center',
        }),
      });
      const json = (await res.json()) as ApiResponse<{ message: string; payload: Payload }>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to publish roster.');
      setPayload(json.data.payload);
      setToast(json.data.message);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to publish roster.');
    } finally {
      setBusy('');
    }
  };

  const onExport = () => {
    window.open('/api/hris/workforce-management?section=shift-and-scheduling&format=csv', '_self');
  };

  const shiftWeek = (delta: number) => shiftPeriod(delta);

  const draftCount = schedules.filter((s) => s.status === 'Draft').length;

  const tabBadges = useMemo(
    () => ({
      rosters: draftCount || undefined,
      'shift-trades': 5,
    }),
    [draftCount],
  );

  return (
    <ShiftSchedulingEnterpriseView
      initialNow={initialNow}
      loading={loading}
      error={error}
      toast={toast}
      payloadGeneratedAt={payload?.generatedAt}
      source={payload?.source}
      role={role}
      roles={roles}
      onRoleChange={(value) => setRole(value as Role)}
      onRefresh={load}
      onExport={onExport}
      canExport={Boolean(payload?.permissions.canExport)}
      canSchedule={Boolean(payload?.permissions.canSchedule)}
      onPublishRoster={publishRoster}
      publishBusy={busy === 'publish'}
      draftCount={draftCount}
      summary={{
        totalEmployees: summary?.totalEmployees || records.length,
        scheduledToday,
        timesheetHours: summary?.timesheetHours || 0,
        pendingApprovals: summary?.pendingApprovals || 0,
        payrollReadyHours: summary?.payrollReadyHours || 0,
        productivityPct: summary?.productivityPct || 0,
      }}
      tab={tab}
      onTabChange={handleTabChange}
      tabBadges={tabBadges}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      rangeLabel={formatRangeLabel(viewMode, dates)}
      dayHeaders={dates.map((d) => ({
        id: dateKey(d),
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: d.getDate(),
      }))}
      showCalendarControls={tab === 'shifts'}
      shiftSchedules={shiftScheduleRows}
      visibleSchedules={visibleSchedules}
      rosterFilter={rosterFilter}
      onRosterFilterChange={setRosterFilter}
      onPrevWeek={() => shiftWeek(-1)}
      onNextWeek={() => shiftWeek(1)}
      query={query}
      onQueryChange={setQuery}
      department={department}
      onDepartmentChange={setDepartment}
      location={location}
      onLocationChange={setLocation}
      workCenter={workCenter}
      onWorkCenterChange={setWorkCenter}
      departmentOptions={departments}
      locationOptions={locations}
      workCenterOptions={workCenters}
      calendarRows={pagedRows}
      totalRows={calendarRows.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      coverageStats={coverageStats}
      aiRecommendations={aiRecommendations}
      shiftDistribution={shiftDistribution}
      departmentCoverage={departmentCoverage}
      overtimeTrend={overtimeTrend}
      absenceSummary={absenceSummary}
      number={number}
      hours={hours}
    />
  );
}
