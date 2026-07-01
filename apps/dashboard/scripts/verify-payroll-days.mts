import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const period = process.argv.find((arg) => arg.startsWith('--period='))?.split('=')[1] || '2026-06';
const codes = process.argv.filter((arg) => !arg.startsWith('--')).map((code) => code.toUpperCase());

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

process.chdir(resolve('apps/dashboard'));

const [{ buildTimesheetHoursMapForPayrollPeriod, readTimesheetPayrollUpdates }, { calculatePayrollForPeriod }] = await Promise.all([
  import('@/lib/timesheet-entry-store'),
  import('@/lib/payroll-calculation-service'),
]);

const [hoursMap, payroll, updates] = await Promise.all([
  buildTimesheetHoursMapForPayrollPeriod(period),
  calculatePayrollForPeriod(period),
  readTimesheetPayrollUpdates(),
]);

const periodId = period.startsWith('per-') ? period : `per-${period}`;
const snapshot = updates.find((item) => item.periodId === periodId);

const rows = (codes.length ? codes : ['C1065', 'C0293']).map((code) => {
  const calc = payroll.records.find((record) => [record.employeeId, record.employeeCode].map((v) => String(v || '').toUpperCase()).includes(code));
  const snap = snapshot?.employeeAttendance.find((row) => String(row.employeeId).toUpperCase() === code);
  const live = hoursMap.get(code) || hoursMap.get(code.replace(/^C0*/, 'C')) || null;
  return {
    code,
    liveDays: live?.daysWorked ?? null,
    snapshotDays: snap?.daysWorked ?? null,
    payrollCalcDays: calc?.timesheetDaysWorked ?? null,
    grossPay: calc?.grossPay ?? null,
  };
});

console.log(JSON.stringify({ period, rows }, null, 2));
