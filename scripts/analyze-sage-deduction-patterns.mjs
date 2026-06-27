/**
 * Analyze Sage migration snapshot patterns for NHF/union/PAYE by grade and category.
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

const parseLines = (json) => {
  try {
    return JSON.parse(json || '[]');
  } catch {
    return [];
  }
};
const lineAmt = (lines, pattern) =>
  lines.filter((line) => pattern.test(String(line.code || ''))).reduce((sum, line) => sum + Number(line.amount || 0), 0);

const classify = (code) => {
  const upper = String(code || '').toUpperCase();
  if (/^P/.test(upper)) return 'permanent';
  if (/^L/.test(upper)) return 'lumpsum';
  return 'other';
};

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

const rows = await pool.request().query(`
  SELECT e.employee_code, e.full_name, ps.salary_grade, ps.payment_type, ps.sage_deduction_lines_json, ps.sage_earning_lines_json
  FROM [hris].[Employees] e
  JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE ps.sage_deduction_lines_json IS NOT NULL
    AND LEN(LTRIM(RTRIM(ps.sage_deduction_lines_json))) > 2
  ORDER BY e.employee_code
`);

const byGrade = {};
const samples = { nhfZeroSenior: [], unionFormula: [], lumpsumPayeOnly: [] };

for (const row of rows.recordset) {
  const cat = classify(row.employee_code);
  if (cat === 'other') continue;
  const grade = String(row.salary_grade || 'UNKNOWN').toUpperCase();
  const ded = parseLines(row.sage_deduction_lines_json);
  const earn = parseLines(row.sage_earning_lines_json);
  const nhf = lineAmt(ded, /^NHF$/i);
  const union = lineAmt(ded, /UNION/i);
  const paye = lineAmt(ded, /^PAYE$/i);
  const pension = lineAmt(ded, /PENSION/i);
  const basic = lineAmt(earn, /_(BASIC)$|^BASIC$|^BASIC1_LUMPSUM/i);

  const key = `${cat}|${grade}`;
  if (!byGrade[key]) byGrade[key] = { count: 0, nhfZero: 0, unionZero: 0, codes: new Set() };
  byGrade[key].count++;
  if (nhf <= 0) byGrade[key].nhfZero++;
  if (union <= 0) byGrade[key].unionZero++;
  ded.forEach((line) => byGrade[key].codes.add(String(line.code || '')));

  if (cat === 'permanent' && nhf <= 0 && /^SS|^MGT|^SMGT/.test(grade) && samples.nhfZeroSenior.length < 8) {
    samples.nhfZeroSenior.push({ employee: row.employee_code, grade, paye, pension, union, basic });
  }
  if (cat === 'permanent' && union > 0 && basic > 0 && samples.unionFormula.length < 5) {
    samples.unionFormula.push({
      employee: row.employee_code,
      grade,
      basic,
      union,
      pctOfBasic: Math.round((union / basic) * 10000) / 100,
    });
  }
  if (cat === 'lumpsum' && samples.lumpsumPayeOnly.length < 5) {
    samples.lumpsumPayeOnly.push({
      employee: row.employee_code,
      paye,
      pension,
      nhf,
      union,
      gross: earn.reduce((s, l) => s + Number(l.amount || 0), 0),
    });
  }
}

const summary = Object.entries(byGrade)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => ({
    key,
    count: value.count,
    nhfZeroPct: Math.round((value.nhfZero / value.count) * 100),
    unionZeroPct: Math.round((value.unionZero / value.count) * 100),
    deductionCodes: [...value.codes].sort(),
  }));

console.log(JSON.stringify({ summary, samples }, null, 2));
await pool.close();
