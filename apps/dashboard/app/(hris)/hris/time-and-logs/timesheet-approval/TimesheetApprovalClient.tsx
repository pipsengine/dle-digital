'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LockKeyhole,
  Printer,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ThumbsDown,
  Users,
} from 'lucide-react';
import { PageTemplate } from '@/components/layout/page-template';

type TimesheetStatus =
  | 'Draft'
  | 'Submitted'
  | 'Supervisor_Reviewed'
  | 'Project_Manager_Reviewed'
  | 'Cost_Control_Reviewed'
  | 'HR_Acknowledged'
  | 'Locked'
  | 'Rejected'
  | 'Returned';

type WorkflowStep = {
  id: string;
  stage: string;
  owner: string;
  status: string;
  by: string | null;
  actedAt: string | null;
  comment: string | null;
  agingHours: number;
  slaStatus: 'On Track' | 'At Risk' | 'Breached';
};

type ProjectApproval = {
  headerId: string;
  projectCode: string;
  projectName: string;
  projectManager: string;
  employeeCount: number;
  totalHours: number;
  billableHours: number;
  costCenter: string;
  overtimeHours: number;
  labourCost: number;
  costControlStatus: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  projectManagerStatus: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  approvalStatus: string;
  lineIds: string[];
};

type EmployeeRow = {
  lineId: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  businessUnit: string;
  employmentType: string;
  location: string;
  clockIn: string | null;
  clockOut: string | null;
  attendanceHours: number;
  productiveHours: number;
  idleHours: number;
  overtimeHours: number;
  totalHours: number;
  variance: number;
  validationStatus: string;
  activities: Array<{
    projectCode: string;
    projectName: string;
    activityCode: string;
    activityName: string;
    hours: number;
    labourCost: number;
    remarks: string | null;
  }>;
};

type TimesheetSummary = {
  id: string;
  timesheetDate: string;
  supervisorName: string;
  workCenterName: string;
  status: TimesheetStatus;
  statusLabel: string;
  currentStage: string | null;
  currentOwner: string;
  nextActionLabel: string | null;
  payrollReady: boolean;
  payrollProcessed: boolean;
  payrollPosted: boolean;
  payrollAcknowledgedAt: string | null;
  totalEmployees: number;
  totalHours: number;
  productiveHours: number;
  idleHours: number;
  overtimeHours: number;
  labourCost: number;
  payrollReadyHours: number;
  workforceUtilization: number;
  submittedAt: string | null;
  periodName: string;
  workflowSteps: WorkflowStep[];
  projectApprovals: ProjectApproval[];
  employeeRows: EmployeeRow[];
  approvalHistory: Array<{ stage: string; decision: string; by: string; actedAt: string; comment: string | null }>;
  projectApprovalSummary: {
    totalProjects: number;
    projectManagerApproved: number;
    costControlApproved: number;
    projectManagerPending: number;
    costControlPending: number;
    approvalText: string;
    costControlText: string;
    consolidatedForHr: boolean;
  };
};

type ApprovalPayload = {
  permissions: {
    actor: string;
    role: string;
    visibilityScope: string;
    canApprove: boolean;
    canBulkApprove: boolean;
    canAcknowledgePayroll: boolean;
    canApproveAllLevels: boolean;
    canExport: boolean;
  };
  pendingTimesheets: TimesheetSummary[];
  stats: Record<string, number>;
  filterOptions: {
    workCenters: string[];
    periods: string[];
    supervisors: string[];
    projects: string[];
    projectManagers: string[];
    costCenters: string[];
    statuses: TimesheetStatus[];
    workflowStages: string[];
  };
  audit: { generatedBy: string; generatedAt: string; sourceModule: string; actionHistory: string };
};

type ApprovalAction = 'APPROVE' | 'REJECT' | 'RETURN' | 'PROCESS_PAYROLL' | 'POST_PAYROLL';
type ProjectStage = 'Cost Control' | 'Project Manager';

const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat('en-GB');

const formatMoney = (value: number) => moneyFmt.format(Number(value || 0));
const formatHours = (value: number) => `${numberFmt.format(Number(value || 0))}h`;
const formatInt = (value: number) => intFmt.format(Number(value || 0));
const formatDateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '-';
const labelStatus = (status: string) => status.replace(/_/g, ' ');

