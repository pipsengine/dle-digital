import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Employee'
  | 'Line Manager'
  | 'HSE Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Executive Management';

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

type NextOfKinRecord = {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  primaryPhone: string;
  alternatePhone?: string | null;
  email?: string | null;
  residentialAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isPrimary: boolean;
  verificationStatus: string;
  lastVerifiedAt?: string | null;
  relationshipEvidenceType?: string | null;
  evidenceStatus: string;
  beneficiary?: { isBeneficiary: boolean; beneficiaryPercentage: number | null; nominationStatus?: string | null };
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
    'Employee',
    'Line Manager',
    'HSE Officer',
    'Compliance Officer',
    'Auditor',
    'Executive Management',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisNextOfKinUpdateRequestsByEmployee?: Map<string, any[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisNextOfKinUpdateRequestsByEmployee) g.__dleHrisNextOfKinUpdateRequestsByEmployee = new Map();
  return { employees: g.__dleHrisEmployees, updateRequests: g.__dleHrisNextOfKinUpdateRequestsByEmployee };
};

const validatePhone = (s: string) => /^[+]?[\d\s()-]{7,20}$/.test((s || '').trim());

const readiness = (records: NextOfKinRecord[]) => {
  const primary = records.find((r) => r.isPrimary) || null;
  const hasPrimary = Boolean(primary);
  const hasVerified = records.some((r) => String(r.verificationStatus || '').toLowerCase() === 'verified');
  const hasEvidence = records.some((r) => String(r.evidenceStatus || '').toLowerCase() === 'verified' || String(r.evidenceStatus || '').toLowerCase() === 'uploaded');
  const hasBeneficiary = records.some((r) => Boolean(r.beneficiary?.isBeneficiary));
  const hasAddress = records.some((r) => Boolean((r.residentialAddress || '').trim()) || Boolean((r.city || '').trim()) || Boolean((r.state || '').trim()) || Boolean((r.country || '').trim()));
  const verifiedRecent = (() => {
    const last = records
      .map((r) => r.lastVerifiedAt)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return false;
    return Date.now() - last < 365 * 24 * 3600 * 1000;
  })();
  const checks = [hasPrimary, hasVerified, hasEvidence, hasAddress, verifiedRecent, hasBeneficiary];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const state = score >= 85 ? 'Ready' : score >= 55 ? 'Partially Ready' : score >= 35 ? 'Requires Update' : 'Not Ready';
  return { score, state, primary, hasPrimary, hasVerified, hasEvidence, hasAddress, verifiedRecent, hasBeneficiary };
};

