'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, FileText, RefreshCcw, RotateCcw, Search, ShieldCheck, ThumbsDown, Users } from 'lucide-react';
import { PageTemplate } from '@/components/layout/page-template';

type TimesheetStatus =
  | 'Draft'
  | 'Submitted'
  | 'Supervisor_Reviewed'
  | 'Project_Manager_Reviewed'
  | 'Cost_Control_Reviewed'
  | 'HR_Acknowledged'
  | 'HR_Reviewed'
  | 'Project_Control_Reviewed'
  | 'Approved'
  | 'Locked'
  | 'Rejected'
  | 'Returned';

type WorkflowStep = {
  stage: 'Supervisor' | 'Project Manager' | 'Cost Control' | 'HR';
  status: string;
  by: string | null;
  actedAt: string | null;
  comment: string | null;
};

type TimesheetSummary = {
  id: string;
  timesheetDate: string;
  supervisorName: string;
  workCenterName: string;
  status: TimesheetStatus;
  currentStage: WorkflowStep['stage'] | null;
  nextActionLabel: string | null;
  payrollReady: boolean;
  payrollAcknowledgedAt: string | null;
  payrollAcknowledgedBy: string | null;
  totalEmployees: number;
  totalHours: number;
  attendanceHours: number;
  idleHours: number;
  submittedAt: string | null;
  lastSyncAt: string | null;
  periodName: string;
  periodStatus: 'Open' | 'Closed' | 'Locked';
  workflowSteps: WorkflowStep[];
  projectApprovals: Array<{
    headerId: string;
    projectCode: string;
    projectName: string;
    projectManager: string;
    employeeCount: number;
    totalHours: number;
    billableHours: number;
    costControlStatus: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
    projectManagerStatus: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
    visibilityScope: string;
    lineIds: string[];
  }>;
  projectApprovalSummary: {
    totalProjects: number;
    projectManagerApproved: number;
    costControlApproved: number;
    projectManagerPending: number;
    costControlPending: number;
    consolidatedForHr: boolean;
  };
};

type ApprovalPayload = {
  permissions: {
    actor: string;
    role: string;
    canApprove: boolean;
    canAcknowledgePayroll: boolean;
    canApproveAllLevels?: boolean;
  };
  pendingTimesheets: TimesheetSummary[];
  stats: {
    totalPending: number;
    supervisorCount: number;
    projectManagerCount: number;
    costControlCount: number;
    hrAcknowledgementCount: number;
    payrollReadyCount: number;
  };
};

const statusLabel = (status: TimesheetStatus) =>
  status
    .replace('Supervisor_Reviewed', 'Supervisor Reviewed')
    .replace('Project_Manager_Reviewed', 'Project Manager Reviewed')
    .replace('Cost_Control_Reviewed', 'Cost Control Reviewed')
    .replace('HR_Acknowledged', 'HR Acknowledged')
    .replace(/_/g, ' ');

const statusClass = (status: TimesheetStatus) => {
  if (status === 'HR_Acknowledged' || status === 'Locked') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Returned') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Submitted') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'Supervisor_Reviewed') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
};

const formatDateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '-';

