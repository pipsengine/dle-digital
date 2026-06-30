import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const codes = process.argv.slice(2).length ? process.argv.slice(2) : ['C1065', 'C0293'];

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

for (const code of codes) {
  const period = await pool.request().query(`SELECT TOP 1 * FROM [hris].[TimesheetPeriods] WHERE [Id]='${periodId}'`);
  const byStatus = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT h.[Status], h.[WorkCenterName], COUNT(DISTINCT h.[TimesheetDate]) AS uniqueDates,
           COUNT(*) AS lineCount,
           SUM(CASE WHEN NULLIF(LTRIM(RTRIM(l.[ClockIn])), '') IS NOT NULL THEN 1 ELSE 0 END) AS linesWithClockIn,
           SUM(CASE WHEN ISNULL(l.[TotalHours], 0) > 0 OR ISNULL(l.[UsedHours], 0) > 0 THEN 1 ELSE 0 END) AS linesWithBookedHours
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]=@periodId
      AND (UPPER(LTRIM(RTRIM(l.[EmployeeId])))=UPPER(@code) OR UPPER(LTRIM(RTRIM(l.[EmployeeNo])))=UPPER(@code))
    GROUP BY h.[Status], h.[WorkCenterName]
    ORDER BY h.[Status], h.[WorkCenterName]
  `);

  const uniqueDatesAll = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT h.[TimesheetDate], h.[Status], h.[WorkCenterName], l.[ClockIn], l.[TotalHours], l.[UsedHours]
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]=@periodId
      AND (UPPER(LTRIM(RTRIM(l.[EmployeeId])))=UPPER(@code) OR UPPER(LTRIM(RTRIM(l.[EmployeeNo])))=UPPER(@code))
    ORDER BY h.[TimesheetDate], h.[WorkCenterName]
  `);

  const lockedClockInDates = new Set();
  const lockedBookedDates = new Set();
  const allClockInDates = new Set();
  const payrollReadyClockInDates = new Set();
  for (const row of uniqueDatesAll.recordset) {
    const d = String(row.TimesheetDate).slice(0, 10);
    const hasClock = Boolean(String(row.ClockIn || '').trim());
    const hasBooked = Number(row.TotalHours || 0) > 0 || Number(row.UsedHours || 0) > 0;
    if (hasClock) allClockInDates.add(d);
    if (['Locked', 'HR_Acknowledged', 'Approved'].includes(row.Status) && hasClock) payrollReadyClockInDates.add(d);
    if (row.Status === 'Locked' && hasClock) lockedClockInDates.add(d);
    if (row.Status === 'Locked' && (hasClock || hasBooked)) lockedBookedDates.add(d);
  }

  const payrollEmp = await pool.request().input('code', sql.NVarChar, code).input('periodId', sql.NVarChar, periodId).query(`
    SELECT TOP 1 e.[DaysWorked], e.[BookedHours], u.[AcknowledgedAt]
    FROM [hris].[TimesheetPayrollUpdateEmployees] e
    JOIN [hris].[TimesheetPayrollUpdates] u ON u.[Id]=e.[PayrollUpdateId]
    WHERE u.[PeriodId]=@periodId AND e.[EmployeeId]=@code
    ORDER BY u.[AcknowledgedAt] DESC
  `);

  console.log(JSON.stringify({
    code,
    period: period.recordset[0] || null,
    byStatusWorkCenter: byStatus.recordset,
    counts: {
      allUniqueDates: allClockInDates.size,
      payrollReadyClockInDates: payrollReadyClockInDates.size,
      lockedClockInDates: lockedClockInDates.size,
      lockedBookedDates: lockedBookedDates.size,
      totalLineRows: uniqueDatesAll.recordset.length,
    },
    latestPayrollSnapshot: payrollEmp.recordset[0] || null,
    dates: [...payrollReadyClockInDates].sort(),
  }, null, 2));
}

await pool.close();
