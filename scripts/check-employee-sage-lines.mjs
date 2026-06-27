import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

const codeArg = process.argv[2] || 'P0181';
const codes = [codeArg, codeArg.replace(/^P/i, ''), `P${codeArg.replace(/^P/i, '')}`];

const envPath = resolve('apps/dashboard/.env');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

const req = pool.request();
codes.forEach((code, i) => req.input(`c${i}`, sql.NVarChar(20), code));
const inList = codes.map((_, i) => `@c${i}`).join(', ');

const rows = await req.query(`
  SELECT e.employee_code, e.full_name,
    ji.job_grade, ps.salary_grade, ps.payroll_group,
    ps.period_salary, ps.annual_salary, ps.latest_deductions,
    ps.sage_payslip_period, ps.sage_payslip_synced_at,
    ps.sage_earning_lines_json, ps.sage_deduction_lines_json, ps.sage_contribution_lines_json
  FROM [hris].[Employees] e
  LEFT JOIN [hris].[EmployeeJobInfo] ji ON ji.employee_id = e.employee_id
  INNER JOIN [hris].[EmployeePayrollSetup] ps ON ps.employee_id = e.employee_id
  WHERE e.employee_code IN (${inList})
`);

const parse = (json) => {
  try { return JSON.parse(json || '[]'); } catch { return []; }
};
const round = (n) => Math.round(n * 100) / 100;

if (!rows.recordset.length) {
  console.log(JSON.stringify({ found: false, searched: codes, message: `No ${codeArg} record in DLE_Enterprise` }, null, 2));
} else {
  for (const row of rows.recordset) {
    const earnings = parse(row.sage_earning_lines_json);
    const deductions = parse(row.sage_deduction_lines_json);
    const contributions = parse(row.sage_contribution_lines_json);
    const gross = round(earnings.reduce((s, l) => s + Number(l.amount || 0), 0));
    const totalDed = round(deductions.reduce((s, l) => s + Number(l.amount || 0), 0));
    console.log(JSON.stringify({
      employee: row.employee_code,
      name: row.full_name,
      jobGrade: row.job_grade || row.salary_grade,
      payrollGroup: row.payroll_group,
      sagePeriod: row.sage_payslip_period,
      syncedAt: row.sage_payslip_synced_at,
      periodSalaryStored: row.period_salary,
      latestDeductionsStored: row.latest_deductions,
      earnings: earnings.map((l) => ({ code: l.code, name: l.name, amount: l.amount })),
      deductions: deductions.map((l) => ({ code: l.code, name: l.name, amount: l.amount })),
      contributions: contributions.map((l) => ({ code: l.code, name: l.name, amount: l.amount })),
      totals: { grossPay: gross, totalDeductions: totalDed, netPay: round(gross - totalDed) },
    }, null, 2));
  }
}

await pool.close();
