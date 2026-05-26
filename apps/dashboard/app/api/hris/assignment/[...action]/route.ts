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

type AssignmentInsight = {
  id: string;
  severity: 'high' | 'medium' | 'low';
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
    __dleHrisAssignmentRequests?: Map<string, any>;
    __dleHrisAssignmentRequestsByEmployee?: Map<string, string[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisAssignmentRequests) g.__dleHrisAssignmentRequests = new Map();
  if (!g.__dleHrisAssignmentRequestsByEmployee) g.__dleHrisAssignmentRequestsByEmployee = new Map();
  return { employees: g.__dleHrisEmployees, requests: g.__dleHrisAssignmentRequests, index: g.__dleHrisAssignmentRequestsByEmployee };
};

const formOptions = () => ({
  departments: ['Civil Engineering', 'Mechanical Engineering', 'Electrical & Instrumentation', 'Project Controls', 'HSE', 'Quality Assurance', 'Procurement', 'Finance', 'Human Capital', 'IT & Support', 'Legal & Compliance', 'Executive Office'],
  businessUnits: ['Operations', 'Corporate Services', 'Projects', 'Commercial'],
  divisions: ['Engineering', 'Operations', 'Corporate Services', 'Projects', 'Commercial'],
  units: ['Projects West', 'Projects East', 'Maintenance', 'Construction', 'HSE & Compliance', 'Finance Ops', 'HR Ops', 'IT Service Desk', 'Procurement Ops'],
  teams: ['Team A', 'Team B', 'Team C', 'Field Ops', 'Back Office', 'Planning', 'Scheduling', 'Site Support'],
  costCenters: ['CC-ENG-001', 'CC-OPS-004', 'CC-HR-002', 'CC-FIN-003', 'CC-IT-005', 'CC-PRJ-006'],
  locations: ['Lagos HQ', 'Port Harcourt', 'Warri Yard', 'Bonny Island', 'Remote'],
  officeSites: ['HQ-01', 'HQ-02', 'PH-01', 'WR-01'],
  projects: [
    { name: 'Lekki Project', code: 'PRJ-LEK-001', location: 'Lagos', client: 'Client A' },
    { name: 'NLNG Train 7', code: 'PRJ-NLNG-007', location: 'Bonny Island', client: 'NLNG' },
    { name: 'Onshore Pipeline', code: 'PRJ-PL-003', location: 'Rivers', client: 'Client B' },
    { name: 'Bridgeworks', code: 'PRJ-BR-002', location: 'Abuja', client: 'Client C' },
  ],
  projectSites: ['Site A', 'Site B', 'Site C', 'Yard West', 'Yard East'],
  assignmentTypes: [
    'Permanent Assignment',
    'Temporary Assignment',
    'Acting Assignment',
    'Secondment',
    'Project Assignment',
    'Cross-Functional Assignment',
    'Field Assignment',
    'Remote Assignment',
  ],
  assignmentStatuses: ['Active', 'Pending Approval', 'Scheduled', 'Expired', 'Completed', 'Cancelled', 'Suspended'],
  mobilizationStatuses: ['Not Assigned', 'Assigned', 'Mobilized', 'On Site', 'Temporarily Off Site', 'Demobilized', 'Completed', 'Cancelled'],
  hseInductionStatuses: ['Not Started', 'Pending', 'Completed', 'Expired'],
});

