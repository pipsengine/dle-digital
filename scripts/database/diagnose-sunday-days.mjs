import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const codes = process.argv.slice(2).length ? process.argv.slice(2) : ['C1065', 'C0293'];
const loadEnv = () => {
  for (const file of [path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
};
loadEnv();

const dayName = (date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T12:00:00Z`).getUTCDay()];

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

for (const code of codes) {
  const r = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT h.[TimesheetDate], h.[Status], l.[ClockIn], l.[TotalHours], l.[UsedHours]
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]='per-2026-06' AND UPPER(l.[EmployeeId])=@code AND h.[Status] NOT IN ('Rejected','Returned')
  `);
  const dates = new Map();
  for (const row of r.recordset) {
    const date = new Date(row.TimesheetDate).toISOString().slice(0, 10);
    const hasBooked = Number(row.TotalHours || 0) > 0 || Number(row.UsedHours || 0) > 0;
    const hasClock = Boolean(String(row.ClockIn || '').trim());
    const current = dates.get(date) || { hasBooked: false, hasClock: false };
    current.hasBooked = current.hasBooked || hasBooked;
    current.hasClock = current.hasClock || hasClock;
    dates.set(date, current);
  }
  const sundays = [...dates.entries()].filter(([date]) => dayName(date) === 'Sun').map(([date, flags]) => ({ date, ...flags }));
  console.log(code, { sundays, totalDates: dates.size });
}

await pool.close();
