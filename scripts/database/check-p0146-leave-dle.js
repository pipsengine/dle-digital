const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
const loadEnv = () => {
  for (const file of [path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
};
loadEnv();
(async () => {
  const pool = await sql.connect({
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    database: process.env.DLE_ENTERPRISE_DB_NAME,
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: {
      encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true').toLowerCase() === 'true',
      trustServerCertificate: true,
    },
  });
  const emp = await pool.request().input('code', sql.NVarChar, 'P0146').query('SELECT employee_id, employee_code FROM hris.Employees WHERE employee_code=@code');
  const id = emp.recordset[0]?.employee_code;
  const balances = await pool.request().input('id', sql.NVarChar, id).query('SELECT LeaveType, CurrentBalance, SourceSystem FROM hris.LeaveBalances WHERE EmployeeId=@id ORDER BY LeaveType');
  const history = await pool.request().input('id', sql.NVarChar, id).query('SELECT TOP 5 LeaveType, StartDate, EndDate, Days, StatusName, SourceSystem FROM hris.LeaveApplications WHERE EmployeeId=@id ORDER BY StartDate DESC');
  console.log(JSON.stringify({ employeeCode: id, balances: balances.recordset, history: history.recordset }, null, 2));
  await pool.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
