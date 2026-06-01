import { NextResponse } from 'next/server';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { readBiometricDevices, writeBiometricDevices, type BiometricDeviceRecord, type DeviceOperationalStatus, type SyncHealth } from '@/lib/biometric-attendance-store';
import { readClockingRecords } from '@/lib/attendance-clocking-store';
import type { AttendanceStatus } from '@/lib/attendance-data';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import type { StructureInsight } from '@/lib/organization-data';

type BiometricException = {
  id: string;
  employeeId: string;
  employeeName: string;
  site: string;
  location: string;
  issueType: 'Missing Punch' | 'Supervisor Override' | 'Mobile Punch' | 'Unmatched Punch';
  severity: 'High' | 'Medium' | 'Low';
  attendanceStatus: AttendanceStatus;
  deviceName: string;
  note: string;
  lastActionAt: string | null;
  supervisor: string;
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
    totalDevices: number;
    onlineDevices: number;
    degradedDevices: number;
    offlineDevices: number;
    failedSyncDevices: number;
    exceptionCount: number;
    unmatchedPunches: number;
    overrideCount: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    statuses: DeviceOperationalStatus[];
    syncHealths: SyncHealth[];
    issueTypes: BiometricException['issueType'][];
  };
  devices: BiometricDeviceRecord[];
  exceptions: BiometricException[];
  insights: StructureInsight[];
};

