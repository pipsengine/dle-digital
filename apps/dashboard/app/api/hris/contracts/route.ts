import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Legal Officer'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type ContractType =
  | 'Permanent Employment'
  | 'Fixed-Term Contract'
  | 'Temporary Contract'
  | 'Consultancy Contract'
  | 'Internship'
  | 'Industrial Training'
  | 'NYSC Placement'
  | 'Expatriate Contract'
  | 'Outsourced Staff Contract'
  | 'Project-Based Contract'
  | 'Secondment Agreement';

type ContractStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Active'
  | 'Due for Renewal'
  | 'Renewed'
  | 'Expired'
  | 'Terminated'
  | 'Suspended'
  | 'Cancelled'
  | 'Archived';

type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending Legal Review'
  | 'Pending HR Director Approval'
  | 'Pending Executive Approval'
  | 'Approved'
  | 'Rejected'
  | 'Active'
  | 'Expired'
  | 'Terminated'
  | 'Archived';

type DocumentCategory =
  | 'Offer Letter'
  | 'Employment Contract'
  | 'Renewal Letter'
  | 'Amendment Letter'
  | 'Secondment Agreement'
  | 'Consultancy Agreement'
  | 'Project Assignment Letter'
  | 'Termination Letter'
  | 'Signed Acceptance Copy'
  | 'Legal Review Document'
  | 'Supporting Approval Memo';

type SignatureStatus = 'Missing' | 'Unsigned' | 'Signed';
type LegalReviewStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
type DocumentLifecycle = 'Active' | 'Archived';

type AuditLog = {
  id: string;
  at: string;
  action: string;
  performedBy: Role;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
  device?: string;
};

type ApprovalStep = {
  id: string;
  at: string;
  stage: WorkflowStatus;
  decision: 'Approved' | 'Rejected';
  by: Role;
  reason?: string | null;
};

type ContractTerms = {
  durationMonths: number | null;
  workingHours: string | null;
  workMode: 'Onsite' | 'Hybrid' | 'Remote' | null;
  noticePeriodDays: number | null;
  renewalClause: string | null;
  terminationClause: string | null;
  confidentialityClause: string | null;
  nonCompeteClause: string | null;
  probationClause: string | null;
  benefitsEligibility: string | null;
  leaveEligibility: string | null;
  medicalEligibility: string | null;
  pensionEligibility: string | null;
  allowancesEligibility: string | null;
  overtimeEligibility: string | null;
  projectAssignmentClause: string | null;
  hseComplianceRequirement: string | null;
  travelRequirement: string | null;
};

type ContractDocument = {
  id: string;
  category: DocumentCategory;
  name: string;
  version: number;
  mimeType: string;
  sizeBytes: number;
  signatureStatus: SignatureStatus;
  legalReviewStatus: LegalReviewStatus;
  expiryDate: string | null;
  status: DocumentLifecycle;
  uploadedAt: string;
  uploadedBy: Role;
  archivedAt?: string | null;
  archivedBy?: Role | null;
};

type EmployeeContract = {
  id: string;
  employeeId: string;
  employeeName: string;
  contractReferenceNo: string;
  contractType: ContractType;
  contractCategory: string;
  contractStatus: ContractStatus;
  workflowStatus: WorkflowStatus;
  startDate: string;
  endDate: string | null;
  probationApplicable: boolean;
  probationStartDate: string | null;
  probationEndDate: string | null;
  confirmationDueDate: string | null;
  department: string | null;
  jobTitle: string | null;
  jobGrade: string | null;
  workLocation: string | null;
  reportingManager: string | null;
  hrOfficer: string | null;
  renewalStatus: string;
  approvalStatus: 'Not Started' | 'In Progress' | 'Approved' | 'Rejected';
  documentStatus: 'Missing' | 'Partial' | 'Complete';
  lastAmendmentAt: string | null;
  terms: ContractTerms;
  documents: ContractDocument[];
  approvals: ApprovalStep[];
  audit: AuditLog[];
  createdBy: Role;
  createdAt: string;
  updatedBy: Role;
  updatedAt: string;
  parentContractId?: string | null;
  renewalOfContractId?: string | null;
  amendedFromContractId?: string | null;
  terminationDate?: string | null;
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
    'Department Head',
    'Legal Officer',
    'Payroll Officer',
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

const contractPermissions = (role: Role) => {
  const canManage = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  const canLegal = role === 'Super Admin' || role === 'Legal Officer';
  const canAudit = role === 'Super Admin' || role === 'Auditor' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  return { canManage, canLegal, canAudit };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisContracts?: Map<string, EmployeeContract>;
    __dleHrisContractsByEmployee?: Map<string, string[]>;
    __dleHrisContractRefSeq?: number;
    __dleHrisEmployees?: Map<string, any>;
  };
  if (!g.__dleHrisContracts) g.__dleHrisContracts = new Map();
  if (!g.__dleHrisContractsByEmployee) g.__dleHrisContractsByEmployee = new Map();
  if (!g.__dleHrisContractRefSeq) g.__dleHrisContractRefSeq = 1000;
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  return { contracts: g.__dleHrisContracts, byEmployee: g.__dleHrisContractsByEmployee, refSeq: g.__dleHrisContractRefSeq, employees: g.__dleHrisEmployees };
};

