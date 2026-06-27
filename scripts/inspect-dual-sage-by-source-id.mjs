/** Query Sage by source employee IDs from DLE_Enterprise. */
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

const dlePool = await sql.connect({
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

const sources = await dlePool.request().query(`
  SELECT e.employee_code, src.source_company_code, src.source_employee_id
  FROM hris.Employees e
  JOIN hris.EmployeeSourceRecords src ON src.employee_id = e.employee_id
  WHERE e.employee_code IN ('P0442','P0457','P0458')
    AND src.source_system = N'Sage 300 People Payroll'
  ORDER BY e.employee_code, src.source_company_code
`);

const ids = sources.recordset.map((r) => r.source_employee_id).filter(Boolean);
await dlePool.close();

if (!ids.length) {
  console.log(JSON.stringify({ error: 'No source ids' }, null, 2));
  process.exit(0);
}

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

const idList = ids.map((id) => Number(id)).join(',');
const { recordset } = await sagePool.request().query(`
DECLARE @Start date = '2026-06-01';
DECLARE @End date = '2026-07-01';

WITH latest AS (
  SELECT e.EmployeeID, e.EmployeeCode, c.CompanyCode, ge.DisplayName AS employeeName,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')) AS jobGrade,
    epp.EmployeePayPeriodID, p.PayslipID, epp.LastCalcDate,
    ROW_NUMBER() OVER (PARTITION BY e.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = e.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  WHERE e.EmployeeID IN (${idList})
    AND epp.LastCalcDate >= @Start AND epp.LastCalcDate < @End
)
SELECT l.EmployeeID, l.EmployeeCode, l.CompanyCode, l.employeeName, l.jobGrade,
  'earning' AS lineCategory, edef.DefCode AS lineCode, pel.Total AS amount
FROM latest l
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = l.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
WHERE l.rn = 1 AND ISNULL(pel.Total, 0) <> 0
UNION ALL
SELECT l.EmployeeID, l.EmployeeCode, l.CompanyCode, l.employeeName, l.jobGrade,
  'deduction', dd.DefCode, pdl.Total
FROM latest l
JOIN Payroll.PayslipDeductionLine pdl ON pdl.PayslipID = l.PayslipID
JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
WHERE l.rn = 1 AND ISNULL(pdl.Total, 0) <> 0
ORDER BY EmployeeCode, CompanyCode, lineCategory, lineCode;
`);

const grouped = {};
for (const row of recordset) {
  const key = `${row.EmployeeID}|${row.CompanyCode}`;
  grouped[key] = grouped[key] || {
    sageEmployeeId: row.EmployeeID,
    employeeCode: row.EmployeeCode,
    companyCode: row.CompanyCode,
    jobGrade: row.jobGrade,
    earnings: [],
    deductions: [],
    gross: 0,
    totalDeductions: 0,
  };
  const line = { code: row.lineCode, amount: Number(row.amount) };
  if (row.lineCategory === 'earning') {
    grouped[key].earnings.push(line);
    grouped[key].gross += line.amount;
  } else {
    grouped[key].deductions.push(line);
    grouped[key].totalDeductions += line.amount;
  }
}

console.log(JSON.stringify({ sourceIds: sources.recordset, payslips: Object.values(grouped) }, null, 2));
await sagePool.close();
