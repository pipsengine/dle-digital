import { NextResponse } from 'next/server';
import { buildBaseAttendanceRecords } from '@/lib/attendance-data';
import { readClockingRecords } from '@/lib/attendance-clocking-store';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import {
  readAttendanceRegisterControls,
  writeAttendanceRegisterControls,
  type AttendanceRegisterControl,
  type RegisterReviewStatus,
} from '@/lib/attendance-register-store';
import type { StructureInsight } from '@/lib/organization-data';

type AttendanceRegisterRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  businessUnit: string;
  department: string;
  jobTitle: string;
  location: string;
  site: string;
  shift: string;
  attendanceStatus: string;
  clockingMode: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  minutesLate: number;
  overtimeHours: number;
  source: string;
  supervisor: string;
  reviewStatus: RegisterReviewStatus;
  verifiedBy: string;
  payrollReady: boolean;
  note: string | null;
  reviewedAt: string;
};

type Payload = {
  generatedAt: string;
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalRecords: number;
    verified: number;
    pendingReview: number;
    flagged: number;
    payrollReady: number;
    locked: number;
    exceptions: number;
    lateCases: number;
  };
  filterOptions: {
    businessUnits: string[];
    locations: string[];
    sites: string[];
    shifts: string[];
    statuses: string[];
    reviewStatuses: RegisterReviewStatus[];
  };
  rows: AttendanceRegisterRow[];
  insights: StructureInsight[];
};

type UpdatePayload = {
  employeeId?: string;
  reviewStatus?: RegisterReviewStatus;
  verifiedBy?: string;
  payrollReady?: boolean;
  note?: string;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const buildPayload = async (request: Request): Promise<Payload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const attendance = buildBaseAttendanceRecords();
  const clocking = await readClockingRecords();
  const controls = await readAttendanceRegisterControls();
  const controlByEmployee = new Map(controls.map((item) => [item.employeeId, item]));

  const rows: AttendanceRegisterRow[] = attendance.map((record) => {
    const clock = clocking.find((item) => item.employeeId === record.employeeId);
    const control = controlByEmployee.get(record.employeeId);
    const defaultStatus: RegisterReviewStatus =
      record.status === 'Absent' || record.minutesLate >= 20 || clock?.clockingMode === 'Exception'
        ? 'Flagged'
        : clock?.clockingMode === 'Clocked In'
          ? 'Pending Review'
          : 'Verified';
    const payrollReady = control?.payrollReady ?? (defaultStatus === 'Verified');
    return {
      id: `att-reg-${record.employeeId.toLowerCase()}`,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      businessUnit: record.businessUnit,
      department: record.department,
      jobTitle: record.jobTitle,
      location: record.location,
      site: record.site,
      shift: record.shift,
      attendanceStatus: record.status,
      clockingMode: clock?.clockingMode || 'Ready To Clock In',
      checkInTime: clock?.clockInTime ?? record.checkInTime,
      checkOutTime: clock?.clockOutTime ?? record.checkOutTime,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      minutesLate: clock?.minutesLate ?? record.minutesLate,
      overtimeHours: clock?.overtimeHours ?? record.overtimeHours,
      source: clock?.source ?? record.biometricSource,
      supervisor: record.supervisor,
      reviewStatus: control?.reviewStatus ?? defaultStatus,
      verifiedBy: control?.verifiedBy || 'Attendance Control Desk',
      payrollReady,
      note: control?.note || clock?.exceptionNote || null,
      reviewedAt: control?.reviewedAt || new Date().toISOString(),
    };
  }).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const flagged = rows.filter((item) => item.reviewStatus === 'Flagged');
  const pending = rows.filter((item) => item.reviewStatus === 'Pending Review');
  const late = rows.filter((item) => item.minutesLate > 0);
  const insights: StructureInsight[] = [
    {
      id: 'reg-ins-1',
      severity: flagged.length >= 2 ? 'high' : 'medium',
      title: `${flagged[0]?.employeeName || 'Attendance register'} has flagged entries requiring attention`,
      recommendation: 'Clear flagged entries before payroll cutoff and ensure each exception has supervisor evidence.',
    },
    {
      id: 'reg-ins-2',
      severity: pending.length >= 2 ? 'medium' : 'low',
      title: `${pending[0]?.employeeName || 'Attendance register'} still has pending review entries`,
      recommendation: 'Finalize open shifts and unresolved register lines before payroll signoff.',
    },
    {
      id: 'reg-ins-3',
      severity: late.length >= 3 ? 'medium' : 'low',
      title: `${late[0]?.employeeName || 'Attendance register'} shows lateness pressure`,
      recommendation: 'Track repeat lateness patterns and validate underlying operational causes.',
    },
  ];

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
      totalRecords: rows.length,
      verified: rows.filter((item) => item.reviewStatus === 'Verified').length,
      pendingReview: pending.length,
      flagged: flagged.length,
      payrollReady: rows.filter((item) => item.payrollReady).length,
      locked: rows.filter((item) => item.reviewStatus === 'Locked').length,
      exceptions: rows.filter((item) => item.clockingMode === 'Exception').length,
      lateCases: late.length,
    },
    filterOptions: {
      businessUnits: Array.from(new Set(rows.map((item) => item.businessUnit))).sort((a, b) => a.localeCompare(b)),
      locations: Array.from(new Set(rows.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(rows.map((item) => item.site))).sort((a, b) => a.localeCompare(b)),
      shifts: Array.from(new Set(rows.map((item) => item.shift))).sort((a, b) => a.localeCompare(b)),
      statuses: Array.from(new Set(rows.map((item) => item.attendanceStatus))).sort((a, b) => a.localeCompare(b)),
      reviewStatuses: ['Pending Review', 'Verified', 'Flagged', 'Locked'],
    },
    rows,
    insights,
  };
};

