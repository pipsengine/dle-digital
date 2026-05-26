import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Legal Officer'
  | 'Compliance Officer'
  | 'HSE Officer'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Line Manager'
  | 'Executive Management'
  | 'IT Administrator';

type Severity = 'high' | 'medium' | 'low';

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  actionLabel: string;
  action: string;
};

type DocumentVerificationStatus =
  | 'Not Required'
  | 'Pending Verification'
  | 'Verified'
  | 'Rejected'
  | 'Expired'
  | 'Update Required'
  | 'Archived'
  | 'Uploaded';

type ConfidentialityLevel = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

type EmployeeDocument = {
  id: string;
  employeeId?: string;
  category: string;
  documentTitle?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  issueDate?: string | null;
  expiresAt?: string | null;
  status: DocumentVerificationStatus;
  complianceStatus?: 'Compliant' | 'At Risk' | 'Non-Compliant' | 'Unknown';
  confidentialityLevel?: ConfidentialityLevel;
  versionNumber?: number;
  uploadedBy?: string | null;
  uploadedAt: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  notes?: string | null;
};

type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  previousFileName: string;
  newFileName: string;
  previousMimeType: string;
  newMimeType: string;
  previousSizeBytes: number;
  newSizeBytes: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  verificationStatus: DocumentVerificationStatus;
};

type AuditEntry = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  employeeId?: string;
  documentId?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
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
    'Legal Officer',
    'Compliance Officer',
    'HSE Officer',
    'Payroll Officer',
    'Auditor',
    'Employee',
    'Line Manager',
    'Executive Management',
    'IT Administrator',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const getViewerEmployeeId = (request: Request) => {
  const v = request.headers.get('x-hris-employee-id');
  return v && v.trim() ? v.trim() : undefined;
};

const permissions = (role: Role) => {
  const canExport = role !== 'Employee';
  const canManage = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer' || role === 'Admin Officer';
  const canVerify = canManage || role === 'Compliance Officer' || role === 'Legal Officer' || role === 'HSE Officer';
  const canArchive = canManage;
  const canReplace = canManage;
  const canAudit = role !== 'Employee' && role !== 'IT Administrator';
  return { canExport, canManage, canVerify, canArchive, canReplace, canAudit };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisDocumentVersions?: Map<string, DocumentVersion[]>;
    __dleHrisDocumentAudits?: Map<string, AuditEntry[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisDocumentVersions) g.__dleHrisDocumentVersions = new Map();
  if (!g.__dleHrisDocumentAudits) g.__dleHrisDocumentAudits = new Map();
  return { employees: g.__dleHrisEmployees, versions: g.__dleHrisDocumentVersions, audits: g.__dleHrisDocumentAudits };
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
  return s.includes('T') ? s : s;
};

const allowedMimeTypes = () =>
  new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ]);

const docCategories = () =>
  [
    'Employment Letter',
    'Offer Letter',
    'Signed Employment Contract',
    'CV / Resume',
    'Academic Certificate',
    'Professional Certificate',
    'Government ID',
    'NIN',
    'BVN',
    'International Passport',
    'Tax Document',
    'Pension Document',
    'Medical Certificate',
    'Guarantor Form',
    'Reference Letter',
    'Promotion Letter',
    'Transfer Letter',
    'Warning Letter',
    'Disciplinary Letter',
    'Training Certificate',
    'HSE Certificate',
    'Contract Renewal Letter',
    'Exit Document',
    'Clearance Form',
    'Other Document',
  ] as const;

const categoryConfig = (employmentType?: string | null) => {
  const requiredCommon = new Set<string>(['Government ID', 'NIN']);
  const requiredContract = new Set<string>(['Signed Employment Contract', 'Contract Renewal Letter']);
  const required = new Set<string>(requiredCommon);
  if ((employmentType || '').toLowerCase().includes('contract')) for (const c of requiredContract) required.add(c);
  const expiryRequired = new Set<string>(['International Passport', 'Medical Certificate', 'HSE Certificate', 'Tax Document']);
  const verificationRequired = new Set<string>(['Signed Employment Contract', 'Government ID', 'NIN', 'International Passport', 'Medical Certificate', 'HSE Certificate']);
  const accessLevel = (cat: string): ConfidentialityLevel => {
    if (cat.includes('Disciplinary') || cat.includes('Warning')) return 'Restricted';
    if (cat.includes('Contract') || cat.includes('Tax') || cat.includes('Pension')) return 'Confidential';
    return 'Internal';
  };
  return { required, expiryRequired, verificationRequired, accessLevel };
};

