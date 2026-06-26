const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const envFile = path.join(process.cwd(), 'apps', 'dashboard', '.env');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[match[1]] = value;
}

(async () => {
  const pool = await sql.connect({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    requestTimeout: 120000,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL',
    },
  });

  const tables = await pool.request().query(`
    SELECT s.name AS schemaName, t.name AS tableName
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.name LIKE '%Time%'
       OR t.name LIKE '%Attend%'
       OR t.name LIKE '%Timesheet%'
       OR t.name LIKE '%Clock%'
       OR t.name LIKE '%EarnUnit%'
       OR t.name LIKE '%Daily%'
       OR t.name LIKE '%Shift%'
    ORDER BY s.name, t.name
  `);
  console.log('Candidate tables:', tables.recordset.length);
  for (const row of tables.recordset) {
    console.log(`- ${row.schemaName}.${row.tableName}`);
  }

  const cols = await pool.request().query(`
    SELECT c.name, ty.name AS typeName
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Payroll' AND t.name = 'PayslipEarnUnit'
    ORDER BY c.column_id
  `);
  console.log('\nPayroll.PayslipEarnUnit columns:');
  for (const row of cols.recordset) {
    console.log(`- ${row.name} (${row.typeName})`);
  }

  const c1728 = await pool.request().query(`
    DECLARE @PayrollPeriodStart date = '2026-06-01';
    DECLARE @PayrollPeriodEnd date = '2026-07-01';

    SELECT TOP 30
      e.EmployeeCode,
      edef.DefCode,
      edef.ShortDescription,
      pel.Total,
      peu.*
    FROM Employee.Employee e
    JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = e.EmployeeID
    JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
    JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = p.PayslipID
    JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
    LEFT JOIN Payroll.PayslipEarnUnit peu ON peu.PayslipEarnLineID = pel.PayslipEarnLineID
    WHERE e.EmployeeCode = 'C1728'
      AND epp.LastCalcDate >= @PayrollPeriodStart
      AND epp.LastCalcDate < @PayrollPeriodEnd
    ORDER BY edef.DefCode
  `);
  console.log('\nC1728 June 2026 earn lines/units:', JSON.stringify(c1728.recordset, null, 2));

  await pool.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
