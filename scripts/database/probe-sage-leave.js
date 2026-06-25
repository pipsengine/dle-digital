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

const code = process.argv[2] || 'P0146';
loadEnv();

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    requestTimeout: 120000,
    connectionTimeout: 30000,
    options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL' },
  }).connect();

  const cols = async (schema, name) => {
    const r = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${name}'
      ORDER BY ORDINAL_POSITION
    `);
    return r.recordset;
  };

  const summaryCols = await cols('Leave', 'LeaveSummary');
  const transactionCols = await cols('Leave', 'LeaveTransaction');
  const employeeLeaveCols = await cols('Leave', 'EmployeeLeave');

  let summarySample = [];
  let transactionSample = [];
  let employeeLeaveSample = [];
  try {
    summarySample = (await pool.request().query(`SELECT TOP 5 * FROM Leave.LeaveSummary`)).recordset;
  } catch (e) {
    summarySample = [{ error: e.message }];
  }
  const emp = (await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT e.EmployeeID, e.EmployeeCode, ge.EntityCode
    FROM Employee.Employee e
    JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
    WHERE UPPER(LTRIM(RTRIM(e.EmployeeCode))) = UPPER(@code)
       OR UPPER(LTRIM(RTRIM(e.EmployeeCode))) = UPPER(REPLACE(@code, 'P', ''))
       OR UPPER(REPLACE(LTRIM(RTRIM(e.EmployeeCode)), '_', '')) = UPPER(REPLACE(@code, 'P', ''))
    ORDER BY e.EmployeeID
  `)).recordset;

  let balances = [];
  let leaveTypes = [];
  let leaveDetailSample = [];
  if (emp.length) {
    const eid = emp[0].EmployeeID;
    balances = (await pool.request().input('eid', sql.Int, eid).query(`
      WITH latest AS (
        SELECT MAX(PayPeriodGenID) AS PayPeriodGenID
        FROM Leave.LeaveSummary
        WHERE EmployeeID = @eid
      )
      SELECT ls.LeaveTypeCode, ls.LeaveDefCode, ls.Entitlement, ls.BalanceBroughtForward,
             ls.AccruedThisPeriod, ls.Planned, ls.Taken, ls.BalanceCarriedForward,
             ls.PayPeriodGenID, ls.PeriodEndDate
      FROM Leave.LeaveSummary ls
      INNER JOIN latest ON latest.PayPeriodGenID = ls.PayPeriodGenID
      WHERE ls.EmployeeID = @eid
      ORDER BY ls.LeaveTypeCode
    `)).recordset;

    leaveTypes = (await pool.request().query(`
      SELECT LeaveTypeID, LeaveTypeCode, Description
      FROM Leave.LeaveType
      ORDER BY LeaveTypeID
    `)).recordset;

    try {
      leaveDetailSample = (await pool.request().input('eid', sql.Int, eid).query(`
        SELECT TOP 15 *
        FROM Leave.LeaveDetail
        WHERE EmployeeID = @eid
        ORDER BY 1 DESC
      `)).recordset;
    } catch (e) {
      leaveDetailSample = [{ error: e.message }];
    }
  }

  console.log(JSON.stringify({
    emp,
    balances,
    leaveTypes,
    leaveDetailSample,
    transactionCols: transactionCols.map((c) => c.COLUMN_NAME),
    employeeLeaveCols: employeeLeaveCols.map((c) => c.COLUMN_NAME),
  }, null, 2));
  await pool.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
