import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

const codes = ['C1065', 'C0293'];
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

const pool = await sql.connect({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const ACTIVE = new Set(['Draft', 'Submitted', 'Supervisor_Reviewed', 'Cost_Control_Reviewed', 'Project_Manager_Reviewed', 'HR_Acknowledged', 'Approved', 'HR_Reviewed', 'Project_Control_Reviewed', 'Locked']);
const PAYROLL_READY = new Set(['HR_Acknowledged', 'Locked', 'Approved']);

const isPaidDay = (row) => {
  const hasClock = Boolean(String(row.ClockIn || '').trim());
  const hasBooked = Number(row.TotalHours || 0) > 0 || Number(row.UsedHours || 0) > 0;
  return hasClock || hasBooked;
};

const iso = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
};

for (const code of codes) {
  const rows = await pool.request().input('code', sql.NVarChar, code).query(`
    SELECT h.[TimesheetDate], h.[Status], h.[WorkCenterName], l.[ClockIn], l.[TotalHours], l.[UsedHours]
    FROM [hris].[TimesheetLines] l
    JOIN [hris].[TimesheetHeaders] h ON CONVERT(NVARCHAR(4000), h.[Id]) = CONVERT(NVARCHAR(4000), l.[HeaderId])
    WHERE h.[PeriodId]='per-2026-06'
      AND (UPPER(LTRIM(RTRIM(l.[EmployeeId])))=UPPER(@code) OR UPPER(LTRIM(RTRIM(l.[EmployeeNo])))=UPPER(@code))
  `);

  const buckets = {
    payrollReadyPaidDays: new Set(),
    activePaidDays: new Set(),
    allPaidDays: new Set(),
    payrollReadyBookedOnly: new Set(),
    activeWeekdays: new Set(),
    juneOnlyActive: new Set(),
  };

  for (const row of rows.recordset) {
    const date = iso(row.TimesheetDate);
    if (!date || !isPaidDay(row)) continue;
    buckets.allPaidDays.add(date);
    if (ACTIVE.has(row.Status)) buckets.activePaidDays.add(date);
    if (PAYROLL_READY.has(row.Status)) buckets.payrollReadyPaidDays.add(date);
    if (ACTIVE.has(row.Status) && Number(row.TotalHours || 0) > 0) buckets.payrollReadyBookedOnly.add(date);
    const wd = new Date(`${date}T12:00:00`).getDay();
    if (ACTIVE.has(row.Status) && wd >= 1 && wd <= 5) buckets.activeWeekdays.add(date);
    if (ACTIVE.has(row.Status) && date >= '2026-06-01' && date <= '2026-06-30') buckets.juneOnlyActive.add(date);
  }

  console.log(code, Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.size])));
  const lockedBooked = new Set();
  const clockNoBook = [];
  for (const row of rows.recordset) {
    if (row.Status !== 'Locked') continue;
    const date = iso(row.TimesheetDate);
    const hasBooked = Number(row.TotalHours || 0) > 0 || Number(row.UsedHours || 0) > 0;
    const hasClock = Boolean(String(row.ClockIn || '').trim());
    if (hasBooked) lockedBooked.add(date);
    else if (hasClock) clockNoBook.push({ date, wc: row.WorkCenterName });
  }
  console.log(code, 'lockedBookedDays', lockedBooked.size, 'clockNoBook', clockNoBook);
}

await pool.close();