const validatePayload = (payload: UpdatePayload, controls: AttendanceRegisterControl[]) => {
  const statuses: RegisterReviewStatus[] = ['Pending Review', 'Verified', 'Flagged', 'Locked'];
  if (!isNonEmpty(payload.employeeId)) return 'An employee is required for the attendance register update.';
  if (payload.reviewStatus && !statuses.includes(payload.reviewStatus)) return 'A valid review status is required.';
  if (payload.verifiedBy !== undefined && !isNonEmpty(payload.verifiedBy)) return 'Verified by cannot be empty.';
  if (payload.note !== undefined && !isNonEmpty(payload.note)) return 'Note cannot be empty.';
  return null;
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to update attendance register controls.');

  const payload = (await request.json()) as UpdatePayload;
  const controls = await readAttendanceRegisterControls();
  const validationError = validatePayload(payload, controls);
  if (validationError) return err(400, validationError);

  const actor = access.actor;
  const existing = controls.find((item) => item.employeeId === payload.employeeId);
  const base: AttendanceRegisterControl =
    existing ||
    {
      id: `reg-${payload.employeeId!.toLowerCase()}`,
      employeeId: payload.employeeId!,
      reviewStatus: 'Pending Review',
      verifiedBy: actor,
      payrollReady: false,
      note: null,
      reviewedAt: new Date().toISOString(),
    };

  const updated: AttendanceRegisterControl = {
    ...base,
    reviewStatus: payload.reviewStatus ?? base.reviewStatus,
    verifiedBy: payload.verifiedBy?.trim() ?? base.verifiedBy,
    payrollReady: payload.payrollReady ?? base.payrollReady,
    note: payload.note?.trim() ?? base.note,
    reviewedAt: new Date().toISOString(),
  };

  const next = existing
    ? controls.map((item) => (item.employeeId === payload.employeeId ? updated : item))
    : [...controls, updated];
  await writeAttendanceRegisterControls(next);
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-register',
    entityId: updated.id,
    action: 'ATTENDANCE_REGISTER_UPDATED',
    actor,
    summary: `${actor} updated attendance register control for ${updated.employeeId} to ${updated.reviewStatus}.`,
    before: (existing || base) as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return ok(updated);
}
