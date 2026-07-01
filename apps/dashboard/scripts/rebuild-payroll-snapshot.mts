import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const periodArg = process.argv.find((arg) => arg.startsWith('--period='))?.split('=')[1] || 'per-2026-06';
const periodId = periodArg.startsWith('per-') ? periodArg : `per-${periodArg}`;
const actor = process.argv.find((arg) => arg.startsWith('--actor='))?.split('=')[1] || 'Payroll Snapshot Rebuild';
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

const { rebuildPayrollSnapshotForPeriod } = await import('@/lib/timesheet-entry-store');

const update = await rebuildPayrollSnapshotForPeriod(periodId, actor);
const rows = update.employeeAttendance
  .filter((row) => !codes.length || codes.includes(String(row.employeeId).toUpperCase()))
  .sort((left, right) => left.employeeName.localeCompare(right.employeeName));

console.log(JSON.stringify({
  periodId: update.periodId,
  periodName: update.periodName,
  acknowledgedAt: update.acknowledgedAt,
  headerCount: update.headerIds.length,
  employeeCount: update.employeeAttendance.length,
  sample: rows,
}, null, 2));
