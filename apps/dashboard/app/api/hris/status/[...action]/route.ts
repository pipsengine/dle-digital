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

type Severity = 'high' | 'medium' | 'low';

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

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  actionLabel: string;
  action: string;
};

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

type EmployeeOption = {
  employeeId: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
  currentStatus?: string;
  manager?: string;
  location?: string;
  contractStatus?: string;
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

const permissions = (role: Role) => {
  const canViewOrg = role !== 'Employee';
  const canExport = role !== 'Employee';
  const canBulk = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer';
  return { canViewOrg, canExport, canBulk };
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisContracts?: Map<string, any>;
    __dleHrisContractsByEmployee?: Map<string, string[]>;
    __dleHrisEmployeeStatusOverrides?: Map<string, any>;
    __dleHrisStatusChangeRequests?: Map<string, StatusChangeRequest>;
    __dleHrisStatusChangeRequestsByEmployee?: Map<string, string[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisContracts) g.__dleHrisContracts = new Map();
  if (!g.__dleHrisContractsByEmployee) g.__dleHrisContractsByEmployee = new Map();
  if (!g.__dleHrisEmployeeStatusOverrides) g.__dleHrisEmployeeStatusOverrides = new Map();
  if (!g.__dleHrisStatusChangeRequests) g.__dleHrisStatusChangeRequests = new Map();
  if (!g.__dleHrisStatusChangeRequestsByEmployee) g.__dleHrisStatusChangeRequestsByEmployee = new Map();
  return {
    employees: g.__dleHrisEmployees,
    contracts: g.__dleHrisContracts,
    contractsByEmployee: g.__dleHrisContractsByEmployee,
    statusOverrides: g.__dleHrisEmployeeStatusOverrides,
    requests: g.__dleHrisStatusChangeRequests,
    requestIndex: g.__dleHrisStatusChangeRequestsByEmployee,
  };
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

const computeContractStatus = (employeeId: string) => {
  const s = stores();
  const ids = s.contractsByEmployee.get(employeeId) || [];
  const contracts = ids.map((id) => s.contracts.get(id)).filter(Boolean) as any[];
  const active = contracts.find((c) => c.contractStatus === 'Active' || c.workflowStatus === 'Active') || contracts[0] || null;
  const end = active?.endDate ? String(active.endDate) : null;
  if (!end) return { contractStatus: '—', contractExpiredDays: null as number | null };
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(endMs)) return { contractStatus: '—', contractExpiredDays: null as number | null };
  const days = Math.ceil((Date.now() - endMs) / (24 * 3600 * 1000));
  if (days > 0) return { contractStatus: `Contract Expired`, contractExpiredDays: days };
  return { contractStatus: `Contract Active`, contractExpiredDays: null as number | null };
};

const emptyImpact = (): StatusImpact => ({
  payroll: [],
  systemAccess: [],
  emailAccess: [],
  attendance: [],
  leaveEntitlement: [],
  benefits: [],
  assetRecovery: [],
  documentClearance: [],
  reportingLine: [],
  workflowApprovals: [],
  projectAssignment: [],
  contractRenewal: [],
});

const impactFor = (newEmploymentStatus: string, action: string) => {
  const s = (newEmploymentStatus || '').toLowerCase();
  const a = (action || '').toLowerCase();
  const impact = emptyImpact();
  const add = (k: keyof StatusImpact, line: string) => impact[k].push(line);

  if (s.includes('suspended') || a.includes('suspend')) {
    add('payroll', 'Payroll requires review; pay may be held depending on policy.');
    add('systemAccess', 'Restrict system access for suspension duration.');
    add('emailAccess', 'Disable corporate email access or set to restricted.');
    add('attendance', 'Disable attendance clock-in and overtime approvals.');
    add('workflowApprovals', 'Remove from approval routing; re-route pending approvals.');
    add('reportingLine', 'Notify line manager and HRBP.');
  }
  if (s.includes('terminated') || s.includes('resigned') || s.includes('retired') || s.includes('exited') || a.includes('terminate') || a.includes('exit')) {
    add('payroll', 'Stop payroll eligibility after effective date; run final settlement workflow.');
    add('systemAccess', 'Disable system access, VPN and application accounts.');
    add('emailAccess', 'Disable corporate email and revoke access tokens.');
    add('attendance', 'Disable attendance clock-in and roster allocation.');
    add('assetRecovery', 'Trigger asset recovery checklist.');
    add('documentClearance', 'Trigger clearance workflow and document completion checks.');
    add('workflowApprovals', 'Re-route approvals and remove from workflow steps.');
    add('projectAssignment', 'Demobilize from project assignments and close timesheets.');
    add('reportingLine', 'Update reporting line where required and notify stakeholders.');
  }
  if (s.includes('on leave') || a.includes('leave')) {
    add('attendance', 'Attendance clock-in should be disabled for leave duration.');
    add('leaveEntitlement', 'Leave entitlement will be reduced and tracked.');
    add('workflowApprovals', 'Delegations may be required for approvals during leave.');
  }
  if (s.includes('reactivated') || a.includes('reactivate') || a.includes('activate')) {
    add('systemAccess', 'Restore access based on role and policy (IT review).');
    add('payroll', 'Payroll eligibility must be confirmed by Payroll Officer.');
    add('attendance', 'Re-enable attendance clock-in and roster allocation.');
    add('workflowApprovals', 'Restore approval routing if applicable.');
  }
  if (s.includes('contract expired') || a.includes('contract expired')) {
    add('contractRenewal', 'Initiate contract renewal workflow or exit escalation.');
    add('payroll', 'Payroll requires review if contract has expired.');
    add('systemAccess', 'Access should be reviewed for contract expiry.');
  }
  if (s.includes('confirmed') || a.includes('confirm')) {
    add('benefits', 'Enable confirmed benefits eligibility and update HR status.');
    add('payroll', 'Confirm payroll eligibility and grade-based allowances.');
  }
  if (s.includes('deceased') || a.includes('deceased')) {
    add('documentClearance', 'Trigger deceased clearance and benefits workflows.');
    add('payroll', 'Stop payroll and route to benefits processing.');
    add('systemAccess', 'Disable all access immediately.');
    add('emailAccess', 'Disable email immediately.');
  }
  if (s.includes('blacklisted') || a.includes('blacklist')) {
    add('documentClearance', 'Blacklisting requires compliance and executive review.');
    add('systemAccess', 'Disable access immediately.');
  }
  return impact;
};

const buildEmployeeOptions = () => {
  const s = stores();
  const out: EmployeeOption[] = [];
  for (const [id, rec] of s.employees.entries()) {
    const profile = rec?.profile || {};
    const contract = computeContractStatus(id);
    out.push({
      employeeId: String(profile.employeeId || id),
      fullName: String(profile.fullName || `Employee ${id}`),
      department: String(profile.department || ''),
      jobTitle: String(profile.jobTitle || ''),
      currentStatus: String(profile.employmentStatus || ''),
      manager: String(profile.reportingManager || ''),
      location: String(profile.location || ''),
      contractStatus: contract.contractStatus,
    });
  }
  out.sort((a, b) => (a.employeeId > b.employeeId ? 1 : -1));
  return out;
};

const buildEmployeeInsights = (employeeId: string) => {
  const s = stores();
  const emp = s.employees.get(employeeId);
  const status = String(emp?.profile?.employmentStatus || 'Active');
  const overrides = s.statusOverrides.get(employeeId) || {};
  const payrollStatus = String(overrides.payrollStatus || (status.toLowerCase().includes('active') ? 'Eligible' : 'Ineligible'));
  const accessStatus = String(overrides.accessStatus || (status.toLowerCase().includes('suspended') ? 'Restricted' : 'Active'));
  const { contractStatus, contractExpiredDays } = computeContractStatus(employeeId);

  const out: AIInsight[] = [];
  const add = (severity: Severity, title: string, confidence: number, recommendation: string, actionLabel: string, action: string) => {
    out.push({ id: `ai-status-${employeeId}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action });
  };

  if (status === 'Active' && contractStatus === 'Contract Expired' && typeof contractExpiredDays === 'number') {
    add('high', `Employee is active but contract expired ${contractExpiredDays} days ago`, 0.86, 'Initiate renewal or update employee status with escalation.', 'Change Status', 'open_change');
  }
  if ((status === 'Exited' || status === 'Terminated' || status === 'Resigned') && payrollStatus.toLowerCase().includes('eligible')) {
    add('high', 'Employee is exited but payroll eligibility remains active', 0.83, 'Disable payroll eligibility and run final settlement workflow.', 'Change Status', 'open_change');
  }
  if ((status === 'Suspended' || status === 'Blacklisted') && accessStatus.toLowerCase().includes('active')) {
    add('high', 'Suspended employee still has system access', 0.84, 'Route to IT Access Review stage and restrict access immediately.', 'Change Status', 'open_change');
  }
  if (status === 'Probation') {
    add('medium', 'Probation ended but confirmation status not updated', 0.72, 'Confirm employee or extend probation with approval.', 'Change Status', 'open_change');
  }
  if (status === 'On Leave') {
    add('medium', 'Employee is on leave but attendance clock-in is active', 0.7, 'Disable attendance clock-in for leave duration.', 'Review Impact', 'open_change');
  }
  if (contractStatus === 'Contract Expired') {
    add('medium', 'Contract employee has no renewal workflow initiated', 0.69, 'Create renewal request or escalate expiry.', 'Bulk Update', 'open_bulk');
  }
  add('low', 'Exit status requires clearance completion', 0.62, 'Ensure clearance steps and asset recovery are completed.', 'View Impact', 'open_change');
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
  const perms = permissions(role);
  const url = new URL(request.url);
  const seg0 = action[0] || '';

  if (seg0 === 'form-options') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const includeEmployees = url.searchParams.get('includeEmployees') === '1';
    const statusOptions = [
      'Active',
      'Probation',
      'Confirmed',
      'On Leave',
      'Suspended',
      'Terminated',
      'Resigned',
      'Retired',
      'Contract Active',
      'Contract Expired',
      'Seconded',
      'Inactive',
      'Exited',
      'Reactivated',
      'Blacklisted',
      'Deceased',
    ];
    const actions = [
      'Activate Employee',
      'Confirm Employee',
      'Suspend Employee',
      'Place on Leave',
      'Return from Leave',
      'Terminate Employee',
      'Mark as Resigned',
      'Mark as Retired',
      'Mark as Deceased',
      'Reactivate Employee',
      'Mark Contract Expired',
      'Mark Contract Renewed',
      'Blacklist Employee',
    ];
    return jsonOk({ statusOptions, actions, ...(includeEmployees ? { employees: buildEmployeeOptions() } : {}) });
  }

  if (seg0 === 'summary') {
    if (!perms.canViewOrg) return jsonErr(403, 'Permission denied');
    const s = stores();
    const list = Array.from(s.employees.values());
    const countBy = (pred: (st: string) => boolean) =>
      list.reduce((acc, e) => acc + (pred(String(e?.profile?.employmentStatus || '')) ? 1 : 0), 0);
    const active = countBy((st) => st === 'Active');
    const suspended = countBy((st) => st === 'Suspended');
    const onLeave = countBy((st) => st === 'On Leave');
    const probation = countBy((st) => st === 'Probation');
    const exited = countBy((st) => st === 'Exited' || st === 'Terminated' || st === 'Resigned' || st === 'Retired');
    let contractExpired = 0;
    for (const e of s.employees.keys()) {
      if (computeContractStatus(e).contractStatus === 'Contract Expired') contractExpired++;
    }
    const pendingRequests = Array.from(s.requests.values()).filter((r) => r.workflowStatus !== 'Completed' && r.workflowStatus !== 'Rejected' && r.workflowStatus !== 'Cancelled').length;
    return jsonOk({
      activeEmployees: active,
      suspendedEmployees: suspended,
      onLeaveEmployees: onLeave,
      probationEmployees: probation,
      exitedEmployees: exited,
      contractExpiredEmployees: contractExpired,
      pendingRequests,
      lastUpdatedAt: nowIso(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase();
    if (employeeId) return jsonOk(buildEmployeeInsights(employeeId));
    const s = stores();
    const all = Array.from(s.employees.keys());
    const risky = all.slice(0, 12).flatMap((id) => buildEmployeeInsights(id).slice(0, 1));
    return jsonOk(risky.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (!perms.canExport) return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = normalizeStr(url.searchParams.get('employeeId'), 40).toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `employee_status_${employeeId}_${stamp}` : `employee_status_${stamp}`;

    const s = stores();
    const rows: string[][] = [];
    const header = ['Employee ID', 'Employee Name', 'Employment Status', 'Payroll', 'Access', 'Leave', 'Contract', 'Last Updated'];
    const selected = employeeId ? [employeeId] : Array.from(s.employees.keys()).slice(0, 200);
    for (const id of selected) {
      const rec = s.employees.get(id);
      const profile = rec?.profile || {};
      const overrides = s.statusOverrides.get(id) || {};
      const contract = computeContractStatus(id);
      rows.push([
        String(profile.employeeId || id),
        String(profile.fullName || ''),
        String(profile.employmentStatus || ''),
        String(overrides.payrollStatus || ''),
        String(overrides.accessStatus || ''),
        String(overrides.leaveStatus || ''),
        contract.contractStatus,
        String(overrides.updatedAt || rec?.profile?.dateJoined || nowIso()),
      ]);
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
      const lines = rows.slice(0, 45).map((r) => `${r[0]} • ${r[1]} • ${r[2]} • Payroll: ${r[3]} • Access: ${r[4]} • Contract: ${r[6]}`);
      const bytes = buildPdfBytes('DLE HRIS — Employee Status Report', lines);
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

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const perms = permissions(role);
  const seg0 = action[0] || '';
  if (seg0 !== 'bulk-update') return jsonErr(404, 'Not found');
  if (!perms.canBulk) return jsonErr(403, 'Permission denied');
  if (role === 'Employee') return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonErr(400, 'Invalid JSON body');
  const employeeIds = Array.isArray(body.employeeIds) ? (body.employeeIds as unknown[]).map((x) => normalizeStr(x, 40).toUpperCase()).filter(Boolean) : [];
  if (!employeeIds.length) return jsonErr(400, 'No employees selected');
  const actionName = normalizeStr(body.action, 80) || 'Bulk Status Update';
  const effectiveDate = normalizeDate(body.effectiveDate) || nowIso().slice(0, 10);
  const reason = normalizeStr(body.reason, 600) || 'Bulk status update';

  const s = stores();
  const impacted: { employeeId: string; employeeName: string; currentStatus: string; proposedStatus: string }[] = [];
  const proposedStatus = (() => {
    const a = actionName.toLowerCase();
    if (a.includes('contract expiry')) return 'Contract Expired';
    if (a.includes('probation')) return 'Confirmed';
    if (a.includes('suspension')) return 'Suspended';
    if (a.includes('reactivation')) return 'Reactivated';
    if (a.includes('exit')) return 'Exited';
    if (a.includes('leave return')) return 'Active';
    return 'Active';
  })();

  for (const id of employeeIds.slice(0, 500)) {
    const rec = s.employees.get(id);
    const profile = rec?.profile || {};
    impacted.push({
      employeeId: id,
      employeeName: String(profile.fullName || `Employee ${id}`),
      currentStatus: String(profile.employmentStatus || '—'),
      proposedStatus,
    });
  }

  const requestId = `streq-bulk-${Math.random().toString(16).slice(2)}`;
  const now = nowIso();
  const req: StatusChangeRequest = {
    id: requestId,
    scope: 'Bulk',
    employeeId: employeeIds[0],
    employeeName: impacted[0]?.employeeName || `Employee ${employeeIds[0]}`,
    bulkEmployeeIds: employeeIds.slice(0, 500),
    action: actionName,
    previousStatus: { employmentStatus: impacted[0]?.currentStatus || null },
    newStatus: { employmentStatus: proposedStatus },
    effectiveDate,
    reason,
    responsibleOfficer: normalizeStr(body.responsibleOfficer, 160) || null,
    workflowStatus: 'Draft',
    createdBy: role,
    createdAt: now,
    updatedAt: now,
    approvals: [],
    impact: impactFor(proposedStatus, actionName),
    audit: [{ id: `aud-${Math.random().toString(16).slice(2)}`, at: now, action: 'Bulk status update draft created', performedBy: role, reason }],
  };
  s.requests.set(requestId, req);
  const index = s.requestIndex;
  const addToIndex = (empId: string) => {
    const cur = index.get(empId) || [];
    index.set(empId, [requestId, ...cur.filter((x) => x !== requestId)].slice(0, 250));
  };
  for (const id of employeeIds.slice(0, 500)) addToIndex(id);

  const aiRisks: AIInsight[] = employeeIds.slice(0, 15).flatMap((id) => buildEmployeeInsights(id).slice(0, 1));
  return jsonOk({ requestId, impactedCount: impacted.length, impacted: impacted.slice(0, 200), aiRisks: aiRisks.slice(0, 10) });
}
