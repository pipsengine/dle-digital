import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Line Manager'
  | 'Employee'
  | 'Auditor'
  | 'HSE Officer'
  | 'Compliance Officer';

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

type EmergencyContact = {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  alternativePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isPrimary: boolean;
  isNextOfKin: boolean;
  isBeneficiary: boolean;
  beneficiaryPercentage?: number | null;
  verificationStatus?: string;
  lastVerifiedAt?: string | null;
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
    'Line Manager',
    'Employee',
    'Auditor',
    'HSE Officer',
    'Compliance Officer',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisEmergencyContactUpdateRequestsByEmployee?: Map<string, any[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisEmergencyContactUpdateRequestsByEmployee) g.__dleHrisEmergencyContactUpdateRequestsByEmployee = new Map();
  return { employees: g.__dleHrisEmployees, updateRequests: g.__dleHrisEmergencyContactUpdateRequestsByEmployee };
};

const validatePhone = (s: string) => /^[+]?[\d\s()-]{7,20}$/.test(s.trim());

const readiness = (contacts: EmergencyContact[]) => {
  const primary = contacts.find((c) => c.isPrimary) || null;
  const hasPrimary = Boolean(primary);
  const hasVerifiedPhone = contacts.some((c) => c.verificationStatus === 'Verified' && validatePhone(String(c.phoneNumber || '')));
  const hasAddress = contacts.some((c) => Boolean((c.address || '').trim()) || Boolean((c.city || '').trim()) || Boolean((c.state || '').trim()) || Boolean((c.country || '').trim()));
  const hasNextOfKin = contacts.some((c) => c.isNextOfKin);
  const hasBeneficiary = contacts.some((c) => c.isBeneficiary);
  const verifiedRecent = (() => {
    const last = contacts
      .map((c) => c.lastVerifiedAt)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return false;
    return Date.now() - last < 365 * 24 * 3600 * 1000;
  })();

  const checks = [
    hasPrimary,
    hasVerifiedPhone,
    hasAddress,
    hasNextOfKin,
    hasBeneficiary,
    verifiedRecent,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const state = score >= 85 ? 'Ready' : score >= 55 ? 'Partially Ready' : score >= 35 ? 'Requires Update' : 'Not Ready';
  return { score, state, hasPrimary, hasVerifiedPhone, hasAddress, hasNextOfKin, hasBeneficiary, verifiedRecent, primary };
};

const buildEmployeeInsights = (employeeId: string, contacts: EmergencyContact[], phoneIndex: Map<string, string[]>, pendingUpdates: number) => {
  const out: AIInsight[] = [];
  const add = (severity: Severity, title: string, confidence: number, recommendation: string, actionLabel: string, action: string) =>
    out.push({ id: `ec-ai-${employeeId}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action });

  if (!contacts.length) add('high', 'Employee has no emergency contacts', 0.92, 'Add at least one emergency contact and mark a primary contact.', 'Add Contact', 'open_add');
  if (contacts.length && !contacts.some((c) => c.isPrimary))
    add('high', 'Employee has no primary emergency contact', 0.9, 'Mark exactly one contact as primary emergency contact.', 'Set Primary', 'open_primary');

  const nok = contacts.find((c) => c.isNextOfKin) || null;
  if (nok && !validatePhone(String(nok.phoneNumber || '')))
    add('medium', 'Next-of-kin phone number appears invalid', 0.84, 'Correct the next-of-kin phone number and re-verify.', 'Edit Contact', 'open_edit');

  const oldestVerified = contacts
    .filter((c) => c.verificationStatus === 'Verified' && c.lastVerifiedAt)
    .map((c) => new Date(String(c.lastVerifiedAt)).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (oldestVerified && Date.now() - oldestVerified > 365 * 24 * 3600 * 1000)
    add('medium', 'Emergency contact has not been verified in 12+ months', 0.78, 'Re-verify primary contact via phone/SMS/email and update verification date.', 'Verify', 'open_verify');

  const duplicates = contacts
    .map((c) => String(c.phoneNumber || '').replace(/\D/g, ''))
    .filter((x) => x.length >= 7)
    .filter((x) => (phoneIndex.get(x) || []).length > 1);
  if (duplicates.length) add('medium', 'Same phone number is used across multiple employees', 0.74, 'Validate identity of contact and confirm phone number ownership.', 'Review', 'open_review');

  const beneficiaryPct = contacts.reduce((acc, c) => acc + (c.isBeneficiary ? (typeof c.beneficiaryPercentage === 'number' ? c.beneficiaryPercentage : 0) : 0), 0);
  if (beneficiaryPct > 100) add('high', 'Beneficiary percentage exceeds 100%', 0.88, 'Adjust beneficiary allocations to total 100% or less.', 'Edit Beneficiary', 'open_edit');

  const incompleteAddr = contacts.some((c) => c.isPrimary && !((c.address || '').trim() || (c.city || '').trim() || (c.state || '').trim() || (c.country || '').trim()));
  if (incompleteAddr) add('low', 'Contact address is incomplete', 0.66, 'Capture at least one address field for emergency readiness.', 'Request Update', 'open_request');

  if (pendingUpdates > 0) add('low', 'Employee update request is pending HR review', 0.7, 'Review the pending emergency contact update request and action accordingly.', 'Open Requests', 'open_requests');

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
    let totalContacts = 0;
    let verifiedContacts = 0;
    let unverifiedContacts = 0;
    let missingPrimary = 0;
    let notReady = 0;

    for (const [id, rec] of employees.entries()) {
      const contacts = (rec?.emergencyContacts || []) as EmergencyContact[];
      totalContacts += contacts.length;
      verifiedContacts += contacts.filter((c) => c.verificationStatus === 'Verified').length;
      unverifiedContacts += contacts.filter((c) => c.verificationStatus !== 'Verified').length;
      if (contacts.length && !contacts.some((c) => c.isPrimary)) missingPrimary++;
      if (!readiness(contacts).state.includes('Ready')) notReady++;
    }
    return jsonOk({
      employeesCount: employees.size,
      totalContacts,
      verifiedContacts,
      unverifiedContacts,
      employeesMissingPrimary: missingPrimary,
      employeesNotReady: notReady,
      lastUpdatedAt: nowIso(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = (url.searchParams.get('employeeId') || '').trim().toUpperCase();

    const phoneIndex = new Map<string, string[]>();
    for (const [id, rec] of employees.entries()) {
      const contacts = (rec?.emergencyContacts || []) as EmergencyContact[];
      for (const c of contacts) {
        const key = String(c.phoneNumber || '').replace(/\D/g, '');
        if (key.length < 7) continue;
        const cur = phoneIndex.get(key) || [];
        phoneIndex.set(key, cur.includes(id) ? cur : [...cur, id]);
      }
    }

    if (employeeId) {
      const rec = employees.get(employeeId);
      const contacts = (rec?.emergencyContacts || []) as EmergencyContact[];
      const pendingUpdates = (updateRequests.get(employeeId) || []).filter((r) => String(r?.status || '').includes('Pending')).length;
      return jsonOk(buildEmployeeInsights(employeeId, contacts, phoneIndex, pendingUpdates));
    }

    const all = Array.from(employees.keys()).slice(0, 20);
    const out: AIInsight[] = [];
    for (const id of all) {
      const rec = employees.get(id);
      const contacts = (rec?.emergencyContacts || []) as EmergencyContact[];
      const pendingUpdates = (updateRequests.get(id) || []).filter((r) => String(r?.status || '').includes('Pending')).length;
      out.push(...buildEmployeeInsights(id, contacts, phoneIndex, pendingUpdates).slice(0, 1));
    }
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = (url.searchParams.get('employeeId') || '').trim().toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `emergency_contacts_${employeeId}_${stamp}` : `emergency_contacts_${stamp}`;

    const header = [
      'Employee ID',
      'Employee Name',
      'Contact Name',
      'Relationship',
      'Primary Phone',
      'Alternate Phone',
      'Email',
      'Address',
      'Primary',
      'Next of Kin',
      'Beneficiary',
      'Verification Status',
      'Last Verified',
    ];
    const rows: string[][] = [];
    const selected = employeeId ? [employeeId] : Array.from(employees.keys()).slice(0, 200);
    for (const id of selected) {
      const rec = employees.get(id);
      const employeeName = String(rec?.profile?.fullName || '');
      const contacts = (rec?.emergencyContacts || []) as EmergencyContact[];
      if (!contacts.length) {
        rows.push([id, employeeName, '', '', '', '', '', '', '', '', '', '', '']);
        continue;
      }
      for (const c of contacts.slice(0, 20)) {
        rows.push([
          id,
          employeeName,
          c.fullName,
          c.relationship,
          c.phoneNumber,
          String(c.alternativePhone || ''),
          String(c.email || ''),
          String(c.address || ''),
          c.isPrimary ? 'Yes' : 'No',
          c.isNextOfKin ? 'Yes' : 'No',
          c.isBeneficiary ? 'Yes' : 'No',
          String(c.verificationStatus || 'Unverified'),
          String(c.lastVerifiedAt || ''),
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
      const lines = rows.slice(0, 45).map((r) => `${r[0]} • ${r[1]} • ${r[2]} • ${r[3]} • ${r[4]} • ${r[11]}`);
      const bytes = buildPdfBytes('DLE HRIS — Emergency Contacts Report', lines);
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

