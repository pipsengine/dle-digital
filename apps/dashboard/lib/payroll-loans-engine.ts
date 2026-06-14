import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

export type LoanStatus = 'Draft' | 'Active' | 'Retired';
export type LoanProduct = {
  id: string;
  label: string;
  enabled: boolean;
  type: 'Loan' | 'Advance';
  interestRate: number;
  maxPrincipalMultiple: number;
  maxTenorMonths: number;
  repaymentFrequency: string;
  recoveryPriority: number;
  requiresFinanceApproval: boolean;
  requiresGuarantor: boolean;
};
export type LoansVersion = {
  id: string;
  name: string;
  status: LoanStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  basis: string;
  notes: string;
  deductionCapRate: number;
  defaultApprovalWorkflow: string[];
  products: LoanProduct[];
  regulatoryChanges: Array<Record<string, unknown>>;
};
export type LoansConfig = {
  schemaVersion: number;
  country: string;
  jurisdiction: string;
  activeVersionId: string;
  versions: LoansVersion[];
  audit: Array<Record<string, unknown>>;
};
export type LoanInput = {
  employee: DleEmployeeDirectoryRow;
  monthlyBasePay: number;
  monthlyAllowances: number;
  productId: string;
  principal: number;
  outstandingBalance: number;
  tenorMonths: number;
  installmentsPaid: number;
  approvalStatus: 'Draft' | 'Submitted' | 'Approved' | 'Active' | 'Paused' | 'Closed' | 'Rejected';
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const CONFIG_PATH = path.join(resolveDashboardRoot(), 'data', 'hris', 'payroll-loans-config.json');
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();

export const readPayrollLoansConfig = async (): Promise<LoansConfig> => JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as LoansConfig;

export const writePayrollLoansConfig = async (config: LoansConfig, actor: string) => {
  const next = {
    ...config,
    audit: [...(Array.isArray(config.audit) ? config.audit : []), { at: new Date().toISOString(), actor, action: 'Loans and salary advances configuration updated', versionId: config.activeVersionId }],
  };
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
};

export const activeLoansVersion = (config: LoansConfig, asOf = new Date().toISOString()) => {
  const asOfDate = asOf.slice(0, 10);
  return (
    config.versions.find((version) => version.id === config.activeVersionId) ||
    config.versions.filter((version) => version.status === 'Active' && version.effectiveFrom <= asOfDate && (!version.effectiveTo || version.effectiveTo >= asOfDate)).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  );
};

export const payrollAmountFromEmployee = (employee: DleEmployeeDirectoryRow) => {
  const monthlyBasePay = Number(employee.periodSalary || (employee.annualSalary ? Number(employee.annualSalary) / 12 : 0) || 0);
  const type = compact(employee.employmentType).toLowerCase();
  const allowanceRate = type.includes('daily') ? 0.08 : type.includes('lumpsum') ? 0.12 : type.includes('it') || type.includes('nysc') ? 0.04 : 0.22;
  return { monthlyBasePay, monthlyAllowances: monthlyBasePay * allowanceRate, netPayEstimate: (monthlyBasePay * (1 + allowanceRate)) * 0.78 };
};

export const generateLoanInputs = (employees: DleEmployeeDirectoryRow[], version: LoansVersion): LoanInput[] => {
  const enabledProducts = version.products.filter((product) => product.enabled);
  return employees
    .map((employee, index) => {
      if (!enabledProducts.length) return null;
      const amounts = payrollAmountFromEmployee(employee);
      const product = enabledProducts[index % enabledProducts.length];
      const multiple = product.id === 'salary-advance' ? 0.35 : product.id === 'emergency-loan' ? 0.75 : 1.5;
      const principal = Math.min(amounts.monthlyBasePay * multiple, amounts.monthlyBasePay * product.maxPrincipalMultiple);
      const tenorMonths = Math.min(product.maxTenorMonths, product.id === 'salary-advance' ? 2 : product.id === 'emergency-loan' ? 6 : 12);
      const installmentsPaid = index % Math.max(1, tenorMonths);
      const approvalStatus = index % 11 === 0 ? 'Paused' : index % 7 === 0 ? 'Submitted' : index % 5 === 0 ? 'Approved' : 'Active';
      const scheduledPrincipal = principal / Math.max(1, tenorMonths);
      const outstandingBalance = Math.max(0, principal - scheduledPrincipal * installmentsPaid);
      return {
        employee,
        monthlyBasePay: amounts.monthlyBasePay,
        monthlyAllowances: amounts.monthlyAllowances,
        productId: product.id,
        principal: roundMoney(principal),
        outstandingBalance: roundMoney(outstandingBalance),
        tenorMonths,
        installmentsPaid,
        approvalStatus: approvalStatus as LoanInput['approvalStatus'],
      };
    })
    .filter(Boolean) as LoanInput[];
};

export const calculateLoanRecovery = (input: LoanInput, version: LoansVersion) => {
  const product = version.products.find((item) => item.id === input.productId);
  const monthlyGross = roundMoney(Number(input.monthlyBasePay || 0) + Number(input.monthlyAllowances || 0));
  const estimatedNetPay = roundMoney(monthlyGross * 0.78);
  const deductionCap = roundMoney(estimatedNetPay * Number(version.deductionCapRate || 0));
  const remainingMonths = Math.max(1, input.tenorMonths - input.installmentsPaid);
  const interestBalance = roundMoney(input.outstandingBalance * Number(product?.interestRate || 0));
  const scheduledRecovery = roundMoney((input.outstandingBalance + interestBalance) / remainingMonths);
  const payrollRecovery = ['Approved', 'Active'].includes(input.approvalStatus) ? Math.min(scheduledRecovery, deductionCap) : 0;
  const projectedBalanceAfterPayroll = roundMoney(Math.max(0, input.outstandingBalance + interestBalance - payrollRecovery));
  const issues: string[] = [];
  if (!product?.enabled) issues.push('Loan product is disabled or missing');
  if (monthlyGross <= 0) issues.push('Monthly pay amount is missing');
  if (!['Approved', 'Active'].includes(input.approvalStatus)) issues.push('Loan is not approved for payroll recovery');
  if (scheduledRecovery > deductionCap) issues.push('Scheduled recovery exceeds configured affordability cap');
  if (compact(input.employee.status).toLowerCase().match(/terminated|resigned|retired|inactive/)) issues.push('Employee is not payroll active');
  return {
    product,
    monthlyGross,
    estimatedNetPay,
    deductionCap,
    interestBalance,
    scheduledRecovery,
    payrollRecovery: roundMoney(payrollRecovery),
    projectedBalanceAfterPayroll,
    remainingMonths,
    issues,
    status: issues.some((issue) => issue.includes('missing') || issue.includes('not payroll active') || issue.includes('disabled')) ? 'Blocked' : issues.length ? 'Review' : 'Ready',
  };
};
