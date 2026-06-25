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

const code = process.argv[2] || 'P0413';
loadEnv();

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    database: process.env.DLE_ENTERPRISE_DB_NAME,
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();

  const result = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT
      e.employee_id,
      e.employee_code,
      e.full_name,
      src.source_employee_id,
      src.source_employee_code,
      emp.date_joined,
      emp.modified_at
    FROM [hris].[Employees] e
    LEFT JOIN [hris].[EmployeeSourceRecords] src
      ON src.employee_id = e.employee_id AND src.source_system = N'Sage 300 People Payroll'
    LEFT JOIN [hris].[EmployeeEmploymentInfo] emp ON emp.employee_id = e.employee_id
    WHERE e.employee_code = @code
       OR src.source_employee_code LIKE '%' + REPLACE(@code, 'P', '') + '%'
  `);

  console.log(JSON.stringify(result.recordset, null, 2));
  await pool.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
