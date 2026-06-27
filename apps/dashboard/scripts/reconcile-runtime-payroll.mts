/**
 * Per-employee runtime parity check: HRIS profile earnings + Sage-aligned deductions vs Sage snapshot.
 * Unlike reconcile-payroll-deductions.mjs, this uses calculatePayrollEarnings (no Sage payslip lines).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const employeeFilter = args.find((arg) => !arg.startsWith('--'))?.toUpperCase();
const reportMode = args.includes('--report') || !employeeFilter;
const verbose = args.includes('--verbose');
const tolerance = Number(args.find((arg) => arg.startsWith('--tolerance='))?.split('=')[1] || 10);
const period = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] || process.env.HRIS_PAYROLL_ENTERPRISE_FROM || '2026-06';

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* ignore */ }
}

process.chdir(resolve('apps/dashboard'));

const [
  { loadWorkspaceEnv, readEmployeeDirectoryFromDb },
  { applyPayrollEmployeeOptions },
  { calculatePayrollEarnings, calculatePermanentUnionDues, resolvePayrollEarningProfile },
  { activeTaxVersion, calculatePayrollTax, defaultNhfApplicableForEmployee, payrollInputFromEmployee, readPayrollTaxConfig },
  { activePensionVersion, calculatePension, pensionInputFromEmployee, readPayrollPensionConfig },
  { basicFromEarningLines, payeTaxableFromPayrollEarnings },
] = await Promise.all([
  import('@/lib/dle-enterprise-db'),
  import('@/lib/payroll-employee-options-store'),
  import('@/lib/payroll-earnings-engine'),
  import('@/lib/payroll-tax-engine'),
  import('@/lib/payroll-pension-engine'),
  import('@/lib/payroll-sage-pay-rules'),
]);

loadWorkspaceEnv();

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const keyFor = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const normCode = (value: unknown) => {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases: Record<string, string> = {
    SNRHOUSING: 'SNRHOUSE',
    SNRHOU: 'SNRHOUSE',
    SNROTHALL: 'SNROTHERALL',
    SNRTRANSPORT: 'SNRTRANS',
    SNRUTILITIES: 'SNRUTILITY',
    JNRHOUSING: 'JNRHOUSE',
    JNRHOU: 'JNRHOUSE',
    JNROTHALL: 'JNROTHERALL',
    JNRTRANSPORT: 'JNRTRANS',
    JNRUTILITIES: 'JNRUTILITY',
    MGTHOUSING: 'MGTHOUSE',
    MGTOTHALL: 'MGTOTHERALL',
    MGTTRANSPORT: 'MGTTRANS',
    LUMPSUMTAX: 'LUMPSUMBASE',
    BASIC1LUMPSUM: 'LUMPSUMBASE',
    TCMTRNSPT: 'TCMTRANSPORT',
    TCMTRNSPTALT: 'TCMTRANSPORT',
  };
  return aliases[code] || code;
};

const classifyEmployee = (employee: { employeeCode?: string; employmentType?: string; salaryGrade?: string; paymentType?: string }) => {
  const upper = String(employee.employeeCode || '').toUpperCase();
  const text = [employee.employmentType, employee.salaryGrade, employee.paymentType].map((v) => String(v || '').toUpperCase()).join(' ');
  if (/^L\d+/.test(upper) || /\b(LUMPSUM|LUMP SUM)\b/.test(text)) return 'lumpsum';
  if (/^P\d+/.test(upper)) return 'permanent';
  return 'other';
};

const lineMap = (lines: Array<{ code?: string; amount?: number }>) => {
  const map = new Map<string, number>();
  for (const line of lines) {
    const code = normCode(line.code);
    if (!code) continue;
    map.set(code, roundMoney((map.get(code) || 0) + Number(line.amount || 0)));
  }
  return map;
};

const sageTaxableTotal = (lines: Array<{ amount?: number; taxableAmount?: number | null }>) =>
  roundMoney(lines.reduce((sum, line) => {
    const taxableAmount = line.taxableAmount === null || line.taxableAmount === undefined ? Number(line.amount || 0) : Number(line.taxableAmount || 0);
    return sum + taxableAmount;
  }, 0));

