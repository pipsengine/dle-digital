const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
const envFile = path.join(process.cwd(), 'apps', 'dashboard', '.env');
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m || process.env[m[1]]) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

(async () => {
  const pool = await sql.connect({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    requestTimeout: 60000,
    options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL' },
  });
  const emp = await pool.request().query(`SELECT TOP 5 EmployeeID, EmployeeCode FROM Employee.Employee WHERE EmployeeCode LIKE '%0146%'`);
  console.log('emp', emp.recordset);
  if (emp.recordset[0]) {
    const eid = emp.recordset[0].EmployeeID;
    const types = await pool.request().query(`SELECT TOP 20 * FROM Leave.LeaveType ORDER BY LeaveTypeID`);
    console.log('types', types.recordset);
    const tx = await pool.request().input('eid', sql.Int, eid).query(`
      SELECT TOP 10 lt.LeaveTransactionID, lt.FromDate, lt.ToDate, lt.UnitsTaken, lt.TransactionStatus, lt.Cancelled, ltype.Code AS LeaveTypeCode, ltype.ShortDescription AS LeaveTypeName
      FROM Leave.LeaveTransaction lt
      JOIN Employee.EmployeeRule er ON er.EmployeeRuleID = lt.EmployeeRuleID
      JOIN Leave.LeaveType ltype ON ltype.LeaveTypeID = lt.LeaveTypeID
      WHERE er.EmployeeID = @eid
      ORDER BY lt.FromDate DESC
    `);
    console.log('tx', JSON.stringify(tx.recordset, null, 2));
    const el = await pool.request().input('eid', sql.Int, eid).query(`
      SELECT el.BalanceCarriedForward, el.UnitsTakenInCycle, el.Entitlement, el.PlannedLeave, el.UnitsAvailable,
             el.BalanceIncludingPlanned, lt.Code AS LeaveTypeCode, lt.ShortDescription AS LeaveTypeName
      FROM Leave.EmployeeLeave el
      JOIN Employee.EmployeePayPeriod epp ON epp.EmployeePayPeriodID = el.EmployeePayPeriodID
      JOIN Employee.EmployeeRule er ON er.EmployeeRuleID = epp.EmployeeRuleID
      JOIN Leave.LeaveDef ld ON ld.LeaveDefID = el.LeaveDefID
      JOIN Leave.LeaveType lt ON lt.LeaveTypeID = ld.LeaveTypeID
      WHERE er.EmployeeID = @eid
        AND epp.EmployeePayPeriodID = (
          SELECT MAX(epp2.EmployeePayPeriodID)
          FROM Employee.EmployeePayPeriod epp2
          JOIN Employee.EmployeeRule er2 ON er2.EmployeeRuleID = epp2.EmployeeRuleID
          WHERE er2.EmployeeID = @eid
        )
      ORDER BY lt.ShortDescription
    `);
    console.log('balances', JSON.stringify(el.recordset, null, 2));
  }
  await pool.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
