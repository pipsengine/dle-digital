const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const envFile = path.join(process.cwd(), 'apps', 'dashboard', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const host = process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8';
const port = Number(process.env.SAGE_PAYROLL_DB_PORT || 1433);
const instance = String(process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL').trim();
const database = process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE';

const base = {
  database,
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  requestTimeout: 30000,
  connectionTimeout: 30000,
  options: { encrypt: false, trustServerCertificate: true },
};

const candidates = [
  { label: `tcp:${host},${port}`, config: { ...base, server: host, port } },
  { label: `${host}\\${instance}`, config: { ...base, server: host, options: { ...base.options, instanceName: instance } } },
];

(async () => {
  if (!base.password) throw new Error('Set SAGE_PAYROLL_DB_PASSWORD in apps/dashboard/.env');
  for (const candidate of candidates) {
    try {
      const pool = await sql.connect(candidate.config);
      const result = await pool.request().query('SELECT DB_NAME() AS databaseName, @@SERVERNAME AS serverName');
      console.log(`OK ${candidate.label}`, result.recordset[0]);
      await pool.close();
      return;
    } catch (error) {
      console.error(`FAIL ${candidate.label}:`, error.message || error);
    }
  }
  process.exit(1);
})();
