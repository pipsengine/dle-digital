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

type Severity = 'high' | 'medium' | 'low';

type ReportingInsight = {
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

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisReportingChangeRequests?: Map<string, any>;
    __dleHrisReportingChangeRequestsByEmployee?: Map<string, string[]>;
    __dleHrisDelegations?: Map<string, any[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisReportingChangeRequests) g.__dleHrisReportingChangeRequests = new Map();
  if (!g.__dleHrisReportingChangeRequestsByEmployee) g.__dleHrisReportingChangeRequestsByEmployee = new Map();
  if (!g.__dleHrisDelegations) g.__dleHrisDelegations = new Map();
  return { employees: g.__dleHrisEmployees, requests: g.__dleHrisReportingChangeRequests, index: g.__dleHrisReportingChangeRequestsByEmployee, delegations: g.__dleHrisDelegations };
};

const addToIndex = (employeeId: string, requestId: string) => {
  const s = stores();
  const ids = s.index.get(employeeId) || [];
  if (!ids.includes(requestId)) s.index.set(employeeId, [requestId, ...ids].slice(0, 120));
};

const listEmployees = () => {
  const s = stores();
  const ids = Array.from(s.employees.keys()).slice(0, 200);
  const fallback = Array.from({ length: 50 }).map((_, i) => `DLE-EMP-${String(i + 1).padStart(5, '0')}`);
  const list = (ids.length ? ids : fallback).slice(0, 120);
  return list.map((employeeId, idx) => ({
    employeeId,
    fullName: `Employee ${String(idx + 1).padStart(2, '0')}`,
    department: idx % 2 === 0 ? 'Projects' : 'Corporate Services',
    jobTitle: idx % 3 === 0 ? 'Engineer' : idx % 3 === 1 ? 'Officer' : 'Supervisor',
    currentManager: idx % 4 === 0 ? 'Line Manager' : 'Department Head',
    location: idx % 2 === 0 ? 'Lagos HQ' : 'Port Harcourt',
    businessUnit: idx % 2 === 0 ? 'Operations' : 'Corporate Services',
    employmentStatus: idx % 9 === 0 ? 'Suspended' : 'Active',
  }));
};

