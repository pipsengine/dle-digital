/**
 * Compare DLE vs DLE_USD Sage payslips for dual-company employees.
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

const codes = process.argv.slice(2).length ? process.argv.slice(2) : ['0442', '0457', '0458', '0465', '465'];
const codeList = codes.map((c) => `'${String(c).replace(/^P/i, '').replace(/^0+/, '')}'`).join(',');

const sagePool = await sql.connect({
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
});

const { recordset } = await sagePool.request().query(`
DECLARE @Start date = '2026-06-01';
DECLARE @End date = '2026-07-01';

WITH targets AS (
  SELECT e.EmployeeID, e.EmployeeCode, c.CompanyCode, ge.DisplayName AS employeeName,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')) AS jobGrade
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
  WHERE REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') IN (${codeList})
     OR REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') IN (${codes.map((c) => `'P${String(c).replace(/^P/i, '')}'`).join(',')})
),
latest AS (
  SELECT t.*, epp.EmployeePayPeriodID, p.PayslipID, epp.LastCalcDate,
    ROW_NUMBER() OVER (PARTITION BY t.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM targets t
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = t.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  WHERE epp.LastCalcDate >= @Start AND epp.LastCalcDate < @End
)
SELECT l.EmployeeID, l.EmployeeCode, l.CompanyCode, l.employeeName, l.jobGrade,
  'earning' AS lineCategory, edef.DefCode AS lineCode,
  COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), edef.DefCode) AS lineName,
  pel.Total AS amount
FROM latest l
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = l.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
WHERE l.rn = 1 AND ISNULL(pel.Total, 0) <> 0

UNION ALL

SELECT l.EmployeeID, l.EmployeeCode, l.CompanyCode, l.employeeName, l.jobGrade,
  'deduction', dd.DefCode,
  COALESCE(NULLIF(LTRIM(RTRIM(dd.ShortDescription)), ''), dd.DefCode),
  pdl.Total
FROM latest l
JOIN Payroll.PayslipDeductionLine pdl ON pdl.PayslipID = l.PayslipID
JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
WHERE l.rn = 1 AND ISNULL(pdl.Total, 0) <> 0

ORDER BY EmployeeCode, CompanyCode, lineCategory, lineCode;
`);

const grouped = {};
for (const row of recordset) {
  const key = `${row.EmployeeCode}|${row.CompanyCode}|${row.EmployeeID}`;
  grouped[key] = grouped[key] || {
    sageEmployeeId: row.EmployeeID,
    employeeCode: row.EmployeeCode,
    companyCode: row.CompanyCode,
    employeeName: row.employeeName,
    jobGrade: row.jobGrade,
    earnings: [],
    deductions: [],
  };
  const line = { code: row.lineCode, name: row.lineName, amount: row.amount };
  if (row.lineCategory === 'earning') grouped[key].earnings.push(line);
  else grouped[key].deductions.push(line);
}

console.log(JSON.stringify({ queriedCodes: codes, payslips: Object.values(grouped) }, null, 2));
await sagePool.close();
