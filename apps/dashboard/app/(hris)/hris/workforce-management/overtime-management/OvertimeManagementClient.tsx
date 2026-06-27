'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OvertimeManagementEnterpriseView,
  inputClass,
  readOnlyClass,
} from './OvertimeManagementEnterpriseView';
import { OvertimeFormField } from './overtime-management-ui';

type Role =
  | 'Employee'
  | 'Supervisor'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Payroll Manager'
  | 'Finance Controller'
  | 'Executive Management'
  | 'Administrator'
  | 'Super Administrator';
type Status = 'Draft' | 'Submitted' | 'Supervisor Approved' | 'HR Approved' | 'Payroll Ready' | 'Payroll Posted' | 'Returned' | 'Rejected' | 'Blocked';
type DayType = 'Weekday' | 'Saturday' | 'Sunday' | 'Public Holiday';
type Action = 'submit' | 'approve-supervisor' | 'approve-hr' | 'mark-payroll-ready' | 'post-payroll' | 'return' | 'reject' | 'reopen';

type OvertimeRecord = {
  id: string;
  sourceLineId: string;
  headerId: string;
  periodId: string;
  date: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  location: string;
  supervisor: string;
  workCenter: string;
  employmentType: string;
  salaryGrade: string;
  dayType: DayType;
  workedHours: number;
  standardHours: number;
  overtimeHours: number;
  payableHours: number;
  multiplier: number;
  hourlyRate: number;
  grossPay: number;
  earningCode: string;
  earningName: string;
  timesheetStatus: string;
  payrollReady: boolean;
  status: Status;
  currentOwner: string;
  severity: 'Low' | 'Medium' | 'High';
  issues: string[];
  projectCodes: string[];
  lastActionAt: string | null;
  workflow: Array<{ stage: 'Employee' | 'Supervisor' | 'HR' | 'Payroll'; status: 'Pending' | 'Completed' | 'Returned' | 'Rejected' | 'Blocked'; owner: string; actedAt: string | null }>;
  auditTrail: Array<{ id: string; at: string; actor: string; role: Role; action: string; oldStatus: Status | null; newStatus: Status; comment: string | null }>;
};

type AuthorizationStatus = 'Submitted' | 'Project Manager Approved' | 'MD Approved' | 'Rejected' | 'Cancelled';

type OvertimeAuthorizationRequest = {
  id: string;
  projectCode: string;
  projectName: string;
  workDate: string;
  workCenter: string;
  supervisorCode: string;
  supervisorName: string;
  requestedHours: number;
  requestedHeadcount: number;
  reason: string;
  status: AuthorizationStatus;
  currentOwnerRole: string;
  currentOwnerName: string;
  projectManagerName: string;
  projectManagerEmail: string | null;
  mdApproverName: string;
  mdApproverEmail: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  generatedAt: string;
  source: string;
  role: Role;
  dataSource: { source: string; databaseAvailable: boolean; warning: string | null; employeeCount: number };
  permissions: { canSubmit: boolean; canSupervisorApprove: boolean; canHrApprove: boolean; canPayroll: boolean; canExport: boolean; canViewMoney: boolean; canAudit: boolean };
  summary: {
    records: number;
    submitted: number;
    supervisorApproved: number;
    hrApproved: number;
    payrollReady: number;
    payrollPosted: number;
    returned: number;
    rejected: number;
    blocked: number;
    payableHours: number;
    grossPay: number;
    pendingApprovals: number;
  };
  filterOptions: { statuses: Status[]; departments: string[]; locations: string[]; dayTypes: DayType[] };
  authorizationSetup: {
    projects: Array<{ id: string; code: string; name: string; projectManager: string; projectManagerEmail?: string | null }>;
    workCenters: Array<{ id: string; code: string; name: string; location?: string | null; site?: string | null }>;
    supervisors: Array<{ id: string; code: string; name: string; email?: string | null; jobTitle?: string; department?: string }>;
    mdApprover: { id: string; code: string; name: string; email?: string | null; jobTitle?: string; department?: string } | null;
  };
  records: OvertimeRecord[];
  authorizationRequests: OvertimeAuthorizationRequest[];
};

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: Role[] = ['Employee', 'Supervisor', 'HR Officer', 'HR Manager', 'Payroll Officer', 'Payroll Manager', 'Finance Controller', 'Executive Management', 'Administrator', 'Super Administrator'];
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const number = (value: number | null | undefined) => numberFmt.format(value || 0);
const money = (value: number | null | undefined, canView = true) => (!canView ? 'Restricted' : moneyFmt.format(value || 0));

