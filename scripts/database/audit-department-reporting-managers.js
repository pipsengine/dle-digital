const fs = require('fs');
const path = require('path');
const sql = require('mssql');

function loadWorkspaceEnv() {
  for (const file of [path.resolve('.env'), path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
}

function dbConfig() {
  return {
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
    database: process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise',
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: {
      encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT).toLowerCase() !== 'false',
      trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE).toLowerCase() === 'true',
    },
  };
}

loadWorkspaceEnv();

(async () => {
  const pool = await sql.connect(dbConfig());

  const targets = await pool.request().query(`
    SELECT e.employee_code, e.full_name, e.employment_type, e.employment_status,
           j.department, j.reporting_manager, j.functional_manager, j.department_head, j.job_title
    FROM hris.Employees e
    LEFT JOIN hris.EmployeeJobInfo j ON j.employee_id = e.employee_id
    WHERE e.employee_code IN ('NYSC0032', 'P0146')
    ORDER BY e.employee_code
  `);
  console.log('TARGETS', JSON.stringify(targets.recordset, null, 2));

  const deptSummary = await pool.request().query(`
    SELECT
      LTRIM(RTRIM(ISNULL(j.department, ''))) AS department,
      COUNT(*) AS employee_count,
      SUM(CASE WHEN j.reporting_manager IS NULL OR LTRIM(RTRIM(j.reporting_manager)) = '' THEN 1 ELSE 0 END) AS missing_manager,
      STRING_AGG(DISTINCT j.reporting_manager, ' | ') WITHIN GROUP (ORDER BY j.reporting_manager) AS managers
    FROM hris.Employees e
    JOIN hris.EmployeeJobInfo j ON j.employee_id = e.employee_id
    WHERE e.employment_status NOT LIKE '%inactive%'
      AND e.employment_status NOT LIKE '%terminated%'
      AND e.employment_status NOT LIKE '%resigned%'
      AND LTRIM(RTRIM(ISNULL(j.department, ''))) <> ''
      AND j.department NOT LIKE '%Production%'
      AND (
        e.employment_type IN ('Permanent', 'Lumpsum', 'NYSC', 'IT')
        OR e.employee_code LIKE 'P%'
        OR e.employee_code LIKE 'L%'
        OR e.employee_code LIKE 'NYSC%'
        OR e.employee_code LIKE 'N%'
      )
    GROUP BY LTRIM(RTRIM(ISNULL(j.department, '')))
    ORDER BY department
  `);
  console.log('DEPT_SUMMARY', JSON.stringify(deptSummary.recordset, null, 2));

  const orgDepts = await pool.request().query(`
    SELECT TOP 200 Name, Leader, Headcount, HealthStatus
    FROM hris.OrganizationDepartments
    WHERE SourceSystem = N'DLE Enterprise'
    ORDER BY Name
  `);
  console.log('ORG_DEPTS', JSON.stringify(orgDepts.recordset, null, 2));

  const itEmployees = await pool.request().query(`
    SELECT e.employee_code, e.full_name, e.employment_type, j.reporting_manager, j.job_title
    FROM hris.Employees e
  JOIN hris.EmployeeJobInfo j ON j.employee_id = e.employee_id
    WHERE j.department LIKE '%IT%'
      AND e.employment_status NOT LIKE '%inactive%'
      AND e.employment_status NOT LIKE '%terminated%'
    ORDER BY e.employee_code
  `);
  console.log('IT_EMPLOYEES', JSON.stringify(itEmployees.recordset, null, 2));

  await pool.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
