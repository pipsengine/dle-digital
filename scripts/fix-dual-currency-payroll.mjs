/**
 * Patch dual-currency employees: primary DLE_USD snapshot + local DLE NGN snapshot.
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

const roundMoney = (value) => Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100) / 100;
const clean = (value) => String(value ?? '').trim();

const BASIC_PERCENT = { SNM: 0.2 };
const derivePackageSalary = (earnings) => {
  const basicLine = earnings.find((line) => /_(BASIC)/i.test(clean(line.code)) || /^BASIC/i.test(clean(line.code)));
  if (basicLine && Number(basicLine.amount) > 0) {
    const code = clean(basicLine.code).toUpperCase();
    const prefix = Object.keys(BASIC_PERCENT).find((key) => code.startsWith(key));
    if (prefix) return roundMoney(Number(basicLine.amount) / BASIC_PERCENT[prefix]);
  }
  return roundMoney(earnings.reduce((sum, line) => sum + Number(line.amount || 0), 0));
};

const summarizeDeductions = (deductions) => roundMoney(deductions.reduce((sum, line) => sum + Number(line.amount || 0), 0));

const sageConfig = {
  server: process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8',
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL',
  },
  connectionTimeout: 15000,
  requestTimeout: 120000,
};

const dleConfig = {
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
};

const TARGET_CODES = ['P0442', 'P0457', 'P0458'];
const PERIOD = process.env.HRIS_ACTIVE_PAYROLL_PERIOD || '2026-06';

const sagePool = await new sql.ConnectionPool(sageConfig).connect();
const dlePool = await new sql.ConnectionPool(dleConfig).connect();

await dlePool.request().query(`
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_payroll_group') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_payroll_group] nvarchar(80) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_pay_currency') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_pay_currency] nvarchar(10) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_period_salary') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_period_salary] decimal(19, 4) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_latest_deductions') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_latest_deductions] decimal(19, 4) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_earning_lines_json') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_earning_lines_json] nvarchar(max) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_deduction_lines_json') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_deduction_lines_json] nvarchar(max) NULL;
  IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_local_contribution_lines_json') IS NULL
    ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_local_contribution_lines_json] nvarchar(max) NULL;
`);

const sourceRows = (await dlePool.request().query(`
  SELECT e.employee_code, src.source_company_code, src.source_employee_id
  FROM hris.Employees e
  JOIN hris.EmployeeSourceRecords src ON src.employee_id = e.employee_id
  WHERE e.employee_code IN ('P0442','P0457','P0458')
    AND src.source_system = N'Sage 300 People Payroll'
`)).recordset;

const ids = sourceRows.map((row) => Number(row.source_employee_id)).filter(Boolean);
const sageLines = (await sagePool.request().query(`
DECLARE @Start date = '2026-06-01';
DECLARE @End date = '2026-07-01';
WITH latest AS (
  SELECT e.EmployeeID, e.EmployeeCode, c.CompanyCode,
    epp.EmployeePayPeriodID, p.PayslipID,
    ROW_NUMBER() OVER (PARTITION BY e.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM Employee.Employee e
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = e.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  WHERE e.EmployeeID IN (${ids.join(',')})
    AND epp.LastCalcDate >= @Start AND epp.LastCalcDate < @End
)
SELECT l.EmployeeID, l.CompanyCode, 'earning' AS lineCategory, edef.DefCode AS lineCode,
  COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), edef.DefCode) AS lineName, pel.Total AS amount
FROM latest l
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = l.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
WHERE l.rn = 1 AND ISNULL(pel.Total, 0) <> 0
UNION ALL
SELECT l.EmployeeID, l.CompanyCode, 'deduction', dd.DefCode,
  COALESCE(NULLIF(LTRIM(RTRIM(dd.ShortDescription)), ''), dd.DefCode), pdl.Total
FROM latest l
JOIN Payroll.PayslipDeductionLine pdl ON pdl.PayslipID = l.PayslipID
JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
WHERE l.rn = 1 AND ISNULL(pdl.Total, 0) <> 0
`)).recordset;

const bySageId = new Map();
for (const row of sageLines) {
  const key = String(row.EmployeeID);
  const current = bySageId.get(key) || {
    sageEmployeeId: key,
    companyCode: row.CompanyCode,
    earnings: [],
    deductions: [],
  };
  const line = { code: row.lineCode, name: row.lineName, amount: roundMoney(row.amount) };
  if (row.lineCategory === 'earning') current.earnings.push(line);
  else current.deductions.push(line);
  bySageId.set(key, current);
}

const results = [];
for (const code of TARGET_CODES) {
  const rows = sourceRows.filter((row) => row.employee_code === code);
  const usdSource = rows.find((row) => row.source_company_code === 'DLE_USD');
  const ngnSource = rows.find((row) => row.source_company_code === 'DLE');
  const primary = usdSource ? bySageId.get(String(usdSource.source_employee_id)) : null;
  const local = ngnSource ? bySageId.get(String(ngnSource.source_employee_id)) : null;
  if (!primary) {
    results.push({ code, status: 'skipped', reason: 'Missing DLE_USD Sage payslip' });
    continue;
  }

  const primaryGross = derivePackageSalary(primary.earnings);
  const primaryDeductions = summarizeDeductions(primary.deductions);
  const localGross = local ? derivePackageSalary(local.earnings) : null;
  const localDeductions = local ? summarizeDeductions(local.deductions) : null;

  await dlePool.request()
    .input('employee_code', sql.NVarChar(20), code)
    .input('payroll_group', sql.NVarChar(80), 'DLE_USD')
    .input('pay_currency', sql.NVarChar(10), 'USD')
    .input('salary_grade', sql.NVarChar(80), 'EXP_USDSNMGT - USD SENIOR MANAGEMENT')
    .input('period_salary', sql.Decimal(19, 4), primaryGross)
    .input('latest_deductions', sql.Decimal(19, 4), primaryDeductions)
    .input('sage_payslip_period', sql.NVarChar(7), PERIOD)
    .input('sage_earning_lines_json', sql.NVarChar(sql.MAX), JSON.stringify(primary.earnings))
    .input('sage_deduction_lines_json', sql.NVarChar(sql.MAX), JSON.stringify(primary.deductions))
    .input('sage_local_payroll_group', sql.NVarChar(80), local ? 'DLE' : null)
    .input('sage_local_pay_currency', sql.NVarChar(10), local ? 'NGN' : null)
    .input('sage_local_period_salary', sql.Decimal(19, 4), localGross)
    .input('sage_local_latest_deductions', sql.Decimal(19, 4), localDeductions)
    .input('sage_local_earning_lines_json', sql.NVarChar(sql.MAX), local ? JSON.stringify(local.earnings) : null)
    .input('sage_local_deduction_lines_json', sql.NVarChar(sql.MAX), local ? JSON.stringify(local.deductions) : null)
    .query(`
      UPDATE ps SET
        payroll_group = @payroll_group,
        pay_currency = @pay_currency,
        salary_grade = @salary_grade,
        period_salary = @period_salary,
        latest_deductions = @latest_deductions,
        sage_payslip_period = @sage_payslip_period,
        sage_earning_lines_json = @sage_earning_lines_json,
        sage_deduction_lines_json = @sage_deduction_lines_json,
        sage_local_payroll_group = @sage_local_payroll_group,
        sage_local_pay_currency = @sage_local_pay_currency,
        sage_local_period_salary = @sage_local_period_salary,
        sage_local_latest_deductions = @sage_local_latest_deductions,
        sage_local_earning_lines_json = @sage_local_earning_lines_json,
        sage_local_deduction_lines_json = @sage_local_deduction_lines_json,
        modified_at = SYSUTCDATETIME()
      FROM [hris].[EmployeePayrollSetup] ps
      JOIN [hris].[Employees] e ON e.employee_id = ps.employee_id
      WHERE e.employee_code = @employee_code;
    `);

  results.push({
    code,
    status: 'updated',
    primary: { company: 'DLE_USD', currency: 'USD', gross: primaryGross, deductions: primaryDeductions },
    local: local ? { company: 'DLE', currency: 'NGN', gross: localGross, deductions: localDeductions } : null,
  });
}

const verify = await dlePool.request().query(`
  SELECT e.employee_code, ps.payroll_group, ps.pay_currency, ps.period_salary, ps.latest_deductions,
    ps.sage_local_payroll_group, ps.sage_local_pay_currency, ps.sage_local_period_salary, ps.sage_local_latest_deductions
  FROM hris.Employees e
  JOIN hris.EmployeePayrollSetup ps ON ps.employee_id = e.employee_id
  WHERE e.employee_code IN ('P0442','P0457','P0458')
  ORDER BY e.employee_code
`);

console.log(JSON.stringify({ results, verify: verify.recordset }, null, 2));
await sagePool.close();
await dlePool.close();