const actionLabels: Record<Action, string> = {
  submit: 'Submit',
  'approve-supervisor': 'Supervisor Approve',
  'approve-hr': 'HR Approve',
  'mark-payroll-ready': 'Mark Payroll Ready',
  'post-payroll': 'Post Payroll',
  return: 'Return',
  reject: 'Reject',
  reopen: 'Reopen',
};

function allowedActions(record: OvertimeRecord, payload: Payload | null): Action[] {
  if (!payload) return [];
  const actions: Action[] = [];
  if (['Draft', 'Returned'].includes(record.status) && payload.permissions.canSubmit) actions.push('submit');
  if (record.status === 'Submitted' && payload.permissions.canSupervisorApprove) actions.push('approve-supervisor');
  if (record.status === 'Supervisor Approved' && payload.permissions.canHrApprove) actions.push('approve-hr');
  if (record.status === 'HR Approved' && payload.permissions.canPayroll) actions.push('mark-payroll-ready');
  if (record.status === 'Payroll Ready' && payload.permissions.canPayroll) actions.push('post-payroll');
  if (['Returned', 'Rejected', 'Blocked'].includes(record.status) && payload.permissions.canHrApprove) actions.push('reopen');
  if (!['Payroll Posted', 'Rejected'].includes(record.status) && (payload.permissions.canSupervisorApprove || payload.permissions.canHrApprove || payload.permissions.canPayroll)) actions.push('return', 'reject');
  return actions;
}