const formOptions = () => ({
  changeTypes: [
    'Manager Change',
    'Functional Manager Change',
    'Department Head Change',
    'Project Manager Change',
    'Matrix Manager Change',
    'Delegated Approver Change',
    'Temporary Reporting Assignment',
    'Bulk Manager Reassignment',
  ],
  statuses: ['Active', 'Pending Approval', 'Scheduled', 'Temporary', 'Expired', 'Cancelled'],
  delegationScopes: [
    'Leave Approval',
    'Attendance Approval',
    'Expense Approval',
    'Timesheet Approval',
    'HR Request Approval',
    'Project Approval',
    'All Workflow Approvals',
  ],
  delegationAssignmentTypes: [
    'Acting manager assignment',
    'Temporary supervisor',
    'Delegated approver',
    'Leave-cover manager',
    'Project supervisor',
    'Alternate approver',
  ],
  departments: ['Civil Engineering', 'Mechanical Engineering', 'Electrical & Instrumentation', 'Project Controls', 'HSE', 'Quality Assurance', 'Procurement', 'Finance', 'Human Capital', 'IT & Support', 'Legal & Compliance', 'Executive Office'],
  businessUnits: ['Operations', 'Corporate Services', 'Projects', 'Commercial'],
  locations: ['Lagos HQ', 'Port Harcourt', 'Warri Yard', 'Bonny Island', 'Remote'],
});

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

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const seg0 = action[0] || '';
  const url = new URL(request.url);

  if (seg0 === 'form-options') {
    const includeEmployees = url.searchParams.get('includeEmployees') === '1';
    return jsonOk({ ...formOptions(), employees: includeEmployees ? listEmployees() : [] });
  }

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const s = stores();
    const totalEmployees = Math.max(50, s.employees.size);
    const pendingChanges = Math.max(6, s.requests.size ? Math.floor(s.requests.size / 2) : 10);
    return jsonOk({
      totalEmployees,
      pendingChanges,
      missingManagers: 4,
      approvalChainGaps: 3,
      delegationExpiringSoon: 2,
      circularRiskFlags: 1,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = url.searchParams.get('employeeId') || '';
    const out: ReportingInsight[] = [];
    const add = (severity: Severity, title: string, confidence: number, recommendation: string, actionLabel: string, actionKey: string) =>
      out.push({ id: `rep-ai-${employeeId || 'org'}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action: actionKey });

    add('high', 'Approval chain has a missing second-level approver', 0.84, 'Assign department head or level 2 approver to remove routing blockage.', 'Open Chain', 'open_approval_chain');
    add('medium', 'Manager has exceeded recommended span of control', 0.72, 'Review team size and consider reassignment or adding supervisor layers.', 'Review Manager', 'open_manager');
    add('medium', 'Delegated approver expires in 3 days', 0.74, 'Extend delegation or configure fallback approver.', 'Review Delegation', 'open_delegation');
    add('low', 'Project reporting line conflicts with department reporting line', 0.66, 'Validate matrix reporting and ensure org chart edges are correct.', 'Open Org Chart', 'open_org_chart');

    if (employeeId) add('high', 'Circular reporting risk detected', 0.86, 'Block circular reporting and resubmit corrected hierarchy.', 'Resolve', 'open_request');
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = url.searchParams.get('employeeId') || '';
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `reporting_line_${employeeId}_${stamp}` : `reporting_line_report_${stamp}`;

    const header = [
      'Employee ID',
      'Employee Name',
      'Direct Manager',
      'Functional Manager',
      'Department Head',
      'Unit Head',
      'Business Unit Head',
      'Project Manager',
      'Site Supervisor',
      'Matrix Manager',
      'Dotted-Line Manager',
      'HR Business Partner',
      'Delegated Approver',
      'Effective Date',
      'End Date',
      'Status',
      'Reason',
    ];
    const employees = listEmployees().slice(0, 80);
    const rows = employees
      .filter((e) => (employeeId ? e.employeeId === employeeId : true))
      .map((e, idx) => [
        e.employeeId,
        e.fullName,
        e.currentManager,
        idx % 3 === 0 ? 'Functional Manager' : '',
        'Department Head',
        idx % 2 === 0 ? 'Unit Head' : 'Unit Head',
        idx % 2 === 0 ? 'Business Unit Head' : 'Business Unit Head',
        idx % 2 === 0 ? 'Project Manager' : '',
        idx % 2 === 0 ? 'Site Supervisor' : '',
        idx % 2 === 0 ? 'Matrix Manager' : '',
        idx % 4 === 0 ? 'Dotted Manager' : '',
        'HRBP',
        idx % 6 === 0 ? 'Delegated Approver' : '',
        '2026-02-01',
        '',
        'Active',
        'Baseline reporting line',
      ]);

    if (format === 'xls' || format === 'excel') {
      const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body>
        <table border="1">
          <tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>
          ${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c ?? '')}</td>`).join('')}</tr>`).join('')}
        </table>
      </body></html>`;
      return new NextResponse(html, {
        headers: {
          'content-type': 'application/vnd.ms-excel;charset=utf-8',
          'content-disposition': `attachment; filename="${fileBase}.xls"`,
        },
      });
    }
    if (format === 'pdf') {
      const lines: string[] = [];
      lines.push(employeeId ? `Employee: ${employeeId}` : 'Reporting Line Report');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push('');
      for (const r of rows.slice(0, 40)) {
        lines.push(`${r[0]} | ${r[1]} | Direct: ${r[2]} | Dept Head: ${r[4]} | BU Head: ${r[6]}`);
      }
      const bytes = buildPdfBytes('DLE HRIS — Reporting Line Export', lines);
      return new NextResponse(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${fileBase}.pdf"`,
        },
      });
    }
    if (format === 'png') {
      return jsonErr(501, 'PNG export is not available in this demo build');
    }

    const csv = [header, ...rows].map((r) => r.map((c) => csvCell(String(c ?? ''))).join(',')).join('\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv;charset=utf-8',
        'content-disposition': `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  return jsonErr(404, 'Not found');
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const seg0 = action[0] || '';
  if (role === 'Employee') return jsonErr(403, 'Permission denied');
  if (seg0 !== 'bulk-reassignment') return jsonErr(404, 'Not found');

  const body = (await request.json().catch(() => null)) as any;
  const currentManager = typeof body?.currentManager === 'string' ? body.currentManager.trim() : '';
  const newManager = typeof body?.newManager === 'string' ? body.newManager.trim() : '';
  const employeeIds = Array.isArray(body?.employeeIds) ? (body.employeeIds as any[]).filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];
  if (!currentManager) return jsonErr(400, 'Current manager is required');
  if (!newManager) return jsonErr(400, 'New manager is required');
  if (newManager.toLowerCase().includes('inactive')) return jsonErr(400, 'Cannot assign to inactive manager');

  const s = stores();
  const candidates = listEmployees().filter((e) => e.currentManager === currentManager).map((e) => e.employeeId);
  const impacted = (employeeIds.length ? employeeIds : candidates).slice(0, 250);
  if (impacted.length === 0) return jsonErr(400, 'No employees found for the selected current manager');

  const now = new Date().toISOString();
  const requestId = `repreq-bulk-${Math.random().toString(16).slice(2)}`;
  const req = {
    id: requestId,
    employeeId: 'BULK',
    employeeName: 'Bulk Manager Reassignment',
    changeType: 'Bulk Manager Reassignment',
    status: 'Draft',
    effectiveDate: typeof body?.effectiveDate === 'string' && body.effectiveDate.trim() ? body.effectiveDate.trim() : now.slice(0, 10),
    endDate: null,
    reason: typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : `Bulk reassignment from ${currentManager} to ${newManager}`,
    notes: typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    previousValues: { directManager: currentManager },
    newValues: { directManager: newManager },
    delegations: [],
    supportingDocuments: [],
    approvals: [],
    audit: [
      {
        id: `audit-${Math.random().toString(16).slice(2)}`,
        at: now,
        action: 'Bulk reassignment draft created',
        performedBy: role,
        reason: typeof body?.reason === 'string' ? body.reason : undefined,
      },
    ],
    createdBy: role,
    createdAt: now,
    updatedAt: now,
    isBulk: true,
    bulkEmployeeIds: impacted,
  };
  s.requests.set(requestId, req);
  for (const empId of impacted) addToIndex(empId, requestId);
  return jsonOk({ requestId, impactedEmployees: impacted.length, previewEmployeeIds: impacted.slice(0, 30) });
}