const complianceFor = (doc: EmployeeDocument, nowMs: number) => {
  if (doc.status === 'Archived') return 'Unknown' as const;
  if (doc.status === 'Rejected') return 'Non-Compliant' as const;
  if (doc.status === 'Pending Verification' || doc.status === 'Uploaded') return 'At Risk' as const;
  const exp = doc.expiresAt ? new Date(doc.expiresAt).getTime() : NaN;
  if (Number.isFinite(exp) && exp < nowMs) return 'Non-Compliant' as const;
  if (Number.isFinite(exp) && exp - nowMs < 30 * 24 * 3600 * 1000) return 'At Risk' as const;
  if (doc.status === 'Verified' || doc.status === 'Not Required') return 'Compliant' as const;
  return 'Unknown' as const;
};

const findDocument = (documentId: string) => {
  const s = stores();
  for (const [employeeId, rec] of s.employees.entries()) {
    const docs = (rec?.documents || []) as EmployeeDocument[];
    const idx = docs.findIndex((d) => d.id === documentId);
    if (idx >= 0) return { employeeId, rec, doc: docs[idx] as EmployeeDocument, index: idx };
  }
  return null;
};

const ensureAudit = (documentId: string) => {
  const s = stores();
  if (!s.audits.has(documentId)) s.audits.set(documentId, []);
  return s.audits.get(documentId)!;
};

const ensureVersions = (doc: EmployeeDocument) => {
  const s = stores();
  const list = s.versions.get(doc.id) || [];
  if (!list.length) {
    const now = nowIso();
    const v: DocumentVersion = {
      id: `ver-${doc.id}-1`,
      documentId: doc.id,
      versionNumber: doc.versionNumber || 1,
      previousFileName: doc.fileName,
      newFileName: doc.fileName,
      previousMimeType: doc.mimeType,
      newMimeType: doc.mimeType,
      previousSizeBytes: doc.sizeBytes,
      newSizeBytes: doc.sizeBytes,
      changedBy: doc.uploadedBy || 'System',
      changedAt: doc.uploadedAt || now,
      reason: 'Initial upload',
      verificationStatus: doc.status,
    };
    s.versions.set(doc.id, [v]);
    return [v];
  }
  return list;
};

const canAccessDoc = (role: Role, viewerEmployeeId: string | undefined, employeeId: string, doc: EmployeeDocument) => {
  const conf = (doc.confidentialityLevel || 'Internal') as ConfidentialityLevel;
  if (conf === 'Restricted') {
    const allowRestricted = new Set<Role>(['Super Admin', 'HR Director', 'HR Manager', 'Legal Officer', 'Compliance Officer', 'Auditor']);
    if (!allowRestricted.has(role)) return false;
  }
  if (conf === 'Confidential') {
    const allowConfidential = new Set<Role>([
      'Super Admin',
      'HR Director',
      'HR Manager',
      'HR Officer',
      'Admin Officer',
      'Legal Officer',
      'Compliance Officer',
      'Payroll Officer',
      'Auditor',
      'Executive Management',
    ]);
    if (!allowConfidential.has(role)) return false;
  }
  if (role === 'IT Administrator') {
    return conf === 'Public' || conf === 'Internal';
  }
  if (role === 'Payroll Officer') {
    return doc.category === 'Tax Document' || doc.category === 'Pension Document' || doc.category === 'BVN';
  }
  if (role === 'HSE Officer') {
    return doc.category === 'Medical Certificate' || doc.category === 'HSE Certificate' || doc.category === 'Training Certificate';
  }
  if (role === 'Compliance Officer') {
    return ['Government ID', 'NIN', 'BVN', 'International Passport', 'Tax Document', 'Pension Document', 'Medical Certificate', 'HSE Certificate'].includes(doc.category);
  }
  if (role === 'Legal Officer') {
    return [
      'Signed Employment Contract',
      'Offer Letter',
      'Employment Letter',
      'Promotion Letter',
      'Transfer Letter',
      'Warning Letter',
      'Disciplinary Letter',
      'Contract Renewal Letter',
      'Exit Document',
      'Clearance Form',
      'Other Document',
    ].includes(doc.category);
  }
  if (role === 'Line Manager') {
    if (conf === 'Confidential' || conf === 'Restricted') return false;
    return doc.status === 'Verified' || doc.status === 'Not Required';
  }
  if (role === 'Employee') {
    if (!viewerEmployeeId || viewerEmployeeId !== employeeId) return false;
    if (conf === 'Restricted') return false;
    if (doc.status !== 'Verified' && doc.status !== 'Not Required') return false;
    return true;
  }
  return true;
};

