import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

const dlePool = await new sql.ConnectionPool({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: 1433,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
}).connect();

const verify = await dlePool.request().query(`
  SELECT e.employee_code, e.full_name, e.employment_status, ji.job_title, ji.department, ji.office_location,
    ps.payroll_group, ps.pay_currency, ps.period_salary, ps.sage_payslip_period, ps.setup_assigned_to_payroll,
    ci.official_email, ci.primary_phone
  FROM hris.Employees e
  LEFT JOIN hris.EmployeeJobInfo ji ON ji.employee_id = e.employee_id
  LEFT JOIN hris.EmployeePayrollSetup ps ON ps.employee_id = e.employee_id
  LEFT JOIN hris.EmployeeContactInfo ci ON ci.employee_id = e.employee_id
  WHERE e.employee_code = 'P0465'
`);
await dlePool.close();
console.log(JSON.stringify(verify.recordset, null, 2));
