import { NextResponse } from 'next/server';
import { readClockingRecords } from '@/lib/attendance-clocking-store';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import {
  readMobileAttendancePolicies,
  writeMobileAttendancePolicies,
  type GeofenceHealth,
  type MobileAttendanceSitePolicy,
  type PolicyStatus,
} from '@/lib/mobile-attendance-store';
import type { StructureInsight } from '@/lib/organization-data';

type MobilePunchRecord = {
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
  clockInTime: string | null;
  clockOutTime: string | null;
  lastActionAt: string | null;
  supervisor: string;
  source: string;
  gpsConfidence: 'High' | 'Medium' | 'Low';
  geofenceResult: 'Inside Fence' | 'Near Edge' | 'Outside Fence';
  deviceTrust: 'Managed' | 'Known' | 'Unverified';
  riskLevel: 'Low' | 'Medium' | 'High';
  note: string;
};

type MobileSiteSummary = {
  id: string;
  location: string;
  site: string;
  policyStatus: PolicyStatus;
  geofenceHealth: GeofenceHealth;
  expectedMobileUsers: number;
  actualMobilePunches: number;
  activeSessions: number;
  riskyPunches: number;
  complianceRatePct: number;
  lastComplianceReviewAt: string;
  incidentNote: string | null;
  allowedRadiusMeters: number;
  gpsAccuracyThresholdMeters: number;
  offlineSyncWindowMinutes: number;
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
    sites: number;
    activePolicies: number;
    mobilePunches: number;
    activeSessions: number;
    riskyPunches: number;
    breachedSites: number;
    complianceRatePct: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    policyStatuses: PolicyStatus[];
    geofenceHealths: GeofenceHealth[];
    riskLevels: MobilePunchRecord['riskLevel'][];
  };
  siteSummaries: MobileSiteSummary[];
  mobilePunches: MobilePunchRecord[];
  insights: StructureInsight[];
};

