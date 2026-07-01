import { readEmployeeDirectoryFromDb, type DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';
import { assignEmployeesToSupervisor } from '@/lib/supervisor-assignment-store';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const PRODUCTION_PATTERN = /\bproduction\b/i;
const LEADERSHIP_PATTERN = /\b(manager|head|lead|supervisor|director)\b/i;

const DEPARTMENT_SUPERVISOR_CODES: Record<string, string> = {
  'information technology': 'P0146',
  'it & enterprise systems': 'P0146',
  'it and enterprise systems': 'P0146',
};

export type DepartmentReportingSyncRow = {
  employeeCode: string;
  employeeName: string;
  department: string;
  employmentType: string;
  previousReportingManager: string | null;
  supervisorCode: string;
  supervisorName: string;
  reason: string;
};

export type DepartmentReportingSyncResult = {
  generatedAt: string;
  dryRun: boolean;
  departmentsReviewed: number;
  employeesReviewed: number;
  employeesNeedingAssignment: number;
  employeesUpdated: number;
  skippedProduction: number;
  skippedOutOfScope: number;
  departmentsWithoutSupervisor: string[];
  planned: DepartmentReportingSyncRow[];
  assignmentBatch: string | null;
};

const normalizeDepartment = (value: string) => clean(value).toLowerCase().replace(/\s+/g, ' ');

const isInactive = (status: string) => /inactive|terminated|resigned|retired|deceased|suspend/i.test(clean(status));

const isProductionDepartment = (department: string) => PRODUCTION_PATTERN.test(clean(department));

const inScopeEmployee = (employee: DleEmployeeDirectoryRow) => {
  const employmentType = clean(employee.employmentType).toLowerCase();
  const code = clean(employee.employeeCode || employee.employeeId).toUpperCase();
  if (employmentType.includes('permanent') || employmentType === 'lumpsum' || employmentType.includes('nysc') || employmentType === 'it') {
    return true;
  }
  return /^(P|L|NYSC|N)\d/i.test(code);
};

const leadershipScore = (employee: DleEmployeeDirectoryRow) => {
  const title = `${clean(employee.jobTitle)} ${clean(employee.designation)}`.toLowerCase();
  if (!LEADERSHIP_PATTERN.test(title)) return 0;
  if (/\b(ag\.|acting)\b.*\bmanager\b/i.test(title) || /\bit manager\b/i.test(title)) return 100;
  if (/\bmanager\b/i.test(title)) return 80;
  if (/\bhead\b/i.test(title)) return 70;
  if (/\blead\b/i.test(title)) return 60;
  if (/\bsupervisor\b/i.test(title)) return 50;
  if (/\bdirector\b/i.test(title)) return 40;
  return 10;
};

const employeeCodeFromReference = (reference: string) => {
  const value = clean(reference);
  if (!value) return '';
  const prefixed = value.match(/^([A-Z]{0,5}0*\d+)\s*-/i);
  if (prefixed?.[1]) return prefixed[1].toUpperCase().replace(/^0+/, (digits) => (digits ? digits : '0'));
  const embedded = value.match(/\b(P\d+|L\d+|NYSC\d+|C\d+)\b/i);
  return embedded?.[1]?.toUpperCase() || '';
};

const reportingManagerMatchesSupervisor = (
  reportingManager: string,
  supervisor: DleEmployeeDirectoryRow,
) => {
  const managerRef = clean(reportingManager);
  if (!managerRef) return false;
  const supervisorLabel = `${clean(supervisor.employeeCode)} - ${clean(supervisor.fullName)}`;
  if (managerRef === supervisorLabel) return true;

  const managerCode = employeeCodeFromReference(managerRef);
  const supervisorCode = normalizePayrollMatchKey(supervisor.employeeCode || supervisor.employeeId);
  if (managerCode && supervisorCode && normalizePayrollMatchKey(managerCode) === supervisorCode) return true;

  const managerName = managerRef.includes(' - ') ? clean(managerRef.split(' - ').slice(1).join(' - ')) : managerRef;
  const supervisorName = clean(supervisor.fullName).toLowerCase();
  const normalizedManagerName = managerName.toLowerCase();
  return Boolean(
    normalizedManagerName
    && (supervisorName === normalizedManagerName || supervisorName.includes(normalizedManagerName) || normalizedManagerName.includes(supervisorName)),
  );
};

const resolveDepartmentSupervisor = (
  department: string,
  employeesInDepartment: DleEmployeeDirectoryRow[],
  allEmployees: DleEmployeeDirectoryRow[],
): DleEmployeeDirectoryRow | null => {
  const departmentKey = normalizeDepartment(department);
  const overrideCode = DEPARTMENT_SUPERVISOR_CODES[departmentKey];
  if (overrideCode) {
    const override = allEmployees.find((employee) => clean(employee.employeeCode).toUpperCase() === overrideCode);
    if (override && !isInactive(override.status)) return override;
  }

  const activeInDepartment = employeesInDepartment.filter((employee) => !isInactive(employee.status));
  const leadershipCandidates = activeInDepartment
    .map((employee) => ({ employee, score: leadershipScore(employee) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.employee.fullName.localeCompare(b.employee.fullName));
  if (leadershipCandidates.length) return leadershipCandidates[0].employee;

  const managerCounts = new Map<string, { count: number; code: string }>();
  for (const employee of activeInDepartment) {
    const managerRef = clean(employee.managerName);
    if (!managerRef) continue;
    const managerCode = employeeCodeFromReference(managerRef) || managerRef;
    const key = normalizePayrollMatchKey(managerCode) || managerRef.toLowerCase();
    const current = managerCounts.get(key) || { count: 0, code: managerCode };
    current.count += 1;
    managerCounts.set(key, current);
  }
  const dominant = [...managerCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (dominant) {
    const supervisor = allEmployees.find((employee) => {
      const keys = [employee.employeeCode, employee.employeeId, employee.fullName].map((value) => normalizePayrollMatchKey(value));
      return keys.includes(dominant[0]) || reportingManagerMatchesSupervisor(dominant[1].code, employee);
    });
    if (supervisor && !isInactive(supervisor.status)) return supervisor;
  }

  const departmentHeadName = activeInDepartment.map((employee) => clean(employee.departmentHead)).find(Boolean);
  if (departmentHeadName) {
    const head = allEmployees.find((employee) => clean(employee.fullName).toLowerCase() === departmentHeadName.toLowerCase());
    if (head && !isInactive(head.status)) return head;
  }

  return null;
};

export async function auditDepartmentReportingManagers(): Promise<DepartmentReportingSyncResult> {
  const employees = (await readEmployeeDirectoryFromDb()) || [];
  return buildDepartmentReportingSyncPlan(employees, true);
}

export async function syncDepartmentReportingManagers(input: {
  dryRun?: boolean;
  performedBy?: string;
  departments?: string[];
} = {}): Promise<DepartmentReportingSyncResult> {
  const employees = (await readEmployeeDirectoryFromDb()) || [];
  const plan = buildDepartmentReportingSyncPlan(employees, Boolean(input.dryRun), input.departments);
  if (input.dryRun || plan.planned.length === 0) return plan;

  const grouped = new Map<string, DepartmentReportingSyncRow[]>();
  for (const row of plan.planned) {
    const bucket = grouped.get(row.supervisorCode) || [];
    bucket.push(row);
    grouped.set(row.supervisorCode, bucket);
  }

  let assignmentBatch: string | null = null;
  let employeesUpdated = 0;
  for (const [supervisorCode, rows] of grouped.entries()) {
    const result = await assignEmployeesToSupervisor({
      supervisorEmployeeCode: supervisorCode,
      employeeCodes: rows.map((row) => row.employeeCode),
      assignmentGroup: 'Department Reporting Line',
      assignmentBatch: assignmentBatch || undefined,
      reason: 'Department/unit reporting manager alignment (excluding Production).',
      performedBy: clean(input.performedBy) || 'department-reporting-sync',
      sourceRows: rows.map((row) => ({
        employeeCode: row.employeeCode,
        sourceLabel: row.employeeName,
        matchConfidence: 'DepartmentSupervisorRule',
        matchNote: row.reason,
      })),
    });
    assignmentBatch = result.assignmentBatch;
    employeesUpdated += rows.length;
  }

  return {
    ...plan,
    dryRun: false,
    employeesUpdated,
    assignmentBatch,
  };
}

function buildDepartmentReportingSyncPlan(
  employees: DleEmployeeDirectoryRow[],
  dryRun: boolean,
  departmentFilter?: string[],
): DepartmentReportingSyncResult {
  const filter = new Set((departmentFilter || []).map(normalizeDepartment).filter(Boolean));
  const activeEmployees = employees.filter((employee) => !isInactive(employee.status));
  const departments = new Map<string, DleEmployeeDirectoryRow[]>();

  let skippedProduction = 0;
  let skippedOutOfScope = 0;

  for (const employee of activeEmployees) {
    const department = clean(employee.department);
    if (!department) {
      skippedOutOfScope += 1;
      continue;
    }
    if (isProductionDepartment(department)) {
      skippedProduction += 1;
      continue;
    }
    if (!inScopeEmployee(employee)) {
      skippedOutOfScope += 1;
      continue;
    }
    if (filter.size && !filter.has(normalizeDepartment(department))) continue;
    const bucket = departments.get(department) || [];
    bucket.push(employee);
    departments.set(department, bucket);
  }

  const planned: DepartmentReportingSyncRow[] = [];
  const departmentsWithoutSupervisor: string[] = [];

  for (const [department, departmentEmployees] of departments.entries()) {
    const supervisor = resolveDepartmentSupervisor(department, departmentEmployees, activeEmployees);
    if (!supervisor) {
      departmentsWithoutSupervisor.push(department);
      continue;
    }

    for (const employee of departmentEmployees) {
      if (clean(employee.employeeCode).toUpperCase() === clean(supervisor.employeeCode).toUpperCase()) continue;

      const hasManager = Boolean(clean(employee.managerName));
      const explicitDepartment = Boolean(DEPARTMENT_SUPERVISOR_CODES[normalizeDepartment(department)]);
      const needsExplicitSupervisor = explicitDepartment && !reportingManagerMatchesSupervisor(clean(employee.managerName), supervisor);
      const needsManager = !hasManager;

      if (!needsManager && !needsExplicitSupervisor) continue;
      if (hasManager && !needsExplicitSupervisor) continue;

      planned.push({
        employeeCode: clean(employee.employeeCode),
        employeeName: clean(employee.fullName),
        department,
        employmentType: clean(employee.employmentType),
        previousReportingManager: clean(employee.managerName) || null,
        supervisorCode: clean(supervisor.employeeCode),
        supervisorName: clean(supervisor.fullName),
        reason: needsExplicitSupervisor
          ? 'Explicit department supervisor mapping'
          : 'Missing reporting manager for department/unit',
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    departmentsReviewed: departments.size,
    employeesReviewed: [...departments.values()].reduce((sum, rows) => sum + rows.length, 0),
    employeesNeedingAssignment: planned.length,
    employeesUpdated: 0,
    skippedProduction,
    skippedOutOfScope,
    departmentsWithoutSupervisor: departmentsWithoutSupervisor.sort((a, b) => a.localeCompare(b)),
    planned: planned.sort((a, b) => a.department.localeCompare(b.department) || a.employeeCode.localeCompare(b.employeeCode)),
    assignmentBatch: null,
  };
}
