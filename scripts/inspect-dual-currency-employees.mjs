/**
 * List DLE / DLE_USD employees and dual-company Sage source records.
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

const usdEmployees = await pool.request().query(`
  SELECT e.employee_code, e.full_name, e.employment_status,
    ps.payroll_group, ps.pay_currency, ps.salary_grade, ps.period_salary,
    ps.sage_payslip_period, ps.latest_deductions,
    ji.business_unit, ji.job_grade
  FROM [hris].[Employees] e
  LEFT JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  LEFT JOIN [hris].[EmployeeJobInfo] ji ON ji.employee_id = e.employee_id
  WHERE ps.payroll_group = 'DLE_USD'
     OR ps.pay_currency = 'USD'
     OR ji.business_unit = 'DLE_USD'
     OR UPPER(ISNULL(ps.salary_grade, '')) LIKE '%EXP%USD%'
     OR UPPER(ISNULL(ji.job_grade, '')) LIKE '%EXP%USD%'
  ORDER BY e.employee_code
`);

const dualCompany = await pool.request().query(`
  SELECT e.employee_code, e.full_name, src.source_company_code, src.source_company_currency, src.source_employee_id
  FROM [hris].[Employees] e
  JOIN [hris].[EmployeeSourceRecords] src ON src.employee_id = e.employee_id
  WHERE src.source_system = N'Sage 300 People Payroll'
    AND e.employee_id IN (
      SELECT employee_id FROM [hris].[EmployeeSourceRecords]
      WHERE source_system = N'Sage 300 People Payroll'
      GROUP BY employee_id HAVING COUNT(DISTINCT source_company_code) > 1
    )
  ORDER BY e.employee_code, src.source_company_code
`);

const p465 = await pool.request().query(`
  SELECT e.employee_code, e.full_name, e.employment_status, e.employment_type,
    ps.payroll_group, ps.setup_assigned_to_payroll
  FROM [hris].[Employees] e
  LEFT JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE e.employee_code LIKE '%465%'
     OR e.full_name LIKE '%OLUFUNKE%'
     OR e.full_name LIKE '%ABE%COMFORT%'
`);

const identitiesPath = resolve('apps/dashboard/data/hris/payroll-payslip-identities.json');
const identities = JSON.parse(readFileSync(identitiesPath, 'utf8'));
const id465 = identities.filter((row) => String(row.employeeCode || row.employeeId || '').replace(/^P/i, '') === '465');

console.log(JSON.stringify({
  usdEmployeeCount: usdEmployees.recordset.length,
  usdEmployees: usdEmployees.recordset,
  dualCompanyCount: dualCompany.recordset.length,
  dualCompanyEmployees: dualCompany.recordset,
  p465InDb: p465.recordset,
  p465InIdentities: id465,
}, null, 2));

await pool.close();
