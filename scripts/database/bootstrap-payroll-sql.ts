/**
 * Bootstrap payroll SQL tables on DLE_Enterprise and migrate any local JSON payroll data.
 * Usage: set DLE_ENTERPRISE_DB_* env vars, then:
 *   npx tsx scripts/database/bootstrap-payroll-sql.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const host = process.env.DLE_ENTERPRISE_DB_HOST || '192.168.5.5';
const database = process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise';
const user = process.env.DLE_ENTERPRISE_DB_USER || 'sa';
const password = process.env.DLE_ENTERPRISE_DB_PASSWORD;

if (!password) {
  console.error('Set DLE_ENTERPRISE_DB_PASSWORD before running bootstrap.');
  process.exit(1);
}

const scriptRoot = path.join(process.cwd(), 'scripts', 'database');

async function runSqlFile(pool: sql.ConnectionPool, fileName: string) {
  const filePath = path.join(scriptRoot, fileName);
  const raw = readFileSync(filePath, 'utf8');
  const batches = raw.split(/^\s*GO\s*$/gim).map((batch) => batch.trim()).filter(Boolean);
  for (const batch of batches) {
    if (batch.toUpperCase().startsWith('USE ')) continue;
    await pool.request().query(batch);
  }
  console.log(`Applied ${fileName}`);
}

async function main() {
  const pool = await sql.connect({
    server: host,
    port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
    database,
    user,
    password,
    options: { encrypt: process.env.DLE_ENTERPRISE_DB_ENCRYPT !== 'false', trustServerCertificate: true },
    connectionTimeout: 20000,
    requestTimeout: 60000,
  });

  console.log(`Connected to ${host}/${database}`);
  await runSqlFile(pool, '45-dle-enterprise-payroll-runs.sql');
  await runSqlFile(pool, '46-dle-enterprise-payroll-periods.sql');

  const counts = await pool.request().query(`
    SELECT 'PayrollRuns' AS entity, COUNT(*) AS row_count FROM hris.PayrollRuns
    UNION ALL SELECT 'PayrollPeriods', COUNT(*) FROM hris.PayrollPeriods
    UNION ALL SELECT 'PayrollRunAudit', COUNT(*) FROM hris.PayrollRunAudit
    UNION ALL SELECT 'PayrollRunSnapshots', COUNT(*) FROM hris.PayrollRunSnapshots
    UNION ALL SELECT 'PayrollSettings', COUNT(*) FROM hris.PayrollSettings;
  `);
  console.table(counts.recordset);
  await pool.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
