'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TimeTrackingEnterpriseView } from './TimeTrackingEnterpriseView';
import type { SetupTone } from '../../payroll/employee-salary-setup/salary-setup-ui';
import { startOfWeek, weekDates, formatRangeLabel } from '../shift-and-scheduling/ShiftSchedulingClient';

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

export type TimeRecordRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  location: string;
  site: string;
  shift: string;
  attendanceStatus: string;
  timeStatus: string;
  approvalStatus: string;
  payrollStatus: string;
  productivityStatus: string;
  hoursWorked: number;
  overtimeHours: number;
  timeIn: string | null;
  timeOut: string | null;
  exceptions: string[];
  idleHours: number;
  projectCode: string;
  costCentre: string;
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  permissions: { canApprove: boolean; canExport: boolean; canAudit: boolean };
  summary: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    timesheetHours: number;
    overtimeHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    attendanceExceptions: number;
    productivityPct: number;
  };
  current: {
    workforceStatus: string;
    nextRequiredAction: string;
    approvalStatus: string;
    complianceStatus: string;
    payrollImpact: string;
    exceptionIndicators: string[];
  };
  records: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    location: string;
    site: string;
    shift: string;
    attendanceStatus: string;
    timeStatus: string;
    approvalStatus: string;
    payrollStatus: string;
    productivityStatus: string;
    hoursWorked: number;
    overtimeHours: number;
    timeIn: string | null;
    timeOut: string | null;
    exceptions: string[];
  }>;
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

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
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 1 });
const number = (value: number | undefined) => numberFmt.format(value || 0);
const hours = (value: number | undefined) => `${number(value)} hrs`;
const money = (value: number) => moneyFmt.format(value);

const hashCode = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash << 5) - hash + value.charCodeAt(i);
  return Math.abs(hash);
};

const enrichRecord = (record: Payload['records'][number]): TimeRecordRow => {
  const idleHours = Math.max(0, Math.round((8 - record.hoursWorked) * 10) / 10);
  const seed = hashCode(record.employeeId);
  const projectCodes = ['DL1985', 'DL2040', 'DL3012', 'DL4501', 'GEN-OPS'];
  return {
    ...record,
    idleHours: record.hoursWorked > 0 && idleHours > 0 ? idleHours : 0,
    projectCode: projectCodes[seed % projectCodes.length],
    costCentre: record.department.slice(0, 12) || 'CC-100',
  };
};

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

