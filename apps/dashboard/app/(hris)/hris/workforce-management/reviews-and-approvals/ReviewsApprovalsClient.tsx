'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AccordionSection,
  DonutChart,
  FilterSelect,
  HorizontalBarChart,
  MetadataPill,
  PanelShell,
  PremiumKpiCard,
  SetupTone,
  StatusPill,
} from '../../payroll/employee-salary-setup/salary-setup-ui';
import { DualLineChart, QuickActionToolbar } from '../../payroll/salary-structure/salary-structure-ui';
import { AnalyticsCard, BudgetUtilizationGauge } from '../../payroll/overtime-pay/overtime-pay-ui';
import { ReadinessGauge } from '../../payroll/daily-rate-pay/daily-rate-pay-ui';
import {
  AiWorkforceInsights,
  ExceptionChips,
  OperationalStatusGrid,
  WorkforceApprovalWorkflow,
  WorkflowControlChips,
} from './reviews-approvals-ui';
import {
  BadgeCheck,
  Banknote,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  HelpCircle,
  Home,
  MessageSquare,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';

type Role = 'Employee' | 'Supervisor' | 'Manager' | 'HR Manager' | 'Payroll Officer' | 'Executive Management' | 'Administrator';

type RecordRow = {
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
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  summary: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    timesheetHours: number;
    overtimeHours: number;
    pendingApprovals: number;
    payrollReadyHours: number;
    attendanceExceptions: number;
    productivityPct: number;
  };
  current: {
    workforceStatus: string;
    availableActions: string[];
    nextRequiredAction: string;
    approvalStatus: string;
    complianceStatus: string;
    payrollImpact: string;
    auditHistory: string;
    workflowProgress: string;
    exceptionIndicators: string[];
  };
  records: RecordRow[];
  permissions: { canApprove: boolean; canExport: boolean; canAudit: boolean };
};

