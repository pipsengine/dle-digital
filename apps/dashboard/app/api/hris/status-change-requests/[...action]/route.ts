import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Department Head'
  | 'Line Manager'
  | 'Payroll Officer'
  | 'IT Administrator'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Director Approval'
  | 'Pending Payroll Review'
  | 'Pending IT Access Review'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type StatusImpact = {
  payroll: string[];
  systemAccess: string[];
  emailAccess: string[];
  attendance: string[];
  leaveEntitlement: string[];
  benefits: string[];
  assetRecovery: string[];
  documentClearance: string[];
  reportingLine: string[];
  workflowApprovals: string[];
  projectAssignment: string[];
  contractRenewal: string[];
};

type StatusChangeRequest = {
  id: string;
  scope: 'Single' | 'Bulk';
  employeeId: string;
  employeeName: string;
  bulkEmployeeIds?: string[];
  action: string;
  previousStatus: Record<string, string | null>;
  newStatus: Record<string, string | null>;
  effectiveDate: string;
  reason: string;
  responsibleOfficer: string | null;
  workflowStatus: WorkflowStatus;
  createdBy: Role;
  createdAt: string;
  updatedAt: string;
  approvals: { id: string; at: string; stage: string; decision: 'Approved' | 'Rejected'; by: Role; reason?: string | null }[];
  impact: StatusImpact;
  audit: { id: string; at: string; action: string; performedBy: Role; oldValue?: string; newValue?: string; reason?: string }[];
};

type StatusHistoryRow = {
  id: string;
  referenceNo: string;
  employeeId: string;
  employeeName: string;
  previousStatus: string;
  newStatus: string;
  statusCategory: string;
  effectiveDate: string;
  reason: string;
  approvalStatus: string;
  approvedBy: string | null;
  createdBy: string;
  createdAt: string;
};

const jsonOk = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const nowIso = () => new Date().toISOString();

const getRole = (request: Request): Role => {
  const v = request.headers.get('x-hris-role');
  const all: Role[] = [
    'Super Admin',
    'HR Director',
    'HR Manager',
    'HR Officer',
    'Admin Officer',
    'Department Head',
    'Line Manager',
    'Payroll Officer',
    'IT Administrator',
    'Compliance Officer',
    'Auditor',
    'Employee',
    'Executive Management',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const getViewerEmployeeId = (request: Request) => {
  const v = request.headers.get('x-hris-employee-id');
  return v && v.trim() ? v.trim() : undefined;
};

const normalizeStr = (v: unknown, max: number) => {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisEmployeeStatusOverrides?: Map<string, any>;
    __dleHrisStatusChangeRequests?: Map<string, StatusChangeRequest>;
    __dleHrisStatusChangeRequestsByEmployee?: Map<string, string[]>;
    __dleHrisStatusHistoryByEmployee?: Map<string, StatusHistoryRow[]>;
    __dleHrisEmploymentHistoryDetail?: Map<string, any>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisEmployeeStatusOverrides) g.__dleHrisEmployeeStatusOverrides = new Map();
  if (!g.__dleHrisStatusChangeRequests) g.__dleHrisStatusChangeRequests = new Map();
  if (!g.__dleHrisStatusChangeRequestsByEmployee) g.__dleHrisStatusChangeRequestsByEmployee = new Map();
  if (!g.__dleHrisStatusHistoryByEmployee) g.__dleHrisStatusHistoryByEmployee = new Map();
  if (!g.__dleHrisEmploymentHistoryDetail) g.__dleHrisEmploymentHistoryDetail = new Map();
  return {
    employees: g.__dleHrisEmployees,
    overrides: g.__dleHrisEmployeeStatusOverrides,
    requests: g.__dleHrisStatusChangeRequests,
    index: g.__dleHrisStatusChangeRequestsByEmployee,
    historyByEmployee: g.__dleHrisStatusHistoryByEmployee,
    employmentHistoryDetail: g.__dleHrisEmploymentHistoryDetail,
  };
};

const auditEntry = (action: string, performedBy: Role, extra?: Partial<StatusChangeRequest['audit'][number]>) => ({
  id: `aud-${Math.random().toString(16).slice(2)}`,
  at: nowIso(),
  action,
  performedBy,
  ...extra,
});

const stageNext = (s: WorkflowStatus): WorkflowStatus => {
  if (s === 'Draft') return 'Submitted';
  if (s === 'Submitted') return 'Pending HR Review';
  if (s === 'Pending HR Review') return 'Pending Department Head Approval';
  if (s === 'Pending Department Head Approval') return 'Pending HR Director Approval';
  if (s === 'Pending HR Director Approval') return 'Pending Payroll Review';
  if (s === 'Pending Payroll Review') return 'Pending IT Access Review';
  if (s === 'Pending IT Access Review') return 'Approved';
  return s;
};

const mapStatus = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v.includes('contract expired')) return 'Contract Expired';
  if (v.includes('contract active')) return 'Contract Active';
  if (v.includes('on leave')) return 'On Leave';
  if (v.includes('probation')) return 'Probation';
  if (v.includes('confirmed')) return 'Confirmed';
  if (v.includes('reactivated')) return 'Reactivated';
  if (v.includes('suspended')) return 'Suspended';
  if (v.includes('resigned')) return 'Resigned';
  if (v.includes('terminated')) return 'Terminated';
  if (v.includes('retired')) return 'Retired';
  if (v.includes('deceased')) return 'Deceased';
  if (v.includes('blacklisted')) return 'Blacklisted';
  if (v.includes('exited')) return 'Exited';
  if (v.includes('inactive')) return 'Inactive';
  if (v.includes('seconded')) return 'Seconded';
  return 'Active';
};