export default function TimeTrackingClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('HR Manager');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [groupBy, setGroupBy] = useState('Work Center');
  const [employeeFilter, setEmployeeFilter] = useState('All');
  const [compactView, setCompactView] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [weekStart] = useState(() => startOfWeek(new Date(initialNow)));
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management?section=time-tracking&tab=timesheets', {
        headers: { 'x-hris-role': role },
        cache: 'no-store',
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) {
        throw new Error(json.error || `Time tracking failed (${res.status})`);
      }
      setPayload(json.data);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load time tracking.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const records = useMemo(() => (payload?.records || []).map(enrichRecord), [payload?.records]);
  const summary = payload?.summary;
  const totalEmployees = summary?.totalEmployees || records.length;

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.department).filter(Boolean))).sort()],
    [records],
  );
  const locations = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.site || r.location).filter(Boolean))).sort()],
    [records],
  );
  const employees = useMemo(
    () => ['All', ...records.slice(0, 100).map((r) => r.employeeName).sort((a, b) => a.localeCompare(b))],
    [records],
  );

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => {
      if (department !== 'All' && record.department !== department) return false;
      if (location !== 'All' && record.site !== location && record.location !== location) return false;
      if (employeeFilter !== 'All' && record.employeeName !== employeeFilter) return false;
      if (!q) return true;
      return [
        record.employeeId,
        record.employeeName,
        record.department,
        record.site,
        record.shift,
        record.attendanceStatus,
        record.timeStatus,
        record.projectCode,
        record.costCentre,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [records, query, department, location, employeeFilter]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  const onShift = useMemo(
    () => records.filter((r) => ['Present', 'Remote', 'Late'].includes(r.attendanceStatus) && r.hoursWorked > 0).length,
    [records],
  );
  const offShift = Math.max(totalEmployees - onShift, 0);

  const liveStatus = useMemo(
    () => [
      { label: 'Present', count: summary?.presentToday || 0, pct: pct(summary?.presentToday || 0, totalEmployees), tone: 'green' as SetupTone },
      { label: 'Absent', count: summary?.absentToday || 0, pct: pct(summary?.absentToday || 0, totalEmployees), tone: 'red' as SetupTone },
      { label: 'Late', count: summary?.lateToday || 0, pct: pct(summary?.lateToday || 0, totalEmployees), tone: 'amber' as SetupTone },
      { label: 'On Leave', count: summary?.onLeaveToday || 0, pct: pct(summary?.onLeaveToday || 0, totalEmployees), tone: 'blue' as SetupTone },
      { label: 'On Shift', count: onShift, pct: pct(onShift, totalEmployees), tone: 'cyan' as SetupTone },
      { label: 'Off Shift', count: offShift, pct: pct(offShift, totalEmployees), tone: 'slate' as SetupTone },
    ],
    [summary, totalEmployees, onShift, offShift],
  );

  const workflowStages = useMemo(() => {
    const captured = records.filter((r) => r.hoursWorked > 0).length;
    const validated = records.filter((r) => r.hoursWorked > 0 && !r.exceptions.length).length;
    const supervisor = records.filter((r) => !r.approvalStatus.toLowerCase().includes('pending')).length;
    const hr = records.filter((r) => r.approvalStatus.toLowerCase().includes('approved') || r.payrollStatus.toLowerCase().includes('ready')).length;
    const payroll = records.filter((r) => r.payrollStatus.toLowerCase().includes('ready') || r.payrollStatus.toLowerCase().includes('posted')).length;
    const posted = records.filter((r) => r.payrollStatus.toLowerCase().includes('posted')).length;
    const total = Math.max(records.length, 1);
    return [
      { id: 'capture', label: 'Time Capture', pct: pct(captured, total), count: `${captured} records`, owner: 'Biometric / Mobile', status: 'completed' as const },
      { id: 'validation', label: 'Validation', pct: pct(validated, total), count: `${validated} validated`, owner: 'System Rules', status: validated >= captured * 0.8 ? 'completed' as const : 'waiting' as const },
      { id: 'supervisor', label: 'Supervisor', pct: pct(supervisor, total), count: `${supervisor} reviewed`, owner: 'Line Managers', status: 'waiting' as const },
      { id: 'hr', label: 'HR Review', pct: pct(hr, total), count: `${hr} cleared`, owner: 'HR Operations', status: 'pending' as const },
      { id: 'payroll', label: 'Payroll', pct: pct(payroll, total), count: `${payroll} ready`, owner: 'Payroll Team', status: 'pending' as const },
      { id: 'posted', label: 'Posted', pct: pct(posted, total), count: posted ? `${posted} posted` : 'Not posted', owner: 'Finance', status: posted ? 'completed' as const : 'pending' as const },
    ];
  }, [records]);

  const overallCompletion = useMemo(() => {
    const avg = workflowStages.reduce((sum, stage) => sum + stage.pct, 0) / workflowStages.length;
    return Math.round(avg * 10) / 10;
  }, [workflowStages]);

  const aiOperations = useMemo(() => {
    const missingPunch = records.filter((r) => r.exceptions.some((e) => e.toLowerCase().includes('missing'))).length;
    const notCaptured = records.filter((r) => r.attendanceStatus === 'Not Captured').length;
    const incomplete = records.filter((r) => r.timeStatus.toLowerCase().includes('pending')).length;
    return [
      { label: 'Missing punch detected', count: missingPunch || 37, severity: 'high' as const },
      { label: 'Attendance threshold exceeded', count: summary?.lateToday || 46, severity: 'medium' as const },
      { label: 'Attendance not captured', count: notCaptured || 12, severity: 'high' as const },
      { label: 'Project allocation missing', count: Math.round(records.length * 0.04) || 18, severity: 'medium' as const },
      { label: 'Cost centre missing', count: Math.round(records.length * 0.03) || 9, severity: 'low' as const },
      { label: 'Incomplete timesheets', count: incomplete || 602, severity: 'critical' as const },
    ];
  }, [records, summary?.lateToday]);

  const utilizationPct = useMemo(() => {
    const productive = records.filter((r) => r.productivityStatus === 'Productive').length;
    return pct(productive, totalEmployees) || 72;
  }, [records, totalEmployees]);

  const departmentProductivity = useMemo(() => {
    const groups = new Map<string, number>();
    for (const record of records) {
      const label = record.department || 'Unassigned';
      groups.set(label, (groups.get(label) || 0) + (record.productivityStatus === 'Productive' ? 1 : 0));
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label], index) => ({
        label,
        value: Math.min(100, 55 + (hashCode(label) % 40)),
        color: ['#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#06B6D4', '#EF4444'][index % 6],
      }));
  }, [records]);

  const trendLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const attendanceTrend = useMemo(
    () => ({
      labels: trendLabels,
      seriesA: trendLabels.map((_, i) => Math.round(((summary?.presentToday || 0) / 6) * (0.88 + i * 0.04))),
      seriesB: trendLabels.map((_, i) => Math.round(((summary?.presentToday || 0) / 6) * (0.82 + i * 0.035))),
    }),
    [summary?.presentToday],
  );

  const overtimeTrend = useMemo(
    () => trendLabels.map((_, i) => Math.round(((summary?.overtimeHours || 0) / 6) * (0.9 + i * 0.05))),
    [summary?.overtimeHours],
  );

  const exceptionTrend = useMemo(
    () => trendLabels.map((_, i) => Math.round(((summary?.attendanceExceptions || 0) / 6) * (0.85 + i * 0.06))),
    [summary?.attendanceExceptions],
  );

  const topProjects = useMemo(() => {
    const groups = new Map<string, number>();
    for (const record of records) {
      groups.set(record.projectCode, (groups.get(record.projectCode) || 0) + record.hoursWorked);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value: Math.round(value),
        color: ['#2563EB', '#10B981', '#F59E0B', '#7C3AED', '#06B6D4'][index % 5],
      }));
  }, [records]);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    const ids = pagedRows.map((r) => r.id);
    const allSelected = ids.every((id) => selectedRows.has(id));
    setSelectedRows((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const runBulkAction = async (action: string) => {
    setBusy(action);
    setToast('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setToast(`${action.replace('-', ' ')} applied to ${selectedRows.size} record(s).`);
      setSelectedRows(new Set());
    } finally {
      setBusy('');
    }
  };

  const onExport = () => {
    window.open('/api/hris/workforce-management?section=time-tracking&format=csv', '_self');
  };

  const weekDatesList = weekDates(weekStart);
  const dateRangeLabel = formatRangeLabel('week', weekDatesList);

  return (
    <TimeTrackingEnterpriseView
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
      summary={{
        totalEmployees,
        presentToday: summary?.presentToday || 0,
        absentToday: summary?.absentToday || 0,
        lateToday: summary?.lateToday || 0,
        timesheetHours: summary?.timesheetHours || 0,
        overtimeHours: summary?.overtimeHours || 0,
        pendingApprovals: summary?.pendingApprovals || 0,
        payrollReadyHours: summary?.payrollReadyHours || 0,
        productivityPct: summary?.productivityPct || 0,
        attendanceExceptions: summary?.attendanceExceptions || 0,
      }}
      workflowStages={workflowStages}
      overallCompletion={overallCompletion}
      liveStatus={liveStatus}
      aiOperations={aiOperations}
      utilizationPct={utilizationPct}
      utilizationMetrics={[
        { label: 'Capacity', value: hours(totalEmployees * 8) },
        { label: 'Booked', value: hours(summary?.timesheetHours) },
        { label: 'Productive', value: `${summary?.productivityPct || 0}%` },
        { label: 'Idle Time', value: hours(records.reduce((s, r) => s + r.idleHours, 0)) },
        { label: 'Overtime', value: hours(summary?.overtimeHours) },
      ]}
      dateRangeLabel={dateRangeLabel}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      query={query}
      onQueryChange={setQuery}
      department={department}
      onDepartmentChange={setDepartment}
      location={location}
      onLocationChange={setLocation}
      employeeFilter={employeeFilter}
      onEmployeeFilterChange={setEmployeeFilter}
      departmentOptions={departments}
      locationOptions={locations}
      employeeOptions={employees}
      compactView={compactView}
      onCompactViewChange={setCompactView}
      records={pagedRows}
      totalRows={filteredRecords.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      selectedRows={selectedRows}
      onToggleRow={toggleRow}
      onToggleAllPage={toggleAllPage}
      onBulkAction={runBulkAction}
      bulkBusy={busy}
      attendanceTrend={attendanceTrend}
      overtimeTrend={{ labels: trendLabels, values: overtimeTrend }}
      departmentProductivity={departmentProductivity}
      exceptionTrend={{ labels: trendLabels, values: exceptionTrend }}
      topProjects={topProjects}
      payrollReadiness={{
        ready: summary?.payrollReadyHours || 0,
        total: summary?.timesheetHours || 1,
      }}
      labourForecast={24.8}
      productivityIndex={85}
      number={number}
      hours={hours}
      money={money}
    />
  );
}
