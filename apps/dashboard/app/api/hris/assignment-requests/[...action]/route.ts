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

type AssignmentRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Line Manager Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Review'
  | 'Pending HR Director Approval'
  | 'Pending Payroll Review'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type AssignmentRequestType =
  | 'Department Transfer'
  | 'Unit Transfer'
  | 'Business Unit Transfer'
  | 'Cost Center Change'
  | 'Reporting Manager Change'
  | 'Project Reassignment'
  | 'Site Reassignment'
  | 'Temporary Assignment'
  | 'Secondment'
  | 'Acting Assignment';

type AssignmentApproval = {
  id: string;
  at: string;
  stage: AssignmentRequestStatus;
  decision: 'Approved' | 'Rejected';
  by: string;
  reason?: string | null;
};

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

type AssignmentRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  requestType: AssignmentRequestType;
  status: AssignmentRequestStatus;
  effectiveDate: string;
  endDate?: string | null;
  reason: string;
  notes?: string | null;
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
  assignmentType: string;
  assignmentStatus: string;
  supportingDocuments: { id: string; name: string }[];
  approvals: AssignmentApproval[];
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
    __dleHrisAssignmentRequests?: Map<string, AssignmentRequest>;
    __dleHrisAssignmentRequestsByEmployee?: Map<string, string[]>;
    __dleHrisEmployeeOverrides?: Map<string, any>;
    __dleHrisEmploymentHistory?: Map<string, any>;
    __dleHrisEmploymentHistoryDetail?: Map<string, any>;
    __dleHrisAssignmentHistory?: Map<string, any[]>;
  };
  if (!g.__dleHrisAssignmentRequests) g.__dleHrisAssignmentRequests = new Map();
  if (!g.__dleHrisAssignmentRequestsByEmployee) g.__dleHrisAssignmentRequestsByEmployee = new Map();
  if (!g.__dleHrisEmployeeOverrides) g.__dleHrisEmployeeOverrides = new Map();
  if (!g.__dleHrisEmploymentHistory) g.__dleHrisEmploymentHistory = new Map();
  if (!g.__dleHrisEmploymentHistoryDetail) g.__dleHrisEmploymentHistoryDetail = new Map();
  if (!g.__dleHrisAssignmentHistory) g.__dleHrisAssignmentHistory = new Map();
  return {
    requests: g.__dleHrisAssignmentRequests,
    index: g.__dleHrisAssignmentRequestsByEmployee,
    overrides: g.__dleHrisEmployeeOverrides,
    histList: g.__dleHrisEmploymentHistory,
    histDetail: g.__dleHrisEmploymentHistoryDetail,
    assignHistory: g.__dleHrisAssignmentHistory,
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

const assignmentEventTypeForRequest = (t: AssignmentRequestType) => {
  if (t === 'Department Transfer' || t === 'Business Unit Transfer') return 'Transfer';
  if (t === 'Unit Transfer') return 'Department Change';
  if (t === 'Cost Center Change') return 'Department Change';
  if (t === 'Reporting Manager Change') return 'Manager Change';
  if (t === 'Project Reassignment' || t === 'Site Reassignment') return 'Project Assignment';
  if (t === 'Secondment') return 'Secondment';
  if (t === 'Acting Assignment') return 'Job Title Change';
  if (t === 'Temporary Assignment') return 'Transfer';
  return 'Transfer';
};

const applyOverride = (employeeId: string, req: AssignmentRequest, mode: 'applyNew' | 'applyPrevious') => {
  const s = stores();
  const existing = s.overrides.get(employeeId) || {};
  const next = { ...existing };
  next.profile = next.profile && typeof next.profile === 'object' ? { ...next.profile } : {};
  next.profile.jobDetails = next.profile.jobDetails && typeof next.profile.jobDetails === 'object' ? { ...next.profile.jobDetails } : {};
  next.profile.employmentDetails = next.profile.employmentDetails && typeof next.profile.employmentDetails === 'object' ? { ...next.profile.employmentDetails } : {};

  const patch = mode === 'applyNew' ? req.newValues : req.previousValues;
  const setJob = (k: string, v: string | null) => ((next.profile.jobDetails as any)[k] = v);
  const setEmp = (k: string, v: string | null) => ((next.profile.employmentDetails as any)[k] = v);

  const setIf = (k: string) => {
    if (!(k in patch)) return;
    const v = patch[k];
    setJob(k, typeof v === 'string' ? v : null);
  };

  for (const k of [
    'department',
    'division',
    'unit',
    'team',
    'businessUnit',
    'costCenter',
    'officeSite',
    'projectSite',
    'reportingManager',
    'functionalManager',
    'departmentHead',
    'unitHead',
    'businessUnitHead',
    'projectManager',
    'siteSupervisor',
    'matrixManager',
    'delegatedApprover',
    'hrBusinessPartner',
    'projectName',
    'projectCode',
    'client',
    'projectLocation',
    'siteLocation',
    'mobilizationStatus',
    'demobilizationStatus',
    'siteAccessRequirement',
    'ppeRequirement',
    'hseInductionStatus',
  ])
    setIf(k);

  if ('workLocation' in patch) setEmp('workLocation', typeof patch.workLocation === 'string' ? patch.workLocation : null);
  if ('workMode' in patch) setEmp('workMode', typeof patch.workMode === 'string' ? patch.workMode : null);
  if ('shiftPattern' in patch) setEmp('shiftPattern', typeof patch.shiftPattern === 'string' ? patch.shiftPattern : null);

  if (typeof patch.department === 'string' && patch.department.trim()) (next.profile as any).department = patch.department;
  if (typeof patch.businessUnit === 'string' && patch.businessUnit.trim()) (next.profile as any).businessUnit = patch.businessUnit;
  if (typeof patch.workLocation === 'string' && patch.workLocation.trim()) (next.profile as any).location = patch.workLocation;
  if (typeof patch.reportingManager === 'string' && patch.reportingManager.trim()) (next.profile as any).reportingManager = patch.reportingManager;

  s.overrides.set(employeeId, next);
};

const writeEmploymentHistory = (req: AssignmentRequest, mode: 'applyNew' | 'applyPrevious', reverseOf?: string | null) => {
  const s = stores();
  const id = `hist-asg-${mode === 'applyNew' ? req.id : `${req.id}-rev`}`;
  const referenceNo = `HIST-ASG-${String(id).slice(-6).toUpperCase()}`;
  const eventType = assignmentEventTypeForRequest(req.requestType);
  const prev = mode === 'applyNew' ? req.previousValues : req.newValues;
  const next = mode === 'applyNew' ? req.newValues : req.previousValues;
  const item = {
    id,
    referenceNo,
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    eventType,
    eventDate: nowIso(),
    effectiveDate: req.effectiveDate,
    previousDepartment: prev.department ?? null,
    newDepartment: next.department ?? null,
    previousJobTitle: null,
    newJobTitle: null,
    previousGrade: null,
    newGrade: null,
    previousManager: prev.reportingManager ?? null,
    newManager: next.reportingManager ?? null,
    previousLocation: prev.workLocation ?? null,
    newLocation: next.workLocation ?? null,
    previousStatus: null,
    newStatus: null,
    reason: mode === 'applyNew' ? req.reason : `Reversal of ${req.id}`,
    notes: req.notes ?? null,
    supportingDocument: req.supportingDocuments && req.supportingDocuments.length ? req.supportingDocuments[0] : null,
    approvalStatus: 'Approved',
    approvalId: `ASG-APP-${req.id.slice(-6).toUpperCase()}`,
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
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    businessUnit: next.businessUnit ?? null,
    location: next.workLocation ?? null,
    eventType,
    eventDate: item.eventDate,
    effectiveDate: item.effectiveDate,
    previousDepartment: item.previousDepartment,
    newDepartment: item.newDepartment,
    previousJobTitle: null,
    newJobTitle: null,
    previousGrade: null,
    newGrade: null,
    previousManager: item.previousManager,
    newManager: item.newManager,
    previousLocation: item.previousLocation,
    newLocation: item.newLocation,
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

const writeAssignmentHistory = (req: AssignmentRequest) => {
  const s = stores();
  const current = s.assignHistory.get(req.employeeId) || [];
  const entry = {
    id: `asg-h-${req.id}`,
    referenceNo: `ASG-${req.id.slice(-6).toUpperCase()}`,
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    assignmentType: req.assignmentType,
    previousDepartment: req.previousValues.department ?? null,
    newDepartment: req.newValues.department ?? null,
    previousUnit: req.previousValues.unit ?? null,
    newUnit: req.newValues.unit ?? null,
    previousManager: req.previousValues.reportingManager ?? null,
    newManager: req.newValues.reportingManager ?? null,
    previousCostCenter: req.previousValues.costCenter ?? null,
    newCostCenter: req.newValues.costCenter ?? null,
    effectiveDate: req.effectiveDate,
    endDate: req.endDate ?? null,
    approvalStatus: req.status,
    approvedBy: req.approvals.find((a) => a.decision === 'Approved')?.by || null,
    createdBy: req.createdBy,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    requestId: req.id,
    isBulk: !!req.isBulk,
  };
  s.assignHistory.set(req.employeeId, [entry, ...current].slice(0, 250));
};

const nextStage = (req: AssignmentRequest): AssignmentRequestStatus => {
  if (req.status === 'Submitted') return 'Pending Line Manager Review';
  if (req.status === 'Pending Line Manager Review') return 'Pending Department Head Approval';
  if (req.status === 'Pending Department Head Approval') return 'Pending HR Review';
  if (req.status === 'Pending HR Review') return 'Pending HR Director Approval';
  if (req.status === 'Pending HR Director Approval') {
    if (req.requestType === 'Cost Center Change') return 'Pending Payroll Review';
    return 'Approved';
  }
  if (req.status === 'Pending Payroll Review') return 'Approved';
  if (req.status === 'Approved') return 'Completed';
  return req.status;
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const reqId = action[0] || '';
  const seg1 = action[1] || '';
  const s = stores();
  const req = s.requests.get(reqId);
  if (!req) return jsonErr(404, 'Assignment request not found');
  if (!seg1) return jsonOk(req);
  if (seg1 === 'audit') return jsonOk(req.audit || []);
  return jsonErr(404, 'Not found');
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const perm = permissions(role);
  const seg0 = action[0] || '';
  const seg1 = action[1] || '';
  const body = (await request.json().catch(() => null)) as any;
  const reason = normalize(body?.reason, 400) || null;

  const s = stores();

  if (seg0 === 'bulk') {
    if (!perm.canSubmit) return jsonErr(403, 'Permission denied');
    const employeeIds = Array.isArray(body?.employeeIds) ? (body.employeeIds as any[]).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : [];
    if (!employeeIds.length) return jsonErr(400, 'employeeIds is required');
    const requestType = normalize(body?.requestType, 80) as AssignmentRequestType;
    const effectiveDate = normalize(body?.effectiveDate, 40);
    const bulkReason = normalize(body?.reason, 600);
    if (!effectiveDate) return jsonErr(400, 'Effective date is required');
    if (!bulkReason) return jsonErr(400, 'Reason is required');
    const now = nowIso();
    const req: AssignmentRequest = {
      id: `asgreq-bulk-${Math.random().toString(16).slice(2)}`,
      employeeId: employeeIds[0],
      employeeName: 'Bulk Assignment',
      requestType: requestType || 'Department Transfer',
      status: 'Draft',
      effectiveDate,
      endDate: normalize(body?.endDate, 40) || null,
      reason: bulkReason,
      notes: normalize(body?.notes, 1200) || null,
      previousValues: {},
      newValues: (body?.newValues && typeof body.newValues === 'object' ? body.newValues : {}) as Record<string, string | null>,
      assignmentType: normalize(body?.assignmentType, 60) || 'Permanent Assignment',
      assignmentStatus: normalize(body?.assignmentStatus, 40) || 'Pending Approval',
      supportingDocuments: [],
      approvals: [],
      audit: [auditEntry('Bulk reassignment request created', role, { reason: bulkReason })],
      createdBy: role,
      createdAt: now,
      updatedAt: now,
      isBulk: true,
      bulkEmployeeIds: employeeIds,
    };
    s.requests.set(req.id, req);
    for (const id of employeeIds) addToIndex(id, req.id);
    return jsonOk(req);
  }

  const req = s.requests.get(seg0);
  if (!req) return jsonErr(404, 'Assignment request not found');
  if (!seg1) return jsonErr(404, 'Not found');

  if (seg1 === 'submit') {
    if (!perm.canSubmit) return jsonErr(403, 'Permission denied');
    if (req.status !== 'Draft' && req.status !== 'Rejected') return jsonErr(400, 'Only Draft/Rejected requests can be submitted');
    req.status = 'Submitted';
    req.updatedAt = nowIso();
    req.audit.unshift(auditEntry('Assignment submitted', role, { reason: reason || req.reason }));
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  if (seg1 === 'approve') {
    if (!perm.canApprove) return jsonErr(403, 'Permission denied');
    if (!['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review', 'Approved'].includes(req.status))
      return jsonErr(400, 'Request is not in an approvable state');

    if (req.status === 'Pending HR Review' && !perm.canHrReview) return jsonErr(403, 'Permission denied');
    if (req.status === 'Pending HR Director Approval' && !perm.canDirector) return jsonErr(403, 'Permission denied');
    if (req.status === 'Pending Payroll Review' && role !== 'Payroll Officer' && !perm.canDirector) return jsonErr(403, 'Permission denied');

    const stageBefore = req.status;
    const next = nextStage(req);
    req.approvals.unshift({
      id: `appr-${Math.random().toString(16).slice(2)}`,
      at: nowIso(),
      stage: stageBefore,
      decision: 'Approved',
      by: role,
      reason,
    });
    req.audit.unshift(auditEntry('Assignment approved', role, { reason: reason || 'Approved' }));
    req.status = next;
    req.updatedAt = nowIso();

    const finalize = (targetEmployeeId: string, employeeName: string) => {
      const localReq: AssignmentRequest = { ...req, employeeId: targetEmployeeId, employeeName };
      applyOverride(targetEmployeeId, localReq, 'applyNew');
      writeEmploymentHistory(localReq, 'applyNew', null);
      writeAssignmentHistory({ ...localReq, status: req.status });
    };

    if (req.status === 'Approved') {
      if (req.isBulk && req.bulkEmployeeIds && req.bulkEmployeeIds.length) {
        for (const id of req.bulkEmployeeIds) finalize(id, `Employee ${id.slice(-5)}`);
      } else {
        finalize(req.employeeId, req.employeeName);
      }
    }
    if (req.status === 'Completed') {
      req.audit.unshift(auditEntry('Assignment completed', role));
    }
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  if (seg1 === 'reject') {
    if (!perm.canApprove) return jsonErr(403, 'Permission denied');
    if (!['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review'].includes(req.status))
      return jsonErr(400, 'Request is not in a rejectable state');
    const stageBefore = req.status;
    req.status = 'Rejected';
    req.updatedAt = nowIso();
    req.approvals.unshift({
      id: `appr-${Math.random().toString(16).slice(2)}`,
      at: nowIso(),
      stage: stageBefore,
      decision: 'Rejected',
      by: role,
      reason: reason || 'Rejected',
    });
    req.audit.unshift(auditEntry('Assignment rejected', role, { reason: reason || 'Rejected' }));
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  if (seg1 === 'reverse') {
    if (!perm.canApprove) return jsonErr(403, 'Permission denied');
    if (!['Approved', 'Completed'].includes(req.status)) return jsonErr(400, 'Only Approved/Completed requests can be reversed');
    applyOverride(req.employeeId, req, 'applyPrevious');
    writeEmploymentHistory(req, 'applyPrevious', `hist-asg-${req.id}`);
    req.status = 'Cancelled';
    req.updatedAt = nowIso();
    req.audit.unshift(auditEntry('Assignment reversed', role, { reason: reason || 'Reversed' }));
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  return jsonErr(404, 'Not found');
}

