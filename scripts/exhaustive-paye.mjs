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
const code = process.argv[2]?.toUpperCase();
const calcPaye = (mt, bht, basic, nhf, rent, pen = true) => {
  let c = Math.max(0, mt * 12 - (pen ? bht * 0.08 * 12 : 0) - (nhf ? basic * 0.025 * 12 : 0) - rent);
  const bands = [{ a: 800000, r: 0 }, { a: 2200000, r: 0.15 }, { a: 9000000, r: 0.18 }, { a: 13000000, r: 0.21 }, { a: 25000000, r: 0.23 }, { a: null, r: 0.25 }];
  let rem = c, p = 0;
  for (const b of bands) {
    const t = b.a === null ? rem : Math.min(rem, b.a);
    p += t * b.r;
    rem = Math.max(0, rem - t);
    if (!rem) break;
  }
  return roundMoney(p / 12);
};

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const r = await pool.request().input('c', sql.NVarChar, code).query(`
  SELECT ps.sage_earning_lines_json, ps.sage_deduction_lines_json FROM hris.Employees e
  JOIN hris.EmployeePayrollSetup ps ON ps.employee_id=e.employee_id WHERE e.employee_code=@c
`);
const earnings = JSON.parse(r.recordset[0].sage_earning_lines_json);
const sagePaye = JSON.parse(r.recordset[0].sage_deduction_lines_json).find((l) => /^PAYE$/i.test(l.code))?.amount;
const isB = (c) => /BASIC|BASICSALARY|COLA_BASIC|MGT_BASIC|SNR_BASIC/i.test(c);
const isH = (c) => /HOUSE|HOUSIN|_HOUS/i.test(c);
const isT = (c) => /TRANS/i.test(c);
const basic = roundMoney(earnings.filter((l) => isB(l.code)).reduce((s, l) => s + Number(l.amount), 0));
const bht = roundMoney(earnings.filter((l) => isB(l.code) || isH(l.code) || isT(l.code)).reduce((s, l) => s + Number(l.amount), 0));
const sageNhf = JSON.parse(r.recordset[0].sage_deduction_lines_json).find((l) => /^NHF$/i.test(l.code))?.amount || 0;

const taPos = (ex = new Set(), addRefund = false) => {
  let mt = roundMoney(earnings.filter((l) => !ex.has(l.code)).reduce((s, l) => s + (Number(l.taxableAmount) > 0 ? Number(l.taxableAmount) : 0), 0));
  if (addRefund) mt = roundMoney(mt + earnings.filter((l) => /^REFUND$/i.test(l.code)).reduce((s, l) => s + Number(l.amount || 0), 0));
  return mt;
};

const codes = earnings.map((l) => l.code);
let best = { diff: 1e9 };
for (let mask = 0; mask < 1 << codes.length; mask++) {
  const ex = new Set(codes.filter((_, i) => mask & (1 << i)));
  for (const addRefund of [false, true]) {
    for (const rent of [0, 250000, 266040, 278470, 400000, 500000, 521880]) {
      for (const pen of [true, false]) {
        const mt = taPos(ex, addRefund);
        const paye = calcPaye(mt, bht, basic, sageNhf > 0, rent, pen);
        const diff = Math.abs(paye - sagePaye);
        if (diff < best.diff) best = { paye, sagePaye, diff, ex: [...ex], addRefund, rent, pen, mt };
      }
    }
  }
}
console.log(JSON.stringify(best, null, 2));
await pool.close();