const buildEmployeeInsights = (employeeId: string, records: NextOfKinRecord[], phoneIndex: Map<string, string[]>, pendingUpdates: number) => {
  const out: AIInsight[] = [];
  const add = (severity: Severity, title: string, confidence: number, recommendation: string, actionLabel: string, action: string) =>
    out.push({ id: `nok-ai-${employeeId}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action });

  if (!records.length) add('high', 'Employee has no next of kin records', 0.93, 'Add at least one next of kin record and mark primary.', 'Add NOK', 'open_add');
  if (records.length && !records.some((r) => r.isPrimary))
    add('high', 'Employee has no primary next of kin', 0.9, 'Mark exactly one record as primary next of kin.', 'Set Primary', 'open_primary');

  const primary = records.find((r) => r.isPrimary) || records[0] || null;
  if (primary && !validatePhone(primary.primaryPhone)) add('medium', 'Next-of-kin phone number appears invalid', 0.84, 'Correct phone number and re-verify.', 'Edit', 'open_edit');

  const missingEvidence = records.some((r) => (r.beneficiary?.isBeneficiary || String(r.beneficiary?.nominationStatus || '').includes('Pending')) && String(r.evidenceStatus || '') === 'Missing');
  if (missingEvidence) add('high', 'Relationship evidence is missing', 0.86, 'Upload relationship evidence for beneficiary linkage and compliance verification.', 'Upload Evidence', 'open_evidence');

  const oldestVerified = records
    .filter((r) => String(r.verificationStatus || '').toLowerCase() === 'verified' && r.lastVerifiedAt)
    .map((r) => new Date(String(r.lastVerifiedAt)).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (oldestVerified && Date.now() - oldestVerified > 365 * 24 * 3600 * 1000)
    add('medium', 'Record has not been verified in 12+ months', 0.78, 'Re-verify primary next of kin via phone/SMS/email and update verification date.', 'Verify', 'open_verify');

  const duplicates = records
    .map((r) => String(r.primaryPhone || '').replace(/\D/g, ''))
    .filter((x) => x.length >= 7)
    .filter((x) => (phoneIndex.get(x) || []).length > 1);
  if (duplicates.length) add('medium', 'Same next-of-kin phone number appears across multiple employees', 0.74, 'Validate duplicate phone ownership and confirm relationship.', 'Review', 'open_review');

  const beneficiaryPct = records.reduce((acc, r) => acc + (r.beneficiary?.isBeneficiary ? (typeof r.beneficiary?.beneficiaryPercentage === 'number' ? r.beneficiary.beneficiaryPercentage : 0) : 0), 0);
  if (beneficiaryPct > 100) add('high', 'Beneficiary percentage requires HR review (total exceeds 100%)', 0.88, 'Adjust beneficiary allocations to total 100% or less.', 'Edit', 'open_beneficiary');

  const incompleteAddr = records.some((r) => r.isPrimary && !((r.residentialAddress || '').trim() || (r.city || '').trim() || (r.state || '').trim() || (r.country || '').trim()));
  if (incompleteAddr) add('low', 'Address is incomplete', 0.66, 'Capture address fields to improve emergency dependency readiness.', 'Request Update', 'open_request');

  if (pendingUpdates > 0) add('low', 'Employee update request is pending HR review', 0.7, 'Review pending next-of-kin update request and action accordingly.', 'Open Requests', 'open_requests');

  const r = readiness(records);
  if (records.length && r.state !== 'Ready') add('low', `Emergency dependency readiness: ${r.state} (${r.score}%)`, 0.7, 'Resolve missing primary, evidence, or verification to raise readiness.', 'View', 'open_readiness');

  return out.slice(0, 10);
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

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const url = new URL(request.url);
  const seg0 = action[0] || '';
  const { employees, updateRequests } = stores();

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    let totalRecords = 0;
    let verified = 0;
    let unverified = 0;
    let missingPrimary = 0;
    let evidenceUploaded = 0;
    let beneficiaryLinked = 0;

    for (const [id, rec] of employees.entries()) {
      const list = (rec?.nextOfKin || []) as NextOfKinRecord[];
      totalRecords += list.length;
      verified += list.filter((r) => String(r.verificationStatus || '').toLowerCase() === 'verified').length;
      unverified += list.filter((r) => String(r.verificationStatus || '').toLowerCase() !== 'verified').length;
      if (list.length && !list.some((r) => r.isPrimary)) missingPrimary++;
      evidenceUploaded += list.filter((r) => String(r.evidenceStatus || '').toLowerCase() === 'uploaded' || String(r.evidenceStatus || '').toLowerCase() === 'verified').length;
      beneficiaryLinked += list.filter((r) => Boolean(r.beneficiary?.isBeneficiary)).length;
    }

    return jsonOk({
      employeesCount: employees.size,
      totalNextOfKinRecords: totalRecords,
      verifiedRecords: verified,
      unverifiedRecords: unverified,
      employeesMissingPrimary: missingPrimary,
      evidenceUploaded,
      beneficiaryLinked,
      lastUpdatedAt: nowIso(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = (url.searchParams.get('employeeId') || '').trim().toUpperCase();

    const phoneIndex = new Map<string, string[]>();
    for (const [id, rec] of employees.entries()) {
      const list = (rec?.nextOfKin || []) as NextOfKinRecord[];
      for (const r of list) {
        const key = String(r.primaryPhone || '').replace(/\D/g, '');
        if (key.length < 7) continue;
        const cur = phoneIndex.get(key) || [];
        phoneIndex.set(key, cur.includes(id) ? cur : [...cur, id]);
      }
    }

    if (employeeId) {
      const rec = employees.get(employeeId);
      const list = (rec?.nextOfKin || []) as NextOfKinRecord[];
      const pendingUpdates = (updateRequests.get(employeeId) || []).filter((r) => String(r?.status || '').includes('Pending')).length;
      return jsonOk(buildEmployeeInsights(employeeId, list, phoneIndex, pendingUpdates));
    }

    const ids = Array.from(employees.keys()).slice(0, 20);
    const out: AIInsight[] = [];
    for (const id of ids) {
      const rec = employees.get(id);
      const list = (rec?.nextOfKin || []) as NextOfKinRecord[];
      const pendingUpdates = (updateRequests.get(id) || []).filter((r) => String(r?.status || '').includes('Pending')).length;
      out.push(...buildEmployeeInsights(id, list, phoneIndex, pendingUpdates).slice(0, 1));
    }
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = (url.searchParams.get('employeeId') || '').trim().toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `next_of_kin_${employeeId}_${stamp}` : `next_of_kin_${stamp}`;

    const header = [
      'Employee ID',
      'Employee Name',
      'Full Name',
      'Relationship',
      'Primary Phone',
      'Email',
      'Address',
      'Primary NOK',
      'Beneficiary Linked',
      'Evidence Status',
      'Verification Status',
      'Last Verified',
    ];
    const rows: string[][] = [];
    const selected = employeeId ? [employeeId] : Array.from(employees.keys()).slice(0, 200);
    for (const id of selected) {
      const rec = employees.get(id);
      const employeeName = String(rec?.profile?.fullName || '');
      const list = (rec?.nextOfKin || []) as NextOfKinRecord[];
      if (!list.length) {
        rows.push([id, employeeName, '', '', '', '', '', '', '', '', '', '']);
        continue;
      }
      for (const r of list.slice(0, 20)) {
        rows.push([
          id,
          employeeName,
          r.fullName,
          r.relationship,
          r.primaryPhone,
          String(r.email || ''),
          String(r.residentialAddress || ''),
          r.isPrimary ? 'Yes' : 'No',
          r.beneficiary?.isBeneficiary ? 'Yes' : 'No',
          String(r.evidenceStatus || ''),
          String(r.verificationStatus || ''),
          String(r.lastVerifiedAt || ''),
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
      const lines = rows.slice(0, 45).map((r) => `${r[0]} • ${r[1]} • ${r[2]} • ${r[3]} • ${r[4]} • ${r[9]} • ${r[10]}`);
      const bytes = buildPdfBytes('DLE HRIS — Next of Kin Report', lines);
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

  return jsonErr(404, 'Not found');
}