const statusTone = (status: string) => {
  if (['HR_Acknowledged', 'Locked', 'Approved'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Returned') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Cost_Control_Reviewed') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Project_Manager_Reviewed') return 'border-purple-200 bg-purple-50 text-purple-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const slaTone = (sla: string) => {
  if (sla === 'Breached') return 'bg-red-50 text-red-700 border-red-200';
  if (sla === 'At Risk') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function KpiCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Clock; tone: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate' }) {
  const color = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    purple: 'border-purple-100 bg-purple-50 text-purple-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${color}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-lg bg-white/80 p-2"><Icon className="h-5 w-5" /></div>
        <div className="text-right">
          <div className="text-2xl font-black text-slate-950">{value}</div>
          <div className="text-[11px] font-bold text-slate-500">{detail}</div>
        </div>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}

function SelectFilter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none">
        <option value="All">All</option>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

export default function TimesheetApprovalClient() {
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [pmFilter, setPmFilter] = useState('All');
  const [costFilter, setCostFilter] = useState('All');
  const [periodFilter, setPeriodFilter] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-approval', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Failed to load approvals');
      setPayload(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (input: { action: ApprovalAction; headerId?: string; headerIds?: string[]; projectCode?: string; stage?: ProjectStage; projectSegments?: Array<{ headerId: string; projectCode: string; stage: ProjectStage }>; comment: string }) => {
    setSubmitting(input.headerId || input.action);
    setError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to update approval workflow');
      setPayload(json.data);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update approval workflow');
    } finally {
      setSubmitting(null);
    }
  };

  const filteredTimesheets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (payload?.pendingTimesheets || []).filter((item) => {
      const searchable = [
        item.supervisorName,
        item.workCenterName,
        item.periodName,
        item.timesheetDate,
        item.status,
        item.currentStage || '',
        ...item.projectApprovals.flatMap((project) => [project.projectCode, project.projectName, project.projectManager, project.costCenter]),
        ...item.employeeRows.flatMap((employee) => [employee.employeeNo, employee.employeeName, employee.department, employee.businessUnit]),
      ].join(' ').toLowerCase();
      if (term && !searchable.includes(term)) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (stageFilter !== 'All' && item.currentStage !== stageFilter) return false;
      if (periodFilter !== 'All' && item.periodName !== periodFilter) return false;
      if (projectFilter !== 'All' && !item.projectApprovals.some((project) => project.projectCode === projectFilter)) return false;
      if (pmFilter !== 'All' && !item.projectApprovals.some((project) => project.projectManager === pmFilter)) return false;
      if (costFilter !== 'All' && !item.projectApprovals.some((project) => project.costCenter === costFilter)) return false;
      return true;
    });
  }, [costFilter, payload, periodFilter, pmFilter, projectFilter, query, stageFilter, statusFilter]);

  const selectedRows = filteredTimesheets.filter((item) => selected.includes(item.id));
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const canApprove = Boolean(payload?.permissions.canApprove);

  const bulkHeaderAction = (action: ApprovalAction, comment: string) => {
    if (!selectedRows.length) return;
    void act({ action, headerIds: selectedRows.map((item) => item.id), comment });
  };

  const bulkProjectAction = (stage: ProjectStage, action: ApprovalAction) => {
    const projectSegments = selectedRows.flatMap((item) =>
      item.projectApprovals
        .filter((project) => stage === 'Cost Control' ? project.costControlStatus === 'Pending' : project.projectManagerStatus === 'Pending')
        .map((project) => ({ headerId: item.id, projectCode: project.projectCode, stage })),
    );
    if (!projectSegments.length) return;
    void act({ action, projectSegments, comment: `${stage} bulk ${action.toLowerCase()} completed.` });
  };

  const exportRows = (format: 'csv' | 'excel' | 'print' | 'pdf') => {
    if (format === 'print' || format === 'pdf') {
      window.print();
      return;
    }
    const rows = filteredTimesheets.flatMap((item) => item.projectApprovals.map((project) => ({
      date: item.timesheetDate,
      period: item.periodName,
      supervisor: item.supervisorName,
      workCenter: item.workCenterName,
      status: item.status,
      currentStage: item.currentStage,
      project: project.projectCode,
      projectName: project.projectName,
      projectManager: project.projectManager,
      costCenter: project.costCenter,
      hours: project.totalHours,
      overtime: project.overtimeHours,
      labourCost: project.labourCost,
      costStatus: project.costControlStatus,
      pmStatus: project.projectManagerStatus,
    })));
    const columns = Object.keys(rows[0] || { date: '', period: '', supervisor: '', project: '', hours: '' });
    const csv = [columns.map(csvValue).join(','), ...rows.map((row) => columns.map((col) => csvValue((row as Record<string, unknown>)[col])).join(','))].join('\n');
    const blob = new Blob([csv], { type: format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-approval-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !payload) {
    return (
      <PageTemplate title="Timesheet Approvals" description="Loading approval workspace..." breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}>
        <div className="flex h-96 items-center justify-center"><RefreshCcw className="h-8 w-8 animate-spin text-slate-400" /></div>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate
      title="Timesheet Approval Workspace"
      description="Supervisor, Cost Control, Project Manager, HR, and Payroll approval control for project-based timesheets."
      breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}
      primaryAction={{ label: 'Refresh', onClick: load, icon: RefreshCcw }}
    >
      <div className="space-y-6">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="Pending Submission" value={formatInt(payload?.stats.pendingSubmission || 0)} detail="Draft entries" icon={FileText} tone="slate" />
          <KpiCard label="Supervisor Approval" value={formatInt(payload?.stats.pendingSupervisorApproval || 0)} detail="Waiting supervisor" icon={ShieldCheck} tone="blue" />
          <KpiCard label="Cost Control Review" value={formatInt(payload?.stats.pendingCostControlReview || 0)} detail="Allocation validation" icon={Banknote} tone="amber" />
          <KpiCard label="Project Manager" value={formatInt(payload?.stats.pendingProjectManagerApproval || 0)} detail="Project approvals" icon={Users} tone="purple" />
          <KpiCard label="HR Approval" value={formatInt(payload?.stats.pendingHrApproval || 0)} detail="Consolidation review" icon={CheckCircle2} tone="green" />
          <KpiCard label="Payroll Posted" value={formatInt(payload?.stats.payrollPosted || 0)} detail={`${formatInt(payload?.stats.payrollReady || 0)} ready`} icon={LockKeyhole} tone="green" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Hours Worked" value={formatHours(payload?.stats.totalHoursWorked || 0)} detail={`${formatHours(payload?.stats.overtimeHours || 0)} overtime`} icon={Clock} tone="blue" />
          <KpiCard label="Labour Cost" value={formatMoney(payload?.stats.labourCost || 0)} detail="Project cost allocation" icon={Banknote} tone="amber" />
          <KpiCard label="Payroll Ready Hours" value={formatHours(payload?.stats.payrollReadyHours || 0)} detail={`${formatInt(payload?.stats.pendingPayrollProcessing || 0)} pending payroll`} icon={FileSpreadsheet} tone="green" />
          <KpiCard label="Approval Aging" value={formatHours(payload?.stats.approvalAgingHours || 0)} detail={`${formatInt(payload?.stats.pendingApprovals || 0)} pending approvals`} icon={AlertTriangle} tone={(payload?.stats.approvalAgingHours || 0) > 24 ? 'red' : 'slate'} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, project, PM, cost center, supervisor..." className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <SelectFilter label="Status" value={statusFilter} values={payload?.filterOptions.statuses || []} onChange={setStatusFilter} />
              <SelectFilter label="Stage" value={stageFilter} values={payload?.filterOptions.workflowStages || []} onChange={setStageFilter} />
              <SelectFilter label="Period" value={periodFilter} values={payload?.filterOptions.periods || []} onChange={setPeriodFilter} />
              <SelectFilter label="Project" value={projectFilter} values={payload?.filterOptions.projects || []} onChange={setProjectFilter} />
              <SelectFilter label="Project Manager" value={pmFilter} values={payload?.filterOptions.projectManagers || []} onChange={setPmFilter} />
              <SelectFilter label="Cost Center" value={costFilter} values={payload?.filterOptions.costCenters || []} onChange={setCostFilter} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bulk Operations</p>
              <h3 className="mt-1 text-sm font-black text-slate-900">{selected.length} selected / {filteredTimesheets.length} visible</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkHeaderAction('APPROVE', 'Bulk header approval completed.')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">Bulk Approval</button>
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkProjectAction('Cost Control', 'APPROVE')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">Bulk Cost Approve</button>
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkProjectAction('Project Manager', 'APPROVE')} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">Bulk PM Approve</button>
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkHeaderAction('RETURN', 'Bulk return for correction.')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-700 disabled:opacity-40">Bulk Return</button>
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkHeaderAction('REJECT', 'Bulk rejection completed.')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-700 disabled:opacity-40">Bulk Rejection</button>
              <button type="button" disabled={!selected.length || !canApprove} onClick={() => bulkHeaderAction('PROCESS_PAYROLL', 'Bulk payroll processing completed.')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40">Bulk Payroll</button>
              <button type="button" onClick={() => exportRows('excel')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700"><Download className="mr-1 inline h-3.5 w-3.5" />Export</button>
              <button type="button" onClick={() => exportRows('print')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700"><Printer className="mr-1 inline h-3.5 w-3.5" />Print</button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-4">
                    <input type="checkbox" checked={selected.length === filteredTimesheets.length && filteredTimesheets.length > 0} onChange={(e) => setSelected(e.target.checked ? filteredTimesheets.map((item) => item.id) : [])} className="rounded border-slate-300" />
                  </th>
                  {['Timesheet', 'Workflow Progress', 'Project Consolidation', 'Hours & Cost', 'Payroll', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTimesheets.map((item) => {
                  const open = expanded.includes(item.id);
                  const currentSla = item.workflowSteps.find((step) => step.stage === item.currentStage)?.slaStatus || 'On Track';
                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-5">
                        <input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="rounded border-slate-300" />
                      </td>
                      <td className="px-4 py-5">
                        <button type="button" onClick={() => toggleExpanded(item.id)} className="mb-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Drill Down
                        </button>
                        <div className="font-black text-slate-950">{item.timesheetDate}</div>
                        <div className="mt-1 text-xs font-bold text-slate-600">{item.workCenterName}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.periodName} / {item.supervisorName}</div>
                        <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(item.status)}`}>{labelStatus(item.status)}</span>
                      </td>
                      <td className="px-4 py-5">
                        <div className="grid min-w-[520px] grid-cols-6 gap-2">
                          {item.workflowSteps.map((step) => (
                            <div key={step.stage} className={`rounded-lg border p-2 ${step.stage === item.currentStage ? 'border-blue-300 bg-blue-50' : step.actedAt ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{step.stage}</p>
                              <p className="mt-1 truncate text-[10px] font-black text-slate-900" title={step.owner}>{step.owner}</p>
                              <p className="mt-1 text-[10px] font-bold text-slate-500">{formatDateTime(step.actedAt)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Owner: {item.currentOwner}</span>
                          <span className={`rounded-full border px-2 py-1 ${slaTone(currentSla)}`}>SLA: {currentSla}</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="min-w-[360px] space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{item.projectApprovalSummary.costControlText}</span>
                            <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-black text-purple-700">{item.projectApprovalSummary.approvalText}</span>
                          </div>
                          {item.projectApprovals.map((project) => (
                            <div key={project.projectCode} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-black text-slate-950">{project.projectCode} - {project.projectName}</div>
                                  <div className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-500">PM: {project.projectManager} / Cost: {project.costCenter}</div>
                                </div>
                                <div className="text-right text-[10px] font-black text-slate-700">{formatHours(project.totalHours)}<br />{formatMoney(project.labourCost)}</div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${project.costControlStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Cost {project.costControlStatus}</span>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${project.projectManagerStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>PM {project.projectManagerStatus}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="font-black text-slate-950">{formatHours(item.totalHours)}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{formatInt(item.totalEmployees)} employees</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold">
                          <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Productive {formatHours(item.productiveHours)}</span>
                          <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">OT {formatHours(item.overtimeHours)}</span>
                          <span className="rounded bg-slate-50 px-2 py-1 text-slate-600">Idle {formatHours(item.idleHours)}</span>
                          <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{formatMoney(item.labourCost)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className={`text-xs font-black ${item.payrollPosted ? 'text-emerald-700' : item.payrollReady ? 'text-blue-700' : 'text-slate-500'}`}>
                          {item.payrollPosted ? 'Posted' : item.payrollProcessed ? 'Processed' : item.payrollReady ? 'Payroll Ready' : 'Not Ready'}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">{formatDateTime(item.payrollAcknowledgedAt)}</div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link href={`/hris/time-and-logs/timesheet-review?headerId=${encodeURIComponent(item.id)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                            Review <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          {item.currentStage === 'Supervisor' ? <button type="button" disabled={!canApprove || submitting === item.id} onClick={() => act({ action: 'APPROVE', headerId: item.id, comment: 'Supervisor reviewed and approved.' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40">Approve</button> : null}
                          {item.currentStage === 'Cost Control' ? item.projectApprovals.filter((project) => project.costControlStatus === 'Pending').map((project) => (
                            <button key={project.projectCode} type="button" disabled={!canApprove} onClick={() => act({ action: 'APPROVE', headerId: item.id, projectCode: project.projectCode, stage: 'Cost Control', comment: `Cost Control approved ${project.projectCode}.` })} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">Cost {project.projectCode}</button>
                          )) : null}
                          {item.currentStage === 'Project Manager' ? item.projectApprovals.filter((project) => project.projectManagerStatus === 'Pending').map((project) => (
                            <button key={project.projectCode} type="button" disabled={!canApprove} onClick={() => act({ action: 'APPROVE', headerId: item.id, projectCode: project.projectCode, stage: 'Project Manager', comment: `Project Manager approved ${project.projectCode}.` })} className="rounded-lg bg-purple-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">PM {project.projectCode}</button>
                          )) : null}
                          {item.currentStage === 'HR' ? <button type="button" disabled={!canApprove} onClick={() => act({ action: 'APPROVE', headerId: item.id, comment: 'HR approved consolidated timesheet for payroll.' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">HR Approve</button> : null}
                          {item.currentStage === 'Payroll Processing' ? (
                            <>
                              <button type="button" disabled={!canApprove} onClick={() => act({ action: 'PROCESS_PAYROLL', headerId: item.id, comment: 'Payroll processed.' })} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">Process</button>
                              <button type="button" disabled={!canApprove} onClick={() => act({ action: 'POST_PAYROLL', headerId: item.id, comment: 'Payroll posted.' })} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">Post</button>
                            </>
                          ) : null}
                          {['Supervisor', 'Cost Control', 'Project Manager', 'HR', 'Payroll Processing'].includes(item.currentStage || '') ? (
                            <>
                              <button type="button" disabled={!canApprove} onClick={() => act({ action: 'RETURN', headerId: item.id, comment: 'Returned for correction.' })} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700"><RotateCcw className="h-3.5 w-3.5" />Return</button>
                              <button type="button" disabled={!canApprove} onClick={() => act({ action: 'REJECT', headerId: item.id, comment: 'Rejected during approval review.' })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700"><ThumbsDown className="h-3.5 w-3.5" />Reject</button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTimesheets.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">No timesheets match this approval workspace view.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {filteredTimesheets.filter((item) => expanded.includes(item.id)).map((item) => (
          <div key={`detail-${item.id}`} className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Drill-Down Detail</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{item.workCenterName} / {item.timesheetDate}</h3>
              </div>
              <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-700">{item.projectApprovalSummary.approvalText}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>{['Employee', 'Org', 'Log', 'Hours', 'Activities', 'Status'].map((header) => <th key={header} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {item.employeeRows.map((employee) => (
                      <tr key={employee.lineId}>
                        <td className="px-3 py-3"><div className="font-black text-slate-900">{employee.employeeName}</div><div className="text-[10px] font-bold text-blue-600">{employee.employeeNo}</div></td>
                        <td className="px-3 py-3 text-slate-600">{employee.department}<br />{employee.businessUnit}</td>
                        <td className="px-3 py-3 font-bold text-slate-700">{employee.clockIn || '--:--'} - {employee.clockOut || '--:--'}</td>
                        <td className="px-3 py-3 font-black text-slate-900">{formatHours(employee.totalHours)}<br /><span className="text-[10px] text-amber-600">OT {formatHours(employee.overtimeHours)}</span></td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            {employee.activities.map((activity) => (
                              <div key={`${employee.lineId}-${activity.projectCode}-${activity.activityCode}`} className="rounded bg-slate-50 px-2 py-1">
                                <span className="font-black text-slate-800">{activity.projectCode}</span> / {activity.activityName} / {formatHours(activity.hours)} / {formatMoney(activity.labourCost)}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{employee.validationStatus}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approval History & Audit Trail</p>
                <div className="mt-3 space-y-3">
                  {item.approvalHistory.length ? item.approvalHistory.map((event, index) => (
                    <div key={`${event.stage}-${event.actedAt}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs font-black text-slate-900">{event.stage} / {event.decision}</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-500">{event.by} / {formatDateTime(event.actedAt)}</div>
                      {event.comment ? <div className="mt-1 text-[11px] font-semibold text-slate-600">{event.comment}</div> : null}
                    </div>
                  )) : <div className="text-sm font-semibold text-slate-400">No workflow actions recorded yet.</div>}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span><Filter className="mr-1 inline h-4 w-4" />Role scope: <strong>{payload?.permissions.visibilityScope}</strong> / Actor: <strong>{payload?.permissions.actor}</strong></span>
            <span><FileText className="mr-1 inline h-4 w-4" />{payload?.audit.actionHistory}</span>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
