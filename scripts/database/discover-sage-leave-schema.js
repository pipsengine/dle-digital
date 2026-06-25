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

  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_NAME LIKE '%Leave%' OR TABLE_SCHEMA LIKE '%Leave%')
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);

  const views = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME LIKE '%Leave%' OR TABLE_SCHEMA LIKE '%Leave%'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);

  console.log(JSON.stringify({ tables: tables.recordset, views: views.recordset }, null, 2));
  await pool.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
