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
    'Line Manager',
    'Payroll Officer',
    'Auditor',
    'Employee',
    'Executive Management',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const formOptions = () => {
  return {
    departments: ['Civil Engineering', 'Mechanical Engineering', 'Electrical & Instrumentation', 'Project Controls', 'HSE', 'Quality Assurance', 'Procurement', 'Finance', 'Human Capital', 'IT & Support', 'Legal & Compliance', 'Executive Office'],
    businessUnits: ['Operations', 'Corporate Services', 'Projects', 'Commercial'],
    divisions: ['Engineering', 'Operations', 'Corporate Services', 'Projects', 'Commercial'],
    locations: ['Lagos HQ', 'Port Harcourt', 'Warri Yard', 'Bonny Island', 'Remote'],
    jobTitles: ['Senior Civil Engineer', 'Mechanical Supervisor', 'E&I Technician', 'Project Manager', 'Planning Engineer', 'Quantity Surveyor', 'HSE Officer', 'QA/QC Engineer', 'HR Officer', 'Payroll Specialist', 'IT Support Engineer', 'Legal Counsel', 'Executive Assistant'],
    designations: ['Engineer', 'Supervisor', 'Manager', 'Officer', 'Specialist'],
    jobGrades: ['G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
    jobLevels: ['L1', 'L2', 'L3', 'L4', 'L5'],
    costCenters: ['CC-ENG-001', 'CC-OPS-004', 'CC-HR-002', 'CC-FIN-003', 'CC-IT-005'],
    workModes: ['Onsite', 'Hybrid', 'Remote'],
    shiftPatterns: ['Day', 'Night', 'Rotational'],
    staffCategories: ['Senior Staff', 'Junior Staff', 'Contractor'],
    employeeCategories: ['Operations', 'Corporate Services', 'Projects', 'Commercial'],
    projectStatuses: ['Assigned', 'Mobilized', 'On Site', 'Demobilized', 'Completed', 'Suspended', 'Cancelled'],
    projects: [
      { name: 'Lekki Project', code: 'PRJ-LEK-001', location: 'Lagos', client: 'Client A' },
      { name: 'NLNG Train 7', code: 'PRJ-NLNG-007', location: 'Bonny Island', client: 'NLNG' },
      { name: 'Onshore Pipeline', code: 'PRJ-PL-003', location: 'Rivers', client: 'Client B' },
      { name: 'Bridgeworks', code: 'PRJ-BR-002', location: 'Abuja', client: 'Client C' },
    ],
  };
};

const stores = () => {
  const g = globalThis as unknown as { __dleHrisEmployees?: Map<string, any> };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  return { employees: g.__dleHrisEmployees };
};

const listEmployees = () => {
  const s = stores();
  const ids = Array.from(s.employees.keys()).slice(0, 200);
  const fallback = Array.from({ length: 40 }).map((_, i) => `DLE-EMP-${String(i + 1).padStart(5, '0')}`);
  const list = (ids.length ? ids : fallback).slice(0, 80);
  return list.map((employeeId, idx) => ({
    employeeId,
    fullName: `Employee ${String(idx + 1).padStart(2, '0')}`,
    department: idx % 2 === 0 ? 'Projects' : 'Corporate Services',
    jobTitle: idx % 3 === 0 ? 'Project Manager' : 'Engineer',
    manager: idx % 4 === 0 ? 'HR Manager' : 'Department Head',
    location: idx % 2 === 0 ? 'Lagos HQ' : 'Port Harcourt',
  }));
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const seg0 = action[0] || '';

  if (seg0 === 'form-options') {
    const url = new URL(request.url);
    const includeEmployees = url.searchParams.get('includeEmployees') === '1';
    return jsonOk({ ...formOptions(), employees: includeEmployees ? listEmployees() : [] });
  }

  if (seg0 === 'summary') {
    if (role === 'Employee') return jsonErr(403, 'Permission denied');
    const s = stores();
    const totalEmployees = Math.max(40, s.employees.size);
    const opts = formOptions();
    const gradeDist = opts.jobGrades.map((g, idx) => ({ grade: g, count: Math.floor((totalEmployees * (idx + 1)) / (opts.jobGrades.length * 2)) + 1 }));
    const deptDist = opts.departments.slice(0, 8).map((d, idx) => ({ department: d, count: Math.floor((totalEmployees * (idx + 2)) / (opts.departments.length * 2)) + 1 }));
    return jsonOk({
      totalEmployees,
      gradeDistribution: gradeDist,
      departmentDistribution: deptDist,
      pendingJobChangeRequests: 6,
      roleProfileCompliancePct: 82,
      projectAssignmentCoveragePct: 76,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  return jsonErr(404, 'Not found');
}

