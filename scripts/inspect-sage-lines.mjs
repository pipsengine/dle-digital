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

const codes = process.argv.slice(2).map((c) => c.toUpperCase());
const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

for (const code of codes) {
  const r = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT TOP 1 e.employee_code, ps.salary_grade, ps.sage_earning_lines_json, ps.sage_deduction_lines_json
    FROM [hris].[Employees] e
    JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
    WHERE e.employee_code = @code
  `);
  const row = r.recordset[0];
  if (!row) { console.log(code, 'NOT FOUND'); continue; }
  const earnings = JSON.parse(row.sage_earning_lines_json || '[]');
  console.log('\n===', code, row.salary_grade, '===');
  for (const line of earnings) {
    console.log(line.code, line.amount, 'taxable:', line.taxableAmount);
  }
  console.log('deductions:', JSON.parse(row.sage_deduction_lines_json || '[]').map((l) => `${l.code}=${l.amount}`).join(', '));
}
await pool.close();
