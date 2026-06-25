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
  const sage = await sql.connect({
    server: process.env.SAGE_PAYROLL_DB_HOST,
    database: process.env.SAGE_PAYROLL_DB_NAME,
    user: process.env.SAGE_PAYROLL_DB_USER,
    password: process.env.SAGE_PAYROLL_DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL' },
  });
  const dle = await new sql.ConnectionPool({
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    database: process.env.DLE_ENTERPRISE_DB_NAME,
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();

  const sageR = await sage.request().input('code', sql.NVarChar, code).query(`
    SELECT e.EmployeeID, e.EmployeeCode, ed.DateEngaged, ed.DateJoinedGroup
    FROM Employee.Employee e
    LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
    WHERE REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') = REPLACE(@code, 'P', '')
       OR REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') LIKE '%' + REPLACE(@code, 'P', '') + '%'
    ORDER BY e.EmployeeID
  `);
  const dleR = await dle.request().input('code', sql.NVarChar, code).query(`
    SELECT e.employee_code, emp.date_joined
    FROM [hris].[Employees] e
    LEFT JOIN [hris].[EmployeeEmploymentInfo] emp ON emp.employee_id = e.employee_id
    WHERE e.employee_code = @code
  `);
  const counts = await sage.request().query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ed.DateJoinedGroup IS NOT NULL AND ed.DateEngaged IS NOT NULL AND ed.DateJoinedGroup < ed.DateEngaged THEN 1 ELSE 0 END) AS group_before_engaged,
      SUM(CASE WHEN ed.DateJoinedGroup IS NOT NULL AND (ed.DateEngaged IS NULL OR ed.DateJoinedGroup = ed.DateEngaged) THEN 1 ELSE 0 END) AS same_or_group_only
    FROM Employee.Employee e
    LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
    LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
    WHERE e.TerminationDate IS NULL AND ISNULL(es.Code, 'A') = 'A'
  `);

  console.log(JSON.stringify({ code, sageRows: sageR.recordset, dle: dleR.recordset[0], sageStats: counts.recordset[0] }, null, 2));
  await sage.close();
  await dle.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