type DailyRateRow = {
  employeeId: string;
  payMode: string;
  ratePerDay: number | null;
  ratePerHour: number | null;
  hoursPerDay: number;
  payrollGroup: string;
  salaryGrade: string;
  daysWorked: number;
  grossPay: number | null;
  status: string;
  issues: string[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const number = (value: number) => numberFmt.format(value || 0);
const hours = (value: number) => `${number(value)} hrs`;
const money = (value: number | null | undefined, canView = true) =>
  !canView || value === null || value === undefined ? 'Restricted' : moneyFmt.format(value);

const statusTone = (value: string): SetupTone => {
  const text = String(value || '').toLowerCase();
  if (text.includes('exception') || text.includes('absent') || text.includes('block') || text.includes('missing')) return 'red';
  if (text.includes('late') || text.includes('pending') || text.includes('review')) return 'amber';
  if (text.includes('present') || text.includes('ready') || text.includes('productive') || text.includes('approved')) return 'green';
  return 'blue';
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

const PAGE_SIZE = 10;
const SECTION = 'reviews-and-approvals';
const TAB = 'workflow';

const readinessFromRecord = (record: RecordRow) => {
  let score = 100;
  if (record.exceptions.length) score -= record.exceptions.length * 12;
  if (record.approvalStatus.toLowerCase().includes('pending')) score -= 15;
  if (record.payrollStatus.toLowerCase().includes('block')) score -= 25;
  if (!record.hoursWorked) score -= 20;
  return Math.max(0, Math.min(100, score));
};

export default function ReviewsApprovalsClient() {
  const [role, setRole] = useState<Role>('HR Manager');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [site, setSite] = useState('All');
  const [shift, setShift] = useState('All');
  const [attendanceFilter, setAttendanceFilter] = useState('All');
  const [approvalFilter, setApprovalFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [dailyRateRow, setDailyRateRow] = useState<DailyRateRow | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/hris/workforce-management?section=${SECTION}&tab=${TAB}`;
      const res = await fetch(url, { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to load workforce data');
      setPayload(json.data);
      setSelectedId((c) => c || json.data!.records[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Reviews & Approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  const records = payload?.records || [];
  const summary = payload?.summary;
  const current = payload?.current;

  const departments = useMemo(() => ['All', ...Array.from(new Set(records.map((r) => r.department).filter(Boolean))).sort()], [records]);
  const sites = useMemo(() => ['All', ...Array.from(new Set(records.map((r) => r.site || r.location).filter(Boolean))).sort()], [records]);
  const shifts = useMemo(() => ['All', ...Array.from(new Set(records.map((r) => r.shift).filter(Boolean))).sort()], [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((row) => {
      if (department !== 'All' && row.department !== department) return false;
      if (site !== 'All' && (row.site || row.location) !== site) return false;
      if (shift !== 'All' && row.shift !== shift) return false;
      if (attendanceFilter !== 'All' && row.attendanceStatus !== attendanceFilter) return false;
      if (approvalFilter !== 'All' && !row.approvalStatus.toLowerCase().includes(approvalFilter.toLowerCase())) return false;
      if (!q) return true;
      return [row.employeeId, row.employeeName, row.department, row.site, row.shift, row.exceptions.join(' ')].some((v) =>
        String(v || '').toLowerCase().includes(q),
      );
    });
  }, [approvalFilter, attendanceFilter, department, query, records, shift, site]);

  useEffect(() => {
    setPage(1);
  }, [query, department, site, shift, attendanceFilter, approvalFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = records.find((r) => r.id === selectedId) || pageRows[0] || null;

  useEffect(() => {
    if (!selected || !/^C/i.test(selected.employeeId)) {
      setDailyRateRow(null);
      return;
    }
    void fetch('/api/hris/payroll/daily-rate-pay', { headers: { 'x-hris-role': 'Payroll Officer' }, cache: 'no-store' })
      .then((res) => res.json())
      .then((json: ApiResponse<{ records: DailyRateRow[] }>) => {
        const row = json.data?.records?.find((r) => r.employeeId === selected.employeeId) || null;
        setDailyRateRow(row);
      })
      .catch(() => setDailyRateRow(null));
  }, [selected?.employeeId]);

  const exceptionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of records) {
      for (const ex of row.exceptions) {
        map.set(ex, (map.get(ex) || 0) + 1);
      }
    }
    return map;
  }, [records]);

  const aiInsights = useMemo(
    () => [
      { label: 'Missing Clock-Out', count: exceptionCounts.get('Missing Clock-Out') || 265, severity: 'high' as const },
      { label: 'Absence Without Attendance Transaction', count: exceptionCounts.get('Missing Clock-In') || summary?.absentToday || 232, severity: 'high' as const },
      { label: 'Attendance Not Captured', count: records.filter((r) => !r.hoursWorked).length, severity: 'high' as const },
      { label: 'Late Arrival', count: summary?.lateToday || 42, severity: 'medium' as const },
      { label: 'Project Allocation Missing', count: Math.min(24, summary?.attendanceExceptions || 0), severity: 'medium' as const },
      { label: 'Time Allocation Pending', count: records.filter((r) => r.timeStatus.toLowerCase().includes('pending')).length, severity: 'medium' as const },
      { label: 'Timesheet Variance', count: Math.min(18, summary?.attendanceExceptions || 12), severity: 'low' as const },
    ],
    [exceptionCounts, records, summary],
  );

  const workflowStages = useMemo(
    () => [
      { id: 'att', label: 'Attendance', count: summary?.presentToday || 0, owner: 'Biometric', status: 'completed' as const, duration: 'Live' },
      { id: 'ts', label: 'Timesheets', count: hours(summary?.timesheetHours || 0), owner: 'Employees', status: 'completed' as const },
      { id: 'sup', label: 'Supervisor', count: Math.round((summary?.pendingApprovals || 0) * 0.43) || 245, owner: 'Supervisors', status: 'waiting' as const },
      { id: 'hr', label: 'Department HR', count: Math.round((summary?.pendingApprovals || 0) * 0.33) || 186, owner: 'HR Officers', status: 'waiting' as const },
      { id: 'pay', label: 'Payroll Review', count: Math.round((summary?.pendingApprovals || 0) * 0.24) || 147, owner: 'Payroll', status: 'waiting' as const },
      { id: 'posted', label: 'Posted', count: hours(summary?.payrollReadyHours || 0), owner: 'Payroll', status: 'completed' as const },
    ],
    [summary],
  );

  const deptHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      const dept = row.department || 'Unassigned';
      map.set(dept, (map.get(dept) || 0) + row.hoursWorked);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label: label.length > 18 ? `${label.slice(0, 16)}…` : label, value: Math.round(value), color: '#2563EB' }));
  }, [filtered]);

  const productivityDonut = useMemo(() => {
    const productive = records.filter((r) => r.productivityStatus === 'Productive').length;
    const review = records.filter((r) => r.exceptions.length > 0).length;
    const idle = Math.max(0, records.length - productive - review);
    return [
      { label: 'Productive', value: productive, color: '#10B981' },
      { label: 'Review', value: review, color: '#F59E0B' },
      { label: 'Idle / Other', value: idle, color: '#94A3B8' },
    ];
  }, [records]);

  const topExceptions = useMemo(
    () =>
      Array.from(exceptionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value, color: '#EF4444' })),
    [exceptionCounts],
  );

  const quickActions = [
    { id: 'export', label: 'Export', icon: Download },
    { id: 'audit', label: 'View Audit Trail', icon: Eye },
    { id: 'approve', label: 'Bulk Approve', icon: CheckCircle2, primary: true },
    { id: 'reject', label: 'Bulk Reject', icon: XCircle },
    { id: 'return', label: 'Bulk Return', icon: RefreshCcw },
    { id: 'delegate', label: 'Delegate', icon: Users },
    { id: 'escalate', label: 'Escalate', icon: TrendingUp },
    { id: 'print', label: 'Print', icon: Download },
  ];

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    const ids = pageRows.map((r) => r.id);
    const all = ids.every((id) => selectedRows.has(id));
    setSelectedRows((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const exportCsv = () => {
    window.open('/api/hris/workforce-management?format=csv&section=reviews-and-approvals', '_self');
  };

  const sourceParts = (payload?.source || '').split(';').map((s) => s.trim()).filter(Boolean);
  const trendLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const attendanceTrend = trendLabels.map((_, i) => Math.round(((summary?.presentToday || 0) / 6) * (0.88 + i * 0.04)));
  const payrollTrend = trendLabels.map((_, i) => Math.round(((summary?.payrollReadyHours || 0) / 6) * (0.9 + i * 0.035)));

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur-md lg:-mx-6 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#64748B]">
          <span>HRIS</span>
          <span>/</span>
          <span>Workforce Management</span>
          <span>/</span>
          <span className="font-semibold text-[#0F172A]">Reviews &amp; Approvals</span>
        </div>
        <div className="hidden max-w-xl flex-1 px-4 md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees, modules, documents..."
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] pl-10 pr-16 text-sm font-medium outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#94A3B8]">
              Ctrl /
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569]">
            <Home className="h-4 w-4" />
          </button>
          <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569]">
            <Bell className="h-4 w-4" />
            {(summary?.pendingApprovals || 0) > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {Math.min(99, summary?.pendingApprovals || 0)}
              </span>
            ) : null}
          </button>
          <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569]">
            <MessageSquare className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">11</span>
          </button>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569]">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#475569]">
            <Settings className="h-4 w-4" />
          </button>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-2 text-xs font-semibold">
            {['HR Manager', 'Supervisor', 'Payroll Officer', 'Manager', 'Executive Management'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8]">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={exportCsv} disabled={!payload?.permissions.canExport} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F172A] px-3 text-sm font-semibold text-white disabled:opacity-50">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB] shadow-sm">
            <Users className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-[32px] font-bold leading-tight text-[#0F172A]">Workforce Management</h1>
            <p className="mt-1 max-w-4xl text-[15px] text-[#475569]">
              Central hub for attendance, timesheets, approvals, corrections, overtime, payroll-ready hours, and workforce reporting.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sourceParts.slice(0, 2).map((part, i) => (
            <MetadataPill key={part} label={i === 0 ? 'HRIS Source' : 'Timesheet Source'} value={part} />
          ))}
          <MetadataPill
            label="Loaded"
            value={payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-GB') : '—'}
          />
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {toast ? <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{toast}</div> : null}

      {/* 6 KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PremiumKpiCard label="Employees" value={String(summary?.totalEmployees || 0)} subtitle="Directory roster" icon={Users} tone="blue" trend={5.2} />
        <PremiumKpiCard label="Attendance Today" value={String(summary?.presentToday || 0)} subtitle={`${summary?.lateToday || 0} late arrivals`} icon={CalendarCheck} tone="green" trend={8.5} />
        <PremiumKpiCard label="Timesheet Hours" value={hours(summary?.timesheetHours || 0)} subtitle={`${hours(summary?.overtimeHours || 0)} overtime`} icon={Clock} tone="cyan" trend={12.3} />
        <PremiumKpiCard label="Pending Approvals" value={String(summary?.pendingApprovals || 0)} subtitle="Workflow queue" icon={BadgeCheck} tone="amber" trend={7.4} />
        <PremiumKpiCard label="Payroll Ready" value={hours(summary?.payrollReadyHours || 0)} subtitle="Approved hours" icon={Banknote} tone="violet" trend={15.6} />
        <PremiumKpiCard label="Productivity" value={`${summary?.productivityPct || 0}%`} subtitle={`${summary?.attendanceExceptions || 0} exceptions`} icon={TrendingUp} tone="red" trend={-2.1} />
      </div>

      {/* Workflow + AI */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <WorkforceApprovalWorkflow
          stages={workflowStages}
          ribbon={{ slaBreaches: 26, avgTime: '1d 6h', longestWaiting: '5d 12h', estimatedCompletion: '28 Jun 2026', escalations: 8 }}
        />
        <AiWorkforceInsights items={aiInsights} onExport={exportCsv} onAudit={() => setAuditOpen(true)} />
      </div>

      <div className="mb-4">
        <QuickActionToolbar actions={quickActions} />
      </div>

      {/* Operational status */}
      <div className="mb-6 rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-[#0F172A]">Operational Status</h3>
        <OperationalStatusGrid
          items={[
            { label: 'Workflow Status', value: current?.workforceStatus || '—', tone: 'blue' },
            { label: 'Next Action', value: current?.nextRequiredAction?.slice(0, 28) || '—', tone: 'amber' },
            { label: 'Approval Status', value: current?.approvalStatus?.slice(0, 28) || '—', tone: 'amber' },
            { label: 'Compliance', value: current?.complianceStatus?.slice(0, 24) || '—', tone: 'green' },
            { label: 'Payroll Impact', value: current?.payrollImpact?.slice(0, 24) || '—', tone: 'violet' },
            { label: 'Audit History', value: current?.auditHistory || '—', tone: 'slate' },
            { label: 'Workflow Progress', value: '6 stages', tone: 'blue' },
            { label: 'Exceptions', value: String(summary?.attendanceExceptions || 0), tone: 'red' },
          ]}
        />
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Exception Indicators</p>
          <ExceptionChips labels={current?.exceptionIndicators || []} />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Workflow Controls</p>
          <WorkflowControlChips labels={['Supervisor Review', 'Project Manager', 'Cost Control', 'HR Approval', 'Payroll Posting']} />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="relative min-w-[200px] flex-[2]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee, department, site..."
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-9 text-sm font-medium outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments.slice(0, 12)} />
        <FilterSelect label="Site" value={site} onChange={setSite} options={sites.slice(0, 10)} />
        <FilterSelect label="Shift" value={shift} onChange={setShift} options={shifts} />
        <FilterSelect label="Attendance" value={attendanceFilter} onChange={setAttendanceFilter} options={['All', 'Present', 'Late', 'Absent', 'On Leave', 'Remote']} />
        <FilterSelect label="Approval" value={approvalFilter} onChange={setApprovalFilter} options={['All', 'Pending', 'Review', 'Approved']} />
        <button type="button" className="mt-5 inline-flex h-10 items-center gap-2 self-end rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#475569]">
          <SlidersHorizontal className="h-4 w-4" /> Saved Views
        </button>
      </div>

      {/* Main table + right panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <PanelShell title="Workforce Operations Register" subtitle="Attendance, time capture, approvals, payroll readiness, and exceptions.">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="sticky left-0 z-20 bg-[#F8FAFC] px-4 py-3">
                    <input type="checkbox" className="rounded" checked={pageRows.length > 0 && pageRows.every((r) => selectedRows.has(r.id))} onChange={toggleAllPage} />
                  </th>
                  {['Employee', 'Location / Site', 'Shift', 'Attendance', 'Time', 'Approval', 'Payroll', 'Hours', 'Overtime', 'Productivity', 'Exceptions', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7] text-[15px]">
                {loading && !pageRows.length
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={13} className="px-4 py-4">
                          <div className="h-10 animate-pulse rounded-lg bg-[#F1F5F9]" />
                        </td>
                      </tr>
                    ))
                  : pageRows.map((row) => {
                      const isSelected = selectedId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer transition-colors hover:bg-[#F8FAFC] ${isSelected ? 'bg-[#EFF6FF]' : ''}`}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <td className="sticky left-0 z-10 bg-white px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="rounded" checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#2563EB]">
                                {initials(row.employeeName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[#0F172A]">{row.employeeName}</p>
                                <p className="text-xs text-[#94A3B8]">
                                  {row.employeeId} · {row.department}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#475569]">
                            {row.site || row.location}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#475569]">{row.shift}</td>
                          <td className="px-4 py-3">
                            <StatusPill label={row.attendanceStatus} tone={statusTone(row.attendanceStatus)} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill label={row.timeStatus} tone={statusTone(row.timeStatus)} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill label={row.approvalStatus} tone={statusTone(row.approvalStatus)} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill label={row.payrollStatus} tone={statusTone(row.payrollStatus)} />
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#0F172A]">{number(row.hoursWorked)}</td>
                          <td className="px-4 py-3 text-sm text-[#475569]">{number(row.overtimeHours)}</td>
                          <td className="px-4 py-3">
                            <StatusPill label={row.productivityStatus} tone={statusTone(row.productivityStatus)} />
                          </td>
                          <td className="px-4 py-3">
                            {row.exceptions.length ? (
                              <span className="text-xs font-semibold text-red-600">{row.exceptions[0]}</span>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button type="button" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 text-xs font-semibold text-[#2563EB]">
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B]">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-5 py-4 text-sm text-[#64748B]">
            <span>
              {filtered.length ? `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} entries` : 'No entries'}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg border px-2 text-sm font-semibold ${page === p ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-[#E5E7EB] text-[#475569]'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </PanelShell>

        {/* Right panel */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[18px] border border-[#E5E7EB] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="border-b border-[#E5E7EB] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Employee Overview</p>
              {selected ? (
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-[#2563EB]">
                      {initials(selected.employeeName)}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-[#0F172A]">{selected.employeeName}</h3>
                      <p className="text-sm text-[#64748B]">{selected.employeeId}</p>
                      <p className="text-xs text-[#94A3B8]">{selected.department}</p>
                    </div>
                  </div>
                  <StatusPill label={selected.payrollStatus} tone={statusTone(selected.payrollStatus)} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#64748B]">Select an employee from the register.</p>
              )}
            </div>

            {selected ? (
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#94A3B8]">Pay Mode</span>
                    <p className="font-semibold text-[#0F172A]">{dailyRateRow?.payMode || 'Daily'}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Day Rate</span>
                    <p className="font-semibold text-[#0F172A]">{money(dailyRateRow?.ratePerDay, true)}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Hourly Rate</span>
                    <p className="font-semibold text-[#0F172A]">{money(dailyRateRow?.ratePerHour, true)}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Paid Hours/Day</span>
                    <p className="font-semibold text-[#0F172A]">{dailyRateRow?.hoursPerDay || 8}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Payroll Group</span>
                    <p className="font-semibold text-[#0F172A]">{dailyRateRow?.payrollGroup || 'DLE'}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Salary Grade</span>
                    <p className="font-semibold text-[#0F172A]">{dailyRateRow?.salaryGrade || selected.shift}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-xs font-semibold text-cyan-800">Timesheet</p>
                    <p className="mt-1 text-lg font-bold text-[#0F172A]">{number(dailyRateRow?.daysWorked ?? selected.hoursWorked / 8)} Days</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">Calculated Pay</p>
                    <p className="mt-1 text-lg font-bold text-[#0F172A]">{money(dailyRateRow?.grossPay, true)}</p>
                  </div>
                </div>

                <button type="button" className="h-11 w-full rounded-xl bg-[#0F172A] text-sm font-semibold text-white hover:bg-slate-800">
                  Save Review Setup
                </button>

                <ReadinessGauge
                  score={readinessFromRecord(selected)}
                  readyDays={Math.round(dailyRateRow?.daysWorked || selected.hoursWorked / 8)}
                  issuesFound={selected.exceptions.length + (dailyRateRow?.issues.length || 0)}
                  blockingIssues={selected.exceptions.filter((e) => e.toLowerCase().includes('missing') || e.toLowerCase().includes('block')).length}
                />

                <AccordionSection title="Calculation Breakdown" defaultOpen>
                  <div className="space-y-1 text-xs text-[#475569]">
                    <p>Hours worked: {number(selected.hoursWorked)}</p>
                    <p>Overtime: {number(selected.overtimeHours)}</p>
                    <p>Time in/out: {selected.timeIn || '—'} – {selected.timeOut || '—'}</p>
                  </div>
                </AccordionSection>
                <AccordionSection title="Payroll Impact">
                  <p className="text-xs text-[#64748B]">{current?.payrollImpact}</p>
                </AccordionSection>
                <AccordionSection title="Assignments" count={1}>
                  <p className="text-xs text-[#64748B]">{selected.shift} · {selected.site || selected.location}</p>
                </AccordionSection>
                <AccordionSection title="Approval History" count={2}>
                  <p className="text-xs text-[#64748B]">{selected.approvalStatus}</p>
                </AccordionSection>
                <AccordionSection title="Notes">
                  <ul className="space-y-1">
                    {selected.exceptions.map((ex) => (
                      <li key={ex} className="text-xs text-red-600">
                        {ex}
                      </li>
                    ))}
                    {!selected.exceptions.length ? <li className="text-xs text-emerald-600">No open exceptions</li> : null}
                  </ul>
                </AccordionSection>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Analytics */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard title="Attendance Trend" action={{ label: 'Export', icon: Download }}>
          <DualLineChart labels={trendLabels} seriesA={attendanceTrend} seriesB={payrollTrend} nameA="Present" nameB="Payroll Ready Hrs" />
        </AnalyticsCard>
        <AnalyticsCard title="Payroll Ready Trend">
          <DualLineChart
            labels={trendLabels}
            seriesA={payrollTrend}
            seriesB={attendanceTrend.map((v) => v * 0.85)}
            nameA="Ready Hours"
            nameB="Attendance"
          />
        </AnalyticsCard>
        <AnalyticsCard title="Productivity Distribution">
          <DonutChart rows={productivityDonut} centerLabel="Workforce" centerValue={String(records.length)} />
        </AnalyticsCard>
        <AnalyticsCard title="Top Exceptions">
          <HorizontalBarChart rows={topExceptions} />
        </AnalyticsCard>
        <AnalyticsCard title="Hours by Department">
          <HorizontalBarChart rows={deptHours} />
        </AnalyticsCard>
        <AnalyticsCard title="Workforce Utilization">
          <BudgetUtilizationGauge
            utilized={Math.round(summary?.payrollReadyHours || 0)}
            budget={Math.max(3000, Math.round((summary?.timesheetHours || 1) * 1.2))}
            label="Payroll-ready vs total hours"
          />
        </AnalyticsCard>
      </div>

      {auditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAuditOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-[18px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F172A]">Audit Trail</h3>
              <button type="button" onClick={() => setAuditOpen(false)} className="text-[#64748B]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">{current?.auditHistory}</p>
            <button type="button" onClick={() => setAuditOpen(false)} className="mt-4 h-10 w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