type UpdatePayload = {
  sitePolicyId?: string;
  policyStatus?: PolicyStatus;
  geofenceHealth?: GeofenceHealth;
  incidentNote?: string;
  allowedRadiusMeters?: number;
  gpsAccuracyThresholdMeters?: number;
  offlineSyncWindowMinutes?: number;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isPositive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const average = (values: number[]) => {
  if (!values.length) return 100;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const buildMobilePunches = async (): Promise<MobilePunchRecord[]> => {
  const records = await readClockingRecords();
  return records
    .filter((record) => record.source === 'Mobile Check-In' || record.attendanceStatus === 'Remote')
    .map((record) => {
      const outsideFence = record.location === 'Bonny' && record.site === 'Marine Base';
      const nearEdge = record.site === 'Liaison Office' || record.minutesLate >= 10;
      const geofenceResult: MobilePunchRecord['geofenceResult'] = outsideFence ? 'Outside Fence' : nearEdge ? 'Near Edge' : 'Inside Fence';
      const gpsConfidence: MobilePunchRecord['gpsConfidence'] =
        geofenceResult === 'Outside Fence' ? 'Low' : geofenceResult === 'Near Edge' ? 'Medium' : 'High';
      const deviceTrust: MobilePunchRecord['deviceTrust'] =
        record.source === 'Mobile Check-In' && record.attendanceStatus === 'Remote' ? 'Known' : record.source === 'Mobile Check-In' ? 'Managed' : 'Unverified';
      const riskLevel: MobilePunchRecord['riskLevel'] =
        geofenceResult === 'Outside Fence' || record.clockingMode === 'Exception'
          ? 'High'
          : geofenceResult === 'Near Edge' || deviceTrust === 'Known'
            ? 'Medium'
            : 'Low';

      return {
        id: `mob-${record.employeeId.toLowerCase()}`,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        businessUnit: record.businessUnit,
        department: record.department,
        jobTitle: record.jobTitle,
        location: record.location,
        site: record.site,
        shift: record.shift,
        attendanceStatus: record.attendanceStatus,
        clockingMode: record.clockingMode,
        clockInTime: record.clockInTime,
        clockOutTime: record.clockOutTime,
        lastActionAt: record.lastActionAt,
        supervisor: record.supervisor,
        source: record.source,
        gpsConfidence,
        geofenceResult,
        deviceTrust,
        riskLevel,
        note:
          record.exceptionNote ||
          (geofenceResult === 'Outside Fence'
            ? 'Mobile punch appears outside the configured geofence and requires review.'
            : record.attendanceStatus === 'Remote'
              ? 'Remote attendance is being captured through the approved mobile channel.'
              : 'Mobile punch was accepted within the configured policy window.'),
      };
    })
    .sort((a, b) => {
      const riskOrder: MobilePunchRecord['riskLevel'][] = ['High', 'Medium', 'Low'];
      const riskCompare = riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel);
      if (riskCompare !== 0) return riskCompare;
      return a.employeeName.localeCompare(b.employeeName);
    });
};

const buildPayload = async (request: Request): Promise<Payload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const policies = await readMobileAttendancePolicies();
  const mobilePunches = await buildMobilePunches();

  const siteSummaries: MobileSiteSummary[] = policies.map((policy) => {
    const sitePunches = mobilePunches.filter((item) => item.location === policy.location && item.site === policy.site);
    const riskyPunches = sitePunches.filter((item) => item.riskLevel !== 'Low').length;
    const activeSessions = sitePunches.filter((item) => item.clockingMode === 'Clocked In').length;
    const compliantPunches = sitePunches.filter((item) => item.riskLevel === 'Low').length;
    const complianceRatePct = sitePunches.length ? Math.round((compliantPunches / sitePunches.length) * 1000) / 10 : 100;

    return {
      ...policy,
      actualMobilePunches: sitePunches.length,
      activeSessions,
      riskyPunches,
      complianceRatePct,
    };
  });

  const highestRiskSite = [...siteSummaries].sort((a, b) => b.riskyPunches - a.riskyPunches)[0];
  const breachedSite = [...siteSummaries].find((item) => item.geofenceHealth === 'Breached');
  const lowestCompliance = [...siteSummaries].sort((a, b) => a.complianceRatePct - b.complianceRatePct)[0];

  const insights: StructureInsight[] = [
    {
      id: 'mob-ins-1',
      severity: breachedSite ? 'high' : 'medium',
      title: `${breachedSite?.site || 'A site'} is operating with geofence breach exposure`,
      recommendation: 'Review geofence calibration, confirm supervisor approvals, and tighten mobile punch acceptance until compliance stabilizes.',
    },
    {
      id: 'mob-ins-2',
      severity: highestRiskSite && highestRiskSite.riskyPunches >= 2 ? 'high' : 'low',
      title: `${highestRiskSite?.site || 'A site'} has the highest risky mobile punch load`,
      recommendation: 'Validate device trust, verify location evidence, and follow up with supervisors on out-of-policy mobile punches.',
    },
    {
      id: 'mob-ins-3',
      severity: lowestCompliance && lowestCompliance.complianceRatePct < 80 ? 'medium' : 'low',
      title: `${lowestCompliance?.site || 'A site'} has the weakest mobile attendance compliance`,
      recommendation: 'Revisit mobile attendance controls, radius settings, and user education for the affected site.',
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
      sites: siteSummaries.length,
      activePolicies: siteSummaries.filter((item) => item.policyStatus === 'Active').length,
      mobilePunches: mobilePunches.length,
      activeSessions: mobilePunches.filter((item) => item.clockingMode === 'Clocked In').length,
      riskyPunches: mobilePunches.filter((item) => item.riskLevel !== 'Low').length,
      breachedSites: siteSummaries.filter((item) => item.geofenceHealth === 'Breached').length,
      complianceRatePct: average(siteSummaries.map((item) => item.complianceRatePct)),
    },
    filterOptions: {
      locations: Array.from(new Set(siteSummaries.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(siteSummaries.map((item) => item.site))).sort((a, b) => a.localeCompare(b)),
      policyStatuses: ['Active', 'Restricted', 'Suspended'],
      geofenceHealths: ['Healthy', 'Warning', 'Breached'],
      riskLevels: ['Low', 'Medium', 'High'],
    },
    siteSummaries: siteSummaries.sort((a, b) => a.site.localeCompare(b.site)),
    mobilePunches,
    insights,
  };
};

const validatePayload = (payload: UpdatePayload, policies: MobileAttendanceSitePolicy[]) => {
  const statuses: PolicyStatus[] = ['Active', 'Restricted', 'Suspended'];
  const healths: GeofenceHealth[] = ['Healthy', 'Warning', 'Breached'];
  if (!isNonEmpty(payload.sitePolicyId)) return 'A mobile attendance site policy is required.';
  if (!policies.some((policy) => policy.id === payload.sitePolicyId)) return 'The selected mobile attendance policy could not be found.';
  if (payload.policyStatus && !statuses.includes(payload.policyStatus)) return 'A valid mobile attendance policy status is required.';
  if (payload.geofenceHealth && !healths.includes(payload.geofenceHealth)) return 'A valid geofence health value is required.';
  if (payload.incidentNote !== undefined && !isNonEmpty(payload.incidentNote)) return 'Incident note cannot be empty.';
  if (payload.allowedRadiusMeters !== undefined && !isPositive(payload.allowedRadiusMeters)) return 'Allowed radius must be a valid positive number.';
  if (payload.gpsAccuracyThresholdMeters !== undefined && !isPositive(payload.gpsAccuracyThresholdMeters)) return 'GPS accuracy threshold must be a valid positive number.';
  if (payload.offlineSyncWindowMinutes !== undefined && !isPositive(payload.offlineSyncWindowMinutes)) return 'Offline sync window must be a valid positive number.';
  return null;
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to manage mobile attendance operations.');

  const payload = (await request.json()) as UpdatePayload;
  const policies = await readMobileAttendancePolicies();
  const validationError = validatePayload(payload, policies);
  if (validationError) return err(400, validationError);

  const actor = access.actor;
  const before = policies.find((policy) => policy.id === payload.sitePolicyId)!;
  const next = policies.map((policy) =>
    policy.id === payload.sitePolicyId
      ? {
          ...policy,
          policyStatus: payload.policyStatus ?? policy.policyStatus,
          geofenceHealth: payload.geofenceHealth ?? policy.geofenceHealth,
          incidentNote: payload.incidentNote?.trim() ?? policy.incidentNote,
          allowedRadiusMeters: payload.allowedRadiusMeters ?? policy.allowedRadiusMeters,
          gpsAccuracyThresholdMeters: payload.gpsAccuracyThresholdMeters ?? policy.gpsAccuracyThresholdMeters,
          offlineSyncWindowMinutes: payload.offlineSyncWindowMinutes ?? policy.offlineSyncWindowMinutes,
          lastComplianceReviewAt: new Date().toISOString(),
        }
      : policy,
  );

  const updated = next.find((policy) => policy.id === payload.sitePolicyId)!;
  await writeMobileAttendancePolicies(next);
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-mobile-site',
    entityId: updated.id,
    action: 'MOBILE_ATTENDANCE_POLICY_UPDATED',
    actor,
    summary: `${actor} updated mobile attendance policy for ${updated.site} to ${updated.policyStatus} / ${updated.geofenceHealth}.`,
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return ok(updated);
}
