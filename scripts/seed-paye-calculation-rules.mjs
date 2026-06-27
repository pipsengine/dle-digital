/**
 * Seed payeCalculation overrides only when full Sage-aligned deductions still mismatch.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
  hrisPayeFromEarnings,
} from './payroll-sage-pay-rules.mjs';

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
  } catch {}
}

const tolerance = 10;
const optionsPath = resolve('apps/dashboard/data/hris/payroll-employee-options.json');
const keyFor = (v) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const options = JSON.parse(readFileSync(optionsPath, 'utf8'));
const byKey = new Map();
for (const option of options) {
  [option.employeeId, option.employeeCode].map(keyFor).filter(Boolean).forEach((key) => byKey.set(key, option));
}
const optionFor = (code) =>
  [code, String(code).replace(/^P/i, ''), String(code).replace(/^L/i, '')].map(keyFor).map((k) => byKey.get(k)).find(Boolean);

const classify = (code, grade, paymentType) => {
  const upper = String(code || '').toUpperCase();
  const text = [grade, paymentType].map((v) => String(v || '').toUpperCase()).join(' ');
  if (/^L/.test(upper) || /LUMPSUM/.test(text)) return 'lumpsum';
  return 'permanent';
};

const defaultNhf = (code, grade, sageNhf, option) => {
  if (typeof option?.nhfApplicable === 'boolean') return option.nhfApplicable;
  if (sageNhf > 0) return true;
  const g = normalizedGrade(grade);
  if (g === 'MGT6' || g === 'SMGT10') return false;
  if (/^(JS|JNR|JR)/.test(g)) return true;
  if (/^(SS|SNR|MGT|SMGT|MGTCOLA|EXP)/.test(g)) return false;
  return false;
};

const unionRate = (grade, employmentType, paymentType) => {
  const g = normalizedGrade(grade);
  const text = [employmentType, grade, paymentType].map((v) => String(v || '').toUpperCase()).join(' ');
  if (/^(MGT|SMGT|MGTCOLA|EXP|SNM)/.test(g) || /\b(MGT|SMGT|MGTCOLA|SENIOR MANAGEMENT)\b/.test(text)) return 0;
  if (/^(JS|JNR|JR)/.test(g) || /\b(JUNIOR|JNR)\b/.test(text)) return 0.03;
  if (/^(SS|SNR)/.test(g) || /\b(SENIOR|SNR)\b/.test(text)) return 0.025;
  return 0;
};

const fullDeductions = (row, earnings, sage, option, payeRules = null) => {
  const category = classify(row.employee_code, row.salary_grade, row.payment_type);
  const nhfApplicable = category === 'permanent' && defaultNhf(row.employee_code, row.salary_grade, sage.nhf, option);
  const basic = basicFromEarningLines(earnings);
  const bht = bhtFromEarningLines(earnings);
  const pension = category === 'lumpsum' ? 0 : roundMoney(bht * 0.08);
  const nhf = nhfApplicable ? roundMoney(basic * 0.025) : 0;
  const union =
    category === 'permanent' && unionRate(row.salary_grade, row.employment_type, row.payment_type) > 0
      ? roundMoney(basic * unionRate(row.salary_grade, row.employment_type, row.payment_type))
      : 0;

  const optionWithRules = payeRules ? { ...(option || {}), payeCalculation: payeRules } : option;
  const payeResult = hrisPayeFromEarnings({
    earningLines: earnings,
    category,
    salaryGrade: row.salary_grade,
    employeeOption: optionWithRules,
    nhfApplicable,
  });

  return {
    paye: payeResult.paye,
    pension,
    nhf,
    union,
    total: roundMoney(payeResult.paye + pension + nhf + union),
  };
};

const findBestRules = (row, earnings, sage, option) => {
  const category = classify(row.employee_code, row.salary_grade, row.payment_type);
  const basic = basicFromEarningLines(earnings);
  const bht = bhtFromEarningLines(earnings);
  const nhfApplicable = defaultNhf(row.employee_code, row.salary_grade, sage.nhf, option);
  const codes = earnings.map((l) => l.code);
  let best = { diff: 1e9, rules: null };

  const taPos = (ex = new Set(), addRefund = false) => {
    let mt = roundMoney(
      earnings.filter((l) => !ex.has(l.code)).reduce((s, l) => s + (Number(l.taxableAmount) > 0 ? Number(l.taxableAmount) : 0), 0),
    );
    if (addRefund || (category === 'lumpsum' && mt * 12 <= 876960)) {
      mt = roundMoney(mt + earnings.filter((l) => /^REFUND$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0));
    }
    return mt;
  };

  for (let mask = 0; mask < 1 << codes.length; mask++) {
    const ex = new Set(codes.filter((_, i) => mask & (1 << i)));
    for (const addRefund of [false, true]) {
      for (const pen of [true, false]) {
        for (const usdRate of [0.208, 0.212, 0.216, 0.2164, 0.22]) {
          const rents = category === 'lumpsum'
            ? [lumpsumAnnualRentRelief(taPos(ex, addRefund)), 500000, 0]
            : [0, 250000, 400000, 500000, 521880];
          for (const rent of [...new Set(rents)]) {
            const mt = taPos(ex, addRefund);
            const grade = normalizedGrade(row.salary_grade);
            let paye;
            if (/^EXP_USD|EXP_USDSNMGT|USD SENIOR/i.test(grade)) paye = calculateUsdSeniorManagementPaye(mt, usdRate);
            else {
              paye = calculatePayeWithReliefs({
                monthlyTaxable: mt,
                monthlyBht: bht,
                monthlyBasic: basic,
                nhfApplicable: category === 'permanent' && nhfApplicable,
                rentRelief: rent,
                includePensionRelief: category === 'permanent' && pen,
              });
            }
            const pension = category === 'lumpsum' ? 0 : roundMoney(bht * 0.08);
            const nhf = nhfApplicable ? roundMoney(basic * 0.025) : 0;
            const union =
              category === 'permanent' && unionRate(row.salary_grade, row.employment_type, row.payment_type) > 0
                ? roundMoney(basic * unionRate(row.salary_grade, row.employment_type, row.payment_type))
                : 0;
            const total = roundMoney(paye + pension + nhf + union);
            const diff = Math.abs(total - sage.total);
            if (diff < best.diff) {
              best = {
                diff,
                rules: {
                  excludedEarningCodes: [...ex],
                  includeRefundInTaxable: addRefund,
                  disablePensionPayeRelief: !pen,
                  annualRentRelief: rent,
                  ...( /^EXP_USD|EXP_USDSNMGT|USD SENIOR/i.test(grade) ? { usdFlatRate: usdRate } : {}),
                },
              };
            }
          }
        }
      }
    }
  }

  if (best.diff > tolerance) best.rules = { ...(best.rules || {}), monthlyPayeOverride: sage.paye };
  return best;
};

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const rows = await pool.request().query(`
  SELECT e.employee_code, e.employment_type, ps.salary_grade, ps.payment_type, ps.sage_earning_lines_json, ps.sage_deduction_lines_json
  FROM [hris].[Employees] e
  JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE ps.sage_deduction_lines_json IS NOT NULL AND (e.employee_code LIKE 'P%' OR e.employee_code LIKE 'L%')
`);

const seeded = [];
for (const row of rows.recordset) {
  const earnings = JSON.parse(row.sage_earning_lines_json || '[]');
  const dedLines = JSON.parse(row.sage_deduction_lines_json || '[]');
  const sage = {
    paye: roundMoney(dedLines.filter((l) => /^PAYE$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0)),
    pension: roundMoney(dedLines.filter((l) => /PENSION/i.test(l.code) && !/ER$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0)),
    nhf: roundMoney(dedLines.filter((l) => /^NHF$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0)),
    union: roundMoney(dedLines.filter((l) => /UNION/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0)),
    total: roundMoney(dedLines.reduce((s, l) => s + Number(l.amount || 0), 0)),
  };
  const option = optionFor(row.employee_code) || {};
  const computed = fullDeductions(row, earnings, sage, option);
  if (Math.abs(computed.total - sage.total) <= tolerance) {
    if (option.payeCalculation) {
      delete option.payeCalculation;
    }
    continue;
  }

  const best = findBestRules(row, earnings, sage, option);
  const withRules = fullDeductions(row, earnings, sage, option, best.rules);
  if (Math.abs(withRules.total - sage.total) > tolerance && !best.rules?.monthlyPayeOverride) continue;

  let target = optionFor(row.employee_code);
  if (!target) {
    target = { employeeId: String(row.employee_code).replace(/^P/i, '').replace(/^L/i, ''), employeeCode: row.employee_code };
    options.push(target);
    [target.employeeId, target.employeeCode].map(keyFor).filter(Boolean).forEach((k) => byKey.set(k, target));
  }
  target.payeCalculation = best.rules;
  target.updatedAt = new Date().toISOString();
  target.updatedBy = 'Sage PAYE rules seed';
  seeded.push({ employee: row.employee_code, diff: Math.abs(withRules.total - sage.total), rules: best.rules });
}

writeFileSync(optionsPath, `${JSON.stringify(options.sort((a, b) => keyFor(a.employeeId).localeCompare(keyFor(b.employeeId))), null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ seeded: seeded.length, items: seeded }, null, 2));
await pool.close();
