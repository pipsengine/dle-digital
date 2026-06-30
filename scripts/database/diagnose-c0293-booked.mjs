import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const loadEnv = () => {
  for (const file of [path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      process.env[m[1]] = v;
    }
  }
};
loadEnv();

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const code = 'C0293';
const r = await pool.request().input('code', sql.NVarChar, code).query(`
  SELECT h.[TimesheetDate], h.[Status], l.[ClockIn], l.[TotalHours], l.[UsedHours]
  FROM [hris].[TimesheetLines] l
  JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
  WHERE h.[PeriodId]='per-2026-06' AND UPPER(l.[EmployeeId])=@code AND h.[Status]='Locked'
    AND (ISNULL(l.[TotalHours],0) > 0 OR ISNULL(l.[UsedHours],0) > 0)
  ORDER BY h.[TimesheetDate]
`);

const dates = r.recordset.map((row) => {
  const date = new Date(row.TimesheetDate).toISOString().slice(0, 10);
  const day = new Date(`${date}T12:00:00`).getDay();
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { date, day: names[day], hours: Number(row.TotalHours || row.UsedHours || 0) };
});

const weekends = dates.filter((d) => d.day === 'Sat' || d.day === 'Sun');
const weekdays = dates.filter((d) => d.day !== 'Sat' && d.day !== 'Sun');
console.log(JSON.stringify({ totalBookedLocked: dates.length, weekdays: weekdays.length, weekends: weekends.length, weekendDates: weekends, allDates: dates }, null, 2));
await pool.close();