const nextRef = () => {
  const g = globalThis as unknown as { __dleHrisContractRefSeq?: number };
  if (!g.__dleHrisContractRefSeq) g.__dleHrisContractRefSeq = 1000;
  const cur = g.__dleHrisContractRefSeq;
  g.__dleHrisContractRefSeq = cur + 1;
  return `DLE-CON-${String(cur).padStart(6, '0')}`;
};

const normalizeStr = (v: unknown, max: number) => {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
};

const normalizeDate = (v: unknown) => {
  const s = normalizeStr(v, 40);
  if (!s) return null;
  const ms = new Date(s.includes('T') ? s : `${s}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(ms)) return null;
  return s.includes('T') ? s.slice(0, 10) : s;
};

const auditEntry = (action: string, performedBy: Role, extra?: Partial<AuditLog>) => ({
  id: `aud-${Math.random().toString(16).slice(2)}`,
  at: nowIso(),
  action,
  performedBy,
  ...extra,
});

const isFixedTerm = (t: ContractType) =>
  t !== 'Permanent Employment' && t !== 'Secondment Agreement';

const computeDocumentStatus = (docs: ContractDocument[]): EmployeeContract['documentStatus'] => {
  if (!docs.length) return 'Missing';
  const required: DocumentCategory[] = ['Employment Contract', 'Signed Acceptance Copy'];
  const has = (c: DocumentCategory) => docs.some((d) => d.status === 'Active' && d.category === c);
  if (required.every(has)) return 'Complete';
  return 'Partial';
};

const computeExpiry = (endDate: string | null) => {
  if (!endDate) return { daysToExpiry: null as number | null, expired: false };
  const ms = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(ms)) return { daysToExpiry: null as number | null, expired: false };
  const days = Math.ceil((ms - Date.now()) / (24 * 3600 * 1000));
  return { daysToExpiry: days, expired: days < 0 };
};

export async function POST(request: Request) {
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const perms = contractPermissions(role);
  if (!perms.canManage) return jsonErr(403, 'Permission denied');
  if (role === 'Employee') return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonErr(400, 'Invalid JSON body');

  const employeeId = normalizeStr(body.employeeId, 40).toUpperCase();
  if (!employeeId) return jsonErr(400, 'Employee ID is required');

  const contractType = normalizeStr(body.contractType, 60) as ContractType;
  const allowedTypes: ContractType[] = [
    'Permanent Employment',
    'Fixed-Term Contract',
    'Temporary Contract',
    'Consultancy Contract',
    'Internship',
    'Industrial Training',
    'NYSC Placement',
    'Expatriate Contract',
    'Outsourced Staff Contract',
    'Project-Based Contract',
    'Secondment Agreement',
  ];
  if (!allowedTypes.includes(contractType)) return jsonErr(400, 'Contract type is required');

  const startDate = normalizeDate(body.startDate);
  const endDate = normalizeDate(body.endDate);
  if (!startDate) return jsonErr(400, 'Start date is required');
  if (isFixedTerm(contractType) && !endDate) return jsonErr(400, 'End date is required for fixed-term contracts');
  if (endDate) {
    const sMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const eMs = new Date(`${endDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(sMs) && Number.isFinite(eMs) && eMs < sMs) return jsonErr(400, 'End date cannot be before start date');
  }

  const contractReferenceNo = normalizeStr(body.contractReferenceNo, 80).toUpperCase() || nextRef();
  const { contracts, byEmployee, employees } = stores();
  for (const c of contracts.values()) {
    if (String(c.contractReferenceNo || '').toUpperCase() === contractReferenceNo) return jsonErr(400, 'Contract reference number must be unique');
  }

  const employeeName = normalizeStr(body.employeeName, 120) || `Employee ${employeeId}`;
  const jobTitle = normalizeStr(body.jobTitle, 120) || null;
  const department = normalizeStr(body.department, 120) || null;
  const jobGrade = normalizeStr(body.jobGrade, 40) || null;
  const workLocation = normalizeStr(body.workLocation, 120) || null;
  const reportingManager = normalizeStr(body.reportingManager, 120) || null;
  const hrOfficer = normalizeStr(body.hrOfficer, 120) || null;

  const probationApplicable = Boolean(body.probationApplicable);
  const probationStartDate = probationApplicable ? normalizeDate(body.probationStartDate) : null;
  const probationEndDate = probationApplicable ? normalizeDate(body.probationEndDate) : null;
  if (probationApplicable && probationStartDate && probationEndDate) {
    const pS = new Date(`${probationStartDate}T00:00:00.000Z`).getTime();
    const pE = new Date(`${probationEndDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(pS) && Number.isFinite(pE) && pE < pS) return jsonErr(400, 'Probation end date cannot be before probation start date');
  }

  const now = nowIso();
  const id = `con-${employeeId}-${Math.random().toString(16).slice(2)}`;
  const terms: ContractTerms = {
    durationMonths: typeof body?.terms?.durationMonths === 'number' ? Math.max(0, Math.min(120, body.terms.durationMonths)) : null,
    workingHours: normalizeStr(body?.terms?.workingHours, 80) || null,
    workMode: (normalizeStr(body?.terms?.workMode, 30) as any) || null,
    noticePeriodDays: typeof body?.terms?.noticePeriodDays === 'number' ? Math.max(0, Math.min(365, body.terms.noticePeriodDays)) : null,
    renewalClause: normalizeStr(body?.terms?.renewalClause, 800) || null,
    terminationClause: normalizeStr(body?.terms?.terminationClause, 800) || null,
    confidentialityClause: normalizeStr(body?.terms?.confidentialityClause, 800) || null,
    nonCompeteClause: normalizeStr(body?.terms?.nonCompeteClause, 800) || null,
    probationClause: normalizeStr(body?.terms?.probationClause, 800) || null,
    benefitsEligibility: normalizeStr(body?.terms?.benefitsEligibility, 120) || null,
    leaveEligibility: normalizeStr(body?.terms?.leaveEligibility, 120) || null,
    medicalEligibility: normalizeStr(body?.terms?.medicalEligibility, 120) || null,
    pensionEligibility: normalizeStr(body?.terms?.pensionEligibility, 120) || null,
    allowancesEligibility: normalizeStr(body?.terms?.allowancesEligibility, 120) || null,
    overtimeEligibility: normalizeStr(body?.terms?.overtimeEligibility, 120) || null,
    projectAssignmentClause: normalizeStr(body?.terms?.projectAssignmentClause, 800) || null,
    hseComplianceRequirement: normalizeStr(body?.terms?.hseComplianceRequirement, 800) || null,
    travelRequirement: normalizeStr(body?.terms?.travelRequirement, 120) || null,
  };

  const rec: EmployeeContract = {
    id,
    employeeId,
    employeeName,
    contractReferenceNo,
    contractType,
    contractCategory: normalizeStr(body.contractCategory, 80) || 'Standard',
    contractStatus: 'Draft',
    workflowStatus: 'Draft',
    startDate,
    endDate: endDate || null,
    probationApplicable,
    probationStartDate,
    probationEndDate,
    confirmationDueDate: normalizeDate(body.confirmationDueDate),
    department,
    jobTitle,
    jobGrade,
    workLocation,
    reportingManager,
    hrOfficer,
    renewalStatus: 'Not Started',
    approvalStatus: 'Not Started',
    documentStatus: 'Missing',
    lastAmendmentAt: null,
    terms,
    documents: [],
    approvals: [],
    audit: [auditEntry('Contract created', role, { reason: normalizeStr(body.reason, 600) || undefined })],
    createdBy: role,
    createdAt: now,
    updatedBy: role,
    updatedAt: now,
  };

  contracts.set(id, rec);
  const idx = byEmployee.get(employeeId) || [];
  byEmployee.set(employeeId, [id, ...idx].slice(0, 250));

  const emp = employees.get(employeeId);
  if (emp?.audit && Array.isArray(emp.audit)) emp.audit.unshift({ id: `aud-${Math.random().toString(16).slice(2)}`, at: now, action: 'Contract created', performedBy: role });

  return jsonOk(rec);
}

