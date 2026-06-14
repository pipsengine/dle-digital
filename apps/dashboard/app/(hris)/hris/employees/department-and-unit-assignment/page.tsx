import DepartmentAndUnitAssignmentClient from './DepartmentAndUnitAssignmentClient';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';

export const dynamic = 'force-dynamic';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const uniqueSorted = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const buildInitialFormOptions = (employees: DleEmployeeDirectoryRow[]) => ({
  departments: uniqueSorted(employees.map((employee) => employee.department)),
  businessUnits: uniqueSorted(employees.map((employee) => employee.businessUnit)),
  divisions: uniqueSorted(employees.map((employee) => employee.division)),
  units: uniqueSorted(employees.map((employee) => employee.projectSite || employee.division)),
  teams: [],
  costCenters: uniqueSorted(employees.map((employee) => employee.costCenter)),
  locations: uniqueSorted(employees.flatMap((employee) => [employee.location, employee.workLocation])),
  officeSites: uniqueSorted(employees.map((employee) => employee.officeLocation || employee.location || employee.workLocation)),
  projects: uniqueSorted(employees.map((employee) => employee.projectSite)).map((name) => ({ name, code: name, location: '', client: '' })),
  projectSites: uniqueSorted(employees.map((employee) => employee.projectSite)),
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
  assignmentStatuses: uniqueSorted(employees.map((employee) => employee.status)),
  mobilizationStatuses: [],
  hseInductionStatuses: [],
  employees: employees.map((employee) => ({
    employeeId: employee.employeeCode,
    fullName: employee.fullName,
    currentDepartment: clean(employee.department) || 'Unassigned Department',
    currentUnit: clean(employee.projectSite) || clean(employee.division) || '',
    currentManager: clean(employee.managerName) || 'Unassigned',
    location: clean(employee.location) || clean(employee.workLocation) || 'Unassigned Location',
    employmentStatus: clean(employee.status) || 'Unknown',
  })),
});

export default async function DepartmentAndUnitAssignmentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employees = (await readPayrollEmployees()).employees;
  const fallbackEmployeeId = employees[0]?.employeeCode || '';
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : fallbackEmployeeId;
  return <DepartmentAndUnitAssignmentClient initialNow={new Date().toISOString()} employeeId={employeeId} initialFormOptions={buildInitialFormOptions(employees)} />;
}