const audit = (documentId: string, entry: Omit<AuditEntry, 'id' | 'at'>) => {
  const row: AuditEntry = { id: `aud-${Math.random().toString(16).slice(2)}`, at: nowIso(), ...entry };
  ensureAudit(documentId).unshift(row);
  return row;
};

const csvCell = (v: string) => {
  const s = (v ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const toCsv = (header: string[], rows: string[][]) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');

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

const buildFileBytes = (doc: EmployeeDocument) => {
  const encoder = new TextEncoder();
  if (doc.mimeType === 'application/pdf') {
    const bytes = buildPdfBytes(`DLE HRIS — ${doc.documentTitle || doc.category}`, [
      `Document ID: ${doc.id}`,
      `Employee ID: ${doc.employeeId || '—'}`,
      `Category: ${doc.category}`,
      `File: ${doc.fileName}`,
      `Status: ${doc.status}`,
    ]);
    return { bytes, contentType: 'application/pdf' };
  }
  if (doc.mimeType === 'text/csv') {
    const csv = toCsv(['Key', 'Value'], [
      ['Document ID', doc.id],
      ['Category', doc.category],
      ['File', doc.fileName],
      ['Status', doc.status],
    ]);
    return { bytes: encoder.encode(csv), contentType: 'text/csv; charset=utf-8' };
  }
  const txt = `DLE HRIS Document\n\nDocument ID: ${doc.id}\nCategory: ${doc.category}\nFile: ${doc.fileName}\nStatus: ${doc.status}\n`;
  return { bytes: encoder.encode(txt), contentType: 'text/plain; charset=utf-8' };
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const perms = permissions(role);
  const url = new URL(request.url);
  const seg0 = action[0] || '';
  const seg1 = action[1] || '';

  const s = stores();

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const now = Date.now();
    let total = 0;
    let verified = 0;
    let pending = 0;
    let rejected = 0;
    let expired = 0;
    let expiringSoon = 0;
    let missingRequired = 0;
    const employeeIds = Array.from(s.employees.keys());
    for (const empId of employeeIds) {
      const rec = s.employees.get(empId);
      const docs = ((rec?.documents || []) as EmployeeDocument[])
        .map((d) => ({ ...d, employeeId: empId }))
        .filter((d) => canAccessDoc(role, viewerEmployeeId, empId, d));
      const employmentType = String(rec?.profile?.employmentType || rec?.profile?.employmentDetails?.employmentType || '');
      const cfg = categoryConfig(employmentType);
      for (const d of docs) {
        total++;
        const st = (d.status || 'Uploaded') as DocumentVerificationStatus;
        if (st === 'Verified') verified++;
        if (st === 'Pending Verification' || st === 'Uploaded') pending++;
        if (st === 'Rejected') rejected++;
        const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
        if (Number.isFinite(exp) && exp < now) expired++;
        if (Number.isFinite(exp) && exp >= now && exp - now < 30 * 24 * 3600 * 1000) expiringSoon++;
      }
      const haveCats = new Set(docs.map((d) => d.category));
      for (const reqCat of cfg.required) if (!haveCats.has(reqCat)) missingRequired++;
    }
    const complianceScore = total ? Math.max(0, Math.min(100, Math.round((verified / total) * 100))) : 0;
    return jsonOk({ total, verified, pending, rejected, expired, expiringSoon, missingRequiredDocuments: missingRequired, complianceScore, lastUpdatedAt: nowIso() });
  }

  if (seg0 === 'expiring') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase() || null;
    const now = Date.now();
    const rows: Array<{ documentId: string; employeeId: string; employeeName: string; category: string; fileName: string; expiresAt: string; daysToExpiry: number; status: string }> = [];
    for (const [empId, rec] of s.employees.entries()) {
      if (employeeId && empId !== employeeId) continue;
      const employeeName = String(rec?.profile?.fullName || '');
      const docs = ((rec?.documents || []) as EmployeeDocument[])
        .map((d) => ({ ...d, employeeId: empId }))
        .filter((d) => canAccessDoc(role, viewerEmployeeId, empId, d));
      for (const d of docs) {
        if (!d.expiresAt) continue;
        const exp = new Date(d.expiresAt).getTime();
        if (!Number.isFinite(exp)) continue;
        const daysToExpiry = Math.ceil((exp - now) / (24 * 3600 * 1000));
        const status = daysToExpiry < 0 ? 'Expired' : daysToExpiry <= 30 ? 'Expiring Soon' : 'Valid';
        if (status === 'Valid' && daysToExpiry > 90) continue;
        rows.push({ documentId: d.id, employeeId: empId, employeeName, category: d.category, fileName: d.fileName, expiresAt: d.expiresAt, daysToExpiry, status });
      }
    }
    rows.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
    return jsonOk(rows.slice(0, 250));
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase();
    const now = Date.now();
    const build = (empId: string) => {
      const rec = s.employees.get(empId);
      const docs = ((rec?.documents || []) as EmployeeDocument[])
        .map((d) => ({ ...d, employeeId: empId }))
        .filter((d) => canAccessDoc(role, viewerEmployeeId, empId, d));
      const employmentType = String(rec?.profile?.employmentType || rec?.profile?.employmentDetails?.employmentType || '');
      const cfg = categoryConfig(employmentType);
      const haveCats = new Set(docs.map((d) => d.category));
      const out: AIInsight[] = [];
      const add = (sev: Severity, title: string, conf: number, recm: string, actionLabel: string, action: string) =>
        out.push({ id: `doc-ai-${empId}-${Math.random().toString(16).slice(2)}`, severity: sev, confidence: conf, title, recommendation: recm, actionLabel, action });

      for (const reqCat of cfg.required) if (!haveCats.has(reqCat)) add('high', `Missing required document: ${reqCat}`, 0.88, 'Request upload or upload on employee behalf and route for verification.', 'Upload', 'open_upload');

      const contractDocMissing = employmentType.toLowerCase().includes('contract') && !haveCats.has('Signed Employment Contract');
      if (contractDocMissing) add('high', 'Required document missing for contract staff', 0.86, 'Upload signed contract and verify before activation.', 'Upload', 'open_upload');

      const expSoon = docs
        .filter((d) => d.expiresAt)
        .map((d) => ({ d, ms: new Date(String(d.expiresAt)).getTime() }))
        .filter((x) => Number.isFinite(x.ms))
        .sort((a, b) => a.ms - b.ms)[0];
      if (expSoon) {
        const days = Math.ceil((expSoon.ms - now) / (24 * 3600 * 1000));
        if (days <= 18) add('medium', `${expSoon.d.category} expires in ${days} days`, 0.77, 'Request renewal and upload updated document before expiry.', 'Open Expiry', 'open_expiry');
      }

      const nin = docs.find((d) => d.category === 'NIN') || null;
      if (nin && nin.status !== 'Verified') add('medium', 'NIN document has not been verified', 0.8, 'Verify NIN document via compliance review or original sighted workflow.', 'Verify', 'open_verify');

      const contract = docs.find((d) => d.category === 'Signed Employment Contract') || null;
      if (!contract) add('high', 'Employee is missing signed employment contract', 0.86, 'Upload signed contract and verify to maintain compliance.', 'Upload', 'open_upload');

      const dup = docs
        .map((d) => `${d.category}::${d.fileName}`.toLowerCase())
        .reduce((acc, k) => (acc.set(k, (acc.get(k) || 0) + 1), acc), new Map<string, number>());
      const firstDup = Array.from(dup.entries()).find(([, c]) => c > 1);
      if (firstDup) add('low', 'Duplicate document detected', 0.66, 'Review duplicates and archive superseded versions.', 'Review', 'open_versions');

      const mismatch = docs.find((d) => {
        const name = d.fileName.toLowerCase();
        const cat = d.category.toLowerCase().replace(/\s+/g, '_');
        return name && cat && !name.includes(cat.slice(0, 6));
      });
      if (mismatch) add('low', 'Uploaded file name does not match selected document category', 0.6, 'Confirm category selection and rename/replace file if required.', 'Review', 'open_edit');

      const passport = docs.find((d) => d.category === 'International Passport') || null;
      if (passport && passport.expiresAt) {
        const ms = new Date(passport.expiresAt).getTime();
        if (Number.isFinite(ms) && ms < now) add('high', 'Passport document appears expired', 0.84, 'Request renewal and upload updated passport.', 'Open Expiry', 'open_expiry');
      }

      return out.slice(0, 12);
    };

    if (employeeId) return jsonOk(build(employeeId));
    const out = Array.from(s.employees.keys())
      .slice(0, 20)
      .flatMap((id) => build(id).slice(0, 1));
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (!perms.canExport) return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase() || null;
    const mode = normalizeStr(url.searchParams.get('mode'), 40).toLowerCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `employee_documents_${employeeId}_${stamp}` : `employee_documents_${stamp}`;

    const header = ['Employee ID', 'Employee Name', 'Document Name', 'Category', 'File Type', 'Size', 'Issue Date', 'Expiry Date', 'Verification Status', 'Compliance', 'Confidentiality', 'Version'];
    const rows: string[][] = [];
    const now = Date.now();

    for (const [empId, rec] of s.employees.entries()) {
      if (employeeId && empId !== employeeId) continue;
      const employeeName = String(rec?.profile?.fullName || '');
      const docs = ((rec?.documents || []) as EmployeeDocument[])
        .map((d) => ({ ...d, employeeId: empId }))
        .filter((d) => canAccessDoc(role, viewerEmployeeId, empId, d));
      const employmentType = String(rec?.profile?.employmentType || rec?.profile?.employmentDetails?.employmentType || '');
      const cfg = categoryConfig(employmentType);
      const haveCats = new Set(docs.map((d) => d.category));

      if (mode === 'missing') {
        for (const reqCat of cfg.required) {
          if (!haveCats.has(reqCat)) rows.push([empId, employeeName, '', reqCat, '', '', '', '', 'Missing', 'Non-Compliant', 'Internal', '']);
        }
        continue;
      }

      for (const d of docs.slice(0, 200)) {
        const conf = (d.confidentialityLevel || cfg.accessLevel(d.category)) as ConfidentialityLevel;
        rows.push([
          empId,
          employeeName,
          String(d.documentTitle || d.category),
          d.category,
          d.mimeType,
          String(d.sizeBytes || ''),
          String(d.issueDate || ''),
          String(d.expiresAt || ''),
          String(d.status || ''),
          String(d.complianceStatus || complianceFor(d, now)),
          conf,
          String(d.versionNumber || 1),
        ]);
      }
    }

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
      const lines = rows.slice(0, 45).map((r) => `${r[0]} • ${r[1]} • ${r[3]} • ${r[8]} • ${r[7] ? `Exp: ${r[7]}` : ''}`);
      const bytes = buildPdfBytes('DLE HRIS — Employee Documents Report', lines);
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

  const docId = seg0;
  if (!docId) return jsonErr(404, 'Not found');
  const found = findDocument(docId);
  if (!found) return jsonErr(404, 'Document not found');
  const { employeeId, doc } = found;
  doc.employeeId = employeeId;

  if (!canAccessDoc(role, viewerEmployeeId, employeeId, doc)) return jsonErr(403, 'Permission denied');

  ensureVersions(doc);
  const auditList = ensureAudit(doc.id);

  if (!seg1) {
    return jsonOk({ document: doc, audit: auditList.slice(0, 200) });
  }

  if (seg1 === 'versions') return jsonOk((stores().versions.get(doc.id) || []).slice(0, 50));

  if (seg1 === 'preview' || seg1 === 'download') {
    audit(doc.id, { action: seg1 === 'preview' ? 'Document previewed' : 'Document downloaded', performedBy: role, employeeId, documentId: doc.id });
    const { bytes, contentType } = buildFileBytes(doc);
    const disposition = seg1 === 'preview' ? 'inline' : 'attachment';
    return new NextResponse(bytes, {
      headers: {
        'content-type': contentType,
        'content-disposition': `${disposition}; filename="${doc.fileName.replace(/"/g, '')}"`,
      },
    });
  }

  return jsonErr(404, 'Not found');
}

export async function PATCH(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const perms = permissions(role);
  const docId = action[0] || '';
  if (!docId) return jsonErr(404, 'Not found');
  if (!perms.canManage) return jsonErr(403, 'Permission denied');
  const found = findDocument(docId);
  if (!found) return jsonErr(404, 'Document not found');
  const { employeeId, rec, doc, index } = found;
  doc.employeeId = employeeId;
  if (!canAccessDoc(role, viewerEmployeeId, employeeId, doc)) return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonErr(400, 'Invalid JSON body');

  const prev = JSON.stringify({ category: doc.category, title: doc.documentTitle, issueDate: doc.issueDate, expiresAt: doc.expiresAt, confidentialityLevel: doc.confidentialityLevel, notes: doc.notes });
  const nextCategory = normalizeStr(body.category, 120) || doc.category;
  const nextTitle = normalizeStr(body.documentTitle, 200) || normalizeStr(body.documentName, 200) || doc.documentTitle || doc.category;
  const issueDate = normalizeDate(body.issueDate) || doc.issueDate || null;
  const expiry = normalizeDate(body.expiryDate) || normalizeDate(body.expiresAt) || doc.expiresAt || null;
  if (issueDate && expiry) {
    const a = new Date(issueDate).getTime();
    const b = new Date(expiry).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b < a) return jsonErr(400, 'Expiry date cannot be before issue date');
  }
  const conf = (normalizeStr(body.confidentialityLevel, 40) as ConfidentialityLevel) || doc.confidentialityLevel || 'Internal';
  const next: EmployeeDocument = {
    ...doc,
    category: nextCategory,
    documentTitle: nextTitle,
    issueDate,
    expiresAt: expiry,
    confidentialityLevel: conf,
    notes: normalizeStr(body.notes, 1200) || doc.notes || null,
    complianceStatus: complianceFor(doc, Date.now()),
  };
  (rec.documents as EmployeeDocument[])[index] = next;
  audit(doc.id, { action: 'Document metadata updated', performedBy: role, employeeId, documentId: doc.id, oldValue: prev, newValue: JSON.stringify({ category: nextCategory, title: nextTitle }), reason: normalizeStr(body.reason, 300) || 'Update' });
  return jsonOk(next);
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const perms = permissions(role);
  const docId = action[0] || '';
  const op = action[1] || '';
  if (!docId) return jsonErr(404, 'Not found');
  if (!op) return jsonErr(404, 'Not found');
  const found = findDocument(docId);
  if (!found) return jsonErr(404, 'Document not found');
  const { employeeId, rec, doc, index } = found;
  doc.employeeId = employeeId;
  if (!canAccessDoc(role, viewerEmployeeId, employeeId, doc)) return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  const reason = normalizeStr(body?.reason, 600) || op;

  if (op === 'verify') {
    if (!perms.canVerify) return jsonErr(403, 'Permission denied');
    const method = normalizeStr(body?.method, 80) || 'HR Review';
    const prev = doc.status;
    const next: EmployeeDocument = {
      ...doc,
      status: 'Verified',
      verifiedBy: role,
      verifiedAt: nowIso(),
      complianceStatus: complianceFor({ ...doc, status: 'Verified' }, Date.now()),
    };
    (rec.documents as EmployeeDocument[])[index] = next;
    audit(doc.id, { action: 'Document verified', performedBy: role, employeeId, documentId: doc.id, oldValue: prev, newValue: next.status, reason: method });
    return jsonOk(next);
  }

  if (op === 'reject') {
    if (!perms.canVerify) return jsonErr(403, 'Permission denied');
    const rejectionReason = normalizeStr(body?.rejectionReason, 600) || reason || 'Rejected';
    const prev = doc.status;
    const next: EmployeeDocument = {
      ...doc,
      status: 'Rejected',
      verifiedBy: role,
      verifiedAt: nowIso(),
      complianceStatus: 'Non-Compliant',
      notes: rejectionReason,
    };
    (rec.documents as EmployeeDocument[])[index] = next;
    audit(doc.id, { action: 'Document rejected', performedBy: role, employeeId, documentId: doc.id, oldValue: prev, newValue: next.status, reason: rejectionReason });
    return jsonOk(next);
  }

  if (op === 'replace') {
    if (!perms.canReplace) return jsonErr(403, 'Permission denied');
    const fileName = normalizeStr(body?.fileName, 240);
    const mimeType = normalizeStr(body?.mimeType, 120);
    const sizeBytes = typeof body?.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) ? Math.max(0, Math.floor(body.sizeBytes)) : null;
    if (!fileName || !mimeType || !sizeBytes) return jsonErr(400, 'Invalid replace payload');
    if (sizeBytes > 15 * 1024 * 1024) return jsonErr(400, 'File size limit exceeded');
    if (!allowedMimeTypes().has(mimeType)) return jsonErr(400, 'File type not allowed');
    const replaceReason = normalizeStr(body?.reason, 600) || 'Replacement';

    const prevStatus = doc.status;
    const prevFile = { fileName: doc.fileName, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes };
    const nextVersion = (doc.versionNumber || 1) + 1;
    const nextStatus: DocumentVerificationStatus = prevStatus === 'Verified' ? 'Pending Verification' : 'Uploaded';
    const updatedAt = nowIso();
    const next: EmployeeDocument = {
      ...doc,
      fileName,
      mimeType,
      sizeBytes,
      versionNumber: nextVersion,
      status: nextStatus,
      verifiedBy: null,
      verifiedAt: null,
      uploadedAt: updatedAt,
      uploadedBy: role,
      complianceStatus: complianceFor({ ...doc, status: nextStatus, fileName, mimeType, sizeBytes }, Date.now()),
    };
    (rec.documents as EmployeeDocument[])[index] = next;
    const versions = ensureVersions(doc);
    const v: DocumentVersion = {
      id: `ver-${doc.id}-${nextVersion}`,
      documentId: doc.id,
      versionNumber: nextVersion,
      previousFileName: prevFile.fileName,
      newFileName: fileName,
      previousMimeType: prevFile.mimeType,
      newMimeType: mimeType,
      previousSizeBytes: prevFile.sizeBytes,
      newSizeBytes: sizeBytes,
      changedBy: role,
      changedAt: updatedAt,
      reason: replaceReason,
      verificationStatus: nextStatus,
    };
    stores().versions.set(doc.id, [v, ...versions].slice(0, 50));
    audit(doc.id, { action: 'Document replaced', performedBy: role, employeeId, documentId: doc.id, oldValue: JSON.stringify(prevFile), newValue: JSON.stringify({ fileName, mimeType, sizeBytes }), reason: replaceReason });
    return jsonOk(next);
  }

  if (op === 'archive') {
    if (!perms.canArchive) return jsonErr(403, 'Permission denied');
    const archiveReason = normalizeStr(body?.archiveReason, 600) || reason || 'Archived';
    const prev = doc.status;
    const next: EmployeeDocument = {
      ...doc,
      status: 'Archived',
      archivedAt: nowIso(),
      archiveReason,
      complianceStatus: 'Unknown',
    };
    (rec.documents as EmployeeDocument[])[index] = next;
    audit(doc.id, { action: 'Document archived', performedBy: role, employeeId, documentId: doc.id, oldValue: prev, newValue: next.status, reason: archiveReason });
    return jsonOk(next);
  }

  return jsonErr(404, 'Not found');
}