export default function TimesheetApprovalClient() {
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | 'All'>('All');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-approval', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Failed to load approvals');
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (headerId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', defaultComment: string, projectCode?: string, stage?: 'Project Manager' | 'Cost Control' | 'HR') => {
    setSubmittingId(projectCode ? `${headerId}-${projectCode}-${stage}` : headerId);
    setError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headerId, action, comment: defaultComment, projectCode, stage }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to update approval');
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update approval');
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredTimesheets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (payload?.pendingTimesheets || []).filter((item) => {
      const matchesQuery = !term || [item.supervisorName, item.workCenterName, item.periodName, item.timesheetDate].some((value) => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [payload, query, statusFilter]);

  if (loading && !payload) {
    return (
      <PageTemplate title="Timesheet Approvals" description="Loading approval workflow..." breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}>
        <div className="flex h-96 items-center justify-center"><RefreshCcw className="h-8 w-8 animate-spin text-slate-400" /></div>
      </PageTemplate>
    );
  }

  const canApprove = Boolean(payload?.permissions.canApprove);

  return (
    <PageTemplate
      title="Timesheet Approvals"
      description="Supervisor review, Project Manager, Cost Control, and HR payroll acknowledgement."
      breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}
      primaryAction={{ label: 'Refresh', onClick: load, icon: RefreshCcw }}
    >
      <div className="space-y-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Pending', value: payload?.stats.totalPending || 0, icon: Clock, tone: 'indigo' },
            { label: 'Supervisor', value: payload?.stats.supervisorCount || 0, icon: ShieldCheck, tone: 'cyan' },
            { label: 'Project Manager', value: payload?.stats.projectManagerCount || 0, icon: Users, tone: 'blue' },
            { label: 'Cost Control', value: payload?.stats.costControlCount || 0, icon: ShieldCheck, tone: 'amber' },
            { label: 'HR Ack.', value: payload?.stats.hrAcknowledgementCount || 0, icon: FileText, tone: 'purple' },
            { label: 'Payroll Ready', value: payload?.stats.payrollReadyCount || 0, icon: CheckCircle2, tone: 'emerald' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg bg-${stat.tone}-50 p-2 text-${stat.tone}-600`}><stat.icon className="h-5 w-5" /></div>
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
              </div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search supervisor, work center, period, or date..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Submitted', 'Supervisor_Reviewed', 'Project_Manager_Reviewed', 'Cost_Control_Reviewed', 'HR_Acknowledged', 'Returned', 'Rejected'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                  statusFilter === status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {status === 'All' ? 'All' : statusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Timesheet', 'Project Split Workflow', 'Hours', 'Payroll', 'Status', 'Actions'].map((header) => (
                    <th key={header} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTimesheets.map((item) => {
                  const awaitingAction = ['Submitted', 'Supervisor_Reviewed', 'Project_Manager_Reviewed', 'Cost_Control_Reviewed'].includes(item.status);
                  const canHeaderApprove = item.status === 'Submitted' || item.status === 'Cost_Control_Reviewed' || Boolean(payload?.permissions.canApproveAllLevels);
                  const approveLabel = item.status === 'Submitted' ? 'Supervisor Review' : item.status === 'Cost_Control_Reviewed' ? 'Acknowledge' : 'Approve';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-900">{item.timesheetDate}</div>
                        <div className="mt-1 text-xs font-bold text-slate-600">{item.workCenterName}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.periodName} / {item.supervisorName}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-[360px] items-center gap-2">
                          {item.workflowSteps.map((step) => (
                            <div key={step.stage} className={`rounded-lg border px-2.5 py-2 ${step.status === 'Pending' ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                              <div className="text-[9px] font-black uppercase tracking-widest">{step.stage}</div>
                              <div className="mt-0.5 text-[10px] font-bold">{step.status}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 grid min-w-[520px] grid-cols-1 gap-2">
                          {item.projectApprovals.map((project) => {
                            const pmKey = `${item.id}-${project.projectCode}-Project Manager`;
                            const ccKey = `${item.id}-${project.projectCode}-Cost Control`;
                            const pmPending = project.projectManagerStatus === 'Pending' && ['Supervisor_Reviewed', 'Project_Manager_Reviewed'].includes(item.status);
                            const ccPending = project.costControlStatus === 'Pending' && ['Project_Manager_Reviewed'].includes(item.status);
                            return (
                              <div key={project.projectCode} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-black text-slate-950">{project.projectCode} - {project.projectName}</div>
                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-500">{project.totalHours}h / {project.employeeCount} employees / PM: {project.projectManager}</div>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${project.projectManagerStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>PM {project.projectManagerStatus}</span>
                                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${project.costControlStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Cost {project.costControlStatus}</span>
                                  </div>
                                </div>
                                {(pmPending || ccPending) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {pmPending ? (
                                      <>
                                        <button type="button" onClick={() => act(item.id, 'APPROVE', `Project Manager approved ${project.projectCode}.`, project.projectCode, 'Project Manager')} disabled={!canApprove || submittingId === pmKey} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50">PM Approve</button>
                                        <button type="button" onClick={() => act(item.id, 'RETURN', `Project Manager returned ${project.projectCode} for correction.`, project.projectCode, 'Project Manager')} disabled={!canApprove || submittingId === pmKey} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700 disabled:opacity-50">PM Return</button>
                                      </>
                                    ) : null}
                                    {ccPending ? (
                                      <>
                                        <button type="button" onClick={() => act(item.id, 'APPROVE', `Cost Control approved ${project.projectCode} allocation.`, project.projectCode, 'Cost Control')} disabled={!canApprove || submittingId === ccKey} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-blue-700 disabled:opacity-50">Cost Approve</button>
                                        <button type="button" onClick={() => act(item.id, 'RETURN', `Cost Control returned ${project.projectCode} allocation.`, project.projectCode, 'Cost Control')} disabled={!canApprove || submittingId === ccKey} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700 disabled:opacity-50">Cost Return</button>
                                      </>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black tabular-nums text-slate-900">{item.totalHours}h</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.totalEmployees} employees / {item.idleHours}h idle</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className={`text-xs font-black ${item.payrollReady ? 'text-emerald-700' : 'text-slate-500'}`}>{item.payrollReady ? 'Ready' : 'Not Ready'}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-400">{formatDateTime(item.payrollAcknowledgedAt)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                        {item.currentStage && <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Waiting: {item.currentStage}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/hris/time-and-logs/timesheet-entry?date=${item.timesheetDate}&supervisorId=${item.supervisorName}&workCenterName=${item.workCenterName}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800">
                            Review <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          {awaitingAction && (
                            <>
                              {canHeaderApprove ? <button type="button" onClick={() => act(item.id, 'APPROVE', item.nextActionLabel || approveLabel, undefined, 'HR')} disabled={!canApprove || submittingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {approveLabel}
                              </button> : null}
                              <button type="button" onClick={() => act(item.id, 'RETURN', 'Returned for correction.')} disabled={!canApprove || submittingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                                <RotateCcw className="h-3.5 w-3.5" /> Return
                              </button>
                              <button type="button" onClick={() => act(item.id, 'REJECT', 'Rejected during approval review.')} disabled={!canApprove || submittingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700 hover:bg-red-100 disabled:opacity-50">
                                <ThumbsDown className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTimesheets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">No timesheets found for this workflow view.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
