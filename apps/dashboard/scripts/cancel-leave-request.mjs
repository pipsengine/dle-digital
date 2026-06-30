import sql from 'mssql';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    }),
);

const args = process.argv.slice(2);
const employeeArg = args.find((item) => item.startsWith('--employee='))?.split('=').slice(1).join('=')
  || (args[0] === '--employee' ? args[1] : null);
const requestId = employeeArg ? null : (args[0] || 'ess-1782808356310-gld174');
const now = new Date().toISOString();

const essPaths = [
  path.join(root, 'data', 'hris', 'ess-requests.json'),
  path.join(root, '..', 'data', 'hris', 'ess-requests.json'),
  path.join(root, '..', '..', 'data', 'hris', 'ess-requests.json'),
  path.join(root, '..', '..', '..', 'deployment', 'iis', 'site', 'apps', 'dashboard', 'data', 'hris', 'ess-requests.json'),
];

const pool = await sql.connect({
  server: env.DLE_ENTERPRISE_DB_HOST,
  port: Number(env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: env.DLE_ENTERPRISE_DB_NAME,
  user: env.DLE_ENTERPRISE_DB_USER,
  password: env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: env.DLE_ENTERPRISE_DB_ENCRYPT === 'true',
    trustServerCertificate: env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
});

let targetIds = [];
if (employeeArg) {
  const lookup = await pool.request()
    .input('EmployeeId', sql.NVarChar(80), employeeArg)
    .query(`
SELECT [Id],[EmployeeId],[FullName],[LeaveType],[StartDate],[EndDate],[StatusName]
FROM [hris].[LeaveApplications]
WHERE [EmployeeId]=@EmployeeId
  AND [StatusName] IN (N'Submitted', N'Under Review', N'Approved', N'Draft');`);
  targetIds = lookup.recordset.map((row) => row.Id);
  console.log(`Found ${targetIds.length} active leave application(s) for ${employeeArg}`);
} else if (requestId) {
  targetIds = [requestId];
}

for (const essPath of essPaths) {
  if (!fs.existsSync(essPath)) continue;
  const requests = JSON.parse(fs.readFileSync(essPath, 'utf8'));
  if (!Array.isArray(requests)) continue;
  const idSet = new Set(targetIds);
  const employeeKey = employeeArg ? String(employeeArg).trim().toUpperCase() : '';
  const next = requests.map((item) => {
    const matchesEmployee = employeeKey
      && String(item.employeeId || '').trim().toUpperCase() === employeeKey;
    const matchesId = idSet.has(item.id);
    const isActiveLeave = /leave/i.test(String(item.category || ''))
      && !['Rejected', 'Cancelled', 'Terminated', 'Closed', 'Withdrawn'].includes(String(item.status || ''));
    if (!matchesId && !(matchesEmployee && isActiveLeave)) return item;
    return {
      ...item,
      status: 'Rejected',
      updatedAt: now,
      comments: [
        ...(Array.isArray(item.comments) ? item.comments : []),
        { at: now, actor: 'Leave Admin Cleanup', comment: 'Withdrawn to allow employee re-application.' },
      ],
    };
  });
  fs.writeFileSync(essPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Updated ${essPath}`);
}

if (employeeArg) {
  await pool.request()
    .input('EmployeeId', sql.NVarChar(80), employeeArg)
    .query(`
UPDATE [hris].[LeaveApplications]
SET [StatusName]=N'Cancelled',
    [WorkflowStage]=N'Closed',
    [ApprovalStatus]=N'Cancelled',
    [UpdatedAt]=SYSUTCDATETIME()
WHERE [EmployeeId]=@EmployeeId
  AND [StatusName] IN (N'Submitted', N'Under Review', N'Approved', N'Draft');`);
} else if (requestId) {
  await pool.request()
    .input('Id', sql.NVarChar(120), requestId)
    .query(`
UPDATE [hris].[LeaveApplications]
SET [StatusName]=N'Cancelled',
    [WorkflowStage]=N'Closed',
    [ApprovalStatus]=N'Cancelled',
    [UpdatedAt]=SYSUTCDATETIME()
WHERE [Id]=@Id;`);
}

const result = employeeArg
  ? await pool.request()
    .input('EmployeeId', sql.NVarChar(80), employeeArg)
    .query(`
SELECT [Id],[EmployeeId],[FullName],[LeaveType],[StartDate],[EndDate],[StatusName]
FROM [hris].[LeaveApplications]
WHERE [EmployeeId]=@EmployeeId
ORDER BY [UpdatedAt] DESC;`)
  : await pool.request()
    .input('Id', sql.NVarChar(120), requestId)
    .query(`
SELECT [Id],[EmployeeId],[FullName],[LeaveType],[StartDate],[EndDate],[StatusName]
FROM [hris].[LeaveApplications]
WHERE [Id]=@Id;`);

console.log(JSON.stringify(result.recordset, null, 2));
await pool.close();
