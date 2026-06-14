import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';
import { activeTaxVersion, calculatePayrollTax, payrollInputFromEmployee, readPayrollTaxConfig } from '@/lib/payroll-tax-engine';
import { activePensionVersion, calculatePension, pensionInputFromEmployee, readPayrollPensionConfig } from '@/lib/payroll-pension-engine';
import { activeStatutoryFundsVersion, calculateStatutoryFunds, readStatutoryFundsConfig, statutoryFundInputFromEmployee } from '@/lib/payroll-statutory-funds-engine';
import { activeLoansVersion, calculateLoanRecovery, generateLoanInputs, readPayrollLoansConfig } from '@/lib/payroll-loans-engine';

type Role = 'Super Admin' | 'HR Director' | 'HR Manager' | 'Payroll Officer' | 'Finance Controller' | 'Executive Management' | 'Auditor' | 'Employee';
type PayslipStatus = 'Ready' | 'Review' | 'Blocked';
type DeliveryStatus = 'Draft' | 'Generated' | 'Released' | 'Withheld';

type PayslipBatch = {
  id: string;
  period: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: Role;
  employeeCount: number;
  releasedCount: number;
  withheldCount: number;
  netPay: number;
  grossPay: number;
  status: 'Generated' | 'Released' | 'Partial';
  audit: Array<{ at: string; actor: Role; action: string; note?: string }>;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const compact = (value: unknown) => String(value || '').trim();
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const activeEmployee = (employee: DleEmployeeDirectoryRow) => !compact(employee.status).toLowerCase().match(/terminated|resigned|retired|inactive|deceased/);

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const BATCH_PATH = path.join(resolveDashboardRoot(), 'data', 'hris', 'payslip-generation-batches.json');

const getRole = (request: Request): Role => {
  const value = request.headers.get('x-hris-role');
  const roles: Role[] = ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor', 'Employee'];
  return roles.includes(value as Role) ? (value as Role) : 'Payroll Officer';
};

const permissions = (role: Role) => ({
  canViewMoney: ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor'].includes(role),
  canGenerate: ['Super Admin', 'Payroll Officer', 'Finance Controller', 'HR Director'].includes(role),
  canRelease: ['Super Admin', 'Finance Controller', 'HR Director'].includes(role),
  canExport: role !== 'Employee',
});

const monthPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const periodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const readBatches = async (): Promise<PayslipBatch[]> => {
  try {
    const parsed = JSON.parse(await readFile(BATCH_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeBatches = async (batches: PayslipBatch[]) => {
  await mkdir(path.dirname(BATCH_PATH), { recursive: true });
  await writeFile(BATCH_PATH, JSON.stringify(batches, null, 2), 'utf8');
};

const payrollAmounts = (employee: DleEmployeeDirectoryRow) => {
  const basic = Number(employee.periodSalary || (employee.annualSalary ? Number(employee.annualSalary) / 12 : 0) || 0);
  const type = compact(employee.employmentType).toLowerCase();
  const allowanceRate = type.includes('daily') ? 0.08 : type.includes('lumpsum') ? 0.12 : type.includes('it') || type.includes('nysc') ? 0.04 : 0.22;
  const allowances = basic * allowanceRate;
  return { basic: roundMoney(basic), allowances: roundMoney(allowances), grossPay: roundMoney(basic + allowances) };
};

const statusFrom = (issues: string[]): PayslipStatus => {
  if (issues.some((issue) => /missing|not payroll active|zero/i.test(issue))) return 'Blocked';
  return issues.length ? 'Review' : 'Ready';
};

const buildPayload = async (request: Request, requestedPeriod = monthPeriod()) => {
  const role = getRole(request);
  const perms = permissions(role);
  const [employeeSource, taxConfig, pensionConfig, fundsConfig, loansConfig, batches] = await Promise.all([
    readPayrollEmployees(),
    readPayrollTaxConfig(),
    readPayrollPensionConfig(),
    readStatutoryFundsConfig(),
    readPayrollLoansConfig(),
    readBatches(),
  ]);
  const taxVersion = activeTaxVersion(taxConfig);
  const pensionVersion = activePensionVersion(pensionConfig);
  const fundsVersion = activeStatutoryFundsVersion(fundsConfig);
  const loansVersion = activeLoansVersion(loansConfig);
  if (!taxVersion || !pensionVersion || !fundsVersion || !loansVersion) throw new Error('One or more payroll configuration versions are missing.');

  const currentBatch = batches.find((batch) => batch.period === requestedPeriod) || null;
  const loanInputs = new Map(generateLoanInputs(employeeSource.employees, loansVersion).map((input) => [input.employee.employeeId, input]));
  const payslips = employeeSource.employees.map((employee) => {
    const amounts = payrollAmounts(employee);
    const tax = calculatePayrollTax(payrollInputFromEmployee(employee), taxVersion);
    const pension = calculatePension(pensionInputFromEmployee(employee), pensionVersion);
    const funds = calculateStatutoryFunds(statutoryFundInputFromEmployee(employee, employeeSource.employees.length), fundsVersion);
    const loanInput = loanInputs.get(employee.employeeId);
    const loan = loanInput ? calculateLoanRecovery(loanInput, loansVersion) : null;
    const paye = roundMoney(tax.monthlyPaye);
    const pensionEmployee = roundMoney(pension.employeeContribution);
    const statutoryEmployee = roundMoney(funds.employeeDeductions);
    const loanRecovery = roundMoney(loan?.payrollRecovery || 0);
    const totalDeductions = roundMoney(paye + pensionEmployee + statutoryEmployee + loanRecovery);
    const netPay = roundMoney(Math.max(0, amounts.grossPay - totalDeductions));
    const issues = [
      ...amounts.grossPay <= 0 ? ['Gross pay is missing'] : [],
      ...netPay <= 0 && amounts.grossPay > 0 ? ['Net pay is zero after deductions'] : [],
      ...!employee.setupAssignedToPayroll ? ['Payroll setup is not assigned'] : [],
      ...!compact(employee.payrollGroup) ? ['Payroll group is missing'] : [],
      ...!activeEmployee(employee) ? ['Employee is not payroll active'] : [],
      ...pension.issues.filter((issue) => issue.includes('missing') || issue.includes('not payroll active')).map((issue) => `Pension: ${issue}`),
      ...funds.issues.map((issue) => `Statutory: ${issue}`),
      ...loan?.issues.filter((issue) => issue.includes('missing') || issue.includes('disabled')).map((issue) => `Loan: ${issue}`) || [],
    ];
    const status = statusFrom(issues);
    const deliveryStatus: DeliveryStatus = currentBatch?.status === 'Released' && status !== 'Blocked' ? 'Released' : currentBatch ? status === 'Blocked' ? 'Withheld' : 'Generated' : 'Draft';
    return {
      payslipId: `PS-${requestedPeriod}-${employee.employeeId}`,
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      department: employee.department,
      businessUnit: employee.businessUnit,
      location: employee.location,
      payrollGroup: employee.payrollGroup || 'Unassigned',
      salaryGrade: employee.salaryGrade || employee.jobGrade || 'Unassigned',
      payCurrency: employee.payCurrency || 'NGN',
      paymentRun: employee.paymentRun || 'Monthly',
      bankName: 'Configured in payroll bank setup',
      maskedAccount: '**** ****',
      period: requestedPeriod,
      periodLabel: periodLabel(requestedPeriod),
      earnings: [
        { label: 'Basic Salary', amount: amounts.basic },
        { label: 'Allowances', amount: amounts.allowances },
      ],
      deductions: [
        { label: 'PAYE', amount: paye },
        { label: 'Pension', amount: pensionEmployee },
        { label: 'NHF / Statutory', amount: statutoryEmployee },
        { label: 'Loan / Salary Advance', amount: loanRecovery },
      ].filter((item) => item.amount > 0),
      employerContributions: [
        { label: 'Employer Pension', amount: roundMoney(pension.employerContribution) },
        { label: 'Employer Statutory Funds', amount: roundMoney(funds.employerCosts) },
      ].filter((item) => item.amount > 0),
      grossPay: amounts.grossPay,
      totalDeductions,
      netPay,
      ytdGross: roundMoney(amounts.grossPay * Number(requestedPeriod.slice(5, 7))),
      ytdPaye: roundMoney(paye * Number(requestedPeriod.slice(5, 7))),
      ytdNet: roundMoney(netPay * Number(requestedPeriod.slice(5, 7))),
      status,
      deliveryStatus,
      issues,
    };
  });

  const totals = payslips.reduce(
    (sum, slip) => ({
      grossPay: sum.grossPay + slip.grossPay,
      deductions: sum.deductions + slip.totalDeductions,
      netPay: sum.netPay + slip.netPay,
      ready: sum.ready + (slip.status === 'Ready' ? 1 : 0),
      review: sum.review + (slip.status === 'Review' ? 1 : 0),
      blocked: sum.blocked + (slip.status === 'Blocked' ? 1 : 0),
      released: sum.released + (slip.deliveryStatus === 'Released' ? 1 : 0),
      withheld: sum.withheld + (slip.deliveryStatus === 'Withheld' ? 1 : 0),
      exceptions: sum.exceptions + slip.issues.length,
    }),
    { grossPay: 0, deductions: 0, netPay: 0, ready: 0, review: 0, blocked: 0, released: 0, withheld: 0, exceptions: 0 }
  );

  const maskedPayslips = payslips.map((slip) => ({
    ...slip,
    earnings: slip.earnings.map((item) => ({ ...item, amount: null })),
    deductions: slip.deductions.map((item) => ({ ...item, amount: null })),
    employerContributions: slip.employerContributions.map((item) => ({ ...item, amount: null })),
    grossPay: null,
    totalDeductions: null,
    netPay: null,
    ytdGross: null,
    ytdPaye: null,
    ytdNet: null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: 'DLE payslip generation engine',
    dataSource: payrollDataSourceInfo(employeeSource),
    company: {
      name: 'Dorman Long Engineering Limited',
      address: '12/14 Agege Motor Road, Idi-Oro, Mushin, Lagos, Nigeria',
      logoUrl: '/brand/dorman-long-logo.jpg',
      email: 'hrpayroll@dormanlongeng.com',
      website: 'www.dormanlongeng.com',
    },
    period: requestedPeriod,
    periodLabel: periodLabel(requestedPeriod),
    role,
    permissions: perms,
    batch: currentBatch,
    batches: batches.slice(0, 12),
    summary: {
      employees: payslips.length,
      grossPay: perms.canViewMoney ? roundMoney(totals.grossPay) : null,
      deductions: perms.canViewMoney ? roundMoney(totals.deductions) : null,
      netPay: perms.canViewMoney ? roundMoney(totals.netPay) : null,
      ready: totals.ready,
      review: totals.review,
      blocked: totals.blocked,
      released: totals.released,
      withheld: totals.withheld,
      exceptionCount: totals.exceptions,
    },
    payslips: perms.canViewMoney ? payslips : maskedPayslips,
  };
};

const csv = (records: any[]) => {
  const headers = ['Payslip ID', 'Employee ID', 'Name', 'Department', 'Payroll Group', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'Delivery', 'Issues'];
  const lines = records.map((record) =>
    [record.payslipId, record.employeeId, record.fullName, record.department, record.payrollGroup, record.grossPay, record.totalDeductions, record.netPay, record.status, record.deliveryStatus, record.issues.join('; ')]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || monthPeriod();
    const payload = await buildPayload(request, period);
    if (url.searchParams.get('format') === 'csv') {
      if (!payload.permissions.canExport) return err(403, 'Permission denied');
      return new Response(csv(payload.payslips), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="payslips-${period}.csv"`,
        },
      });
    }
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load payslip generation.');
  }
}

export async function POST(request: Request) {
  try {
    const role = getRole(request);
    const perms = permissions(role);
    const body = await request.json().catch(() => ({}));
    const action = compact(body.action);
    const period = compact(body.period) || monthPeriod();
    if (!perms.canGenerate) return err(403, 'Permission denied');
    const payload = await buildPayload(request, period);
    if (action === 'release' && !perms.canRelease) return err(403, 'Release permission denied');

    const batches = await readBatches();
    const existing = batches.find((batch) => batch.period === period);
    const now = new Date().toISOString();
    const status = action === 'release' ? (payload.summary.blocked > 0 ? 'Partial' : 'Released') : 'Generated';
    const releasedCount = action === 'release' ? payload.summary.employees - payload.summary.blocked : existing?.releasedCount || 0;
    const withheldCount = action === 'release' ? payload.summary.blocked : existing?.withheldCount || 0;
    const batch: PayslipBatch = {
      id: existing?.id || `payslip-batch-${period}-${Date.now()}`,
      period,
      periodLabel: payload.periodLabel,
      generatedAt: existing?.generatedAt || now,
      generatedBy: existing?.generatedBy || role,
      employeeCount: payload.summary.employees,
      releasedCount,
      withheldCount,
      grossPay: Number(payload.summary.grossPay || 0),
      netPay: Number(payload.summary.netPay || 0),
      status,
      audit: [
        ...(existing?.audit || []),
        { at: now, actor: role, action: action || 'generate', note: compact(body.note) || undefined },
      ],
    };
    await writeBatches([batch, ...batches.filter((item) => item.period !== period)].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)));
    return ok({ batch });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to update payslip batch.');
  }
}
