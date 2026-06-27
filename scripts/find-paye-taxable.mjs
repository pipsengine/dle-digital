/**
 * Brute-find PAYE taxable adjustments for mismatched employees.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

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

const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;
const codes = process.argv.slice(2).map((c) => c.toUpperCase());

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const calcPaye = (monthlyTaxable, monthlyBht, monthlyBasic, nhfApplicable, rentRelief, includePension = true) => {
  const annualTaxable = monthlyTaxable * 12;
  const annualPension = includePension ? roundMoney(monthlyBht * 0.08 * 12) : 0;
  const annualNhf = nhfApplicable ? roundMoney(monthlyBasic * 0.025 * 12) : 0;
  let chargeable = roundMoney(Math.max(0, annualTaxable - annualPension - annualNhf - rentRelief));
  const bands = [{ a: 800000, r: 0 }, { a: 2200000, r: 0.15 }, { a: 9000000, r: 0.18 }, { a: 13000000, r: 0.21 }, { a: 25000000, r: 0.23 }, { a: null, r: 0.25 }];
  let remaining = chargeable, annualPaye = 0;
  for (const band of bands) {
    const t = band.a === null ? remaining : Math.min(remaining, band.a);
    annualPaye += t * band.r;
    remaining = Math.max(0, remaining - t);
    if (remaining <= 0) break;
  }
  return roundMoney(annualPaye / 12);
};

const isBasic = (c) => /BASIC1_LUMPSUM|BASICSALARY|_(BASIC)$|^BASIC$|_BASIC$|COLA_BASIC|MGT_BASIC|SNR_BASIC|JNR_BASIC|LUMPSUMTAX/i.test(String(c || '').toUpperCase());
const isHouse = (c) => /HOUSE|HOUSIN|_HOUS$/i.test(String(c || '').toUpperCase());
const isTrans = (c) => /TRANS/i.test(String(c || '').toUpperCase());

for (const code of codes) {
  const r = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT e.employee_code, ps.salary_grade, ps.sage_earning_lines_json, ps.sage_deduction_lines_json
    FROM [hris].[Employees] e JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
    WHERE e.employee_code = @code
  `);
  const row = r.recordset[0];
  if (!row) continue;
  const earnings = JSON.parse(row.sage_earning_lines_json || '[]');
  const ded = JSON.parse(row.sage_deduction_lines_json || '[]');
  const sagePaye = ded.find((l) => /^PAYE$/i.test(l.code))?.amount || 0;
  const sageNhf = ded.find((l) => /^NHF$/i.test(l.code))?.amount || 0;
  const basic = roundMoney(earnings.filter((l) => isBasic(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0));
  const bht = roundMoney(earnings.filter((l) => isBasic(l.code) || isHouse(l.code) || isTrans(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0));

  const lineTax = (line, mode) => {
    if (mode === 'amount') return Number(line.amount || 0);
    if (mode === 'taxable') return line.taxableAmount != null ? Number(line.taxableAmount) : Number(line.amount || 0);
    if (mode === 'taxablePos') return line.taxableAmount != null && Number(line.taxableAmount) > 0 ? Number(line.taxableAmount) : 0;
    return 0;
  };

  const modes = ['taxablePos', 'taxable', 'amount'];
  const rentReliefs = [0, 266040, 278470, 500000, 521880];
  const nhf = sageNhf > 0;
  const includePension = !/^L/.test(code);

  let best = null;
  for (const mode of modes) {
    const full = roundMoney(earnings.reduce((s, l) => s + lineTax(l, mode), 0));
    for (const rent of rentReliefs) {
      const paye = calcPaye(full, bht, basic, nhf, rent, includePension);
      const diff = Math.abs(paye - sagePaye);
      if (!best || diff < best.diff) best = { mode, rent, full, paye, diff, label: `all lines ${mode} rent=${rent}` };
    }
    for (const line of earnings) {
      const subset = roundMoney(earnings.filter((l) => l.code !== line.code).reduce((s, l) => s + lineTax(l, mode), 0));
      for (const rent of rentReliefs) {
        const paye = calcPaye(subset, bht, basic, nhf, rent, includePension);
        const diff = Math.abs(paye - sagePaye);
        if (diff < best.diff) best = { mode, rent, full: subset, paye, diff, label: `exclude ${line.code} ${mode} rent=${rent}` };
      }
    }
    const excludeRefund = roundMoney(earnings.filter((l) => !/^REFUND$/i.test(l.code)).reduce((s, l) => s + lineTax(l, mode === 'taxablePos' ? 'taxablePos' : mode), 0));
    const includeRefundAmt = roundMoney(earnings.reduce((s, l) => {
      if (/^REFUND$/i.test(l.code)) return s + Number(l.amount || 0);
      return s + lineTax(l, mode);
    }, 0));
    for (const [tax, label] of [[excludeRefund, 'no REFUND'], [includeRefundAmt, 'REFUND as amount']]) {
      for (const rent of rentReliefs) {
        const paye = calcPaye(tax, bht, basic, nhf, rent, includePension);
        const diff = Math.abs(paye - sagePaye);
        if (diff < best.diff) best = { paye, diff, label: `${label} ${mode} rent=${rent}`, full: tax, rent };
      }
    }
  }

  console.log('\n===', code, row.salary_grade, 'sage PAYE', sagePaye, '===');
  // multi-exclusion search
  const taPos = (lines, exclude = new Set()) =>
    roundMoney(lines.filter((l) => !exclude.has(l.code)).reduce((s, l) => s + (Number(l.taxableAmount) > 0 ? Number(l.taxableAmount) : 0), 0));
  const codes = earnings.map((l) => l.code);
  let multiBest = best;
  for (let mask = 0; mask < 1 << Math.min(codes.length, 12); mask++) {
    const ex = new Set(codes.filter((_, i) => mask & (1 << i)));
    for (const rent of [0, 266040, 278470, 500000, 521880]) {
      let mt = taPos(earnings, ex);
      if (mt * 12 < 876960) mt = roundMoney(mt + earnings.filter((l) => /^REFUND$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0));
      const paye = calcPaye(mt, bht, basic, nhf, rent, includePension);
      const diff = Math.abs(paye - sagePaye);
      if (diff < multiBest.diff) multiBest = { paye, diff, rent, mt, exclude: [...ex], label: 'multi-exclude' };
    }
  }

  console.log('best match:', multiBest);
  console.log('lines:', earnings.map((l) => `${l.code}=${l.amount} ta=${l.taxableAmount}`).join(' | '));
}

await pool.close();