const compareLineMaps = (sage: Map<string, number>, hris: Map<string, number>) => {
  const codes = new Set([...sage.keys(), ...hris.keys()]);
  const variances: Array<{ code: string; sage: number; hris: number; delta: number }> = [];
  for (const code of codes) {
    const s = roundMoney(sage.get(code) || 0);
    const h = roundMoney(hris.get(code) || 0);
    const delta = roundMoney(h - s);
    if (Math.abs(delta) > tolerance) variances.push({ code, sage: s, hris: h, delta });
  }
  return variances;
};

type DirectoryEmployee = NonNullable<Awaited<ReturnType<typeof readEmployeeDirectoryFromDb>>>[number];

const inputOnlyEmployee = (employee: DirectoryEmployee): DirectoryEmployee => ({
  ...employee,
  sagePayrollEarnings: undefined,
  sagePayrollDeductions: undefined,
  sagePayrollContributions: undefined,
});

const [taxConfig, pensionConfig] = await Promise.all([readPayrollTaxConfig(), readPayrollPensionConfig()]);
const taxVersion = activeTaxVersion(taxConfig);
const pensionVersion = activePensionVersion(pensionConfig);
if (!taxVersion || !pensionVersion) throw new Error('Missing active tax or pension configuration version.');

const directory = await readEmployeeDirectoryFromDb();
if (!directory?.length) throw new Error('Could not load employee directory from DLE_Enterprise.');

const employees = (await applyPayrollEmployeeOptions(directory))
  .filter((employee) => {
    const category = classifyEmployee(employee);
    if (category !== 'permanent' && category !== 'lumpsum') return false;
    if (!employee.sagePayrollDeductions?.lines?.length) return false;
    if (employeeFilter) {
      const filterKeys = new Set([
        keyFor(employeeFilter),
        keyFor(employeeFilter.replace(/^P/i, '')),
        keyFor(`P${employeeFilter.replace(/^P/i, '')}`),
        keyFor(employeeFilter.replace(/^L/i, '')),
        keyFor(`L${employeeFilter.replace(/^L/i, '')}`),
      ]);
      return [employee.employeeCode, employee.employeeId, employee.sourceEmployeeId].map(keyFor).some((key) => filterKeys.has(key));
    }
    return true;
  });

const calculationOptions = { period, includePeriodAdjustments: true, ignoreSagePayslipLines: true as const };
const results: Array<Record<string, unknown>> = [];

