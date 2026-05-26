import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Unit Head'
  | 'Line Manager'
  | 'Project Manager'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type ReportingChangeStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Director Approval'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type ReportingChangeType =
  | 'Manager Change'
  | 'Functional Manager Change'
  | 'Department Head Change'
  | 'Project Manager Change'
  | 'Matrix Manager Change'
  | 'Delegated Approver Change'
  | 'Temporary Reporting Assignment'
  | 'Bulk Manager Reassignment';

type AuditLog = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  device?: string;
  reason?: string;
};

type ReportingApproval = {
  id: string;
  at: string;
  stage: ReportingChangeStatus;
  decision: 'Approved' | 'Rejected';
  by: string;
  reason?: string | null;
};

type ReportingDelegation = {
  id: string;
  assignmentType: string;
  assignedEmployee: string;
  delegatedRole: string;
  startDate: string;
  endDate: string;
  delegationReason: string;
  approvalScope: string;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Cancelled';
};

type ReportingChangeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  changeType: ReportingChangeType;
  status: ReportingChangeStatus;
  effectiveDate: string;
  endDate?: string | null;
  reason: string;
  notes?: string | null;
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
  delegations: ReportingDelegation[];
  supportingDocuments: { id: string; name: string }[];
  approvals: ReportingApproval[];
  audit: AuditLog[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isBulk?: boolean;
  bulkEmployeeIds?: string[];
};

const jsonOk = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const nowIso = () => new Date().toISOString();

const normalize = (v: unknown, max = 600) => {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
};

