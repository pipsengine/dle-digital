import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

const pool = await sql.connect({
  server: process.env.SAGE_PAYROLL_DB_HOST,
  port: 1433,
  database: process.env.SAGE_PAYROLL_DB_NAME,
  user: process.env.SAGE_PAYROLL_DB_USER,
  password: process.env.SAGE_PAYROLL_DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE },
});

const r = await pool.request().query(`
  SELECT TOP 20 e.EmployeeID, e.EmployeeCode, c.CompanyCode, ge.DisplayName, es.Code AS status
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
  WHERE REPLACE(UPPER(e.EmployeeCode), '_', '') LIKE '%465%'
     OR ge.DisplayName LIKE '%OLUFUNKE%'
     OR ge.DisplayName LIKE '%ABE%COMFORT%'
`);
console.log(JSON.stringify(r.recordset, null, 2));
await pool.close();
