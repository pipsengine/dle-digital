import { NextResponse } from 'next/server';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import { readClockingRecords, writeClockingRecords, type ClockingEvent, type ClockingRecord } from '@/lib/attendance-clocking-store';
import type { AttendanceStatus, BiometricSource, Shift } from '@/lib/attendance-data';
import type { StructureInsight } from '@/lib/organization-data';

type ClockingPayload = {
  generatedAt: string;
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalEmployees: number;
    readyToClockIn: number;
    clockedIn: number;
    clockedOut: number;
    exceptions: number;
    latePunches: number;
    averageLateMinutes: number;
    activeSites: number;
  };
  filterOptions: {
    businessUnits: string[];
    locations: string[];
    sites: string[];
    shifts: Shift[];
    statuses: AttendanceStatus[];
    modes: ClockingRecord['clockingMode'][];
  };
  records: ClockingRecord[];
  insights: StructureInsight[];
};

type UpdateClockingPayload = {
  employeeId?: string;
  action?: 'CLOCK_IN' | 'CLOCK_OUT' | 'MANUAL_OVERRIDE';
  timestamp?: string;
  source?: BiometricSource;
  note?: string;
  overrideStatus?: AttendanceStatus;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const average = (values: number[]) => {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const buildInsights = (records: ClockingRecord[]): StructureInsight[] => {
  const missingPunch = [...records].filter((item) => item.clockingMode === 'Exception').sort((a, b) => a.employeeName.localeCompare(b.employeeName))[0];
  const longestLate = [...records].filter((item) => item.minutesLate > 0).sort((a, b) => b.minutesLate - a.minutesLate)[0];
  const unclosedShift = [...records].filter((item) => item.clockingMode === 'Clocked In').sort((a, b) => a.employeeName.localeCompare(b.employeeName))[0];

  return [
    {
      id: 'clk-ins-1',
      severity: missingPunch ? 'high' : 'low',
      title: `${missingPunch?.employeeName || 'No employee'} has an attendance exception`,
      recommendation: 'Validate the roster, confirm whether the absence is approved, and apply a supervisor override only when evidence is available.',
    },
    {
      id: 'clk-ins-2',
      severity: longestLate && longestLate.minutesLate >= 20 ? 'medium' : 'low',
      title: `${longestLate?.employeeName || 'No employee'} has the highest lateness exposure`,
      recommendation: 'Review access timing, travel constraints, and supervisor follow-up for repeated late punches.',
    },
    {
      id: 'clk-ins-3',
      severity: unclosedShift ? 'medium' : 'low',
      title: `${unclosedShift?.employeeName || 'No employee'} still has an open clocking session`,
      recommendation: 'Confirm whether the employee is still on shift and close the session at shift end to keep payroll and attendance reporting accurate.',
    },
  ];
};

const buildPayload = async (request: Request): Promise<ClockingPayload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const records = await readClockingRecords();

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      actor: uiPermissions.actor,
      role: uiPermissions.role,
      canEdit: uiPermissions.canEditAttendance,
      canExport: true,
      canViewAudit: uiPermissions.canViewAudit,
    },
    summary: {
      totalEmployees: records.length,
      readyToClockIn: records.filter((item) => item.clockingMode === 'Ready To Clock In').length,
      clockedIn: records.filter((item) => item.clockingMode === 'Clocked In').length,
      clockedOut: records.filter((item) => item.clockingMode === 'Clocked Out').length,
      exceptions: records.filter((item) => item.clockingMode === 'Exception').length,
      latePunches: records.filter((item) => item.minutesLate > 0).length,
      averageLateMinutes: average(records.filter((item) => item.minutesLate > 0).map((item) => item.minutesLate)),
      activeSites: new Set(records.map((item) => `${item.location}||${item.site}`)).size,
    },
    filterOptions: {
      businessUnits: Array.from(new Set(records.map((item) => item.businessUnit))).sort((a, b) => a.localeCompare(b)),
      locations: Array.from(new Set(records.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(records.map((item) => item.site))).sort((a, b) => a.localeCompare(b)),
      shifts: ['Day', 'Night', 'Rotational'],
      statuses: ['Present', 'Late', 'Absent', 'On Leave', 'Remote', 'Excused'],
      modes: ['Ready To Clock In', 'Clocked In', 'Clocked Out', 'Exception'],
    },
    records: records.sort((a, b) => {
      const modeOrder: ClockingRecord['clockingMode'][] = ['Exception', 'Ready To Clock In', 'Clocked In', 'Clocked Out'];
      const modeCompare = modeOrder.indexOf(a.clockingMode) - modeOrder.indexOf(b.clockingMode);
      if (modeCompare !== 0) return modeCompare;
      return a.employeeName.localeCompare(b.employeeName);
    }),
    insights: buildInsights(records),
  };
};

const minutesLateFromTime = (scheduledStart: string, actualTime: string) => {
  const [sh, sm] = scheduledStart.split(':').map(Number);
  const [ah, am] = actualTime.split(':').map(Number);
  return Math.max(((ah * 60) + am) - ((sh * 60) + sm), 0);
};