type UpdatePayload = {
  deviceId?: string;
  operationalStatus?: DeviceOperationalStatus;
  syncHealth?: SyncHealth;
  incidentNote?: string;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const resolveIssueType = (record: Awaited<ReturnType<typeof readClockingRecords>>[number]): BiometricException['issueType'] => {
  if (record.source === 'Supervisor Override') return 'Supervisor Override';
  if (record.source === 'Mobile Check-In') return 'Mobile Punch';
  if (record.clockingMode === 'Exception') return 'Missing Punch';
  return 'Unmatched Punch';
};

const resolveSeverity = (record: Awaited<ReturnType<typeof readClockingRecords>>[number]): BiometricException['severity'] => {
  if (record.clockingMode === 'Exception' || record.source === 'Supervisor Override') return 'High';
  if (record.source === 'Mobile Check-In' || record.minutesLate >= 20) return 'Medium';
  return 'Low';
};

const buildPayload = async (request: Request): Promise<Payload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const devices = await readBiometricDevices();
  const records = await readClockingRecords();

  const deviceBySite = new Map(devices.map((device) => [`${device.location}||${device.site}`, device]));
  const exceptions: BiometricException[] = records
    .filter((record) => record.clockingMode === 'Exception' || record.source !== 'Biometric Device')
    .map((record) => {
      const device = deviceBySite.get(`${record.location}||${record.site}`);
      const issueType = resolveIssueType(record);
      return {
        id: `bio-ex-${record.employeeId.toLowerCase()}`,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        site: record.site,
        location: record.location,
        issueType,
        severity: resolveSeverity(record),
        attendanceStatus: record.attendanceStatus,
        deviceName: device?.deviceName || record.deviceName,
        note: record.exceptionNote || (issueType === 'Mobile Punch' ? 'Attendance captured outside a fixed biometric terminal.' : 'Attendance requires biometric validation review.'),
        lastActionAt: record.lastActionAt,
        supervisor: record.supervisor,
      };
    })
    .sort((a, b) => {
      const severityOrder: BiometricException['severity'][] = ['High', 'Medium', 'Low'];
      const severityCompare = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityCompare !== 0) return severityCompare;
      return a.employeeName.localeCompare(b.employeeName);
    });

  const worstDevice = [...devices].sort((a, b) => {
    const statusOrder: DeviceOperationalStatus[] = ['Offline', 'Degraded', 'Maintenance', 'Online'];
    const statusCompare = statusOrder.indexOf(a.operationalStatus) - statusOrder.indexOf(b.operationalStatus);
    if (statusCompare !== 0) return statusCompare;
    return b.unmatchedPunches - a.unmatchedPunches;
  })[0];

  const mostExceptionsSite = [...devices].sort((a, b) => b.unmatchedPunches + b.supervisorOverrides - (a.unmatchedPunches + a.supervisorOverrides))[0];
  const failedSyncDevice = [...devices].find((device) => device.syncHealth === 'Failed');

  const insights: StructureInsight[] = [
    {
      id: 'bio-ins-1',
      severity: worstDevice && worstDevice.operationalStatus !== 'Online' ? 'high' : 'medium',
      title: `${worstDevice?.deviceName || 'A device'} has the highest operational risk`,
      recommendation: 'Stabilize device connectivity, verify power integrity, and confirm onsite fallback attendance procedures until the device returns to normal health.',
    },
    {
      id: 'bio-ins-2',
      severity: failedSyncDevice ? 'high' : 'medium',
      title: `${failedSyncDevice?.deviceName || 'A biometric device'} is failing sync`,
      recommendation: 'Restore sync before payroll cutoff and replay buffered transactions to avoid attendance gaps.',
    },
    {
      id: 'bio-ins-3',
      severity: mostExceptionsSite && mostExceptionsSite.unmatchedPunches + mostExceptionsSite.supervisorOverrides >= 5 ? 'high' : 'low',
      title: `${mostExceptionsSite?.site || 'A site'} has the highest biometric exception load`,
      recommendation: 'Review enrollment coverage, punch discipline, and supervisor override dependency for the affected site.',
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
      totalDevices: devices.length,
      onlineDevices: devices.filter((device) => device.operationalStatus === 'Online').length,
      degradedDevices: devices.filter((device) => device.operationalStatus === 'Degraded' || device.operationalStatus === 'Maintenance').length,
      offlineDevices: devices.filter((device) => device.operationalStatus === 'Offline').length,
      failedSyncDevices: devices.filter((device) => device.syncHealth === 'Failed').length,
      exceptionCount: exceptions.length,
      unmatchedPunches: devices.reduce((sum, device) => sum + device.unmatchedPunches, 0),
      overrideCount: devices.reduce((sum, device) => sum + device.supervisorOverrides, 0),
    },
    filterOptions: {
      locations: Array.from(new Set(devices.map((device) => device.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(devices.map((device) => device.site))).sort((a, b) => a.localeCompare(b)),
      statuses: ['Online', 'Degraded', 'Offline', 'Maintenance'],
      syncHealths: ['Healthy', 'Delayed', 'Failed'],
      issueTypes: ['Missing Punch', 'Supervisor Override', 'Mobile Punch', 'Unmatched Punch'],
    },
    devices: devices.sort((a, b) => a.site.localeCompare(b.site)),
    exceptions,
    insights,
  };
};

const validatePayload = (payload: UpdatePayload, devices: BiometricDeviceRecord[]) => {
  const statuses: DeviceOperationalStatus[] = ['Online', 'Degraded', 'Offline', 'Maintenance'];
  const syncHealths: SyncHealth[] = ['Healthy', 'Delayed', 'Failed'];
  if (!isNonEmpty(payload.deviceId)) return 'A biometric device is required.';
  if (!devices.some((device) => device.id === payload.deviceId)) return 'The selected biometric device could not be found.';
  if (payload.operationalStatus && !statuses.includes(payload.operationalStatus)) return 'A valid operational status is required.';
  if (payload.syncHealth && !syncHealths.includes(payload.syncHealth)) return 'A valid sync health status is required.';
  if (payload.incidentNote !== undefined && !isNonEmpty(payload.incidentNote)) return 'Incident note cannot be empty.';
  return null;
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to manage biometric attendance operations.');

  const payload = (await request.json()) as UpdatePayload;
  const devices = await readBiometricDevices();
  const validationError = validatePayload(payload, devices);
  if (validationError) return err(400, validationError);

  const actor = access.actor;
  const before = devices.find((device) => device.id === payload.deviceId)!;
  const next = devices.map((device) =>
    device.id === payload.deviceId
      ? {
          ...device,
          operationalStatus: payload.operationalStatus ?? device.operationalStatus,
          syncHealth: payload.syncHealth ?? device.syncHealth,
          incidentNote: payload.incidentNote?.trim() ?? device.incidentNote,
          lastSyncAt: new Date().toISOString(),
        }
      : device,
  );

  const updated = next.find((device) => device.id === payload.deviceId)!;
  await writeBiometricDevices(next);
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-device',
    entityId: updated.id,
    action: 'BIOMETRIC_DEVICE_UPDATED',
    actor,
    summary: `${actor} updated biometric device ${updated.deviceCode} to ${updated.operationalStatus} / ${updated.syncHealth}.`,
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return ok(updated);
}