const getRole = (request: Request): Role => {
  const v = request.headers.get('x-hris-role');
  const all: Role[] = [
    'Super Admin',
    'HR Director',
    'HR Manager',
    'HR Officer',
    'Department Head',
    'Unit Head',
    'Line Manager',
    'Project Manager',
    'Payroll Officer',
    'Auditor',
    'Employee',
    'Executive Management',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const permissions = (role: Role) => {
  const canSubmit = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  const canApprove =
    role === 'Super Admin' ||
    role === 'HR Director' ||
    role === 'HR Manager' ||
    role === 'Department Head' ||
    role === 'Unit Head' ||
    role === 'Line Manager' ||
    role === 'Project Manager' ||
    role === 'Payroll Officer';
  const canDirector = role === 'Super Admin' || role === 'HR Director';
  const canHrReview = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  return { canSubmit, canApprove, canDirector, canHrReview };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisReportingChangeRequests?: Map<string, ReportingChangeRequest>;
    __dleHrisReportingChangeRequestsByEmployee?: Map<string, string[]>;
    __dleHrisEmployeeOverrides?: Map<string, any>;
    __dleHrisEmploymentHistory?: Map<string, any>;
    __dleHrisEmploymentHistoryDetail?: Map<string, any>;
    __dleHrisReportingHistory?: Map<string, any[]>;
    __dleHrisDelegations?: Map<string, ReportingDelegation[]>;
  };
  if (!g.__dleHrisReportingChangeRequests) g.__dleHrisReportingChangeRequests = new Map();
  if (!g.__dleHrisReportingChangeRequestsByEmployee) g.__dleHrisReportingChangeRequestsByEmployee = new Map();
  if (!g.__dleHrisEmployeeOverrides) g.__dleHrisEmployeeOverrides = new Map();
  if (!g.__dleHrisEmploymentHistory) g.__dleHrisEmploymentHistory = new Map();
  if (!g.__dleHrisEmploymentHistoryDetail) g.__dleHrisEmploymentHistoryDetail = new Map();
  if (!g.__dleHrisReportingHistory) g.__dleHrisReportingHistory = new Map();
  if (!g.__dleHrisDelegations) g.__dleHrisDelegations = new Map();
  return {
    requests: g.__dleHrisReportingChangeRequests,
    index: g.__dleHrisReportingChangeRequestsByEmployee,
    overrides: g.__dleHrisEmployeeOverrides,
    histList: g.__dleHrisEmploymentHistory,
    histDetail: g.__dleHrisEmploymentHistoryDetail,
    reportingHistory: g.__dleHrisReportingHistory,
    delegations: g.__dleHrisDelegations,
  };
};

const auditEntry = (action: string, performedBy: string, extra?: Partial<AuditLog>): AuditLog => ({
  id: `audit-${Math.random().toString(16).slice(2)}`,
  at: nowIso(),
  action,
  performedBy,
  ipAddress: extra?.ipAddress,
  device: extra?.device,
  oldValue: extra?.oldValue,
  newValue: extra?.newValue,
  reason: extra?.reason,
});

const addToIndex = (employeeId: string, id: string) => {
  const s = stores();
  const ids = s.index.get(employeeId) || [];
  if (!ids.includes(id)) s.index.set(employeeId, [id, ...ids].slice(0, 120));
};

const nextApprovalStage = (req: ReportingChangeRequest): ReportingChangeStatus => {
  if (req.status === 'Submitted') return 'Pending HR Review';
  if (req.status === 'Pending HR Review') return 'Pending Department Head Approval';
  if (req.status === 'Pending Department Head Approval') return 'Pending HR Director Approval';
  if (req.status === 'Pending HR Director Approval') return 'Approved';
  return req.status;
};

const applyOverrideFromReportingRequest = (employeeId: string, req: ReportingChangeRequest, mode: 'applyNew' | 'applyPrevious') => {
  const s = stores();
  const existing = s.overrides.get(employeeId) || {};
  const next = { ...existing };
  next.profile = next.profile && typeof next.profile === 'object' ? { ...next.profile } : {};
  next.profile.jobDetails = next.profile.jobDetails && typeof next.profile.jobDetails === 'object' ? { ...next.profile.jobDetails } : {};

  const patch = mode === 'applyNew' ? req.newValues : req.previousValues;
  const safeStr = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const setJob = (k: string, v: string | null) => ((next.profile.jobDetails as any)[k] = v);
  const mapKeys: [string, string][] = [
    ['directManager', 'reportingManager'],
    ['functionalManager', 'functionalManager'],
    ['departmentHead', 'departmentHead'],
    ['unitHead', 'unitHead'],
    ['businessUnitHead', 'businessUnitHead'],
    ['projectManager', 'projectManager'],
    ['siteSupervisor', 'siteSupervisor'],
    ['matrixManager', 'matrixManager'],
    ['dottedLineManager', 'dottedLineManager'],
    ['hrBusinessPartner', 'hrBusinessPartner'],
    ['delegatedApprover', 'delegatedApprover'],
  ];
  for (const [src, dest] of mapKeys) {
    if (!(src in patch)) continue;
    setJob(dest, safeStr((patch as any)[src]));
  }

  if (mode === 'applyNew') {
    const del = Array.isArray(req.delegations) ? req.delegations : [];
    s.delegations.set(employeeId, del);
  } else {
    s.delegations.set(employeeId, []);
  }

  const histEvent = {
    id: `h-${employeeId}-${Math.random().toString(16).slice(2)}`,
    sourceReportingRequestId: req.id,
    at: req.effectiveDate,
    type: req.changeType,
    detail: mode === 'applyNew' ? req.reason : `Reversal of ${req.id}`,
    actor: req.createdBy || 'HRIS',
  };
  next.history = Array.isArray(next.history) ? [histEvent, ...next.history] : [histEvent];
  s.overrides.set(employeeId, next);
};

const addReportingHistoryEntry = (req: ReportingChangeRequest, employeeId: string, mode: 'applyNew' | 'applyPrevious', reverseOf?: string | null) => {
  const s = stores();
  const current = s.reportingHistory.get(employeeId) || [];
  const prev = mode === 'applyNew' ? req.previousValues : req.newValues;
  const next = mode === 'applyNew' ? req.newValues : req.previousValues;
  const entry = {
    id: `rep-h-${employeeId}-${mode === 'applyNew' ? req.id : `${req.id}-rev`}`,
    referenceNo: `REP-${req.id.slice(-6).toUpperCase()}${mode === 'applyNew' ? '' : '-REV'}`,
    employeeId,
    employeeName: mode === 'applyNew' ? req.employeeName : `Reversal — ${req.employeeName}`,
    changeType: req.changeType,
    previousManager: prev.directManager ?? null,
    newManager: next.directManager ?? null,
    previousFunctionalManager: prev.functionalManager ?? null,
    newFunctionalManager: next.functionalManager ?? null,
    effectiveDate: req.effectiveDate,
    endDate: req.endDate ?? null,
    approvalStatus: mode === 'applyNew' ? req.status : 'Approved',
    approvedBy: req.approvals.find((a) => a.decision === 'Approved')?.by || null,
    createdBy: req.createdBy,
    createdAt: req.createdAt,
    updatedAt: nowIso(),
    requestId: req.id,
    reverseOf: reverseOf || null,
    isBulk: !!req.isBulk,
  };
  s.reportingHistory.set(employeeId, [entry, ...current].slice(0, 250));
};

const writeEmploymentHistory = (req: ReportingChangeRequest, employeeId: string, mode: 'applyNew' | 'applyPrevious', reverseOf?: string | null) => {
  const s = stores();
  const id = `hist-rep-${employeeId}-${mode === 'applyNew' ? req.id : `${req.id}-rev`}`;
  const referenceNo = `HIST-REP-${String(id).slice(-6).toUpperCase()}`;
  const prev = mode === 'applyNew' ? req.previousValues : req.newValues;
  const next = mode === 'applyNew' ? req.newValues : req.previousValues;
  const item = {
    id,
    referenceNo,
    employeeId,
    employeeName: req.employeeName,
    eventType: 'Manager Change',
    eventDate: nowIso(),
    effectiveDate: req.effectiveDate,
    previousDepartment: null,
    newDepartment: null,
    previousJobTitle: null,
    newJobTitle: null,
    previousGrade: null,
    newGrade: null,
    previousManager: prev.directManager ?? null,
    newManager: next.directManager ?? null,
    previousLocation: null,
    newLocation: null,
    previousStatus: null,
    newStatus: null,
    reason: mode === 'applyNew' ? req.reason : `Reversal of ${req.id}`,
    notes: req.notes ?? null,
    supportingDocument: req.supportingDocuments && req.supportingDocuments.length ? req.supportingDocuments[0] : null,
    approvalStatus: 'Approved',
    approvalId: `REP-APP-${req.id.slice(-6).toUpperCase()}`,
    approvedBy: req.approvals.find((a) => a.decision === 'Approved')?.by || 'HRIS',
    approvedAt: nowIso(),
    createdBy: req.createdBy,
    createdAt: req.createdAt,
    updatedAt: nowIso(),
    audit: req.audit || [],
    reverseOf: reverseOf || null,
  };
  s.histDetail.set(id, item);
  s.histList.set(id, {
    id,
    referenceNo,
    employeeId,
    employeeName: item.employeeName,
    businessUnit: null,
    location: null,
    eventType: item.eventType,
    eventDate: item.eventDate,
    effectiveDate: item.effectiveDate,
    previousDepartment: null,
    newDepartment: null,
    previousJobTitle: null,
    newJobTitle: null,
    previousGrade: null,
    newGrade: null,
    previousManager: item.previousManager,
    newManager: item.newManager,
    previousLocation: null,
    newLocation: null,
    previousStatus: null,
    newStatus: null,
    reason: item.reason,
    notes: item.notes,
    approvalStatus: item.approvalStatus,
    approvalId: item.approvalId,
    approvedBy: item.approvedBy,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
  });
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  if (role === 'Employee') return jsonErr(403, 'Permission denied');
  const seg0 = action[0] || '';
  const seg1 = action[1] || '';
  const s = stores();
  const req = s.requests.get(seg0);
  if (!req) return jsonErr(404, 'Reporting change request not found');
  if (!seg1) return jsonOk(req);
  if (seg1 === 'audit') return jsonOk(req.audit || []);
  return jsonErr(404, 'Not found');
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  if (role === 'Employee') return jsonErr(403, 'Permission denied');
  const perms = permissions(role);
  const requestId = action[0] || '';
  const actionKey = action[1] || '';
  if (!requestId || !actionKey) return jsonErr(404, 'Not found');

  const s = stores();
  const req = s.requests.get(requestId);
  if (!req) return jsonErr(404, 'Reporting change request not found');

  const body = (await request.json().catch(() => null)) as any;
  const decisionReason = normalize(body?.reason, 400) || null;

  if (actionKey === 'submit') {
    if (!perms.canSubmit) return jsonErr(403, 'Permission denied');
    if (req.status !== 'Draft' && req.status !== 'Rejected') return jsonErr(400, 'Only Draft/Rejected requests can be submitted');
    req.status = 'Submitted';
    req.updatedAt = nowIso();
    req.audit.unshift(auditEntry('Reporting change request submitted', role, { reason: decisionReason || req.reason }));
    s.requests.set(req.id, req);
    if (req.isBulk && Array.isArray(req.bulkEmployeeIds)) for (const empId of req.bulkEmployeeIds) addToIndex(empId, req.id);
    else addToIndex(req.employeeId, req.id);
    return jsonOk(req);
  }

  if (actionKey === 'approve') {
    if (!perms.canApprove) return jsonErr(403, 'Permission denied');
    if (!['Submitted', 'Pending HR Review', 'Pending Department Head Approval', 'Pending HR Director Approval'].includes(req.status)) return jsonErr(400, 'Request is not in an approvable state');
    if (req.status === 'Pending HR Review' && !perms.canHrReview) return jsonErr(403, 'Permission denied');
    if (req.status === 'Pending Department Head Approval' && role !== 'Department Head' && !perms.canDirector) return jsonErr(403, 'Permission denied');
    if (req.status === 'Pending HR Director Approval' && !perms.canDirector) return jsonErr(403, 'Permission denied');

    const stageBefore = req.status;
    const next = nextApprovalStage(req);
    req.approvals.unshift({
      id: `appr-${Math.random().toString(16).slice(2)}`,
      at: nowIso(),
      stage: stageBefore,
      decision: 'Approved',
      by: role,
      reason: decisionReason,
    });
    req.audit.unshift(auditEntry('Reporting change request approved', role, { reason: decisionReason || 'Approved' }));
    req.status = next;
    req.updatedAt = nowIso();

    if (req.status === 'Approved') {
      const employees = req.isBulk && Array.isArray(req.bulkEmployeeIds) ? req.bulkEmployeeIds : [req.employeeId];
      for (const empId of employees) {
        applyOverrideFromReportingRequest(empId, req, 'applyNew');
        writeEmploymentHistory(req, empId, 'applyNew');
        addReportingHistoryEntry(req, empId, 'applyNew');
      }
      req.audit.unshift(auditEntry('Employee reporting line updated from approved request', role));
    }
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  if (actionKey === 'reject') {
    if (!perms.canApprove) return jsonErr(403, 'Permission denied');
    if (!['Submitted', 'Pending HR Review', 'Pending Department Head Approval', 'Pending HR Director Approval'].includes(req.status)) return jsonErr(400, 'Request is not in a rejectable state');
    const stageBefore = req.status;
    req.status = 'Rejected';
    req.updatedAt = nowIso();
    req.approvals.unshift({
      id: `appr-${Math.random().toString(16).slice(2)}`,
      at: nowIso(),
      stage: stageBefore,
      decision: 'Rejected',
      by: role,
      reason: decisionReason || 'Rejected',
    });
    req.audit.unshift(auditEntry('Reporting change request rejected', role, { reason: decisionReason || 'Rejected' }));
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  if (actionKey === 'reverse') {
    if (!perms.canDirector) return jsonErr(403, 'Permission denied');
    if (req.status !== 'Approved') return jsonErr(400, 'Only Approved requests can be reversed');
    const employees = req.isBulk && Array.isArray(req.bulkEmployeeIds) ? req.bulkEmployeeIds : [req.employeeId];
    for (const empId of employees) {
      applyOverrideFromReportingRequest(empId, req, 'applyPrevious');
      writeEmploymentHistory(req, empId, 'applyPrevious', req.id);
      addReportingHistoryEntry(req, empId, 'applyPrevious', req.id);
    }
    req.audit.unshift(auditEntry('Reporting change request reversed', role, { reason: decisionReason || `Reversal of ${req.id}` }));
    req.status = 'Completed';
    req.updatedAt = nowIso();
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  return jsonErr(404, 'Not found');
}
