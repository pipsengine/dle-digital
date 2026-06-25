import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

const envPath = resolve('apps/dashboard/.env');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const enterpriseFrom = String(process.env.HRIS_PAYROLL_ENTERPRISE_FROM || '2026-06').trim();
const period = '2026-06';
const periodKey = (value) => {
  const normalized = String(value || '').replace(/^per-/, '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return 0;
  const [year, month] = normalized.split('-').map(Number);
  return year * 100 + month;
};
const isEnterprise = periodKey(period) >= periodKey(enterpriseFrom);

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
  connectionTimeout: Number(process.env.DLE_ENTERPRISE_DB_CONNECTION_TIMEOUT_MS || 20000),
  requestTimeout: Number(process.env.DLE_ENTERPRISE_DB_REQUEST_TIMEOUT_MS || 60000),
});

const runs = await pool.request().input('period', sql.Char(7), period).query(`
  SELECT run_id, period_code, run_status, employee_count, gross_pay, net_pay, modified_at
  FROM [hris].[PayrollRuns]
  WHERE period_code = @period
  ORDER BY modified_at DESC
`);

const snapshots = await pool.request().input('period', sql.Char(7), period).query(`
  SELECT COUNT(*) AS SnapshotRows
  FROM [hris].[PayrollRunSnapshots] s
  INNER JOIN [hris].[PayrollRuns] r ON r.run_id = s.run_id
  WHERE r.period_code = @period
`);

const settings = await pool.request().query(`
  SELECT setting_key, setting_value
  FROM [hris].[PayrollSettings]
  WHERE setting_key IN ('active_payroll_period', 'next_payroll_period')
`);

await pool.close();

console.log(JSON.stringify({
  period,
  enterpriseCutoverFrom: enterpriseFrom,
  isEnterprisePayrollPeriod: isEnterprise,
  activePayrollPeriodEnv: process.env.HRIS_ACTIVE_PAYROLL_PERIOD || '(default 2026-06)',
  sageEnrichEnabled: String(process.env.HRIS_SAGE_PAYROLL_ENRICH || 'false') === 'true',
  payrollRunsForJune: runs.recordset.length,
  latestRun: runs.recordset[0] ? {
    status: runs.recordset[0].run_status,
    employeeCount: runs.recordset[0].employee_count,
    grossPay: runs.recordset[0].gross_pay,
    netPay: runs.recordset[0].net_pay,
    modifiedAt: runs.recordset[0].modified_at,
  } : null,
  snapshotRows: snapshots.recordset[0]?.SnapshotRows ?? 0,
  payrollSettings: Object.fromEntries((settings.recordset || []).map((row) => [row.setting_key, row.setting_value])),
  verdict: isEnterprise && runs.recordset.length > 0 && Number(runs.recordset[0]?.employee_count || 0) > 0 && Number(snapshots.recordset[0]?.SnapshotRows || 0) > 0
    ? 'June 2026 payroll is 100% DLE_Enterprise with calculated snapshot data.'
    : isEnterprise && runs.recordset.length > 0
      ? 'June 2026 is enterprise-sourced in code and a run row exists, but payroll is not calculated/released yet — run Validate Payroll in HRIS.'
      : isEnterprise
        ? 'June 2026 is enterprise-sourced in code, but no PayrollRuns row found yet — open the June period and validate payroll.'
        : 'Enterprise cutover env is not set to June 2026.',
}, null, 2));
