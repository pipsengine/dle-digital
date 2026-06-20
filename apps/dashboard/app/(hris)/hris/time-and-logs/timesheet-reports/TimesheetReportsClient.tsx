'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GitBranch,
  Landmark,
  LockKeyhole,
  Mail,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageTemplate } from '@/components/layout/page-template';

type ReportType =
  | 'summary'
  | 'employee-detail'
  | 'department'
  | 'project'
  | 'project-manager-approval'
  | 'cost-control'
  | 'payroll-processing'
  | 'overtime-analysis'
  | 'resource-allocation'
  | 'manpower-utilization'
  | 'workforce-productivity'
  | 'approval-status'
  | 'exceptions'
  | 'audit-trail'
  | 'project-labour-cost'
  | 'project-resource-utilization';

type Summary = {
  records: number;
  employees: number;
  timesheets: number;
  totalHoursWorked: number;
  productiveHours: number;
  nonProductiveHours: number;
  overtimeHours: number;
  labourCost: number;
  projectCostAllocation: number;
  resourceUtilizationPct: number;
  workforceProductivityIndex: number;
  payrollReadyHours: number;
  pendingApprovals: number;
  rejectedTimesheets: number;
  approvalCycleTimeHours: number;
  missingTimesheets: number;
  complianceRate: number;
  exceptionRows: number;
};

type GroupedRow = Summary & {
  label: string;
  drilldownKey: string;
  groupBy: string;
};

type DetailRow = {
  headerId: string;
  lineId: string;
  allocationId: string;
  periodId: string;
  periodName: string;
  timesheetDate: string;
  supervisorName: string;
  workCenterName: string;
  normalizedStatus: string;
  approvalStatus: string;
  payrollReady: boolean;
  employeeNo: string;
  employeeName: string;
  employeeCategory: string;
  employmentType: string;
  department: string;
  section: string;
  businessUnit: string;
  costCentre: string;
  location: string;
  jobCode: string;
  jobTitle: string;
  attendanceHours: number;
  productiveHours: number;
  nonProductiveHours: number;
  overtimeHours: number;
  totalHours: number;
  variance: number;
  validationStatus: string;
  validationMessage: string | null;
  projectCode: string;
  projectName: string;
  projectManager: string;
  projectSite: string;
  activityCode: string;
  activityName: string;
  allocationHours: number;
  labourRateNgn: number;
  labourCostNgn: number;
  projectManagerStatus: string;
  costControlStatus: string;
  overtimeStatus: string;
  exceptionType: string;
  exceptionSeverity: 'Low' | 'Medium' | 'High';
  workflowHistory: string;
  approvalComments: string;
  submittedAt: string | null;
  submittedBy: string | null;
  payrollAcknowledgedAt: string | null;
  auditTrail: string;
};

type FilterOptions = {
  periods: { id: string; name: string }[];
  statuses: string[];
  supervisors: string[];
  workCenters: string[];
  projects: string[];
  employees: string[];
  departments: string[];
  sections: string[];
  businessUnits: string[];
  costCentres: string[];
  locations: string[];
  jobCodes: string[];
  activityCodes: string[];
  projectManagers: string[];
  employeeCategories: string[];
  employmentTypes: string[];
  overtimeStatuses: string[];
};

type ReportsPayload = {
  generatedAt: string;
  reportType: ReportType;
  permissions: {
    actor: string;
    role: string;
    visibilityScope: string;
    canExport: boolean;
    canSchedule: boolean;
    canViewCosts: boolean;
    canViewPayroll: boolean;
  };
  summary: Summary;
  reportRows: Array<GroupedRow | DetailRow>;
  detailRows: DetailRow[];
  drilldowns: Record<string, GroupedRow[]>;
  breakdowns: Record<string, GroupedRow[]>;
  widgets: Array<{ id: string; title: string; value: string; detail: string }>;
  subscriptions: Array<{ id: string; name: string; cadence: string; channels: string; status: string }>;
  integrations: string[];
  audit: { exportedBy: string; generatedAt: string; sourceModule: string; actionHistory: string; changeTracking: string };
  filterOptions: FilterOptions;
};

