import { NextResponse } from 'next/server';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';
import { activeTaxVersion, calculatePayrollTax, payrollInputFromEmployee, readPayrollTaxConfig, type PayrollTaxVersion } from '@/lib/payroll-tax-engine';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Payroll Officer'
  | 'Finance Controller'
  | 'Executive Management'
  | 'Auditor'
  | 'Employee';

type PayrollRunStatus = 'Draft' | 'Validation' | 'Ready for Approval' | 'Approved' | 'Locked' | 'Posted';

type PayrollRun = {
  id: string;
  period: string;
  status: PayrollRunStatus;
  employeeCount: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
  lockedAt: string | null;
  postedAt: string | null;
};

const jsonOk = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const nowIso = () => new Date().toISOString();
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();

const getRole = (request: Request): Role => {
  const value = request.headers.get('x-hris-role');
  const roles: Role[] = ['Super Admin', 'HR Director', 'HR Manager', 'HR Officer', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor', 'Employee'];
  return roles.includes(value as Role) ? (value as Role) : 'Payroll Officer';
};

const permissions = (role: Role) => {
  const canViewMoney = ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor'].includes(role);
  const canManageRun = ['Super Admin', 'HR Director', 'Payroll Officer', 'Finance Controller'].includes(role);
  const canApprove = ['Super Admin', 'HR Director', 'Finance Controller', 'Executive Management'].includes(role);
  const canPost = ['Super Admin', 'Payroll Officer', 'Finance Controller'].includes(role);
  const canExport = role !== 'Employee';
  return { canViewMoney, canManageRun, canApprove, canPost, canExport };
};

const runStore = (() => {
  const g = globalThis as unknown as { __dlePayrollRuns?: Map<string, PayrollRun> };
  if (!g.__dlePayrollRuns) g.__dlePayrollRuns = new Map();
  return g.__dlePayrollRuns;
})();

const monthPeriod = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const periodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const employeeCost = (employee: DleEmployeeDirectoryRow, taxVersion: PayrollTaxVersion) => {
  const basePay = Number(employee.periodSalary || (employee.annualSalary ? employee.annualSalary / 12 : 0) || 0);
  const type = compact(employee.employmentType).toLowerCase();
  const allowanceRate = type.includes('daily') ? 0.08 : type.includes('lumpsum') ? 0.12 : type.includes('it') || type.includes('nysc') ? 0.04 : 0.22;
  const allowance = basePay * allowanceRate;
  const tax = calculatePayrollTax(payrollInputFromEmployee(employee), taxVersion);
  const pension = (tax.statutoryItems.find((item) => item.id === 'pension')?.amount || 0) / 12;
  const paye = tax.monthlyPaye;
  const otherDeductions = (tax.statutoryItems.find((item) => item.id === 'other-statutory')?.amount || 0) / 12;
  const grossPay = basePay + allowance;
  const deductions = pension + paye + otherDeductions;
  return {
    basePay: roundMoney(basePay),
    allowances: roundMoney(allowance),
    pension: roundMoney(pension),
    paye: roundMoney(paye),
    otherDeductions: roundMoney(otherDeductions),
    grossPay: roundMoney(grossPay),
    deductions: roundMoney(deductions),
    netPay: roundMoney(Math.max(0, grossPay - deductions)),
  };
};

const riskFor = (employee: DleEmployeeDirectoryRow, cost: ReturnType<typeof employeeCost>) => {
  const issues: string[] = [];
  if (!employee.setupAssignedToPayroll) issues.push('Payroll setup is not assigned');
  if (cost.basePay <= 0) issues.push('Pay amount is missing');
  if (!compact(employee.salaryGrade || employee.jobGrade)) issues.push('Salary grade is missing');
  if (!compact(employee.payrollGroup)) issues.push('Payroll group is missing');
  if (compact(employee.status).toLowerCase().match(/terminated|resigned|retired|inactive/)) issues.push('Employee status is not payroll active');
  if (compact(employee.payCurrency) && compact(employee.payCurrency).toUpperCase() !== 'NGN') issues.push('Foreign currency review required');
  const severity = issues.some((issue) => issue.includes('not payroll active') || issue.includes('Pay amount')) ? 'High' : issues.length > 0 ? 'Medium' : 'Low';
  return { issues, severity };
};

const buildRecords = (employees: DleEmployeeDirectoryRow[], taxVersion: PayrollTaxVersion) =>
  employees.map((employee) => {
    const cost = employeeCost(employee, taxVersion);
    const risk = riskFor(employee, cost);
    const payrollStatus = risk.issues.length === 0 ? 'Ready' : risk.severity === 'High' ? 'Blocked' : 'Review';
    return {
      employeeId: employee.employeeId,
      employeeDbId: employee.employeeDbId,
      fullName: employee.fullName,
      department: employee.department,
      businessUnit: employee.businessUnit,
      location: employee.location,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      employmentStatus: employee.status,
      payrollGroup: employee.payrollGroup || 'Unassigned',
      salaryGrade: employee.salaryGrade || employee.jobGrade || 'Unassigned',
      payCurrency: employee.payCurrency || 'NGN',
      paymentRun: employee.paymentRun || 'Monthly',
      paymentType: employee.paymentType || 'Bank Transfer',
      setupAssignedToPayroll: employee.setupAssignedToPayroll,
      payrollStatus,
      riskSeverity: risk.severity,
      exceptionCount: risk.issues.length,
      exceptions: risk.issues,
      ...cost,
    };
  });

const maskMoney = (record: any) => ({
  ...record,
  basePay: null,
  allowances: null,
  pension: null,
  paye: null,
  otherDeductions: null,
  grossPay: null,
  deductions: null,
  netPay: null,
});

type PayrollGroupSummary = { label: string; employees: number; grossPay: number; netPay: number; exceptions: number };

const grouped = (records: any[], key: string) =>
  Array.from<PayrollGroupSummary>(
    records.reduce((map, record) => {
      const label = record[key] || 'Unassigned';
      const current = map.get(label) || { label, employees: 0, grossPay: 0, netPay: 0, exceptions: 0 };
      current.employees += 1;
      current.grossPay += record.grossPay || 0;
      current.netPay += record.netPay || 0;
      current.exceptions += record.exceptionCount || 0;
      map.set(label, current);
      return map;
    }, new Map<string, PayrollGroupSummary>()).values()
  )
    .map((item) => ({
      label: item.label,
      employees: item.employees,
      grossPay: roundMoney(item.grossPay),
      netPay: roundMoney(item.netPay),
      exceptions: item.exceptions,
    }))
    .sort((a, b) => b.netPay - a.netPay);

const buildPayload = async (request: Request) => {
  const role = getRole(request);
  const perms = permissions(role);
  const [employeeSource, taxConfig] = await Promise.all([readPayrollEmployees(), readPayrollTaxConfig()]);
  const employeeRows = employeeSource.employees;
  const taxVersion = activeTaxVersion(taxConfig);
  if (!taxVersion) throw new Error('No active payroll tax configuration is available.');
  const records = buildRecords(employeeRows, taxVersion);
  const eligible = records.filter((record) => !['Terminated', 'Resigned', 'Retired', 'Inactive'].includes(record.employmentStatus));
  const ready = records.filter((record) => record.payrollStatus === 'Ready');
  const blocked = records.filter((record) => record.payrollStatus === 'Blocked');
  const review = records.filter((record) => record.payrollStatus === 'Review');
  const totals = records.reduce(
    (sum, record) => ({
      grossPay: sum.grossPay + record.grossPay,
      deductions: sum.deductions + record.deductions,
      netPay: sum.netPay + record.netPay,
      basePay: sum.basePay + record.basePay,
      allowances: sum.allowances + record.allowances,
    }),
    { grossPay: 0, deductions: 0, netPay: 0, basePay: 0, allowances: 0 }
  );
  const period = monthPeriod();
  if (runStore.size === 0) {
    const run: PayrollRun = {
      id: `payroll-${period}`,
      period,
      status: blocked.length ? 'Validation' : 'Ready for Approval',
      employeeCount: eligible.length,
      grossPay: roundMoney(totals.grossPay),
      deductions: roundMoney(totals.deductions),
      netPay: roundMoney(totals.netPay),
      createdAt: nowIso(),
      createdBy: 'System',
      approvedAt: null,
      approvedBy: null,
      lockedAt: null,
      postedAt: null,
    };
    runStore.set(run.id, run);
  }
  const exceptions = records
    .filter((record) => record.exceptionCount > 0)
    .flatMap((record) =>
      record.exceptions.map((issue: string, index: number) => ({
        id: `${record.employeeId}-${index}`,
        employeeId: record.employeeId,
        employeeName: record.fullName,
        issue,
        severity: record.riskSeverity,
        owner: issue.includes('Pay amount') || issue.includes('Payroll group') ? 'Payroll Officer' : issue.includes('status') ? 'HR Manager' : 'HR Officer',
      }))
    );

  const visibleRecords = perms.canViewMoney ? records : records.map(maskMoney);

  return {
    generatedAt: nowIso(),
    source: `${employeeSource.source} and payroll setup`,
    dataSource: payrollDataSourceInfo(employeeSource),
    role,
    permissions: perms,
    period,
    periodLabel: periodLabel(period),
    summary: {
      totalEmployees: employeeRows.length,
      payrollEligible: eligible.length,
      readyEmployees: ready.length,
      reviewEmployees: review.length,
      blockedEmployees: blocked.length,
      payrollCoveragePct: employeeRows.length ? Math.round((records.filter((r) => r.setupAssignedToPayroll).length / employeeRows.length) * 1000) / 10 : 0,
      grossPay: roundMoney(totals.grossPay),
      deductions: roundMoney(totals.deductions),
      netPay: roundMoney(totals.netPay),
      basePay: roundMoney(totals.basePay),
      allowances: roundMoney(totals.allowances),
      exceptionCount: exceptions.length,
    },
    runs: Array.from(runStore.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    records: visibleRecords,
    exceptions,
    breakdowns: {
      byPayrollGroup: grouped(records, 'payrollGroup'),
      byDepartment: grouped(records, 'department').slice(0, 12),
      byEmploymentType: grouped(records, 'employmentType'),
    },
    controls: [
      { id: 'master-data', label: 'Master Data Validation', status: blocked.length ? 'Attention Required' : 'Passed', tone: blocked.length ? 'red' : 'green' },
      { id: 'statutory', label: 'PAYE and Pension Estimate', status: 'Calculated', tone: 'blue' },
      { id: 'approval', label: 'Segregated Approval', status: Array.from(runStore.values())[0]?.status || 'Draft', tone: 'violet' },
      { id: 'audit', label: 'Payroll Audit Trail', status: 'Enabled', tone: 'cyan' },
    ],
  };
};

const csv = (records: any[]) => {
  const headers = ['Employee ID', 'Name', 'Department', 'Type', 'Status', 'Payroll Group', 'Grade', 'Currency', 'Gross Pay', 'Deductions', 'Net Pay', 'Payroll Status', 'Exceptions'];
  const lines = records.map((r) =>
    [
      r.employeeId,
      r.fullName,
      r.department,
      r.employmentType,
      r.employmentStatus,
      r.payrollGroup,
      r.salaryGrade,
      r.payCurrency,
      r.grossPay,
      r.deductions,
      r.netPay,
      r.payrollStatus,
      r.exceptions.join('; '),
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
};

export async function GET(request: Request) {
  const payload = await buildPayload(request);
  const url = new URL(request.url);
  if (url.searchParams.get('format') === 'csv') {
    if (!payload.permissions.canExport) return jsonErr(403, 'Permission denied');
    return new Response(csv(payload.records), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="payroll-${payload.period}.csv"`,
      },
    });
  }
  return jsonOk(payload);
}

export async function POST(request: Request) {
  const role = getRole(request);
  const perms = permissions(role);
  const body = await request.json().catch(() => ({}));
  const action = compact(body.action);
  const runId = compact(body.runId) || `payroll-${monthPeriod()}`;
  const existing = runStore.get(runId);

  if (action === 'create-run') {
    if (!perms.canManageRun) return jsonErr(403, 'Permission denied');
    const payload = await buildPayload(request);
    const run: PayrollRun = {
      id: runId,
      period: payload.period,
      status: payload.summary.blockedEmployees ? 'Validation' : 'Ready for Approval',
      employeeCount: payload.summary.payrollEligible,
      grossPay: payload.summary.grossPay,
      deductions: payload.summary.deductions,
      netPay: payload.summary.netPay,
      createdAt: nowIso(),
      createdBy: role,
      approvedAt: null,
      approvedBy: null,
      lockedAt: null,
      postedAt: null,
    };
    runStore.set(run.id, run);
    return jsonOk({ run });
  }

  if (!existing) return jsonErr(404, 'Payroll run not found');
  if (action === 'approve-run') {
    if (!perms.canApprove) return jsonErr(403, 'Permission denied');
    existing.status = 'Approved';
    existing.approvedAt = nowIso();
    existing.approvedBy = role;
    return jsonOk({ run: existing });
  }
  if (action === 'lock-run') {
    if (!perms.canManageRun) return jsonErr(403, 'Permission denied');
    existing.status = 'Locked';
    existing.lockedAt = nowIso();
    return jsonOk({ run: existing });
  }
  if (action === 'post-run') {
    if (!perms.canPost) return jsonErr(403, 'Permission denied');
    existing.status = 'Posted';
    existing.postedAt = nowIso();
    return jsonOk({ run: existing });
  }
  return jsonErr(400, 'Unsupported payroll action');
}
