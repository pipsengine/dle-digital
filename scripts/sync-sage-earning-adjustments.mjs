/**
 * Upsert Sage earning lines into payroll-period-earning-adjustments.json
 * for runtime profile parity (structural package + supplemental lines).
 *
 * Usage: node scripts/sync-sage-earning-adjustments.mjs [--period=2026-06] [P0420 L1940 ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

const args = process.argv.slice(2);
const period = args.find((arg) => arg.startsWith('--period='))?.split('=')[1] || '2026-06';
const employeeFilters = args.filter((arg) => !arg.startsWith('--')).map((code) => code.toUpperCase());
const adjustmentsPath = resolve('apps/dashboard/data/hris/payroll-period-earning-adjustments.json');
const source = 'Sage payslip supplemental earning sync';

const keyFor = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const adjustmentKey = (row) => `${row.period}|${keyFor(row.employeeCode || row.employeeId)}|${String(row.code || '').toUpperCase()}`;

const filterCodes = employeeFilters.flatMap((code) => {
  const bare = code.replace(/^P/i, '').replace(/^L/i, '');
  return [code, bare, `P${bare}`, `L${bare}`];
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

const request = pool.request();
request.input('period', sql.NVarChar(7), period);
const filterSql = filterCodes.length
  ? `AND e.employee_code IN (${filterCodes.map((_, i) => `@f${i}`).join(', ')})`
  : `AND (e.employee_code LIKE 'P%' OR e.employee_code LIKE 'L%')`;
filterCodes.forEach((code, i) => request.input(`f${i}`, sql.NVarChar(20), code));

const { recordset } = await request.query(`
  SELECT e.employee_code, e.full_name, ps.sage_earning_lines_json
  FROM [hris].[Employees] e
  INNER JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE ps.sage_payslip_period = @period
    AND ps.sage_earning_lines_json IS NOT NULL
    ${filterSql}
`);

const parseLines = (json) => {
  try { return JSON.parse(json || '[]'); } catch { return []; }
};

const adjustments = JSON.parse(readFileSync(adjustmentsPath, 'utf8'));
const byKey = new Map(adjustments.map((row) => [adjustmentKey(row), row]));
let added = 0;
let updated = 0;

for (const row of recordset) {
  const numericCode = String(row.employee_code || '').replace(/^[PL]/i, '');
  const employeeLabel = `${numericCode} - ${String(row.full_name || '').trim()}`;
  const earnings = parseLines(row.sage_earning_lines_json);
  for (const line of earnings) {
    const code = String(line.code || '').trim();
    const amount = Number(line.amount || 0);
    if (!code || !Number.isFinite(amount) || amount === 0) continue;
    const taxable = line.taxable !== false && !/^REFUND$/i.test(code);
    const next = {
      period,
      employeeId: employeeLabel,
      employeeCode: employeeLabel,
      code,
      name: String(line.name || code).trim(),
      amount: Math.round(amount * 100) / 100,
      taxable,
      source,
    };
    const key = adjustmentKey(next);
    const existing = byKey.get(key);
    if (!existing) {
      adjustments.push(next);
      byKey.set(key, next);
      added += 1;
      continue;
    }
    if (Math.abs(Number(existing.amount || 0) - next.amount) > 0.009 || existing.taxable !== next.taxable) {
      existing.amount = next.amount;
      existing.taxable = next.taxable;
      existing.name = next.name;
      existing.source = source;
      updated += 1;
    }
  }
}

writeFileSync(adjustmentsPath, `${JSON.stringify(adjustments, null, 2)}\n`, 'utf8');
await pool.close();
console.log(JSON.stringify({ period, employees: recordset.length, added, updated, totalRows: adjustments.length }, null, 2));
