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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
};
loadEnv();

const payable = (row) => {
  const hasBooked = Number(row.TotalHours || 0) > 0 || Number(row.UsedHours || 0) > 0;
  if (hasBooked) return true;
  const hasClock = Boolean(String(row.ClockIn || '').trim());
  if (!hasClock) return false;
  const dateKey = new Date(row.TimesheetDate).toISOString().slice(0, 10);
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day !== 0;
};

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const r = await pool.request().query(`
  SELECT h.[TimesheetDate], h.[Status], h.[WorkCenterName], l.[ClockIn], l.[TotalHours], l.[UsedHours]
  FROM [hris].[TimesheetLines] l
  JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
  WHERE h.[PeriodId]='per-2026-06' AND UPPER(l.[EmployeeId])='C0293'
`);

const sets = { all: new Set(), locked: new Set(), lockedMaint: new Set(), draftBlast: new Set() };
for (const row of r.recordset) {
  const date = new Date(row.TimesheetDate).toISOString().slice(0, 10);
  if (!payable(row)) continue;
  sets.all.add(date);
  if (row.Status === 'Locked') {
    sets.locked.add(date);
    if (row.WorkCenterName === 'Maintenance') sets.lockedMaint.add(date);
  }
  if (row.Status === 'Draft' && row.WorkCenterName === 'Blasting') sets.draftBlast.add(date);
}

const onlyDraftBlast = [...sets.draftBlast].filter((date) => !sets.lockedMaint.has(date));
const onlyNotLockedMaint = [...sets.all].filter((date) => !sets.lockedMaint.has(date));

console.log(JSON.stringify({
  counts: Object.fromEntries(Object.entries(sets).map(([key, value]) => [key, value.size])),
  onlyDraftBlast,
  onlyNotLockedMaint,
  lockedMaintDates: [...sets.lockedMaint].sort(),
}, null, 2));

await pool.close();