const validatePayload = (payload: UpdateClockingPayload, records: ClockingRecord[]) => {
  if (!isNonEmpty(payload.employeeId)) return 'An employee is required for the clocking action.';
  if (!payload.action || !['CLOCK_IN', 'CLOCK_OUT', 'MANUAL_OVERRIDE'].includes(payload.action)) return 'A valid clocking action is required.';

  const record = records.find((item) => item.employeeId === payload.employeeId);
  if (!record) return 'The selected employee could not be found in the clocking register.';

  if (payload.action !== 'MANUAL_OVERRIDE') {
    if (!isNonEmpty(payload.timestamp)) return 'A valid clocking time is required.';
    if (!isNonEmpty(payload.source)) return 'A valid clocking source is required.';
  }

  if (payload.action === 'CLOCK_IN' && record.clockInTime && !record.clockOutTime) return 'This employee is already clocked in.';
  if (payload.action === 'CLOCK_OUT' && !record.clockInTime) return 'Clock-out cannot be completed before a valid clock-in.';
  if (payload.action === 'CLOCK_OUT' && record.clockOutTime) return 'This employee has already clocked out.';
  if (payload.action === 'MANUAL_OVERRIDE' && !payload.overrideStatus) return 'An override status is required for a manual override.';

  return null;
};

const toIsoTime = (time: string) => `2026-05-29T${time}:00.000Z`;

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to manage clock-in and clock-out actions.');

  const payload = (await request.json()) as UpdateClockingPayload;
  const existing = await readClockingRecords();
  const validationError = validatePayload(payload, existing);
  if (validationError) return err(400, validationError);

  const actor = access.actor;
  const targetEmployeeId = payload.employeeId!;
  const next = existing.map((record) => {
    if (record.employeeId !== payload.employeeId) return record;

    const events = [...record.events];
    const source = payload.source || 'Supervisor Override';
    if (payload.action === 'CLOCK_IN') {
      const timestamp = payload.timestamp!;
      const nextRecord: ClockingRecord = {
        ...record,
        clockInTime: timestamp,
        clockOutTime: null,
        lastActionAt: timestamp,
        source,
        minutesLate: minutesLateFromTime(record.scheduledStart, timestamp),
        attendanceStatus: minutesLateFromTime(record.scheduledStart, timestamp) > 5 ? 'Late' : 'Present',
        clockingMode: 'Clocked In',
        exceptionNote: null,
      };
      const event: ClockingEvent = {
        id: `clk-evt-${Date.now()}`,
        employeeId: record.employeeId,
        action: 'CLOCK_IN',
        timestamp: toIsoTime(timestamp),
        source,
        actor,
        note: payload.note?.trim() || null,
      };
      nextRecord.events = [event, ...events].slice(0, 20);
      return nextRecord;
    }

    if (payload.action === 'CLOCK_OUT') {
      const timestamp = payload.timestamp!;
      const nextRecord: ClockingRecord = {
        ...record,
        clockOutTime: timestamp,
        lastActionAt: timestamp,
        source,
        overtimeHours: overtimeHoursFromTime(record.scheduledEnd, timestamp),
        clockingMode: 'Clocked Out',
      };
      const event: ClockingEvent = {
        id: `clk-evt-${Date.now()}`,
        employeeId: record.employeeId,
        action: 'CLOCK_OUT',
        timestamp: toIsoTime(timestamp),
        source,
        actor,
        note: payload.note?.trim() || null,
      };
      nextRecord.events = [event, ...events].slice(0, 20);
      return nextRecord;
    }

    if (payload.action === 'MANUAL_OVERRIDE') {
      const nextRecord: ClockingRecord = {
        ...record,
        attendanceStatus: payload.overrideStatus!,
        clockingMode: payload.overrideStatus === 'Absent' || payload.overrideStatus === 'Excused' || payload.overrideStatus === 'On Leave' ? 'Exception' : record.clockingMode,
        exceptionNote: payload.note?.trim() || 'Manual supervisor override applied.',
        lastActionAt: new Date().toISOString().split('T')[1].slice(0, 5),
      };
      const event: ClockingEvent = {
        id: `clk-evt-${Date.now()}`,
        employeeId: record.employeeId,
        action: 'MANUAL_OVERRIDE',
        timestamp: new Date().toISOString(),
        source: 'Supervisor Override',
        actor,
        note: payload.note?.trim() || `Status overridden to ${payload.overrideStatus}`,
      };
      nextRecord.events = [event, ...events].slice(0, 20);
      return nextRecord;
    }

    return record;
  });

  await writeClockingRecords(next);

  const target = next.find((r) => r.employeeId === targetEmployeeId)!;
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-clock',
    entityId: targetEmployeeId,
    action: payload.action!,
    actor,
    summary: `${payload.action} recorded for ${target.employeeName} by ${actor}.`,
    before: (existing.find((r) => r.employeeId === targetEmployeeId) || null) as unknown as Record<string, unknown>,
    after: target as unknown as Record<string, unknown>,
  });

  return ok(await buildPayload(request));
}

const overtimeHoursFromTime = (scheduledEnd: string, actualTime: string) => {
  const [sh, sm] = scheduledEnd.split(':').map(Number);
  const [ah, am] = actualTime.split(':').map(Number);
  const minutes = Math.max((ah * 60 + am) - (sh * 60 + sm), 0);
  return Math.round((minutes / 60) * 10) / 10;
}