const listEmployees = () => {
  const s = stores();
  const ids = Array.from(s.employees.keys()).slice(0, 200);
  const fallback = Array.from({ length: 50 }).map((_, i) => `DLE-EMP-${String(i + 1).padStart(5, '0')}`);
  const list = (ids.length ? ids : fallback).slice(0, 120);
  return list.map((employeeId, idx) => ({
    employeeId,
    fullName: `Employee ${String(idx + 1).padStart(2, '0')}`,
    currentDepartment: idx % 2 === 0 ? 'Projects' : 'Corporate Services',
    currentUnit: idx % 3 === 0 ? 'Construction' : 'Maintenance',
    currentManager: idx % 4 === 0 ? 'Department Head' : 'Line Manager',
    location: idx % 2 === 0 ? 'Lagos HQ' : 'Port Harcourt',
    employmentStatus: idx % 9 === 0 ? 'Suspended' : 'Active',
  }));
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
    const pendingRequests = Math.max(6, s.requests.size ? Math.floor(s.requests.size / 3) : 8);
    return jsonOk({
      totalEmployees,
      pendingRequests,
      overstaffedDepartments: 3,
      understaffedUnits: 2,
      costCenterMismatchFlags: 5,
      projectAssignmentGaps: 7,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = url.searchParams.get('employeeId');
    const out: AssignmentInsight[] = [];
    const add = (severity: 'high' | 'medium' | 'low', title: string, confidence: number, recommendation: string, actionLabel: string, actionKey: string) =>
      out.push({ id: `asg-ai-${employeeId || 'org'}-${Math.random().toString(16).slice(2)}`, severity, confidence, title, recommendation, actionLabel, action: actionKey });

    add('medium', 'Current department is above approved headcount by 8%', 0.73, 'Review headcount cap and consider reassignment or approved hiring exceptions.', 'Open Headcount', 'open_headcount');
    add('high', '7 employees have no assigned unit/team', 0.82, 'Assign unit/team to improve approval routing and operational reporting.', 'Open Records', 'open_missing_unit');
    add('medium', '5 cost-center mismatches detected vs department mapping', 0.78, 'Run payroll reconciliation and submit cost center correction requests.', 'Review Cost Centers', 'open_cost_center');
    add('low', 'Project assignments expiring in next 30 days', 0.66, 'Prepare demobilization or next assignment to prevent expired active placements.', 'Review Projects', 'open_projects');

    if (employeeId) add('medium', 'Department transfer requires HR Director approval', 0.7, 'Submit transfer request and ensure required stage approvals are completed before applying changes.', 'Open Workflow', 'open_workflow');
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = url.searchParams.get('employeeId') || '';
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `assignment_${employeeId}_${stamp}` : `assignment_report_${stamp}`;

    const header = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Division',
      'Unit',
      'Team',
      'Business Unit',
      'Cost Center',
      'Location',
      'Office Site',
      'Project',
      'Project Site',
      'Reporting Manager',
      'Functional Manager',
      'Assignment Type',
      'Assignment Status',
      'Effective Date',
      'End Date',
    ];
    const employees = listEmployees().slice(0, 80);
    const rows = employees
      .filter((e) => (employeeId ? e.employeeId === employeeId : true))
      .map((e, idx) => [
        e.employeeId,
        e.fullName,
        idx % 2 === 0 ? 'Projects' : 'Corporate Services',
        idx % 2 === 0 ? 'Projects' : 'Corporate Services',
        idx % 3 === 0 ? 'Construction' : 'Maintenance',
        idx % 4 === 0 ? 'Field Ops' : 'Back Office',
        idx % 2 === 0 ? 'Operations' : 'Corporate Services',
        idx % 2 === 0 ? 'CC-PRJ-006' : 'CC-HR-002',
        e.location,
        idx % 2 === 0 ? 'HQ-01' : 'PH-01',
        idx % 2 === 0 ? 'NLNG Train 7' : 'Lekki Project',
        idx % 2 === 0 ? 'Site A' : 'Site B',
        e.currentManager,
        idx % 3 === 0 ? 'Functional Manager' : '—',
        idx % 2 === 0 ? 'Permanent Assignment' : 'Project Assignment',
        'Active',
        '2026-01-15',
        '',
      ]);

    const csvCell = (v: string) => {
      const s = (v ?? '').replace(/\r?\n/g, ' ').trim();
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
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
      lines.push(employeeId ? `Employee: ${employeeId}` : 'Assignment Report');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push('');
      lines.push(`Records: ${rows.length}`);
      lines.push('');
      for (const r of rows.slice(0, 28)) lines.push(`${r[0]} • ${r[1]} • ${r[2]} • ${r[4]} • ${r[7]} • ${r[8]}`);
      const bytes = buildPdfBytes('DLE HRIS — Assignment Report', lines);
      return new NextResponse(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${fileBase}.pdf"`,
        },
      });
    }
    const csv = [header.map(csvCell).join(','), ...rows.map((r) => r.map((c) => csvCell(String(c ?? ''))).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv;charset=utf-8',
        'content-disposition': `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  return jsonErr(404, 'Not found');
}

