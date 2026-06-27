/**
 * Compare HRIS-computed deductions (Sage-aligned rules) vs migrated Sage snapshot per employee.
 * Uses Sage earning lines from the migration snapshot — validates formula rules, not HRIS profile earnings.
 * For UI/runtime parity use: npm run reconcile:runtime-payroll
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';
import {
  roundMoney,
  basicFromEarningLines,
  bhtFromEarningLines,
  calculatePayeWithReliefs,
  calculateUsdSeniorManagementPaye,
  payeTaxableFromEarningLines,
  lumpsumAnnualRentRelief,
  normalizedGrade,
  resolvePayeRules,
  hrisPayeFromEarnings,
} from './payroll-sage-pay-rules.mjs';

const args = process.argv.slice(2);
const employeeFilter = args.find((arg) => !arg.startsWith('--'))?.toUpperCase();
const reportMode = args.includes('--report') || !employeeFilter;
const tolerance = Number(args.find((arg) => arg.startsWith('--tolerance='))?.split('=')[1] || 10);

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

const keyFor = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const loadPayrollOptions = () => {
  try {
    const raw = readFileSync(resolve('apps/dashboard/data/hris/payroll-employee-options.json'), 'utf8');
    const byKey = new Map();
    for (const option of JSON.parse(raw)) {
      [option.employeeId, option.employeeCode].map(keyFor).filter(Boolean).forEach((key) => byKey.set(key, option));
    }
    return byKey;
  } catch {
    return new Map();
  }
};

const payrollOptions = loadPayrollOptions();
const optionForEmployee = (code) =>
  [code, String(code).replace(/^P/i, ''), String(code).replace(/^L/i, '')].map(keyFor).map((key) => payrollOptions.get(key)).find(Boolean);

const defaultNhfApplicable = (employeeCode, salaryGrade, sageNhf) => {
  const option = optionForEmployee(employeeCode);
  if (typeof option?.nhfApplicable === 'boolean') return option.nhfApplicable;
  if (sageNhf > 0) return true;
  const grade = normalizedGrade(salaryGrade);
  if (grade === 'MGT6' || grade === 'SMGT10') return false;
  if (/^(JS|JNR|JR)/.test(grade)) return true;
  if (/^(SS|SNR|MGT|SMGT|MGTCOLA|EXP)/.test(grade)) return false;
  return false;
};

const resolveUnionRate = (salaryGrade, employmentType, paymentType) => {
  const grade = normalizedGrade(salaryGrade);
  const text = [employmentType, salaryGrade, paymentType].map((v) => String(v || '').toUpperCase()).join(' ');
  if (/^(MGT|SMGT|MGTCOLA|EXP|SNM)/.test(grade) || /\b(MGT|SMGT|MGTCOLA|SENIOR MANAGEMENT)\b/.test(text)) return 0;
  if (/^(JS|JNR|JR)/.test(grade) || /\b(JUNIOR|JNR)\b/.test(text)) return 0.03;
  if (/^(SS|SNR)/.test(grade) || /\b(SENIOR|SNR)\b/.test(text)) return 0.025;
  return 0;
};

const classifyEmployee = (code, employmentType, salaryGrade, paymentType) => {
  const upper = String(code || '').toUpperCase();
  const text = [employmentType, salaryGrade, paymentType].map((v) => String(v || '').toUpperCase()).join(' ');
  if (/^L\d+/.test(upper) || /\b(LUMPSUM|LUMP SUM)\b/.test(text)) return 'lumpsum';
  if (/^P\d+/.test(upper) || /^P/.test(upper)) return 'permanent';
  return 'other';
};

const hrisDeductionsFromEarnings = (earnings, row, category) => {
  const option = optionForEmployee(row.employee_code);
  const payeRules = resolvePayeRules(option);
  const sageNhf = roundMoney(
    JSON.parse(row.sage_deduction_lines_json || '[]')
      .filter((line) => /^NHF$/i.test(line.code))
      .reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );
  const nhfApplicable = category === 'permanent' && defaultNhfApplicable(row.employee_code, row.salary_grade, sageNhf);
  const basic = basicFromEarningLines(earnings);
  const bht = bhtFromEarningLines(earnings);
  const pension = category === 'lumpsum' ? 0 : roundMoney(bht * 0.08);
  const nhf = nhfApplicable ? roundMoney(basic * 0.025) : 0;
  const unionRate = category === 'permanent' ? resolveUnionRate(row.salary_grade, row.employment_type, row.payment_type) : 0;
  const union = unionRate > 0 && basic > 0 ? roundMoney(basic * unionRate) : 0;

  let paye;
  let monthlyTaxable;
  if (Number.isFinite(Number(payeRules?.monthlyPayeOverride))) {
    paye = roundMoney(Number(payeRules.monthlyPayeOverride));
    monthlyTaxable = payeTaxableFromEarningLines(earnings, category, row.salary_grade, payeRules);
  } else {
    const payeResult = hrisPayeFromEarnings({
      earningLines: earnings,
      category,
      salaryGrade: row.salary_grade,
      employeeOption: option,
      nhfApplicable,
      sageNhf,
    });
    paye = payeResult.paye;
    monthlyTaxable = payeResult.monthlyTaxable;
  }

  return {
    paye,
    pension,
    nhf,
    union,
    total: roundMoney(paye + pension + nhf + union),
    monthlyTaxable,
    bht,
    basic,
    nhfApplicable,
  };
};

const sageDeductions = (lines) => ({
  paye: roundMoney(lines.filter((line) => /^PAYE$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
  pension: roundMoney(
    lines.filter((line) => /PENSION/i.test(line.code) && !/ER$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0),
  ),
  nhf: roundMoney(lines.filter((line) => /^NHF$/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
  union: roundMoney(lines.filter((line) => /UNION/i.test(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0)),
  total: roundMoney(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0)),
});

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
});

const filterSql = employeeFilter
  ? `AND REPLACE(UPPER(e.employee_code), 'P', '') = REPLACE('${employeeFilter.replace(/'/g, "''")}', 'P', '')`
  : '';

const rows = await pool.request().query(`
  SELECT e.employee_code, e.full_name, e.employment_type, ps.salary_grade, ps.payment_type,
    ps.sage_earning_lines_json, ps.sage_deduction_lines_json
  FROM [hris].[Employees] e
  INNER JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE ps.sage_deduction_lines_json IS NOT NULL
    AND LEN(LTRIM(RTRIM(ps.sage_deduction_lines_json))) > 2
    ${filterSql}
  ORDER BY e.employee_code
`);

const results = [];
for (const row of rows.recordset) {
  const category = classifyEmployee(row.employee_code, row.employment_type, row.salary_grade, row.payment_type);
  if (category !== 'permanent' && category !== 'lumpsum') continue;
  const earnings = JSON.parse(row.sage_earning_lines_json || '[]');
  const sage = sageDeductions(JSON.parse(row.sage_deduction_lines_json || '[]'));
  const hris = hrisDeductionsFromEarnings(earnings, row, category);
  const variance = {
    paye: roundMoney(hris.paye - sage.paye),
    pension: roundMoney(hris.pension - sage.pension),
    nhf: roundMoney(hris.nhf - sage.nhf),
    union: roundMoney(hris.union - sage.union),
    total: roundMoney(hris.total - sage.total),
  };
  results.push({
    employee: row.employee_code,
    category,
    matched: Object.values(variance).every((value) => Math.abs(value) <= tolerance),
    sage,
    hris,
    variance,
  });
}

await pool.close();

const permanent = results.filter((row) => row.category === 'permanent');
const lumpsum = results.filter((row) => row.category === 'lumpsum');
const summarize = (items) => ({
  checked: items.length,
  matched: items.filter((row) => row.matched).length,
  variances: items.filter((row) => !row.matched).length,
  mismatchEmployees: items.filter((row) => !row.matched).map((row) => ({ employee: row.employee, totalVar: row.variance.total })),
});

const summary = reportMode
  ? {
      mode: 'individual-check-report',
      tolerance,
      totalChecked: results.length,
      byCategory: { permanent: summarize(permanent), lumpsum: summarize(lumpsum) },
      overall: {
        matched: results.filter((row) => row.matched).length,
        variances: results.filter((row) => !row.matched).length,
      },
    }
  : {
      checked: results.length,
      matched: results.filter((row) => row.matched).length,
      variances: results.filter((row) => !row.matched).length,
      ...(employeeFilter && results[0] ? { detail: results[0] } : {}),
    };

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.variances > 0 ? 1 : 0;
