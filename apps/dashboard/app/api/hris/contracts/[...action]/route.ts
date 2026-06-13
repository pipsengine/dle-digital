import { NextResponse } from 'next/server';
import { readEmployeeContractFromDb, readEmployeeContractsFromDb } from '@/lib/dle-enterprise-db';

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

type Severity = 'high' | 'medium' | 'low';

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

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  actionLabel: string;
  action: string;
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

const permissions = (role: Role) => {
  const canManage = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  const canLegal = role === 'Super Admin' || role === 'Legal Officer';
  const canApproveDept = role === 'Super Admin' || role === 'Department Head';
  const canApproveDirector = role === 'Super Admin' || role === 'HR Director';
  const canApproveExec = role === 'Super Admin' || role === 'Executive Management';
  const canAudit = role === 'Super Admin' || role === 'Auditor' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  return { canManage, canLegal, canApproveDept, canApproveDirector, canApproveExec, canAudit };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisContracts?: Map<string, EmployeeContract>;
    __dleHrisContractsByEmployee?: Map<string, string[]>;
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisEmploymentHistoryDetail?: Map<string, any>;
  };
  if (!g.__dleHrisContracts) g.__dleHrisContracts = new Map();
  if (!g.__dleHrisContractsByEmployee) g.__dleHrisContractsByEmployee = new Map();
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisEmploymentHistoryDetail) g.__dleHrisEmploymentHistoryDetail = new Map();
  return { contracts: g.__dleHrisContracts, byEmployee: g.__dleHrisContractsByEmployee, employees: g.__dleHrisEmployees, histDetail: g.__dleHrisEmploymentHistoryDetail };
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

const ensureCanViewContract = (role: Role, viewerEmployeeId: string | undefined, contract: EmployeeContract) => {
  if (role !== 'Employee') return true;
  return Boolean(viewerEmployeeId && viewerEmployeeId === contract.employeeId);
};

const signedDocPresent = (docs: ContractDocument[]) =>
  docs.some((d) => d.status === 'Active' && (d.category === 'Signed Acceptance Copy' || d.category === 'Employment Contract') && d.signatureStatus === 'Signed');

const mergeContracts = async (employeeId?: string) => {
  const s = stores();
  const db = ((await readEmployeeContractsFromDb(employeeId)) || []) as unknown as EmployeeContract[];
  const memory = Array.from(s.contracts.values()).filter((c) => (employeeId ? c.employeeId === employeeId : true));
  const seen = new Set<string>();
  return [...memory, ...db].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
};

const contractRow = (c: EmployeeContract) => {
  const approvals = Array.isArray(c.approvals) ? c.approvals : [];
  const lastApproved = approvals.find((a) => a && a.decision === 'Approved') || null;
  return {
    id: String(c.id || ''),
    employeeId: String(c.employeeId || ''),
    employeeName: String(c.employeeName || ''),
    contractReferenceNo: String(c.contractReferenceNo || ''),
    contractType: String(c.contractType || ''),
    startDate: String(c.startDate || ''),
    endDate: c.endDate ? String(c.endDate) : null,
    contractStatus: String(c.contractStatus || ''),
    renewalStatus: String(c.renewalStatus || ''),
    approvalStatus: String(c.approvalStatus || ''),
    documentStatus: String(c.documentStatus || ''),
    createdBy: String(c.createdBy || ''),
    approvedBy: lastApproved ? String(lastApproved.by || '') : null,
    createdAt: String(c.createdAt || ''),
    updatedAt: String(c.updatedAt || ''),
  };
};

