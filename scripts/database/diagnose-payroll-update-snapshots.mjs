import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

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

const pool = await new sql.ConnectionPool({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
}).connect();

const periodId = 'per-2026-06';
const codes = ['C1065', 'C0293'];

const snapshots = await pool.request().input('periodId', sql.NVarChar, periodId).query(`
  SELECT u.[Id], u.[AcknowledgedAt], u.[AcknowledgedBy],
         (SELECT COUNT(*) FROM [hris].[TimesheetPayrollUpdateEmployees] e WHERE e.[PayrollUpdateId]=u.[Id]) AS employeeCount
  FROM [hris].[TimesheetPayrollUpdates] u
  WHERE u.[PeriodId]=@periodId
  ORDER BY u.[AcknowledgedAt] DESC
`);

const headerStatuses = await pool.request().input('periodId', sql.NVarChar, periodId).query(`
  SELECT [Status], COUNT(*) cnt, COUNT(DISTINCT [TimesheetDate]) dayCount
  FROM [hris].[TimesheetHeaders]
  WHERE [PeriodId]=@periodId
  GROUP BY [Status]
`);

const employeeSnapshots = {};
for (const code of codes) {
  const rows = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT TOP 3 u.[AcknowledgedAt], e.[DaysWorked], e.[BookedHours]
    FROM [hris].[TimesheetPayrollUpdateEmployees] e
    JOIN [hris].[TimesheetPayrollUpdates] u ON u.[Id]=e.[PayrollUpdateId]
    WHERE u.[PeriodId]=@periodId AND e.[EmployeeId]=@code
    ORDER BY u.[AcknowledgedAt] DESC
  `);
  const lockedDays = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT COUNT(DISTINCT h.[TimesheetDate]) AS uniqueLockedDays
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]=@periodId AND h.[Status]=N'Locked'
      AND (UPPER(l.[EmployeeId])=@code OR UPPER(l.[EmployeeNo])=@code)
      AND NULLIF(LTRIM(RTRIM(l.[ClockIn])), '') IS NOT NULL
  `);
  const hrAckDays = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT COUNT(DISTINCT h.[TimesheetDate]) AS uniqueHrAckDays
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]=@periodId AND h.[Status]=N'HR_Acknowledged'
      AND (UPPER(l.[EmployeeId])=@code OR UPPER(l.[EmployeeNo])=@code)
      AND NULLIF(LTRIM(RTRIM(l.[ClockIn])), '') IS NOT NULL
  `);
  employeeSnapshots[code] = {
    latestSnapshots: rows.recordset,
    lockedDaysWithClockIn: lockedDays.recordset[0]?.uniqueLockedDays,
    hrAckDaysWithClockIn: hrAckDays.recordset[0]?.uniqueHrAckDays,
  };
}

console.log(JSON.stringify({
  periodId,
  snapshotCount: snapshots.recordset.length,
  snapshots: snapshots.recordset.slice(0, 5),
  headerStatuses: headerStatuses.recordset,
  employeeSnapshots,
}, null, 2));

await pool.close();
