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

for (const code of codes) {
  const employee = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT e.employee_id, e.employee_code, e.full_name, e.employment_type, e.employment_status,
           pay.payroll_group, pay.payment_run, pay.payment_type, pay.period_salary, pay.rate_per_day, pay.basic_salary
    FROM [hris].[Employees] e
    LEFT JOIN [hris].[EmployeePayrollSetup] pay ON pay.employee_id = e.employee_id
    WHERE UPPER(LTRIM(RTRIM(e.employee_code))) = UPPER(@code)
  `);

  const lines = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT h.[PeriodId], h.[TimesheetDate], h.[Status], h.[WorkCenterName], h.[SupervisorName],
           l.[EmployeeId], l.[EmployeeNo], l.[EmployeeName], l.[ClockIn], l.[ClockOut],
           l.[AttendanceDuration], l.[UsedHours], l.[TotalHours]
    FROM [hris].[TimesheetLines] l
    INNER JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE UPPER(LTRIM(RTRIM(l.[EmployeeId]))) = UPPER(@code)
       OR UPPER(LTRIM(RTRIM(l.[EmployeeNo]))) = UPPER(@code)
    ORDER BY h.[TimesheetDate], h.[WorkCenterName]
  `);

  const payrollUpdates = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT u.[PeriodId], u.[PeriodName], u.[AcknowledgedAt], e.[DaysWorked], e.[AttendanceHours], e.[BookedHours]
    FROM [hris].[TimesheetPayrollUpdateEmployees] e
    INNER JOIN [hris].[TimesheetPayrollUpdates] u ON u.[Id] = e.[PayrollUpdateId]
    WHERE UPPER(LTRIM(RTRIM(e.[EmployeeId]))) = UPPER(@code)
    ORDER BY u.[AcknowledgedAt] DESC
  `);

  const byPeriod = new Map();
  for (const row of lines.recordset) {
    const periodId = row.PeriodId;
    const bucket = byPeriod.get(periodId) || {
      periodId,
      totalLines: 0,
      withClockIn: 0,
      uniqueDates: new Set(),
      uniqueDatesWithClockIn: new Set(),
      statuses: new Set(),
      bookedHours: 0,
      hrAckDates: new Set(),
    };
    bucket.totalLines += 1;
    bucket.statuses.add(row.Status);
    bucket.bookedHours += Number(row.TotalHours || row.UsedHours || 0);
    if (row.TimesheetDate) bucket.uniqueDates.add(String(row.TimesheetDate).slice(0, 10));
    if (row.ClockIn) {
      bucket.withClockIn += 1;
      if (row.TimesheetDate) bucket.uniqueDatesWithClockIn.add(String(row.TimesheetDate).slice(0, 10));
    }
    if (['HR_Acknowledged', 'Locked', 'Approved'].includes(String(row.Status)) && row.TimesheetDate && row.ClockIn) {
      bucket.hrAckDates.add(String(row.TimesheetDate).slice(0, 10));
    }
    byPeriod.set(periodId, bucket);
  }

  const periodSummary = [...byPeriod.values()].map((item) => ({
    periodId: item.periodId,
    totalLines: item.totalLines,
    linesWithClockIn: item.withClockIn,
    uniqueDates: item.uniqueDates.size,
    uniqueDatesWithClockIn: item.uniqueDatesWithClockIn.size,
    hrAcknowledgedDaysWithClockIn: item.hrAckDates.size,
    bookedHours: Math.round(item.bookedHours * 10) / 10,
    statuses: [...item.statuses],
  }));

  console.log(JSON.stringify({
    code,
    employee: employee.recordset[0] || null,
    periodSummary,
    payrollUpdates: payrollUpdates.recordset,
    recentLines: lines.recordset.slice(-5),
    totalLineCount: lines.recordset.length,
  }, null, 2));
}

await pool.close();
