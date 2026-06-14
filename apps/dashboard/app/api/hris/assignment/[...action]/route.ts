import { NextResponse } from 'next/server';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';

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

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const uniqueSorted = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b));

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
    __dleHrisAssignmentRequests?: Map<string, any>;
  };
  if (!g.__dleHrisAssignmentRequests) g.__dleHrisAssignmentRequests = new Map();
  return { requests: g.__dleHrisAssignmentRequests };
};

const readAssignmentEmployees = async () => (await readPayrollEmployees()).employees;

const assignmentTypes = [
  'Permanent Assignment',
  'Temporary Assignment',
  'Acting Assignment',
  'Secondment',
  'Project Assignment',
  'Cross-Functional Assignment',
  'Field Assignment',
  'Remote Assignment',
];

const formOptions = (employees: DleEmployeeDirectoryRow[]) => ({
  departments: uniqueSorted(employees.map((employee) => employee.department)),
  businessUnits: uniqueSorted(employees.map((employee) => employee.businessUnit)),
  divisions: uniqueSorted(employees.map((employee) => employee.division)),
  units: uniqueSorted(employees.map((employee) => employee.projectSite)),
  teams: [],
  costCenters: uniqueSorted(employees.map((employee) => employee.costCenter)),
  locations: uniqueSorted(employees.flatMap((employee) => [employee.location, employee.workLocation])),
  officeSites: uniqueSorted(employees.map((employee) => employee.officeLocation)),
  projects: uniqueSorted(employees.map((employee) => employee.projectSite)).map((name) => ({ name, code: name, location: '', client: '' })),
  projectSites: uniqueSorted(employees.map((employee) => employee.projectSite)),
  assignmentTypes,
  assignmentStatuses: uniqueSorted(employees.map((employee) => employee.status)),
  mobilizationStatuses: [],
  hseInductionStatuses: [],
});

const listEmployees = (employees: DleEmployeeDirectoryRow[]) =>
  employees.map((employee) => ({
    employeeId: employee.employeeCode,
    fullName: employee.fullName,
    currentDepartment: clean(employee.department) || 'Unassigned Department',
    currentUnit: clean(employee.projectSite) || clean(employee.division) || '',
    currentManager: clean(employee.managerName) || 'Unassigned',
    location: clean(employee.location) || clean(employee.workLocation) || 'Unassigned Location',
    employmentStatus: clean(employee.status) || 'Unknown',
  }));