export default function OvertimeManagementClient({ initialNow }: { initialNow: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [role, setRole] = useState<Role>('HR Manager');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [department, setDepartment] = useState('All');
  const [location, setLocation] = useState('All');
  const [dayType, setDayType] = useState<'All' | DayType>('All');
  const [selectedId, setSelectedId] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    employeeId: '',
    date: new Date(initialNow).toISOString().slice(0, 10),
    dayType: 'Weekday' as DayType,
    workedHours: '10',
    payableHours: '',
    projectCode: '',
    reason: '',
  });
  const [authorizationForm, setAuthorizationForm] = useState({
    projectCode: '',
    projectName: '',
    workDate: new Date(initialNow).toISOString().slice(0, 10),
    workCenter: '',
    supervisorCode: '',
    supervisorName: '',
    requestedHours: '2',
    requestedHeadcount: '1',
    overtimeType: 'Weekday',
    costCenter: 'Managing Director',
    projectManagerName: '',
    projectManagerEmail: '',
    mdApproverName: 'Managing Director',
    mdApproverEmail: '',
    reason: '',
    details: 'High workload on project delivery week tasks.',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Overtime management failed (${res.status})`);
      const data = json.data;
      setPayload(data);
      setSelectedId((current) => current || data.records[0]?.id || '');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load overtime management.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (status !== 'All' && record.status !== status) return false;
      if (department !== 'All' && record.department !== department) return false;
      if (location !== 'All' && record.location !== location) return false;
      if (dayType !== 'All' && record.dayType !== dayType) return false;
      if (!q) return true;
      return [record.employeeId, record.employeeName, record.department, record.location, record.supervisor, record.workCenter, record.status, record.projectCodes.join(' ')].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [payload?.records, query, status, department, location, dayType]);

  const selected = payload?.records.find((record) => record.id === selectedId) || filtered[0] || null;
  const canViewMoney = Boolean(payload?.permissions.canViewMoney);
  const authorizationRequests = payload?.authorizationRequests || [];
  const approvedAuthorizations = authorizationRequests.filter((item) => item.status === 'MD Approved');
  const setup = payload?.authorizationSetup;

  const runAction = async (recordId: string, action: Action) => {
    setBusy(`${recordId}-${action}`);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ id: recordId, action, actor: role, comment }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `${actionLabels[action]} failed`);
      setPayload(json.data);
      setToast(`${actionLabels[action]} completed.`);
      setComment('');
    } catch (event) {
      setError(event instanceof Error ? event.message : `${actionLabels[action]} failed.`);
    } finally {
      setBusy('');
    }
  };

  const runBulk = async (action: Action) => {
    const ids = Array.from(selectedRows);
    if (!ids.length) return;
    for (const id of ids) await runAction(id, action);
    setSelectedRows(new Set());
  };

  const toggleRow = (id: string) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    window.location.href = '/api/hris/workforce-management/overtime-management?format=csv';
  };

  const createRequest = async () => {
    setBusy('create-request');
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: 'create-request',
          actor: role,
          employeeId: requestForm.employeeId,
          date: requestForm.date,
          dayType: requestForm.dayType,
          workedHours: Number(requestForm.workedHours || 0),
          payableHours: requestForm.payableHours ? Number(requestForm.payableHours) : undefined,
          projectCode: requestForm.projectCode,
          reason: requestForm.reason,
        }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to create overtime request.');
      setPayload(json.data);
      setSelectedId(json.data.records[0]?.id || '');
      setToast('Overtime request created.');
      setShowRequest(false);
      setRequestForm((current) => ({ ...current, employeeId: '', workedHours: '10', payableHours: '', projectCode: '', reason: '' }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to create overtime request.');
    } finally {
      setBusy('');
    }
  };

  const createAuthorization = async () => {
    setBusy('create-authorization');
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({
          action: 'create-authorization',
          actor: 'Production Manager',
          ...authorizationForm,
          requestedHours: Number(authorizationForm.requestedHours || 0),
          requestedHeadcount: Number(authorizationForm.requestedHeadcount || 1),
        }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to submit overtime authorization.');
      setPayload(json.data);
      setToast('Overtime authorization submitted to the Project Manager.');
      setAuthorizationForm((current) => ({ ...current, projectCode: '', projectName: '', workCenter: '', supervisorCode: '', supervisorName: '', requestedHours: '2', requestedHeadcount: '1', reason: '', details: '' }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to submit overtime authorization.');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    const md = setup?.mdApprover;
    if (!md) return;
    setAuthorizationForm((current) => ({
      ...current,
      mdApproverName: current.mdApproverName && current.mdApproverName !== 'Managing Director' ? current.mdApproverName : md.name,
      mdApproverEmail: current.mdApproverEmail || md.email || '',
    }));
  }, [setup?.mdApprover]);

  const onProjectChange = (projectCode: string) => {
    const project = setup?.projects.find((item) => item.code === projectCode);
    setAuthorizationForm((current) => ({
      ...current,
      projectCode,
      projectName: project?.name || '',
      projectManagerName: project?.projectManager || '',
      projectManagerEmail: project?.projectManagerEmail || '',
    }));
  };

  const onWorkCenterChange = (workCenterName: string) => {
    setAuthorizationForm((current) => ({ ...current, workCenter: workCenterName }));
  };

  const onSupervisorChange = (supervisorCode: string) => {
    const supervisor = setup?.supervisors.find((item) => item.code === supervisorCode);
    setAuthorizationForm((current) => ({
      ...current,
      supervisorCode,
      supervisorName: supervisor?.name || '',
    }));
  };

  const actOnAuthorization = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(`${id}-${decision}`);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/hris/workforce-management/overtime-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ id, action: `${decision}-authorization`, actor: role, comment }),
      });
      const json = (await res.json()) as ApiResponse<Payload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `Unable to ${decision} authorization.`);
      setPayload(json.data);
      setToast(`Overtime authorization ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      setComment('');
    } catch (event) {
      setError(event instanceof Error ? event.message : `Unable to ${decision} authorization.`);
    } finally {
      setBusy('');
    }
  };

  const authorizationFormPanel = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OvertimeFormField label="Project">
          <input list="overtime-projects" value={authorizationForm.projectCode} onChange={(event) => onProjectChange(event.target.value)} placeholder="Search/select project" className={inputClass} />
          <datalist id="overtime-projects">
            {(setup?.projects || []).map((project) => (
              <option key={project.id} value={project.code}>
                {project.name}
              </option>
            ))}
          </datalist>
        </OvertimeFormField>
        <OvertimeFormField label="Project Manager">
          <input value={authorizationForm.projectManagerName} readOnly placeholder="Auto from project" className={readOnlyClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Work Date">
          <input type="date" value={authorizationForm.workDate} onChange={(event) => setAuthorizationForm((current) => ({ ...current, workDate: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Work Center">
          <input list="overtime-work-centers" value={authorizationForm.workCenter} onChange={(event) => onWorkCenterChange(event.target.value)} placeholder="Search/select work center" className={inputClass} />
          <datalist id="overtime-work-centers">
            {(setup?.workCenters || []).map((workCenter) => (
              <option key={workCenter.id} value={workCenter.name}>
                {[workCenter.code, workCenter.site || workCenter.location].filter(Boolean).join(' / ')}
              </option>
            ))}
          </datalist>
        </OvertimeFormField>
        <OvertimeFormField label="Supervisor">
          <input list="overtime-supervisors" value={authorizationForm.supervisorCode} onChange={(event) => onSupervisorChange(event.target.value)} placeholder="Search/select supervisor" className={inputClass} />
          <datalist id="overtime-supervisors">
            {(setup?.supervisors || []).map((supervisor) => (
              <option key={supervisor.id} value={supervisor.code}>
                {supervisor.name} {supervisor.jobTitle ? `/ ${supervisor.jobTitle}` : ''}
              </option>
            ))}
          </datalist>
        </OvertimeFormField>
        <OvertimeFormField label="Approving Manager">
          <input value={authorizationForm.supervisorName} readOnly placeholder="Auto from supervisor" className={readOnlyClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Overtime Type">
          <select value={authorizationForm.overtimeType} onChange={(event) => setAuthorizationForm((current) => ({ ...current, overtimeType: event.target.value }))} className={inputClass}>
            {['Weekday', 'Saturday', 'Sunday', 'Public Holiday'].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </OvertimeFormField>
        <OvertimeFormField label="Reason / Justification">
          <input value={authorizationForm.reason} onChange={(event) => setAuthorizationForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Auto from project" className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Payroll">
          <input value="Auto from employee directory" readOnly className={readOnlyClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Cost Center">
          <input value={authorizationForm.costCenter} onChange={(event) => setAuthorizationForm((current) => ({ ...current, costCenter: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="GL Account">
          <input value="Auto from employee directory" readOnly className={readOnlyClass} />
        </OvertimeFormField>
        <OvertimeFormField label="OT Hours">
          <input type="number" min="0" step="0.5" value={authorizationForm.requestedHours} onChange={(event) => setAuthorizationForm((current) => ({ ...current, requestedHours: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Headcount">
          <input type="number" min="1" step="1" value={authorizationForm.requestedHeadcount} onChange={(event) => setAuthorizationForm((current) => ({ ...current, requestedHeadcount: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
      </div>
      <div className="mt-4">
        <OvertimeFormField label="Details / Reason for Overtime">
          <textarea
            value={authorizationForm.details}
            onChange={(event) => setAuthorizationForm((current) => ({ ...current, details: event.target.value }))}
            rows={3}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
        </OvertimeFormField>
      </div>
    </>
  );

  const newRequestPanel = showRequest ? (
    <section className="rounded-[18px] border border-[#A7F3D0] bg-[#ECFDF5]/60 p-5">
      <h2 className="text-lg font-semibold text-[#0F172A]">New Overtime Request</h2>
      <p className="mt-1 text-xs text-[#64748B]">Create exceptional overtime not yet captured from a payroll-ready timesheet.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <OvertimeFormField label="Employee code">
          <input value={requestForm.employeeId} onChange={(event) => setRequestForm((current) => ({ ...current, employeeId: event.target.value }))} placeholder="e.g. C2422" className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Date">
          <input type="date" value={requestForm.date} onChange={(event) => setRequestForm((current) => ({ ...current, date: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Day type">
          <select value={requestForm.dayType} onChange={(event) => setRequestForm((current) => ({ ...current, dayType: event.target.value as DayType }))} className={inputClass}>
            {(payload?.filterOptions.dayTypes || ['Weekday', 'Saturday', 'Sunday', 'Public Holiday']).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </OvertimeFormField>
        <OvertimeFormField label="Worked hours">
          <input type="number" min="0" step="0.5" value={requestForm.workedHours} onChange={(event) => setRequestForm((current) => ({ ...current, workedHours: event.target.value }))} className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Payable hours">
          <input type="number" min="0" step="0.5" value={requestForm.payableHours} onChange={(event) => setRequestForm((current) => ({ ...current, payableHours: event.target.value }))} placeholder="Auto" className={inputClass} />
        </OvertimeFormField>
        <OvertimeFormField label="Project code">
          <input value={requestForm.projectCode} onChange={(event) => setRequestForm((current) => ({ ...current, projectCode: event.target.value }))} placeholder="Optional" className={inputClass} />
        </OvertimeFormField>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <OvertimeFormField label="Reason / justification">
            <input value={requestForm.reason} onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))} className={inputClass} />
          </OvertimeFormField>
        </div>
        <button type="button" onClick={() => void createRequest()} disabled={busy === 'create-request'} className="inline-flex h-11 items-center rounded-xl bg-[#10B981] px-5 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-60">
          Create Request
        </button>
      </div>
    </section>
  ) : null;

  return (
    <OvertimeManagementEnterpriseView
      initialNow={initialNow}
      loading={loading}
      error={error}
      toast={toast}
      payloadGeneratedAt={payload?.generatedAt}
      databaseAvailable={payload?.dataSource.databaseAvailable}
      role={role}
      roles={roles}
      onRoleChange={(value) => setRole(value as Role)}
      onRefresh={() => void load()}
      onExport={exportCsv}
      canExport={Boolean(payload?.permissions.canExport)}
      showRequest={showRequest}
      onToggleRequest={() => setShowRequest((value) => !value)}
      summary={payload?.summary || { records: 0, pendingApprovals: 0, submitted: 0, supervisorApproved: 0, payrollReady: 0, payrollPosted: 0, blocked: 0, returned: 0, rejected: 0, payableHours: 0, grossPay: 0 }}
      canViewMoney={canViewMoney}
      authorizationRequests={authorizationRequests}
      approvedAuthorizationCount={approvedAuthorizations.length}
      authorizationForm={authorizationFormPanel}
      onSubmitAuthorization={() => void createAuthorization()}
      authorizationBusy={busy === 'create-authorization'}
      onApproveAuthorization={(id) => void actOnAuthorization(id, 'approve')}
      onRejectAuthorization={(id) => void actOnAuthorization(id, 'reject')}
      authorizationActionBusy={Boolean(busy)}
      query={query}
      onQueryChange={setQuery}
      status={status}
      onStatusChange={(value) => setStatus(value as 'All' | Status)}
      department={department}
      onDepartmentChange={setDepartment}
      location={location}
      onLocationChange={setLocation}
      dayType={dayType}
      onDayTypeChange={(value) => setDayType(value as 'All' | DayType)}
      statusOptions={payload?.filterOptions.statuses || []}
      departmentOptions={payload?.filterOptions.departments || []}
      locationOptions={payload?.filterOptions.locations || []}
      dayTypeOptions={payload?.filterOptions.dayTypes || []}
      selectedRowsCount={selectedRows.size}
      filteredCount={filtered.length}
      onBulkAction={(action) => void runBulk(action as Action)}
      bulkBusy={Boolean(busy)}
      records={filtered}
      selectedId={selectedId}
      onSelectRecord={setSelectedId}
      selected={selected}
      selectedRows={selectedRows}
      onToggleRow={toggleRow}
      comment={comment}
      onCommentChange={setComment}
      allowedActions={selected ? allowedActions(selected, payload).map(String) : []}
      actionLabels={actionLabels}
      onRunAction={(action) => selected && void runAction(selected.id, action as Action)}
      actionBusy={busy}
      money={(value) => money(value, canViewMoney)}
      number={number}
      newRequestPanel={newRequestPanel}
    />
  );
}
