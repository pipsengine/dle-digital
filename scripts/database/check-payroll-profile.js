const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const loadEnv = () => {
  for (const file of [path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
};

const code = process.argv[2] || 'C0293';
loadEnv();

(async () => {
  const sage = await new sql.ConnectionPool({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL' },
  }).connect();
  const dle = await new sql.ConnectionPool({
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    database: process.env.DLE_ENTERPRISE_DB_NAME,
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();

  const sageR = await sage.request().input('code', sql.NVarChar, code).query(`
    SELECT TOP 1
      e.EmployeeID,
      e.EmployeeCode,
      ed.BankName,
      ed.BankCode,
      ed.AccountNo,
      ed.TaxNo,
      ed.PeriodSalary,
      ed.RatePerDay
    FROM Employee.Employee e
    LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
    WHERE REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') = REPLACE(@code, 'P', '')
    ORDER BY e.EmployeeID
  `);

  const dleR = await dle.request().input('code', sql.NVarChar, code).query(`
    SELECT
      e.employee_code,
      pay.bank_name,
      pay.account_number,
      pay.tax_identification_number,
      pay.pension_provider,
      pay.period_salary,
      pay.basic_salary,
      pay.latest_allowances,
      pay.latest_deductions,
      pay.salary_grade
    FROM [hris].[Employees] e
    LEFT JOIN [hris].[EmployeePayrollSetup] pay ON pay.employee_id = e.employee_id
    WHERE e.employee_code = @code
  `);

  const gaps = await dle.request().query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN NULLIF(LTRIM(RTRIM(pay.bank_name)), '') IS NULL THEN 1 ELSE 0 END) AS missing_bank,
      SUM(CASE WHEN NULLIF(LTRIM(RTRIM(pay.account_number)), '') IS NULL THEN 1 ELSE 0 END) AS missing_account,
      SUM(CASE WHEN NULLIF(LTRIM(RTRIM(pay.tax_identification_number)), '') IS NULL THEN 1 ELSE 0 END) AS missing_tax,
      SUM(CASE WHEN NULLIF(LTRIM(RTRIM(pay.pension_provider)), '') IS NULL THEN 1 ELSE 0 END) AS missing_pension
    FROM [hris].[Employees] e
    LEFT JOIN [hris].[EmployeePayrollSetup] pay ON pay.employee_id = e.employee_id
    WHERE e.employment_status <> 'Terminated'
  `);

  console.log(JSON.stringify({ code, sage: sageR.recordset[0] || null, dle: dleR.recordset[0] || null, workforceGaps: gaps.recordset[0] }, null, 2));
  await sage.close();
  await dle.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