for (const employee of employees) {
  const category = classifyEmployee(employee);
  const runtimeEmployee = inputOnlyEmployee(employee);
  const earnings = calculatePayrollEarnings(runtimeEmployee, calculationOptions);
  const tax = calculatePayrollTax(payrollInputFromEmployee(runtimeEmployee, calculationOptions, earnings), taxVersion);
  const pension = calculatePension(pensionInputFromEmployee(runtimeEmployee, calculationOptions), pensionVersion);
  const union = calculatePermanentUnionDues(runtimeEmployee, calculationOptions);
  const nhfApplicable = category === 'permanent' && defaultNhfApplicableForEmployee(runtimeEmployee);
  const basic = earnings.basicPay || basicFromEarningLines((earnings.paidEarningLines || []) as never);
  const nhf = nhfApplicable ? roundMoney(basic * 0.025) : 0;

  const sageEarningLines = employee.sagePayrollEarnings || [];
  const sageDeductionLines = employee.sagePayrollDeductions?.lines || [];
  const sage = {
    gross: roundMoney(sageEarningLines.reduce((sum, line) => sum + Number(line.amount || 0), 0)),
    taxable: sageTaxableTotal(sageEarningLines),
    paye: roundMoney(sageDeductionLines.filter((line) => /^PAYE$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
    pension: roundMoney(sageDeductionLines.filter((line) => /PENSION/i.test(line.code) && !/ER$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
    nhf: roundMoney(sageDeductionLines.filter((line) => /^NHF$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
    union: roundMoney(sageDeductionLines.filter((line) => /UNION/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
  };
  sage.total = roundMoney(sage.paye + sage.pension + sage.nhf + sage.union);

  const hris = {
    gross: earnings.grossPay,
    taxable: payeTaxableFromPayrollEarnings(runtimeEmployee, earnings),
    paye: tax.monthlyPaye,
    pension: pension.employeeContribution,
    nhf,
    union: union.amount,
  };
  hris.total = roundMoney(hris.paye + hris.pension + hris.nhf + hris.union);

  const earningVariances = compareLineMaps(
    lineMap(sageEarningLines),
    lineMap((earnings.paidEarningLines || earnings.earningLines || []) as Array<{ code: string; amount: number }>),
  );
  const deductionVariance = {
    paye: roundMoney(hris.paye - sage.paye),
    pension: roundMoney(hris.pension - sage.pension),
    nhf: roundMoney(hris.nhf - sage.nhf),
    union: roundMoney(hris.union - sage.union),
    total: roundMoney(hris.total - sage.total),
    gross: roundMoney(hris.gross - sage.gross),
    taxable: roundMoney(hris.taxable - sage.taxable),
  };

  const deductionMatched = ['paye', 'pension', 'nhf', 'union', 'total'].every((key) => Math.abs(Number((deductionVariance as Record<string, number>)[key] || 0)) <= tolerance);
  const earningsMatched = earningVariances.length === 0;
  const matched = deductionMatched && earningsMatched;

  results.push({
    employee: employee.employeeCode,
    category,
    profile: resolvePayrollEarningProfile(runtimeEmployee),
    matched,
    deductionMatched,
    earningsMatched,
    sage,
    hris,
    variance: deductionVariance,
    ...(earningVariances.length ? { earningVariances } : {}),
    ...(verbose || !matched ? { hrisEarningCodes: [...lineMap((earnings.paidEarningLines || []) as Array<{ code: string; amount: number }>).entries()].map(([code, amount]) => ({ code, amount })) } : {}),
  });
}

const permanent = results.filter((row) => row.category === 'permanent');
const lumpsum = results.filter((row) => row.category === 'lumpsum');
const summarize = (items: typeof results) => ({
  checked: items.length,
  matched: items.filter((row) => row.matched).length,
  deductionMatched: items.filter((row) => row.deductionMatched).length,
  earningsMatched: items.filter((row) => row.earningsMatched).length,
  variances: items.filter((row) => !row.matched).length,
  deductionVariances: items.filter((row) => !row.deductionMatched).length,
  mismatchEmployees: items.filter((row) => !row.deductionMatched).map((row) => ({
    employee: row.employee,
    payeVar: (row.variance as { paye: number }).paye,
    totalVar: (row.variance as { total: number }).total,
    earningLineDiffs: Array.isArray(row.earningVariances) ? row.earningVariances.length : 0,
  })),
});

const summary = reportMode
  ? {
      mode: 'runtime-profile-parity-report',
      period,
      tolerance,
      totalChecked: results.length,
      byCategory: { permanent: summarize(permanent), lumpsum: summarize(lumpsum) },
      overall: {
        matched: results.filter((row) => row.matched).length,
        variances: results.filter((row) => !row.matched).length,
        deductionMatched: results.filter((row) => row.deductionMatched).length,
        deductionVariances: results.filter((row) => !row.deductionMatched).length,
      },
      topDeductionVariances: results
        .filter((row) => !row.deductionMatched)
        .sort((a, b) => Math.abs((b.variance as { total: number }).total) - Math.abs((a.variance as { total: number }).total))
        .slice(0, 15),
    }
  : {
      checked: results.length,
      matched: results.filter((row) => row.matched).length,
      variances: results.filter((row) => !row.matched).length,
      ...(employeeFilter && results[0] ? { detail: results[0] } : {}),
    };

console.log(JSON.stringify(summary, null, 2));
process.exitCode = (summary.overall?.deductionVariances ?? summary.deductionVariances ?? 0) > 0 ? 1 : 0;
