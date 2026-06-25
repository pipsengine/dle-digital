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

loadEnv();

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL' },
  }).connect();

  const sage = await pool.request().input('code', sql.NVarChar, 'P0146').query(`
    SELECT TOP 10 e.EmployeeID, ge.EntityCode AS EmployeeCode, ge.DisplayName
    FROM Employee.Employee e
    JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
    WHERE ge.EntityCode LIKE '%0146%'
    ORDER BY e.EmployeeID
  `);

  const dle = await new sql.ConnectionPool({
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    database: process.env.DLE_ENTERPRISE_DB_NAME,
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  const dleEmp = await dle.request().input('code', sql.NVarChar, 'P0146').query(`
    SELECT e.employee_id, e.employee_code, src.source_employee_id
    FROM hris.Employees e
  LEFT JOIN hris.EmployeeSourceRecords src ON src.employee_id = e.employee_id AND src.source_system = N'Sage 300 People Payroll'
    WHERE e.employee_code = @code
  `);

  let sageLeave = [];
  const sourceId = dleEmp.recordset[0]?.source_employee_id;
  if (sourceId) {
    sageLeave = (await pool.request().input('eid', sql.Int, Number(sourceId)).query(`
      WITH latest AS (SELECT MAX(PayPeriodGenID) AS PayPeriodGenID FROM Leave.LeaveSummary WHERE EmployeeID = @eid)
      SELECT ls.LeaveTypeCode, ls.Entitlement, ls.Taken, ls.Planned, ls.BalanceCarriedForward, ls.BalanceBroughtForward, ls.AccruedThisPeriod
      FROM Leave.LeaveSummary ls INNER JOIN latest ON latest.PayPeriodGenID = ls.PayPeriodGenID
      WHERE ls.EmployeeID = @eid
    `)).recordset;
  }

  const leaveTypes = (await pool.request().query(`SELECT LeaveTypeID, LeaveTypeCode, Description FROM Leave.LeaveType ORDER BY LeaveTypeID`)).recordset;

  console.log(JSON.stringify({ sage: sage.recordset, dle: dleEmp.recordset, sageLeave, leaveTypes }, null, 2));
  await pool.close();
  await dle.close();
})().catch((e) => { console.error(e); process.exit(1); });