const reportTypes: { id: ReportType; label: string; description: string; icon: typeof BarChart3 }[] = [
  { id: 'summary', label: 'Timesheet Summary', description: 'Enterprise summary by payroll period and organization.', icon: BarChart3 },
  { id: 'employee-detail', label: 'Employee Detail', description: 'Employee daily entries, projects, status, and hours.', icon: Users },
  { id: 'department', label: 'Department Report', description: 'Department, section, and business unit utilization.', icon: Landmark },
  { id: 'project', label: 'Project Report', description: 'Project split hours and project manager ownership.', icon: BriefcaseBusiness },
  { id: 'project-manager-approval', label: 'PM Approval', description: 'Project manager approval status and bottlenecks.', icon: ShieldCheck },
  { id: 'cost-control', label: 'Cost Control', description: 'Cost centre allocation and budget effort analysis.', icon: LockKeyhole },
  { id: 'payroll-processing', label: 'Payroll Processing', description: 'Payroll-ready hours and consolidated summaries.', icon: CheckCircle2 },
  { id: 'overtime-analysis', label: 'Overtime Analysis', description: 'Overtime status, excessive overtime, and approval.', icon: Clock },
  { id: 'resource-allocation', label: 'Resource Allocation', description: 'Crew allocation by work center and project.', icon: GitBranch },
  { id: 'manpower-utilization', label: 'Manpower Utilization', description: 'Location and manpower utilization monitoring.', icon: Users },
  { id: 'workforce-productivity', label: 'Productivity', description: 'Workforce productivity index and trends.', icon: TrendingUp },
  { id: 'approval-status', label: 'Approval Status', description: 'Workflow stages, comments, returns, and cycle time.', icon: FileText },
  { id: 'exceptions', label: 'Exception Report', description: 'Missing, rejected, duplicate, invalid, and bottleneck checks.', icon: AlertTriangle },
  { id: 'audit-trail', label: 'Audit Trail', description: 'Workflow history, comments, changes, and export audit.', icon: FileSpreadsheet },
  { id: 'project-labour-cost', label: 'Project Labour Cost', description: 'Labour cost by project, activity, and cost centre.', icon: Landmark },
  { id: 'project-resource-utilization', label: 'Project Resource Use', description: 'Project resource utilization and effort analysis.', icon: BriefcaseBusiness },
];

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat('en-GB');

const formatMoney = (value: number) => moneyFmt.format(Number(value || 0));
const formatHours = (value: number) => `${numberFmt.format(Number(value || 0))}h`;
const formatNumber = (value: number) => intFmt.format(Number(value || 0));
const formatStatus = (status: string) => status.replace(/_/g, ' ');
const isGroupedRow = (row: GroupedRow | DetailRow): row is GroupedRow => 'label' in row;

const normalizeDimensionLabel = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unassigned';
  const normalized = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const key = normalized.toLowerCase();
  if (['permanent', 'permanent staff'].includes(key)) return 'Permanent';
  if (['lumpsum', 'lump sum', 'contract on lumpsum', 'contract lump sum'].includes(key)) return 'Lumpsum';
  if (['daily rate', 'contract on day rate', 'contract day rate', 'day rate'].includes(key)) return 'Daily Rate';
  if (key === 'no project') return 'No Project';
  if (key === 'unassigned') return 'Unassigned';
  if (/^p\d{4}\s+-/i.test(normalized) || /^c?\d{4}\s+-/i.test(normalized)) return normalized;
  if (normalized.length <= 4) return normalized.toUpperCase();
  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ');
};

const uniqueFilterValues = (values: string[] = []) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const label = normalizeDimensionLabel(value).toLowerCase();
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};