const buildPdfBytes = (title: string, lines: string[]) => {
  const escapePdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const cleanPdf = (s: string) => escapePdf(s.replace(/\r?\n/g, ' ').slice(0, 170));
  const all = [title, ...lines].slice(0, 55);
  const stream = [`BT /F1 10 Tf 40 760 Td`, ...all.flatMap((line, index) => [`(${cleanPdf(line || '')}) Tj`, index === all.length - 1 ? '' : '0 -12 Td']).filter(Boolean), 'ET'].join('\n');

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
  pushObj(`5 0 obj\n<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  const startXref = out.length;
  out += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i++) out += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return encoder.encode(out);
};

const exportRows = (employees: DleEmployeeDirectoryRow[], employeeId: string) =>
  employees
    .filter((employee) => (employeeId ? employee.employeeCode.toLowerCase() === employeeId.toLowerCase() : true))
    .map((employee) => [
      employee.employeeCode,
      employee.fullName,
      clean(employee.department),
      clean(employee.division),
      clean(employee.projectSite),
      '',
      clean(employee.businessUnit),
      clean(employee.costCenter),
      clean(employee.location) || clean(employee.workLocation),
      clean(employee.officeLocation),
      clean(employee.projectSite),
      clean(employee.projectSite),
      clean(employee.managerName),
      clean(employee.functionalManager),
      clean(employee.employmentType),
      clean(employee.status),
      employee.dateJoined || '',
      employee.contractEndDate || '',
    ]);

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const seg0 = action[0] || '';
  const url = new URL(request.url);

  if (seg0 === 'form-options') {
    const employees = await readAssignmentEmployees();
    const includeEmployees = url.searchParams.get('includeEmployees') === '1';
    return jsonOk({ ...formOptions(employees), employees: includeEmployees ? listEmployees(employees) : [] });
  }

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employees = await readAssignmentEmployees();
    const activeRequests = Array.from(stores().requests.values()).filter((item: any) => !['Approved', 'Cancelled', 'Completed'].includes(String(item?.status || '')));
    return jsonOk({
      totalEmployees: employees.length,
      pendingRequests: activeRequests.length,
      overstaffedDepartments: 0,
      understaffedUnits: employees.filter((employee) => !clean(employee.department)).length,
      costCenterMismatchFlags: employees.filter((employee) => !clean(employee.costCenter)).length,
      projectAssignmentGaps: employees.filter((employee) => !clean(employee.projectSite)).length,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  if (seg0 === 'ai-insights') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const employeeId = url.searchParams.get('employeeId');
    const employees = await readAssignmentEmployees();
    const employee = employeeId ? employees.find((item) => item.employeeCode.toLowerCase() === employeeId.toLowerCase()) : null;
    const out: AssignmentInsight[] = [];
    const add = (severity: AssignmentInsight['severity'], title: string, confidence: number, recommendation: string, actionLabel: string, action: string) =>
      out.push({ id: `asg-ai-${employeeId || 'org'}-${out.length + 1}`, severity, confidence, title, recommendation, actionLabel, action });

    const missingUnit = employees.filter((item) => !clean(item.projectSite) && !clean(item.division)).length;
    const missingCostCenter = employees.filter((item) => !clean(item.costCenter)).length;
    const missingManager = employees.filter((item) => !clean(item.managerName)).length;
    if (missingUnit) add('high', `${missingUnit} employees have no unit or project site`, 0.82, 'Complete unit or site assignment so approval routing and operational reporting stay accurate.', 'Review Records', 'open_missing_unit');
    if (missingCostCenter) add('medium', `${missingCostCenter} employees have no cost center`, 0.78, 'Review payroll mappings and submit controlled cost center corrections where required.', 'Review Cost Centers', 'open_cost_center');
    if (missingManager) add('medium', `${missingManager} employees have no reporting manager`, 0.76, 'Assign reporting managers before department or unit changes are approved.', 'Review Managers', 'open_managers');
    if (employee && !clean(employee.department)) add('high', 'Employee department is unassigned', 0.86, 'Submit a department assignment request with an effective date and approver rationale.', 'Open Workflow', 'open_workflow');
    if (employee && !clean(employee.managerName)) add('medium', 'Employee reporting manager is unassigned', 0.8, 'Assign a reporting manager as part of the change request.', 'Open Workflow', 'open_workflow');
    if (!out.length) add('low', 'Assignment data is complete for current checks', 0.64, 'No department, manager, cost center, or project-site gaps were found in the current directory extract.', 'View Assignment', 'open_assignment');
    return jsonOk(out.slice(0, 12));
  }

  if (seg0 === 'export') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const employeeId = url.searchParams.get('employeeId') || '';
    const stamp = new Date().toISOString().slice(0, 10);
    const fileBase = employeeId ? `assignment_${employeeId}_${stamp}` : `assignment_report_${stamp}`;
    const header = ['Employee ID', 'Employee Name', 'Department', 'Division', 'Unit', 'Team', 'Business Unit', 'Cost Center', 'Location', 'Office Site', 'Project', 'Project Site', 'Reporting Manager', 'Functional Manager', 'Assignment Type', 'Assignment Status', 'Effective Date', 'End Date'];
    const rows = exportRows((await readAssignmentEmployees()).slice(0, 500), employeeId);

    const csvCell = (v: string) => {
      const s = (v ?? '').replace(/\r?\n/g, ' ').trim();
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    if (format === 'xls' || format === 'excel') {
      const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body><table border="1"><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c ?? '')}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      return new NextResponse(html, {
        headers: {
          'content-type': 'application/vnd.ms-excel;charset=utf-8',
          'content-disposition': `attachment; filename="${fileBase}.xls"`,
        },
      });
    }
    if (format === 'pdf') {
      const lines = [employeeId ? `Employee: ${employeeId}` : 'Assignment Report', `Generated: ${new Date().toISOString()}`, '', `Records: ${rows.length}`, '', ...rows.slice(0, 28).map((r) => `${r[0]} | ${r[1]} | ${r[2]} | ${r[4]} | ${r[7]} | ${r[8]}`)];
      return new NextResponse(buildPdfBytes('DLE HRIS - Assignment Report', lines), {
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
