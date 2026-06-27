/**
 * Sync nhfApplicable from Sage migration snapshots into payroll-employee-options.json.
 * One-time cutover seed — HRIS uses these flags at runtime, not Sage.
 *
 * Usage: node scripts/sync-nhf-from-sage-snapshot.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

const dryRun = process.argv.includes('--dry-run');

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

const optionsPath = resolve('apps/dashboard/data/hris/payroll-employee-options.json');
const keyFor = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const parseLines = (json) => {
  try {
    return JSON.parse(json || '[]');
  } catch {
    return [];
  }
};
const nhfFromSage = (lines) =>
  parseLines(lines).filter((line) => /^NHF$/i.test(String(line.code || ''))).reduce((sum, line) => sum + Number(line.amount || 0), 0);

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
  SELECT e.employee_code, ps.sage_deduction_lines_json
  FROM [hris].[Employees] e
  JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE ps.sage_deduction_lines_json IS NOT NULL
    AND (e.employee_code LIKE 'P%' OR e.employee_code LIKE 'L%')
  ORDER BY e.employee_code
`);
await pool.close();

const existing = JSON.parse(readFileSync(optionsPath, 'utf8'));
const byKey = new Map();
for (const option of existing) {
  [option.employeeId, option.employeeCode].map(keyFor).filter(Boolean).forEach((key) => byKey.set(key, { ...option }));
}

let updated = 0;
let created = 0;
const changes = [];

for (const row of rows.recordset) {
  const code = String(row.employee_code || '').trim();
  const nhfApplicable = nhfFromSage(row.sage_deduction_lines_json) > 0;
  const keys = [code, code.replace(/^P/i, ''), code.replace(/^L/i, '')].map(keyFor).filter(Boolean);
  const existingOption = keys.map((key) => byKey.get(key)).find(Boolean);
  const normalizedCode = code.replace(/^P/i, '').replace(/^L/i, '');
  const employeeId = /^L/i.test(code) ? code : normalizedCode;

  if (existingOption && existingOption.nhfApplicable === nhfApplicable) continue;

  const nextOption = {
    ...(existingOption || {}),
    employeeId: existingOption?.employeeId || employeeId,
    employeeCode: existingOption?.employeeCode || code,
    nhfApplicable,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Sage cutover sync',
  };
  keys.forEach((key) => byKey.set(key, nextOption));
  changes.push({ employee: code, nhfApplicable, action: existingOption ? 'updated' : 'created' });
  if (existingOption) updated += 1;
  else created += 1;
}

const next = [...new Map([...byKey.entries()].map(([, option]) => [keyFor(option.employeeCode || option.employeeId), option])).values()]
  .sort((a, b) => keyFor(a.employeeId).localeCompare(keyFor(b.employeeId)));

if (!dryRun) {
  writeFileSync(optionsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  dryRun,
  permanentAndLumpsum: rows.recordset.length,
  created,
  updated,
  totalOptions: next.length,
  sampleChanges: changes.slice(0, 15),
}, null, 2));