const buildPdfBytes = (title: string, lines: string[]) => {
  const escapePdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const clean = (s: string) => escapePdf(s.replace(/\r?\n/g, ' ').slice(0, 170));
  const fontSize = 10;
  const lineHeight = 12;
  const startY = 760;
  const x = 40;
  const all = [title, ...lines].slice(0, 55);
  const streamParts: string[] = [];
  streamParts.push(`BT /F1 ${fontSize} Tf ${x} ${startY} Td`);
  for (let i = 0; i < all.length; i++) {
    streamParts.push(`(${clean(all[i] || '')}) Tj`);
    if (i !== all.length - 1) streamParts.push(`0 -${lineHeight} Td`);
  }
  streamParts.push('ET');
  const stream = streamParts.join('\n');

  const encoder = new TextEncoder();
  const xref: number[] = [0];
  let out = '%PDF-1.4\n';
  const pushObj = (obj: string) => {
    xref.push(out.length);
    out += obj;
  };
  pushObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pushObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pushObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  pushObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  const streamBytes = encoder.encode(stream);
  pushObj(`5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  const startXref = out.length;
  out += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i++) out += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return encoder.encode(out);
};

const csvCell = (v: string) => {
  const s = (v ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = (header: string[], rows: string[][]) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');

const updateEmployeeFromContract = (contract: EmployeeContract, mode: 'activate' | 'terminate') => {
  const s = stores();
  const rec = s.employees.get(contract.employeeId);
  if (!rec?.profile) return;
  const profile = rec.profile;
  const before = JSON.stringify({ employmentStatus: profile.employmentStatus, employmentType: profile.employmentType, employmentDetails: profile.employmentDetails });

  if (!profile.employmentDetails) profile.employmentDetails = {};

  if (mode === 'activate') {
    const isPermanent = contract.contractType === 'Permanent Employment';
    profile.employmentType = isPermanent ? 'Permanent' : 'Contract';
    profile.employmentStatus = contract.contractStatus === 'Expired' ? 'Contract' : 'Active';
    profile.employmentDetails.contractStartDate = contract.startDate;
    profile.employmentDetails.contractEndDate = contract.endDate;
    profile.employmentDetails.workLocation = contract.workLocation || profile.employmentDetails.workLocation || profile.location;
  } else {
    profile.employmentStatus = 'Terminated';
    profile.employmentDetails.exitDate = contract.terminationDate || nowIso().slice(0, 10);
    profile.employmentDetails.exitReason = 'Termination';
  }

  const after = JSON.stringify({ employmentStatus: profile.employmentStatus, employmentType: profile.employmentType, employmentDetails: profile.employmentDetails });
  if (Array.isArray(rec.audit)) rec.audit.unshift({ id: `aud-${Math.random().toString(16).slice(2)}`, at: nowIso(), action: 'Employee status updated from contract', performedBy: 'HR Manager', oldValue: before, newValue: after });
};

const writeEmploymentHistoryEvent = (contract: EmployeeContract, eventType: string, approvalStatus: string, approvedBy: Role | null) => {
  const s = stores();
  const id = `hist-contract-${contract.id}-${Math.random().toString(16).slice(2)}`;
  const referenceNo = `HIST-CON-${contract.id.slice(-6).toUpperCase()}`;
  s.histDetail.set(id, {
    id,
    referenceNo,
    employeeId: contract.employeeId,
    employeeName: contract.employeeName,
    eventType,
    effectiveDate: contract.startDate,
    endDate: contract.endDate,
    previousManager: null,
    newManager: contract.reportingManager,
    approvalStatus,
    approvedBy,
    createdBy: contract.createdBy,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    notes: contract.contractReferenceNo,
  });
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const p = permissions(role);
  const url = new URL(request.url);
  const seg0 = action[0] || '';

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const all = await mergeContracts();
    const active = all.filter((c) => c.contractStatus === 'Active').length;
    const pending = all.filter((c) => c.workflowStatus !== 'Draft' && c.workflowStatus !== 'Approved' && c.workflowStatus !== 'Rejected').length;
    const expiringSoon = all.filter((c) => {
      const { daysToExpiry } = computeExpiry(c.endDate);
      return typeof daysToExpiry === 'number' && daysToExpiry >= 0 && daysToExpiry <= 30;
    }).length;
    const missingSigned = all.filter((c) => c.contractStatus === 'Active' && !signedDocPresent(c.documents)).length;
    return jsonOk({
      totalContracts: all.length,
      activeContracts: active,
      pendingApprovals: pending,
      expiringSoon,
      missingSignedDocuments: missingSigned,
      lastUpdatedAt: nowIso(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase();
    const list = await mergeContracts(employeeId || undefined);
    const out: AIInsight[] = [];
    const add = (severity: Severity, title: string, confidence: number, recommendation: string, actionLabel: string, actionKey: string) =>
      out.push({ id: `con-ai-${employeeId || 'org'}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action: actionKey });

    const one = list.find((c) => c.contractStatus === 'Active' || c.contractStatus === 'Due for Renewal') || list[0];
    if (one) {
      const { daysToExpiry, expired } = computeExpiry(one.endDate);
      if (typeof daysToExpiry === 'number' && daysToExpiry <= 21 && daysToExpiry >= 0)
        add('high', `Contract expires in ${daysToExpiry} days`, 0.86, 'Start renewal workflow and confirm approvals routing.', 'Renew', 'renew');
      if (expired && one.employeeId) add('high', 'Employee is active but contract has expired', 0.83, 'Escalate expiry and update employment status or renew immediately.', 'Review', 'review');
      if (one.workflowStatus === 'Draft') add('medium', 'Renewal approval has not started', 0.72, 'Submit contract for approval to avoid expiry risk.', 'Submit', 'submit');
      if (one.contractStatus === 'Active' && !signedDocPresent(one.documents))
        add('high', 'Signed contract document is missing', 0.88, 'Upload signed acceptance copy before continued activation.', 'Upload Document', 'upload_document');
      if (one.endDate && one.contractType === 'Project-Based Contract')
        add('low', 'Contract end date may conflict with project assignment end date', 0.62, 'Confirm project assignment dates and align contract end date.', 'Amend', 'amend');
    }
    add('medium', 'Contract renewal requires HR Director approval', 0.7, 'Ensure routing includes HR Director stage for renewals.', 'View Workflow', 'workflow');
    return jsonOk(out.slice(0, 10));
  }

  if (seg0 === 'expiring') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const withinDays = Math.max(1, Math.min(365, Number(url.searchParams.get('withinDays') || '90')));
    const rows = (await mergeContracts())
      .map((c) => ({ c, exp: computeExpiry(c.endDate) }))
      .filter((x) => typeof x.exp.daysToExpiry === 'number' && x.exp.daysToExpiry >= 0 && x.exp.daysToExpiry <= withinDays)
      .sort((a, b) => (a.exp.daysToExpiry! > b.exp.daysToExpiry! ? 1 : -1))
      .slice(0, 200)
      .map((x) => ({
        contractId: x.c.id,
        employeeId: x.c.employeeId,
        employeeName: x.c.employeeName,
        contractReferenceNo: x.c.contractReferenceNo,
        contractType: x.c.contractType,
        endDate: x.c.endDate,
        daysToExpiry: x.exp.daysToExpiry,
        status: x.c.contractStatus,
      }));
    return jsonOk(rows);
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `contract_report_${employeeId}_${stamp}` : `contract_report_${stamp}`;

    const list = await mergeContracts(employeeId || undefined);
    const header = ['Employee ID', 'Employee Name', 'Contract Ref', 'Type', 'Status', 'Start Date', 'End Date', 'Workflow', 'Approval', 'Documents', 'HR Officer'];
    const rows = list.slice(0, 200).map((c) => [
      c.employeeId,
      c.employeeName,
      c.contractReferenceNo,
      c.contractType,
      c.contractStatus,
      c.startDate,
      c.endDate || '',
      c.workflowStatus,
      c.approvalStatus,
      c.documentStatus,
      c.hrOfficer || '',
    ]);

    if (format === 'xls' || format === 'excel') {
      const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body>
        <table border="1">
          <tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>
          ${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c || '')}</td>`).join('')}</tr>`).join('')}
        </table>
      </body></html>`;
      return new NextResponse(html, {
        headers: {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${fileBase}.xls"`,
        },
      });
    }

    if (format === 'pdf') {
      const lines = rows.slice(0, 45).map((r) => `${r[0]} • ${r[1]} • ${r[2]} • ${r[3]} • ${r[4]} • ${r[5]} → ${r[6] || '—'}`);
      const bytes = buildPdfBytes('DLE HRIS — Contract Report', lines);
      return new NextResponse(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${fileBase}.pdf"`,
        },
      });
    }

    const csv = toCsv(header, rows);
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  const contractId = seg0;
  const s = stores();
  const c = (s.contracts.get(contractId) || (await readEmployeeContractFromDb(contractId))) as EmployeeContract | null;
  if (!c) return jsonErr(404, 'Contract not found');
  if (!ensureCanViewContract(role, viewerEmployeeId, c)) return jsonErr(403, 'Permission denied');

  const downloadDocId = normalizeStr(url.searchParams.get('downloadDocId'), 120);
  if (downloadDocId) {
    const doc = c.documents.find((d) => d.id === downloadDocId) || null;
    if (!doc) return jsonErr(404, 'Document not found');
    if (role === 'Employee') {
      if (!(doc.status === 'Active' && doc.signatureStatus === 'Signed')) return jsonErr(403, 'Permission denied');
    }
    c.audit.unshift(auditEntry('Contract document downloaded', role, { reason: doc.name }));
    const bytes = new TextEncoder().encode(`DLE HRIS Demo Document\n${doc.name}\n${doc.category}\n${c.contractReferenceNo}\n`);
    return new NextResponse(bytes, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${doc.name.replace(/[^a-z0-9._-]/gi, '_')}"`,
      },
    });
  }

  c.audit.unshift(auditEntry('Contract viewed', role));
  return jsonOk(c);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const contractId = action[0] || '';
  if (!contractId) return jsonErr(400, 'Contract ID is required');
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const p = permissions(role);
  if (!p.canManage) return jsonErr(403, 'Permission denied');

  const s = stores();
  const c = s.contracts.get(contractId);
  if (!c) return jsonErr(404, 'Contract not found');
  if (!ensureCanViewContract(role, viewerEmployeeId, c)) return jsonErr(403, 'Permission denied');
  if (!(c.workflowStatus === 'Draft' || c.workflowStatus === 'Rejected')) return jsonErr(400, 'Only draft/rejected contracts can be edited');

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonErr(400, 'Invalid JSON body');
  const before = JSON.stringify({ contractType: c.contractType, contractStatus: c.contractStatus, startDate: c.startDate, endDate: c.endDate, terms: c.terms, probationApplicable: c.probationApplicable });

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
  const t = normalizeStr(body.contractType, 60) as ContractType;
  if (t && allowedTypes.includes(t)) c.contractType = t;

  const startDate = normalizeDate(body.startDate) || c.startDate;
  const endDate = normalizeDate(body.endDate);
  if (isFixedTerm(c.contractType) && !(endDate || c.endDate)) return jsonErr(400, 'End date is required for fixed-term contracts');
  if (endDate) {
    const sMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const eMs = new Date(`${endDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(sMs) && Number.isFinite(eMs) && eMs < sMs) return jsonErr(400, 'End date cannot be before start date');
    c.endDate = endDate;
  }
  c.startDate = startDate;

  c.contractCategory = normalizeStr(body.contractCategory, 80) || c.contractCategory;
  c.department = normalizeStr(body.department, 120) || c.department;
  c.jobTitle = normalizeStr(body.jobTitle, 120) || c.jobTitle;
  c.jobGrade = normalizeStr(body.jobGrade, 40) || c.jobGrade;
  c.workLocation = normalizeStr(body.workLocation, 120) || c.workLocation;
  c.reportingManager = normalizeStr(body.reportingManager, 120) || c.reportingManager;
  c.hrOfficer = normalizeStr(body.hrOfficer, 120) || c.hrOfficer;

  c.probationApplicable = Boolean(body.probationApplicable);
  c.probationStartDate = c.probationApplicable ? normalizeDate(body.probationStartDate) : null;
  c.probationEndDate = c.probationApplicable ? normalizeDate(body.probationEndDate) : null;
  if (c.probationApplicable && c.probationStartDate && c.probationEndDate) {
    const pS = new Date(`${c.probationStartDate}T00:00:00.000Z`).getTime();
    const pE = new Date(`${c.probationEndDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(pS) && Number.isFinite(pE) && pE < pS) return jsonErr(400, 'Probation end date cannot be before probation start date');
  }
  c.confirmationDueDate = c.probationApplicable ? normalizeDate(body.confirmationDueDate) : c.confirmationDueDate;

  const terms = body.terms && typeof body.terms === 'object' ? (body.terms as Record<string, any>) : {};
  c.terms.durationMonths = typeof terms.durationMonths === 'number' ? Math.max(0, Math.min(120, terms.durationMonths)) : c.terms.durationMonths;
  c.terms.workingHours = normalizeStr(terms.workingHours, 80) || c.terms.workingHours;
  c.terms.workMode = (normalizeStr(terms.workMode, 30) as any) || c.terms.workMode;
  c.terms.noticePeriodDays = typeof terms.noticePeriodDays === 'number' ? Math.max(0, Math.min(365, terms.noticePeriodDays)) : c.terms.noticePeriodDays;
  c.terms.renewalClause = normalizeStr(terms.renewalClause, 800) || c.terms.renewalClause;
  c.terms.terminationClause = normalizeStr(terms.terminationClause, 800) || c.terms.terminationClause;
  c.terms.confidentialityClause = normalizeStr(terms.confidentialityClause, 800) || c.terms.confidentialityClause;
  c.terms.nonCompeteClause = normalizeStr(terms.nonCompeteClause, 800) || c.terms.nonCompeteClause;
  c.terms.probationClause = normalizeStr(terms.probationClause, 800) || c.terms.probationClause;
  c.terms.benefitsEligibility = normalizeStr(terms.benefitsEligibility, 120) || c.terms.benefitsEligibility;
  c.terms.leaveEligibility = normalizeStr(terms.leaveEligibility, 120) || c.terms.leaveEligibility;
  c.terms.medicalEligibility = normalizeStr(terms.medicalEligibility, 120) || c.terms.medicalEligibility;
  c.terms.pensionEligibility = normalizeStr(terms.pensionEligibility, 120) || c.terms.pensionEligibility;
  c.terms.allowancesEligibility = normalizeStr(terms.allowancesEligibility, 120) || c.terms.allowancesEligibility;
  c.terms.overtimeEligibility = normalizeStr(terms.overtimeEligibility, 120) || c.terms.overtimeEligibility;
  c.terms.projectAssignmentClause = normalizeStr(terms.projectAssignmentClause, 800) || c.terms.projectAssignmentClause;
  c.terms.hseComplianceRequirement = normalizeStr(terms.hseComplianceRequirement, 800) || c.terms.hseComplianceRequirement;
  c.terms.travelRequirement = normalizeStr(terms.travelRequirement, 120) || c.terms.travelRequirement;

  c.documentStatus = computeDocumentStatus(c.documents);
  c.updatedAt = nowIso();
  c.updatedBy = role;
  c.audit.unshift(
    auditEntry('Contract edited', role, {
      oldValue: before,
      newValue: JSON.stringify({ contractType: c.contractType, startDate: c.startDate, endDate: c.endDate, terms: c.terms, probationApplicable: c.probationApplicable }),
      reason: normalizeStr(body.reason, 600) || undefined,
    })
  );
  return jsonOk(c);
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const contractId = action[0] || '';
  const op = action[1] || '';
  if (!contractId) return jsonErr(400, 'Contract ID is required');
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const p = permissions(role);

  const s = stores();
  const c = s.contracts.get(contractId);
  if (!c) return jsonErr(404, 'Contract not found');
  if (!ensureCanViewContract(role, viewerEmployeeId, c)) return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  const reason = normalizeStr(body?.reason, 600) || undefined;

  const stageApproveAllowed = (stage: WorkflowStatus) => {
    if (stage === 'Submitted' || stage === 'Pending HR Review') return p.canManage;
    if (stage === 'Pending Department Head Approval') return p.canApproveDept || p.canManage;
    if (stage === 'Pending Legal Review') return p.canLegal || p.canManage;
    if (stage === 'Pending HR Director Approval') return p.canApproveDirector || p.canManage;
    if (stage === 'Pending Executive Approval') return p.canApproveExec || p.canManage;
    return false;
  };

  if (op === 'submit') {
    if (!p.canManage) return jsonErr(403, 'Permission denied');
    if (!(c.workflowStatus === 'Draft' || c.workflowStatus === 'Rejected')) return jsonErr(400, 'Only draft/rejected contracts can be submitted');
    if (isFixedTerm(c.contractType) && !c.endDate) return jsonErr(400, 'End date is required for fixed-term contracts');
    c.workflowStatus = 'Submitted';
    c.contractStatus = 'Pending Approval';
    c.approvalStatus = 'In Progress';
    c.audit.unshift(auditEntry('Contract submitted', role, { reason }));
    c.updatedAt = nowIso();
    c.updatedBy = role;
    return jsonOk(c);
  }

  if (op === 'approve') {
    if (!stageApproveAllowed(c.workflowStatus)) return jsonErr(403, 'Permission denied');
    const now = nowIso();
    const before = c.workflowStatus;
    const next: Record<WorkflowStatus, WorkflowStatus> = {
      Draft: 'Submitted',
      Submitted: 'Pending HR Review',
      'Pending HR Review': 'Pending Department Head Approval',
      'Pending Department Head Approval': 'Pending Legal Review',
      'Pending Legal Review': 'Pending HR Director Approval',
      'Pending HR Director Approval': 'Pending Executive Approval',
      'Pending Executive Approval': 'Approved',
      Approved: 'Approved',
      Rejected: 'Rejected',
      Active: 'Active',
      Expired: 'Expired',
      Terminated: 'Terminated',
      Archived: 'Archived',
    };
    const after = next[c.workflowStatus] || c.workflowStatus;
    c.workflowStatus = after;
    c.approvals.unshift({ id: `appr-${Math.random().toString(16).slice(2)}`, at: now, stage: before, decision: 'Approved', by: role, reason: reason || null });
    c.audit.unshift(auditEntry('Contract approved', role, { reason, oldValue: before, newValue: after }));
    c.updatedAt = now;
    c.updatedBy = role;

    if (after === 'Approved') {
      const docStatus = computeDocumentStatus(c.documents);
      if (!signedDocPresent(c.documents)) return jsonErr(400, 'Signed document required before activation');
      c.documentStatus = docStatus;
      c.approvalStatus = 'Approved';
      const { expired } = computeExpiry(c.endDate);
      c.contractStatus = expired ? 'Expired' : 'Active';
      c.workflowStatus = expired ? 'Expired' : 'Active';
      updateEmployeeFromContract(c, 'activate');
      writeEmploymentHistoryEvent(c, 'Contract', 'Approved', role);
      c.audit.unshift(auditEntry('Contract activated', role));
      c.updatedAt = nowIso();
    }
    return jsonOk(c);
  }

  if (op === 'reject') {
    if (!stageApproveAllowed(c.workflowStatus)) return jsonErr(403, 'Permission denied');
    if (c.workflowStatus === 'Draft') return jsonErr(400, 'Draft cannot be rejected');
    const now = nowIso();
    const before = c.workflowStatus;
    c.workflowStatus = 'Rejected';
    c.contractStatus = 'Draft';
    c.approvalStatus = 'Rejected';
    c.approvals.unshift({ id: `appr-${Math.random().toString(16).slice(2)}`, at: now, stage: before, decision: 'Rejected', by: role, reason: reason || null });
    c.audit.unshift(auditEntry('Contract rejected', role, { reason, oldValue: before, newValue: 'Rejected' }));
    c.updatedAt = now;
    c.updatedBy = role;
    return jsonOk(c);
  }

  if (op === 'documents') {
    if (!(p.canManage || p.canLegal)) return jsonErr(403, 'Permission denied');
    const actionKey = normalizeStr(body?.action, 40).toLowerCase();
    const docId = normalizeStr(body?.docId, 140);
    if (actionKey === 'archive') {
      if (!docId) return jsonErr(400, 'Document ID is required');
      const doc = c.documents.find((d) => d.id === docId) || null;
      if (!doc) return jsonErr(404, 'Document not found');
      doc.status = 'Archived';
      doc.archivedAt = nowIso();
      doc.archivedBy = role;
      c.documentStatus = computeDocumentStatus(c.documents);
      c.audit.unshift(auditEntry('Contract document archived', role, { reason: `${doc.category} v${doc.version}` }));
      c.updatedAt = nowIso();
      c.updatedBy = role;
      return jsonOk(doc);
    }

    const category = normalizeStr(body?.category, 80) as DocumentCategory;
    const categories: DocumentCategory[] = [
      'Offer Letter',
      'Employment Contract',
      'Renewal Letter',
      'Amendment Letter',
      'Secondment Agreement',
      'Consultancy Agreement',
      'Project Assignment Letter',
      'Termination Letter',
      'Signed Acceptance Copy',
      'Legal Review Document',
      'Supporting Approval Memo',
    ];
    if (!categories.includes(category)) return jsonErr(400, 'Invalid document category');
    const name = normalizeStr(body?.name, 160) || `${category.replace(/\s+/g, '_')}.pdf`;
    const mimeType = normalizeStr(body?.mimeType, 120) || 'application/pdf';
    const sizeBytes = Math.max(0, Math.min(25_000_000, Number(body?.sizeBytes || 0)));
    const signatureStatus = (normalizeStr(body?.signatureStatus, 40) as SignatureStatus) || 'Unsigned';
    const legalReviewStatus = (normalizeStr(body?.legalReviewStatus, 40) as LegalReviewStatus) || 'Not Required';
    const expiryDate = normalizeDate(body?.expiryDate);

    const allowedMime = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ]);
    if (sizeBytes <= 0 || !allowedMime.has(mimeType.toLowerCase())) return jsonErr(400, 'File validation failed');
    const maxDocs = 50;
    if (c.documents.length >= maxDocs) return jsonErr(400, 'Document limit reached');

    if (actionKey === 'replace') {
      if (!docId) return jsonErr(400, 'Document ID is required');
      const existing = c.documents.find((d) => d.id === docId) || null;
      if (!existing) return jsonErr(404, 'Document not found');
      existing.status = 'Archived';
      existing.archivedAt = nowIso();
      existing.archivedBy = role;
      c.audit.unshift(auditEntry('Contract document replaced', role, { reason: `${existing.category} v${existing.version}` }));
    }

    const versions = c.documents.filter((d) => d.category === category).map((d) => d.version);
    const nextVersion = (versions.length ? Math.max(...versions) : 0) + 1;
    const doc: ContractDocument = {
      id: `doc-${Math.random().toString(16).slice(2)}`,
      category,
      name,
      version: nextVersion,
      mimeType,
      sizeBytes,
      signatureStatus,
      legalReviewStatus,
      expiryDate: expiryDate || null,
      status: 'Active',
      uploadedAt: nowIso(),
      uploadedBy: role,
    };
    c.documents.unshift(doc);
    c.documentStatus = computeDocumentStatus(c.documents);
    c.audit.unshift(auditEntry('Contract document uploaded', role, { reason: `${doc.category} v${doc.version}` }));
    c.updatedAt = nowIso();
    c.updatedBy = role;
    return jsonOk(doc);
  }

  if (op === 'renew') {
    if (!p.canManage) return jsonErr(403, 'Permission denied');
    const newStartDate = normalizeDate(body?.startDate) || c.endDate || nowIso().slice(0, 10);
    const newEndDate = normalizeDate(body?.endDate);
    if (isFixedTerm(c.contractType) && !newEndDate) return jsonErr(400, 'End date is required for fixed-term contracts');
    if (newEndDate) {
      const sMs = new Date(`${newStartDate}T00:00:00.000Z`).getTime();
      const eMs = new Date(`${newEndDate}T00:00:00.000Z`).getTime();
      if (Number.isFinite(sMs) && Number.isFinite(eMs) && eMs < sMs) return jsonErr(400, 'End date cannot be before start date');
    }
    const id = `con-${c.employeeId}-${Math.random().toString(16).slice(2)}`;
    const now = nowIso();
    const copy: EmployeeContract = {
      ...c,
      id,
      contractReferenceNo: normalizeStr(body?.contractReferenceNo, 80).toUpperCase() || `${c.contractReferenceNo}-R${Math.random().toString(16).slice(2, 4).toUpperCase()}`,
      contractStatus: 'Draft',
      workflowStatus: 'Draft',
      approvalStatus: 'Not Started',
      renewalStatus: 'In Progress',
      documents: [],
      approvals: [],
      audit: [auditEntry('Contract renewed (draft created)', role, { reason })],
      createdBy: role,
      createdAt: now,
      updatedBy: role,
      updatedAt: now,
      parentContractId: c.id,
      renewalOfContractId: c.id,
      startDate: newStartDate,
      endDate: newEndDate || null,
    };
    s.contracts.set(copy.id, copy);
    const idx = s.byEmployee.get(c.employeeId) || [];
    s.byEmployee.set(c.employeeId, [copy.id, ...idx].slice(0, 250));
    c.renewalStatus = 'Renewal Initiated';
    c.audit.unshift(auditEntry('Contract renewal initiated', role, { reason, newValue: copy.id }));
    return jsonOk(copy);
  }

  if (op === 'amend') {
    if (!p.canManage) return jsonErr(403, 'Permission denied');
    const id = `con-${c.employeeId}-${Math.random().toString(16).slice(2)}`;
    const now = nowIso();
    const copy: EmployeeContract = {
      ...c,
      id,
      contractReferenceNo: normalizeStr(body?.contractReferenceNo, 80).toUpperCase() || `${c.contractReferenceNo}-A${Math.random().toString(16).slice(2, 4).toUpperCase()}`,
      contractStatus: 'Draft',
      workflowStatus: 'Draft',
      approvalStatus: 'Not Started',
      lastAmendmentAt: now,
      documents: [],
      approvals: [],
      audit: [auditEntry('Contract amendment (draft created)', role, { reason })],
      createdBy: role,
      createdAt: now,
      updatedBy: role,
      updatedAt: now,
      parentContractId: c.id,
      amendedFromContractId: c.id,
    };
    s.contracts.set(copy.id, copy);
    const idx = s.byEmployee.get(c.employeeId) || [];
    s.byEmployee.set(c.employeeId, [copy.id, ...idx].slice(0, 250));
    c.lastAmendmentAt = now;
    c.audit.unshift(auditEntry('Contract amendment initiated', role, { reason, newValue: copy.id }));
    return jsonOk(copy);
  }

  if (op === 'terminate') {
    if (!p.canManage) return jsonErr(403, 'Permission denied');
    const termDate = normalizeDate(body?.terminationDate) || nowIso().slice(0, 10);
    const startMs = new Date(`${c.startDate}T00:00:00.000Z`).getTime();
    const termMs = new Date(`${termDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(termMs) && termMs < startMs) return jsonErr(400, 'Termination date cannot be before contract start date');
    c.terminationDate = termDate;
    c.contractStatus = 'Terminated';
    c.workflowStatus = 'Terminated';
    c.audit.unshift(auditEntry('Contract terminated', role, { reason }));
    c.updatedAt = nowIso();
    c.updatedBy = role;
    updateEmployeeFromContract(c, 'terminate');
    writeEmploymentHistoryEvent(c, 'Termination', 'Approved', role);
    return jsonOk(c);
  }

  return jsonErr(404, 'Not found');
}