const statusClass = (status: string) => {
  if (status === 'HR_Acknowledged' || status === 'Locked' || status === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected' || status === 'Returned') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Submitted') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Supervisor_Reviewed') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (status === 'Cost_Control_Reviewed' || status === 'Project_Manager_Reviewed') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const csvValue = (value: unknown) => {
  const normalized = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

function MultiSelect({ label, values, selected, onChange, limit = 8, compact = false }: { label: string; values: string[]; selected: string[]; onChange: (next: string[]) => void; limit?: number; compact?: boolean }) {
  const cleanValues = uniqueFilterValues(values);
  const visible = cleanValues.slice(0, limit);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        {selected.length ? <button type="button" onClick={() => onChange([])} className="text-[10px] font-black text-blue-700">Clear</button> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((value) => {
          const active = selected.includes(value);
          return (
            <button key={value} type="button" onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])} title={value} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${active ? 'border-blue-500 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <span className={`block truncate ${compact ? 'max-w-[140px]' : 'max-w-[180px]'}`}>{normalizeDimensionLabel(value)}</span>
            </button>
          );
        })}
        {cleanValues.length > visible.length ? <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-400">+{cleanValues.length - visible.length}</span> : null}
      </div>
    </div>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone = 'blue' }: { label: string; value: string; detail: string; icon: typeof BarChart3; tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tone];
  const iconClass = {
    blue: 'bg-blue-600 text-white',
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-red-600 text-white',
    slate: 'bg-slate-800 text-white',
  }[tone];
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`rounded-lg p-2 ${iconClass}`}><Icon className="h-5 w-5" /></div>
        <div className="text-right">
          <div className="text-xl font-black text-slate-950">{value}</div>
          <div className="text-[11px] font-semibold text-slate-500">{detail}</div>
        </div>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconClass}`} />
    </div>
  );
}

export default function TimesheetReportsClient() {
  const [payload, setPayload] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState('');
  const [payrollReady, setPayrollReady] = useState<'all' | 'yes' | 'no'>('all');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [workCenters, setWorkCenters] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [projectManagers, setProjectManagers] = useState<string[]>([]);
  const [costCentres, setCostCentres] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [employeeCategories, setEmployeeCategories] = useState<string[]>([]);
  const [drilldown, setDrilldown] = useState<{ groupBy: string; key: string } | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ reportType, from, to });
    if (query.trim()) params.set('query', query.trim());
    if (payrollReady !== 'all') params.set('payrollReady', payrollReady);
    if (statuses.length) params.set('statuses', statuses.join(','));
    if (supervisors.length) params.set('supervisors', supervisors.join(','));
    if (workCenters.length) params.set('workCenters', workCenters.join(','));
    if (periods.length) params.set('periods', periods.join(','));
    if (projects.length) params.set('projects', projects.join(','));
    if (departments.length) params.set('departments', departments.join(','));
    if (locations.length) params.set('locations', locations.join(','));
    if (projectManagers.length) params.set('projectManagers', projectManagers.join(','));
    if (costCentres.length) params.set('costCentres', costCentres.join(','));
    if (employmentTypes.length) params.set('employmentTypes', employmentTypes.join(','));
    if (employeeCategories.length) params.set('employeeCategories', employeeCategories.join(','));
    return `/api/hris/time-and-logs/timesheet-reports?${params.toString()}`;
  }, [costCentres, departments, employeeCategories, employmentTypes, from, locations, payrollReady, periods, projectManagers, projects, query, reportType, statuses, supervisors, to, workCenters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(requestUrl, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to load timesheet reports');
      setPayload(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load timesheet reports');
    } finally {
      setLoading(false);
    }
  }, [requestUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportRows = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'print') {
      window.print();
      return;
    }
    if (format === 'pdf') {
      window.print();
      return;
    }
    const rows = payload?.detailRows || [];
    const columns: Array<[string, keyof DetailRow]> = [
      ['Date', 'timesheetDate'],
      ['Employee No', 'employeeNo'],
      ['Employee Name', 'employeeName'],
      ['Category', 'employeeCategory'],
      ['Employment Type', 'employmentType'],
      ['Department', 'department'],
      ['Section', 'section'],
      ['Business Unit', 'businessUnit'],
      ['Location', 'location'],
      ['Supervisor', 'supervisorName'],
      ['Project', 'projectCode'],
      ['Project Manager', 'projectManager'],
      ['Cost Centre', 'costCentre'],
      ['Activity Code', 'activityCode'],
      ['Approval Status', 'approvalStatus'],
      ['Timesheet Status', 'normalizedStatus'],
      ['Overtime Status', 'overtimeStatus'],
      ['Productive Hours', 'productiveHours'],
      ['Non Productive Hours', 'nonProductiveHours'],
      ['Overtime Hours', 'overtimeHours'],
      ['Labour Cost', 'labourCostNgn'],
      ['Exception', 'exceptionType'],
      ['Audit Trail', 'auditTrail'],
    ];
    const csv = [columns.map(([label]) => csvValue(label)).join(','), ...rows.map((row) => columns.map(([, key]) => csvValue(row[key])).join(','))].join('\n');
    const blob = new Blob([csv], { type: format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-${reportType}-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filterOptions = payload?.filterOptions;
  const summary = payload?.summary;
  const activeReport = reportTypes.find((item) => item.id === reportType) || reportTypes[0];
  const periodNameById = new Map((filterOptions?.periods || []).map((period) => [period.id, period.name]));
  const activeFilterItems = [
    ...periods.map((id) => ({ group: 'Period', value: periodNameById.get(id) || id })),
    ...statuses.map((value) => ({ group: 'Status', value })),
    ...projects.map((value) => ({ group: 'Project', value })),
    ...departments.map((value) => ({ group: 'Department', value })),
    ...projectManagers.map((value) => ({ group: 'Project Manager', value })),
    ...supervisors.map((value) => ({ group: 'Supervisor', value })),
    ...costCentres.map((value) => ({ group: 'Cost Centre', value })),
    ...locations.map((value) => ({ group: 'Location', value })),
    ...workCenters.map((value) => ({ group: 'Work Center', value })),
    ...employmentTypes.map((value) => ({ group: 'Employment Type', value })),
    ...employeeCategories.map((value) => ({ group: 'Employee Category', value })),
    ...(payrollReady !== 'all' ? [{ group: 'Payroll', value: payrollReady === 'yes' ? 'Payroll Ready' : 'Not Payroll Ready' }] : []),
  ];
  const clearAllFilters = () => {
    setQuery('');
    setPayrollReady('all');
    setStatuses([]);
    setSupervisors([]);
    setWorkCenters([]);
    setPeriods([]);
    setProjects([]);
    setDepartments([]);
    setLocations([]);
    setProjectManagers([]);
    setCostCentres([]);
    setEmploymentTypes([]);
    setEmployeeCategories([]);
    setDrilldown(null);
  };
  const drilldownRows = drilldown ? (payload?.detailRows || []).filter((row) => {
    const value = drilldown.groupBy === 'project' ? `${row.projectCode} - ${row.projectName}` : drilldown.groupBy === 'department' ? row.department : drilldown.groupBy === 'employee' ? `${row.employeeNo} - ${row.employeeName}` : drilldown.groupBy === 'supervisor' ? row.supervisorName : drilldown.groupBy === 'date' ? row.timesheetDate : row.businessUnit;
    return value === drilldown.key;
  }) : [];

  return (
    <PageTemplate
      title="Timesheet Reporting & Analytics"
      description="Enterprise timesheet intelligence across workforce, projects, approvals, payroll, labour cost, exceptions, and audit controls."
      breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Workforce Management', href: '/hris/workforce-management' }, { label: 'Timesheet Reports' }]}
      primaryAction={{ label: loading ? 'Refreshing' : 'Refresh', onClick: load, icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: () => exportRows('csv'), icon: Download }}
    >
      <div className="space-y-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Report Catalogue</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{activeReport.label}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{activeReport.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportRows('excel')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" />Excel</button>
              <button onClick={() => exportRows('pdf')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><FileText className="h-4 w-4" />PDF</button>
              <button onClick={() => exportRows('print')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" />Print</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {reportTypes.map((item) => {
              const active = reportType === item.id;
              return (
                <button key={item.id} type="button" onClick={() => { setReportType(item.id); setDrilldown(null); }} className={`min-h-[78px] rounded-lg border p-3 text-left transition ${active ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  <item.icon className="mb-2 h-4 w-4" />
                  <div className="text-[11px] font-black uppercase leading-tight">{item.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Report Filters</p>
              <h3 className="mt-1 text-sm font-black text-slate-950">{activeFilterItems.length} active filter{activeFilterItems.length === 1 ? '' : 's'}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">Period and date range are applied together as an intersection.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowAdvancedFilters((value) => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                <Filter className="h-4 w-4" /> {showAdvancedFilters ? 'Hide Advanced' : 'Advanced Filters'}
              </button>
              <button type="button" onClick={clearAllFilters} disabled={!activeFilterItems.length && !query} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, project, PM, department, location, status..." className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600" />
            </label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-600" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-600" />
            <select value={payrollReady} onChange={(e) => setPayrollReady(e.target.value as 'all' | 'yes' | 'no')} className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-600">
              <option value="all">All payroll states</option>
              <option value="yes">Payroll-ready only</option>
              <option value="no">Not payroll-ready</option>
            </select>
          </div>

          {activeFilterItems.length ? (
            <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
              {activeFilterItems.slice(0, 12).map((item) => (
                <span key={`${item.group}-${item.value}`} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-black text-blue-800">
                  {item.group}: {normalizeDimensionLabel(item.value)}
                </span>
              ))}
              {activeFilterItems.length > 12 ? <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-black text-blue-800">+{activeFilterItems.length - 12} more</span> : null}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <MultiSelect label="Periods" values={(filterOptions?.periods || []).map((period) => period.name)} selected={periods.map((id) => filterOptions?.periods.find((period) => period.id === id)?.name || id)} onChange={(nextNames) => setPeriods(nextNames.map((name) => filterOptions?.periods.find((period) => period.name === name)?.id || name))} compact />
            <MultiSelect label="Statuses" values={filterOptions?.statuses || []} selected={statuses} onChange={setStatuses} compact />
            <MultiSelect label="Projects" values={filterOptions?.projects || []} selected={projects} onChange={setProjects} compact />
            <MultiSelect label="Departments" values={filterOptions?.departments || []} selected={departments} onChange={setDepartments} compact />
          </div>

          {showAdvancedFilters ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced Filters</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Use these for role, location, cost, employment, and workforce dimension analysis.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <MultiSelect label="Project Managers" values={filterOptions?.projectManagers || []} selected={projectManagers} onChange={setProjectManagers} compact />
                <MultiSelect label="Supervisors" values={filterOptions?.supervisors || []} selected={supervisors} onChange={setSupervisors} compact />
                <MultiSelect label="Cost Centres" values={filterOptions?.costCentres || []} selected={costCentres} onChange={setCostCentres} compact />
                <MultiSelect label="Locations" values={filterOptions?.locations || []} selected={locations} onChange={setLocations} compact />
                <MultiSelect label="Work Centers" values={filterOptions?.workCenters || []} selected={workCenters} onChange={setWorkCenters} compact />
                <MultiSelect label="Employment Type" values={filterOptions?.employmentTypes || []} selected={employmentTypes} onChange={setEmploymentTypes} compact />
                <MultiSelect label="Employee Category" values={filterOptions?.employeeCategories || []} selected={employeeCategories} onChange={setEmployeeCategories} compact />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Total Hours Worked" value={formatHours(summary?.totalHoursWorked || 0)} detail={`${formatNumber(summary?.timesheets || 0)} timesheets`} icon={Clock} />
          <KpiCard label="Productive Hours" value={formatHours(summary?.productiveHours || 0)} detail={`${formatNumber(summary?.resourceUtilizationPct || 0)}% utilization`} icon={BriefcaseBusiness} tone="green" />
          <KpiCard label="Non-Productive Hours" value={formatHours(summary?.nonProductiveHours || 0)} detail={`${formatHours(summary?.overtimeHours || 0)} overtime`} icon={AlertTriangle} tone="amber" />
          <KpiCard label="Labour Cost" value={formatMoney(summary?.labourCost || 0)} detail={`${formatMoney(summary?.projectCostAllocation || 0)} allocated`} icon={Landmark} tone="slate" />
          <KpiCard label="Payroll-Ready Hours" value={formatHours(summary?.payrollReadyHours || 0)} detail={`${formatNumber(summary?.pendingApprovals || 0)} pending approvals`} icon={CheckCircle2} tone="green" />
          <KpiCard label="Compliance Rate" value={`${formatNumber(summary?.complianceRate || 0)}%`} detail={`${formatNumber(summary?.exceptionRows || 0)} exceptions`} icon={ShieldCheck} tone={(summary?.exceptionRows || 0) ? 'red' : 'green'} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">Interactive Report View</h2>
                <p className="text-xs font-semibold text-slate-500">{loading ? 'Refreshing report data...' : `Generated ${payload ? new Date(payload.generatedAt).toLocaleString() : '-'}`}</p>
              </div>
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Group / Line</th>
                    <th className="px-4 py-3 text-right">Records</th>
                    <th className="px-4 py-3 text-right">Employees</th>
                    <th className="px-4 py-3 text-right">Productive</th>
                    <th className="px-4 py-3 text-right">Non-Prod</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Compliance</th>
                    <th className="px-4 py-3 text-right">Exceptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(payload?.reportRows || []).slice(0, 120).map((row, index) => {
                    if (isGroupedRow(row)) {
                      return (
                        <tr key={`${row.label}-${index}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setDrilldown({ groupBy: row.groupBy, key: row.drilldownKey })} className="text-left font-black text-blue-800 hover:underline">{formatStatus(row.label)}</button>
                            <div className="text-[11px] font-semibold text-slate-500">Drill down by {row.groupBy}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{formatNumber(row.records)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatNumber(row.employees)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatHours(row.productiveHours)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatHours(row.nonProductiveHours)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatMoney(row.labourCost)}</td>
                          <td className="px-4 py-3 text-right font-black">{formatNumber(row.complianceRate)}%</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{formatNumber(row.exceptionRows)}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={row.allocationId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-900">{row.employeeName}</div>
                          <div className="text-xs font-bold text-slate-500">{row.employeeNo} / {row.projectCode} / {row.timesheetDate}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">1</td>
                        <td className="px-4 py-3 text-right font-bold">1</td>
                        <td className="px-4 py-3 text-right font-bold">{formatHours(row.productiveHours)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatHours(row.nonProductiveHours)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatMoney(row.labourCostNgn)}</td>
                        <td className="px-4 py-3 text-right font-black">{row.validationStatus === 'Valid' ? '100%' : '0%'}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{row.exceptionType === 'None' ? 0 : 1}</td>
                      </tr>
                    );
                  })}
                  {!loading && !payload?.reportRows.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-400">No report data matches the current filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <Breakdown title="Approval Status" rows={payload?.breakdowns.status || []} onSelect={(row) => setDrilldown({ groupBy: row.groupBy, key: row.drilldownKey })} />
            <Breakdown title="Top Projects" rows={payload?.breakdowns.project || []} onSelect={(row) => setDrilldown({ groupBy: row.groupBy, key: row.drilldownKey })} />
            <Breakdown title="Exceptions" rows={payload?.breakdowns.exception || []} onSelect={(row) => setDrilldown({ groupBy: row.groupBy, key: row.drilldownKey })} />
          </div>
        </div>

        {drilldown && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Drill-Down Analysis</p>
                <h3 className="text-base font-black text-slate-950">{formatStatus(drilldown.key)}</h3>
              </div>
              <button type="button" onClick={() => setDrilldown(null)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-black text-blue-700">Close</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>{['Date', 'Employee', 'Department', 'Project', 'PM', 'Productive', 'Cost', 'Status', 'Exception'].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drilldownRows.slice(0, 100).map((row) => (
                    <tr key={row.allocationId}>
                      <td className="px-4 py-3 font-bold">{row.timesheetDate}</td>
                      <td className="px-4 py-3 font-black">{row.employeeName}</td>
                      <td className="px-4 py-3 font-bold">{row.department}</td>
                      <td className="px-4 py-3 font-bold">{row.projectCode}</td>
                      <td className="px-4 py-3 font-bold">{row.projectManager}</td>
                      <td className="px-4 py-3 font-bold">{formatHours(row.productiveHours)}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(row.labourCostNgn)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.normalizedStatus)}`}>{formatStatus(row.normalizedStatus)}</span></td>
                      <td className="px-4 py-3 font-bold text-red-700">{row.exceptionType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Panel title="Dashboard Widgets" icon={BarChart3}>
            {(payload?.widgets || []).map((widget) => (
              <div key={widget.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-slate-800">{widget.title}</span><span className="text-sm font-black text-blue-700">{widget.value}</span></div>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{widget.detail}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Subscriptions & Distribution" icon={Mail}>
            {(payload?.subscriptions || []).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-slate-800">{item.name}</span><span className="text-[10px] font-black uppercase text-emerald-700">{item.status}</span></div>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{item.cadence} / {item.channels}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Audit & Integration" icon={Bell}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">
              <p><span className="font-black text-slate-900">Generated By:</span> {payload?.audit.exportedBy || '-'}</p>
              <p className="mt-1"><span className="font-black text-slate-900">Source:</span> {payload?.audit.sourceModule || '-'}</p>
              <p className="mt-1"><span className="font-black text-slate-900">Scope:</span> {payload?.permissions.visibilityScope || '-'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(payload?.integrations || []).map((item) => <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">{item}</span>)}
            </div>
          </Panel>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-slate-900">Timesheet Line Detail</h2>
              <p className="text-xs font-semibold text-slate-500">Allocation-level detail with workflow, payroll, cost, and audit fields. Showing up to 1,000 rows.</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{formatNumber(payload?.detailRows.length || 0)} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr>{['Employee', 'Date / Period', 'Org', 'Project / Activity', 'Approval', 'Payroll', 'Hours', 'Cost', 'Exception', 'Audit'].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payload?.detailRows || []).map((row) => (
                  <tr key={row.allocationId} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><div className="font-black text-slate-900">{row.employeeName}</div><div className="text-xs font-bold text-slate-500">{row.employeeNo} / {row.employmentType}</div></td>
                    <td className="px-4 py-3"><div className="font-bold">{row.timesheetDate}</div><div className="text-xs font-semibold text-slate-500">{row.periodName}</div></td>
                    <td className="px-4 py-3"><div className="font-bold">{row.department}</div><div className="text-xs font-semibold text-slate-500">{row.businessUnit} / {row.location}</div></td>
                    <td className="px-4 py-3"><div className="font-black text-blue-800">{row.projectCode}</div><div className="text-xs font-semibold text-slate-500">{row.activityCode} / {row.projectManager}</div></td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(row.normalizedStatus)}`}>{formatStatus(row.normalizedStatus)}</span><div className="mt-1 text-xs font-semibold text-slate-500">{row.projectManagerStatus} / {row.costControlStatus}</div></td>
                    <td className="px-4 py-3"><div className={row.payrollReady ? 'font-black text-emerald-700' : 'font-black text-slate-500'}>{row.payrollReady ? 'Ready' : 'Not Ready'}</div><div className="text-xs font-semibold text-slate-500">{row.overtimeStatus}</div></td>
                    <td className="px-4 py-3 text-right"><div className="font-black">{formatHours(row.productiveHours)}</div><div className="text-xs font-semibold text-slate-500">Idle {formatHours(row.nonProductiveHours)} / OT {formatHours(row.overtimeHours)}</div></td>
                    <td className="px-4 py-3 text-right"><div className="font-black">{formatMoney(row.labourCostNgn)}</div><div className="text-xs font-semibold text-slate-500">@ {formatMoney(row.labourRateNgn)}</div></td>
                    <td className="px-4 py-3"><div className={row.exceptionType === 'None' ? 'font-black text-emerald-600' : 'font-black text-red-700'}>{row.exceptionType}</div><div className="text-xs font-semibold text-slate-500">{row.validationMessage || row.exceptionSeverity}</div></td>
                    <td className="px-4 py-3"><div className="max-w-[260px] truncate text-xs font-semibold text-slate-500" title={row.workflowHistory || row.auditTrail}>{row.workflowHistory || row.auditTrail}</div></td>
                  </tr>
                ))}
                {!loading && !payload?.detailRows.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm font-bold text-slate-400">No timesheet lines available for this report.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}

function Breakdown({ title, rows, onSelect }: { title: string; rows: GroupedRow[]; onSelect: (row: GroupedRow) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-black text-slate-900">{title}</h2></div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 8).map((row) => (
          <button key={`${row.groupBy}-${row.label}`} type="button" onClick={() => onSelect(row)} className="block w-full px-4 py-3 text-left hover:bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-black text-slate-800">{formatStatus(row.label)}</span>
              <span className="shrink-0 text-sm font-black text-slate-900">{formatHours(row.productiveHours)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
              <span>{formatNumber(row.records)} records</span>
              <span>{formatMoney(row.labourCost)}</span>
            </div>
          </button>
        ))}
        {!rows.length && <div className="px-4 py-8 text-center text-sm font-bold text-slate-400">No data</div>}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Icon className="h-4 w-4 text-blue-700" />
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
