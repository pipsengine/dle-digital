import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Line Manager'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type JobChangeStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Director Approval'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled';

type JobChangeType =
  | 'Job Title Change'
  | 'Department Change'
  | 'Grade Change'
  | 'Reporting Manager Change'
  | 'Functional Manager Change'
  | 'Location Change'
  | 'Project Assignment Change'
  | 'Cost Center Change'
  | 'Role Profile Update';

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

type JobSupportingDoc = { id: string; name: string };

type JobChangeApproval = {
  id: string;
  at: string;
  stage: JobChangeStatus;
  decision: 'Approved' | 'Rejected';
  by: string;
  reason?: string | null;
};

type JobChangeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  changeType: JobChangeType;
  status: JobChangeStatus;
  effectiveDate: string;
  reason: string;
  notes?: string | null;
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
  supportingDocuments: JobSupportingDoc[];
  approvals: JobChangeApproval[];
  audit: AuditLog[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const jsonOk = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const nowIso = () => new Date().toISOString();

const normalize = (v: unknown, max = 500) => {
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
    'Line Manager',
    'Payroll Officer',
    'Auditor',
    'Employee',
    'Executive Management',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const jobPermissions = (role: Role) => {
  const canApprove = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'Department Head';
  const canHrReview = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  const canDirector = role === 'Super Admin' || role === 'HR Director';
  return { canApprove, canHrReview, canDirector };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisJobChangeRequests?: Map<string, JobChangeRequest>;
    __dleHrisJobChangeRequestsByEmployee?: Map<string, string[]>;
    __dleHrisEmployeeOverrides?: Map<string, any>;
    __dleHrisEmploymentHistory?: Map<string, any>;
    __dleHrisEmploymentHistoryDetail?: Map<string, any>;
  };
  if (!g.__dleHrisJobChangeRequests) g.__dleHrisJobChangeRequests = new Map();
  if (!g.__dleHrisJobChangeRequestsByEmployee) g.__dleHrisJobChangeRequestsByEmployee = new Map();
  if (!g.__dleHrisEmployeeOverrides) g.__dleHrisEmployeeOverrides = new Map();
  if (!g.__dleHrisEmploymentHistory) g.__dleHrisEmploymentHistory = new Map();
  if (!g.__dleHrisEmploymentHistoryDetail) g.__dleHrisEmploymentHistoryDetail = new Map();
  return {
    requests: g.__dleHrisJobChangeRequests,
    index: g.__dleHrisJobChangeRequestsByEmployee,
    overrides: g.__dleHrisEmployeeOverrides,
    historyList: g.__dleHrisEmploymentHistory,
    historyDetail: g.__dleHrisEmploymentHistoryDetail,
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

const jobEventTypeForChange = (t: JobChangeType) => {
  if (t === 'Job Title Change') return 'Job Title Change';
  if (t === 'Department Change') return 'Department Change';
  if (t === 'Grade Change') return 'Grade Change';
  if (t === 'Reporting Manager Change' || t === 'Functional Manager Change') return 'Manager Change';
  if (t === 'Location Change') return 'Transfer';
  if (t === 'Project Assignment Change') return 'Project Assignment';
  if (t === 'Cost Center Change') return 'Department Change';
  return 'Job Title Change';
};

const applyOverrideFromJobRequest = (employeeId: string, req: JobChangeRequest) => {
  const s = stores();
  const existing = s.overrides.get(employeeId) || {};
  const next = { ...existing };
  next.profile = next.profile && typeof next.profile === 'object' ? { ...next.profile } : {};
  next.profile.jobDetails = next.profile.jobDetails && typeof next.profile.jobDetails === 'object' ? { ...next.profile.jobDetails } : {};
  next.profile.employmentDetails = next.profile.employmentDetails && typeof next.profile.employmentDetails === 'object' ? { ...next.profile.employmentDetails } : {};

  const patch = req.newValues || {};
  const setJob = (k: string, v: string | null) => ((next.profile.jobDetails as any)[k] = v);
  const setEmp = (k: string, v: string | null) => ((next.profile.employmentDetails as any)[k] = v);

  if (req.changeType === 'Job Title Change') setJob('jobTitle', patch.jobTitle ?? null);
  if (req.changeType === 'Grade Change') setJob('jobGrade', patch.jobGrade ?? null);
  if (req.changeType === 'Department Change') {
    setJob('department', patch.department ?? null);
    setJob('businessUnit', patch.businessUnit ?? null);
  }
  if (req.changeType === 'Reporting Manager Change') setJob('reportingManager', patch.reportingManager ?? null);
  if (req.changeType === 'Functional Manager Change') setJob('functionalManager', patch.functionalManager ?? null);
  if (req.changeType === 'Location Change') setEmp('workLocation', patch.workLocation ?? null);
  if (req.changeType === 'Project Assignment Change') setJob('projectSite', patch.projectSite ?? null);
  if (req.changeType === 'Cost Center Change') setJob('costCenter', patch.costCenter ?? null);
  if (req.changeType === 'Role Profile Update') {
    const keys = [
      'roleSummary',
      'roleProfile',
      'jobPurpose',
      'jobDescription',
      'keyResponsibilities',
      'technicalCompetencies',
      'behavioralCompetencies',
      'requiredQualifications',
      'requiredCertifications',
      'requiredExperience',
      'kpis',
      'performanceExpectations',
      'hseResponsibilities',
      'complianceResponsibilities',
    ];
    for (const k of keys) setJob(k, (patch as any)[k] ?? null);
  }

  s.overrides.set(employeeId, next);
};

const writeEmploymentHistoryFromJobRequest = (req: JobChangeRequest) => {
  const s = stores();
  const id = `hist-job-${req.id}`;
  const referenceNo = `HIST-JOB-${req.id.slice(-6).toUpperCase()}`;
  const eventType = jobEventTypeForChange(req.changeType);
  const item = {
    id,
    referenceNo,
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    eventType,
    eventDate: req.updatedAt,
    effectiveDate: req.effectiveDate,
    previousDepartment: req.previousValues.department ?? null,
    newDepartment: req.newValues.department ?? null,
    previousJobTitle: req.previousValues.jobTitle ?? null,
    newJobTitle: req.newValues.jobTitle ?? null,
    previousGrade: req.previousValues.jobGrade ?? null,
    newGrade: req.newValues.jobGrade ?? null,
    previousManager: req.previousValues.reportingManager ?? null,
    newManager: req.newValues.reportingManager ?? null,
    previousLocation: req.previousValues.workLocation ?? null,
    newLocation: req.newValues.workLocation ?? null,
    previousStatus: null,
    newStatus: null,
    reason: req.reason,
    notes: req.notes ?? null,
    supportingDocument: req.supportingDocuments && req.supportingDocuments.length ? req.supportingDocuments[0] : null,
    approvalStatus: 'Approved',
    approvalId: `JOB-APP-${req.id.slice(-6).toUpperCase()}`,
    approvedBy: req.approvals.find((a) => a.decision === 'Approved')?.by || 'HRIS',
    approvedAt: req.updatedAt,
    createdBy: req.createdBy,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    audit: req.audit || [],
    reverseOf: null,
  };
  s.historyDetail.set(id, item);
  s.historyList.set(id, {
    id,
    referenceNo,
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    businessUnit: req.newValues.businessUnit ?? null,
    location: req.newValues.workLocation ?? null,
    eventType,
    eventDate: item.eventDate,
    effectiveDate: item.effectiveDate,
    previousDepartment: item.previousDepartment,
    newDepartment: item.newDepartment,
    previousJobTitle: item.previousJobTitle,
    newJobTitle: item.newJobTitle,
    previousGrade: item.previousGrade,
    newGrade: item.newGrade,
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

const nextApprovalStage = (req: JobChangeRequest): JobChangeStatus => {
  if (req.status === 'Submitted') return 'Pending HR Review';
  if (req.status === 'Pending HR Review') {
    if (req.changeType === 'Department Change' || req.changeType === 'Reporting Manager Change' || req.changeType === 'Location Change') return 'Pending Department Head Approval';
    return 'Pending HR Director Approval';
  }
  if (req.status === 'Pending Department Head Approval') return 'Pending HR Director Approval';
  if (req.status === 'Pending HR Director Approval') return 'Approved';
  return req.status;
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const seg0 = action[0] || '';
  const seg1 = action[1] || '';

  const s = stores();
  const req = s.requests.get(seg0);
  if (!req) return jsonErr(404, 'Job change request not found');

  if (!seg1) return jsonOk(req);
  if (seg1 === 'audit') return jsonOk(req.audit || []);
  return jsonErr(404, 'Not found');
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const perms = jobPermissions(role);
  const requestId = action[0] || '';
  const actionKey = action[1] || '';
  if (!requestId || !actionKey) return jsonErr(404, 'Not found');

  const s = stores();
  const req = s.requests.get(requestId);
  if (!req) return jsonErr(404, 'Job change request not found');

  const body = (await request.json().catch(() => null)) as any;
  const decisionReason = normalize(body?.reason, 400) || null;

  if (actionKey === 'submit') {
    if (req.status !== 'Draft' && req.status !== 'Rejected') return jsonErr(400, 'Only Draft/Rejected requests can be submitted');
    req.status = 'Submitted';
    req.updatedAt = nowIso();
    req.audit.unshift(auditEntry('Job change request submitted', role, { reason: decisionReason || req.reason }));
    s.requests.set(req.id, req);
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
    req.audit.unshift(auditEntry('Job change request approved', role, { reason: decisionReason || 'Approved' }));
    req.status = next;
    req.updatedAt = nowIso();

    if (req.status === 'Approved') {
      applyOverrideFromJobRequest(req.employeeId, req);
      writeEmploymentHistoryFromJobRequest(req);
      req.audit.unshift(auditEntry('Employee profile updated from job change request', role));
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
    req.audit.unshift(auditEntry('Job change request rejected', role, { reason: decisionReason || 'Rejected' }));
    s.requests.set(req.id, req);
    return jsonOk(req);
  }

  return jsonErr(404, 'Not found');
}