const applyStatusToEmployee = (employeeId: string, employeeName: string, next: Record<string, string | null>, role: Role, reason: string, effectiveDate: string) => {
  const s = stores();
  const rec = s.employees.get(employeeId);
  const profile = rec?.profile;
  if (!profile) return;

  const prevEmploymentStatus = String(profile.employmentStatus || '—');
  const newEmploymentStatus = mapStatus(String(next.employmentStatus || next.newEmploymentStatus || 'Active'));
  profile.employmentStatus = newEmploymentStatus;
  if (!profile.employmentDetails) profile.employmentDetails = {};
  profile.employmentDetails.employmentStatus = newEmploymentStatus;
  profile.employmentDetails.statusEffectiveDate = effectiveDate;
  profile.employmentDetails.statusReason = reason;

  const payrollEligible = ['Active', 'Confirmed', 'Probation', 'Reactivated', 'Contract Active'].includes(newEmploymentStatus);
  const accessActive = ['Active', 'Confirmed', 'Probation', 'On Leave', 'Contract Active', 'Seconded', 'Reactivated'].includes(newEmploymentStatus);
  const leave = newEmploymentStatus === 'On Leave' ? 'On Leave' : 'Not on Leave';
  const probation = newEmploymentStatus === 'Probation' ? 'In Probation' : newEmploymentStatus === 'Confirmed' ? 'Completed' : '—';
  const contract = newEmploymentStatus === 'Contract Expired' ? 'Contract Expired' : newEmploymentStatus === 'Contract Active' ? 'Contract Active' : '—';
  const compliance = ['Blacklisted', 'Deceased'].includes(newEmploymentStatus) ? 'High Risk' : ['Terminated', 'Resigned', 'Exited', 'Retired'].includes(newEmploymentStatus) ? 'Clearance Required' : 'OK';
  const exit = ['Terminated', 'Resigned', 'Exited', 'Retired', 'Deceased'].includes(newEmploymentStatus) ? newEmploymentStatus : '—';

  s.overrides.set(employeeId, {
    employeeId,
    hrStatus: newEmploymentStatus,
    payrollStatus: payrollEligible ? 'Eligible' : 'Ineligible',
    accessStatus: accessActive ? 'Active' : 'Restricted',
    leaveStatus: leave,
    probationStatus: probation,
    contractStatus: contract,
    confirmationStatus: newEmploymentStatus === 'Confirmed' ? 'Confirmed' : newEmploymentStatus === 'Probation' ? 'Pending' : '—',
    complianceStatus: compliance,
    exitStatus: exit,
    effectiveDate,
    statusReason: reason,
    responsibleOfficer: null,
    updatedAt: nowIso(),
  });

  if (Array.isArray(rec.audit)) rec.audit.unshift({ id: `aud-${Math.random().toString(16).slice(2)}`, at: nowIso(), action: 'Employee status updated', performedBy: role, oldValue: prevEmploymentStatus, newValue: newEmploymentStatus, reason });
  if (Array.isArray(rec.history)) rec.history.unshift({ id: `h-${employeeId}-${Math.random().toString(16).slice(2)}`, at: nowIso(), type: 'Status Change', detail: `${prevEmploymentStatus} → ${newEmploymentStatus}`, actor: role });

  const hist: StatusHistoryRow = {
    id: `sthist-${employeeId}-${Math.random().toString(16).slice(2)}`,
    referenceNo: `ST-${employeeId.slice(-5)}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    employeeId,
    employeeName,
    previousStatus: prevEmploymentStatus,
    newStatus: newEmploymentStatus,
    statusCategory: 'Lifecycle',
    effectiveDate,
    reason,
    approvalStatus: 'Approved',
    approvedBy: role,
    createdBy: role,
    createdAt: nowIso(),
  };
  const cur = s.historyByEmployee.get(employeeId) || [];
  s.historyByEmployee.set(employeeId, [hist, ...cur].slice(0, 300));

  const ehId = `hist-status-${employeeId}-${Math.random().toString(16).slice(2)}`;
  s.employmentHistoryDetail.set(ehId, {
    id: ehId,
    referenceNo: hist.referenceNo,
    employeeId,
    employeeName,
    eventType: 'Status Change',
    effectiveDate,
    approvalStatus: 'Approved',
    approvedBy: role,
    createdBy: role,
    createdAt: nowIso(),
    notes: `${prevEmploymentStatus} → ${newEmploymentStatus}`,
  });
};

const reverseStatusForEmployee = (employeeId: string, employeeName: string, prev: Record<string, string | null>, role: Role, reason: string, effectiveDate: string) => {
  applyStatusToEmployee(employeeId, employeeName, { employmentStatus: String(prev.employmentStatus || 'Active') }, role, reason, effectiveDate);
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const requestId = action[0] || '';
  const sub = action[1] || '';
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const s = stores();

  const req = s.requests.get(requestId);
  if (!req) return jsonErr(404, 'Request not found');
  if (role === 'Employee' && (!viewerEmployeeId || viewerEmployeeId !== req.employeeId)) return jsonErr(403, 'Permission denied');

  if (sub === 'audit') return jsonOk(req.audit || []);
  return jsonOk(req);
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const requestId = action[0] || '';
  const op = action[1] || '';
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const s = stores();

  const req = s.requests.get(requestId);
  if (!req) return jsonErr(404, 'Request not found');
  if (role === 'Employee') return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  const reason = normalizeStr(body?.reason, 600) || op;

  if (op === 'submit') {
    if (!(req.workflowStatus === 'Draft' || req.workflowStatus === 'Rejected')) return jsonErr(400, 'Only Draft/Rejected can be submitted');
    req.workflowStatus = 'Submitted';
    req.updatedAt = nowIso();
    req.audit.unshift(auditEntry('Status change submitted', role, { reason }));
    return jsonOk(req);
  }

  if (op === 'approve') {
    if (req.workflowStatus === 'Draft') return jsonErr(400, 'Draft cannot be approved');
    if (req.workflowStatus === 'Rejected' || req.workflowStatus === 'Cancelled') return jsonErr(400, 'Request is not approvable');
    if (req.workflowStatus === 'Completed') return jsonErr(400, 'Request already completed');

    const before = req.workflowStatus;
    const next = stageNext(before);
    req.approvals.unshift({ id: `appr-${Math.random().toString(16).slice(2)}`, at: nowIso(), stage: before, decision: 'Approved', by: role, reason: reason || null });
    req.audit.unshift(auditEntry('Status change approved', role, { reason, oldValue: before, newValue: next }));
    req.workflowStatus = next;
    req.updatedAt = nowIso();

    if (next === 'Approved') {
      const targets = req.scope === 'Bulk' ? (req.bulkEmployeeIds || []).slice(0, 500) : [req.employeeId];
      for (const empId of targets) {
        const rec = s.employees.get(empId);
        const employeeName = String(rec?.profile?.fullName || req.employeeName);
        applyStatusToEmployee(empId, employeeName, req.newStatus, role, req.reason, req.effectiveDate);
      }
      req.audit.unshift(auditEntry('Status change applied', role, { reason: req.reason }));
      req.workflowStatus = 'Completed';
      req.updatedAt = nowIso();
    }
    return jsonOk(req);
  }

  if (op === 'reject') {
    if (req.workflowStatus === 'Draft') return jsonErr(400, 'Draft cannot be rejected');
    if (req.workflowStatus === 'Completed') return jsonErr(400, 'Completed request cannot be rejected');
    const before = req.workflowStatus;
    req.workflowStatus = 'Rejected';
    req.approvals.unshift({ id: `appr-${Math.random().toString(16).slice(2)}`, at: nowIso(), stage: before, decision: 'Rejected', by: role, reason: reason || null });
    req.audit.unshift(auditEntry('Status change rejected', role, { reason, oldValue: before, newValue: 'Rejected' }));
    req.updatedAt = nowIso();
    return jsonOk(req);
  }

  if (op === 'reverse') {
    if (!(role === 'Super Admin' || role === 'HR Director')) return jsonErr(403, 'Permission denied');
    if (req.workflowStatus !== 'Completed') return jsonErr(400, 'Only completed requests can be reversed');
    const targets = req.scope === 'Bulk' ? (req.bulkEmployeeIds || []).slice(0, 500) : [req.employeeId];
    for (const empId of targets) {
      const rec = s.employees.get(empId);
      const employeeName = String(rec?.profile?.fullName || req.employeeName);
      reverseStatusForEmployee(empId, employeeName, req.previousStatus, role, `Reversal: ${reason}`, nowIso().slice(0, 10));
    }
    req.audit.unshift(auditEntry('Status change reversed', role, { reason }));
    req.updatedAt = nowIso();
    return jsonOk(req);
  }

  return jsonErr(404, 'Not found');
}
