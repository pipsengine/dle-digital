import { NextResponse } from 'next/server';
import { buildBaseAttendanceRecords } from '@/lib/attendance-data';
import { readClockingRecords } from '@/lib/attendance-clocking-store';
import { readBiometricDevices } from '@/lib/biometric-attendance-store';
import { readMobileAttendancePolicies } from '@/lib/mobile-attendance-store';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import {
  readSiteAttendanceControls,
  writeSiteAttendanceControls,
  type SiteAttendanceControl,
  type SiteEscalationStatus,
} from '@/lib/site-attendance-store';
import type { StructureInsight } from '@/lib/organization-data';

type SiteHealth = 'Healthy' | 'Needs Attention' | 'Critical';

type SiteAttendanceRecord = {
  id: string;
  location: string;
  site: string;
  headcount: number;
  present: number;
  late: number;
  absent: number;
  remote: number;
  excused: number;
  attendanceRatePct: number;
  punctualityPct: number;
  overtimeHours: number;
  activeClockedIn: number;
  clockExceptions: number;
  biometricStatus: string;
  biometricSync: string;
  mobilePolicy: string;
  mobilePunches: number;
  riskyMobilePunches: number;
  escalationStatus: SiteEscalationStatus;
  actionOwner: string;
  transportRisk: 'Low' | 'Medium' | 'High';
  nextReviewAt: string;
  controlNote: string | null;
  health: SiteHealth;
  shiftCoverage: Array<{ shift: string; planned: number; present: number }>;
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
    healthySites: number;
    attentionSites: number;
    criticalSites: number;
    attendanceRatePct: number;
    activeClockedIn: number;
    exceptions: number;
    riskyMobilePunches: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    healths: SiteHealth[];
    escalationStatuses: SiteEscalationStatus[];
  };
  sites: SiteAttendanceRecord[];
  insights: StructureInsight[];
};

type UpdatePayload = {
  siteControlId?: string;
  escalationStatus?: SiteEscalationStatus;
  actionOwner?: string;
  transportRisk?: 'Low' | 'Medium' | 'High';
  nextReviewAt?: string;
  controlNote?: string;
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const average = (values: number[]) => {
  if (!values.length) return 100;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const attendanceRate = (records: ReturnType<typeof buildBaseAttendanceRecords>) => {
  if (!records.length) return 0;
  const available = records.filter((item) => item.status !== 'On Leave' && item.status !== 'Excused');
  if (!available.length) return 100;
  const effective = available.filter((item) => item.status === 'Present' || item.status === 'Late' || item.status === 'Remote').length;
  return Math.round((effective / available.length) * 1000) / 10;
};

const punctualityRate = (records: ReturnType<typeof buildBaseAttendanceRecords>) => {
  const checkedIn = records.filter((item) => item.status === 'Present' || item.status === 'Late');
  if (!checkedIn.length) return 100;
  const punctual = checkedIn.filter((item) => item.minutesLate <= 5).length;
  return Math.round((punctual / checkedIn.length) * 1000) / 10;
};

const buildPayload = async (request: Request): Promise<Payload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const attendance = buildBaseAttendanceRecords();
  const clocking = await readClockingRecords();
  const biometric = await readBiometricDevices();
  const mobile = await readMobileAttendancePolicies();
  const controls = await readSiteAttendanceControls();

  const groupKeys = Array.from(new Set(attendance.map((item) => `${item.location}||${item.site}`)));
  const sites: SiteAttendanceRecord[] = groupKeys.map((key, index) => {
    const [location, site] = key.split('||');
    const siteAttendance = attendance.filter((item) => item.location === location && item.site === site);
    const siteClocking = clocking.filter((item) => item.location === location && item.site === site);
    const siteBiometric = biometric.find((item) => item.location === location && item.site === site);
    const siteMobile = mobile.find((item) => item.location === location && item.site === site);
    const siteControl = controls.find((item) => item.location === location && item.site === site);
    const mobilePunches = siteClocking.filter((item) => item.source === 'Mobile Check-In' || item.attendanceStatus === 'Remote').length;
    const riskyMobilePunches = siteClocking.filter(
      (item) =>
        item.location === location &&
        item.site === site &&
        (item.source === 'Supervisor Override' || item.clockingMode === 'Exception' || item.minutesLate >= 10),
    ).length;

    const rate = attendanceRate(siteAttendance);
    const punctuality = punctualityRate(siteAttendance);
    const absent = siteAttendance.filter((item) => item.status === 'Absent').length;
    const late = siteAttendance.filter((item) => item.status === 'Late').length;
    const exceptions = siteClocking.filter((item) => item.clockingMode === 'Exception').length;
    const health: SiteHealth =
      absent > 1 || exceptions > 1 || siteBiometric?.operationalStatus === 'Offline' || rate < 80
        ? 'Critical'
        : late > 1 || riskyMobilePunches > 0 || siteBiometric?.operationalStatus === 'Degraded' || rate < 90
          ? 'Needs Attention'
          : 'Healthy';

    return {
      id: siteControl?.id || `site-att-${index + 1}`,
      location,
      site,
      headcount: siteAttendance.length,
      present: siteAttendance.filter((item) => item.status === 'Present').length,
      late,
      absent,
      remote: siteAttendance.filter((item) => item.status === 'Remote').length,
      excused: siteAttendance.filter((item) => item.status === 'Excused' || item.status === 'On Leave').length,
      attendanceRatePct: rate,
      punctualityPct: punctuality,
      overtimeHours: Math.round(siteAttendance.reduce((sum, item) => sum + item.overtimeHours, 0) * 10) / 10,
      activeClockedIn: siteClocking.filter((item) => item.clockingMode === 'Clocked In').length,
      clockExceptions: exceptions,
      biometricStatus: siteBiometric?.operationalStatus || 'Unavailable',
      biometricSync: siteBiometric?.syncHealth || 'Unavailable',
      mobilePolicy: siteMobile?.policyStatus || 'Unavailable',
      mobilePunches,
      riskyMobilePunches,
      escalationStatus: siteControl?.escalationStatus || 'Normal Monitoring',
      actionOwner: siteControl?.actionOwner || siteAttendance[0]?.supervisor || 'Unassigned',
      transportRisk: siteControl?.transportRisk || 'Low',
      nextReviewAt: siteControl?.nextReviewAt || new Date().toISOString(),
      controlNote: siteControl?.controlNote || null,
      health,
      shiftCoverage: ['Day', 'Night', 'Rotational'].map((shift) => {
        const members = siteAttendance.filter((item) => item.shift === shift);
        const presentCount = members.filter((item) => item.status === 'Present' || item.status === 'Late' || item.status === 'Remote').length;
        return { shift, planned: members.length, present: presentCount };
      }),
    };
  });

  const weakest = [...sites].sort((a, b) => a.attendanceRatePct - b.attendanceRatePct)[0];
  const critical = [...sites].find((item) => item.health === 'Critical');
  const highestRisk = [...sites].sort((a, b) => b.riskyMobilePunches + b.clockExceptions - (a.riskyMobilePunches + a.clockExceptions))[0];

  const insights: StructureInsight[] = [
    {
      id: 'site-ins-1',
      severity: weakest && weakest.attendanceRatePct < 85 ? 'high' : 'medium',
      title: `${weakest?.site || 'A site'} has the weakest attendance rate`,
      recommendation: 'Focus supervisor follow-up, verify shift readiness, and confirm attendance blockers at the site immediately.',
    },
    {
      id: 'site-ins-2',
      severity: critical ? 'high' : 'medium',
      title: `${critical?.site || 'A site'} is currently in critical attendance posture`,
      recommendation: 'Escalate operational coverage, attendance exceptions, and device availability until the site returns to stable control.',
    },
    {
      id: 'site-ins-3',
      severity: highestRisk && highestRisk.riskyMobilePunches + highestRisk.clockExceptions >= 2 ? 'medium' : 'low',
      title: `${highestRisk?.site || 'A site'} has the highest control exception load`,
      recommendation: 'Review mobile punch evidence, open clocking sessions, and local escalation ownership for the site.',
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
      sites: sites.length,
      healthySites: sites.filter((item) => item.health === 'Healthy').length,
      attentionSites: sites.filter((item) => item.health === 'Needs Attention').length,
      criticalSites: sites.filter((item) => item.health === 'Critical').length,
      attendanceRatePct: average(sites.map((item) => item.attendanceRatePct)),
      activeClockedIn: sites.reduce((sum, item) => sum + item.activeClockedIn, 0),
      exceptions: sites.reduce((sum, item) => sum + item.clockExceptions, 0),
      riskyMobilePunches: sites.reduce((sum, item) => sum + item.riskyMobilePunches, 0),
    },
    filterOptions: {
      locations: Array.from(new Set(sites.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(sites.map((item) => item.site))).sort((a, b) => a.localeCompare(b)),
      healths: ['Healthy', 'Needs Attention', 'Critical'],
      escalationStatuses: ['Normal Monitoring', 'Supervisor Follow-Up', 'HR Escalation', 'Critical Response'],
    },
    sites: sites.sort((a, b) => a.site.localeCompare(b.site)),
    insights,
  };
};

const validatePayload = (payload: UpdatePayload, controls: SiteAttendanceControl[]) => {
  const escalationStatuses: SiteEscalationStatus[] = ['Normal Monitoring', 'Supervisor Follow-Up', 'HR Escalation', 'Critical Response'];
  const transportRisks: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];
  if (!isNonEmpty(payload.siteControlId)) return 'A site attendance control is required.';
  if (!controls.some((item) => item.id === payload.siteControlId)) return 'The selected site attendance control could not be found.';
  if (payload.escalationStatus && !escalationStatuses.includes(payload.escalationStatus)) return 'A valid escalation status is required.';
  if (payload.transportRisk && !transportRisks.includes(payload.transportRisk)) return 'A valid transport risk is required.';
  if (payload.actionOwner !== undefined && !isNonEmpty(payload.actionOwner)) return 'Action owner cannot be empty.';
  if (payload.nextReviewAt !== undefined && Number.isNaN(Date.parse(payload.nextReviewAt))) return 'Next review must be a valid date.';
  if (payload.controlNote !== undefined && !isNonEmpty(payload.controlNote)) return 'Control note cannot be empty.';
  return null;
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to manage site attendance controls.');

  const payload = (await request.json()) as UpdatePayload;
  const controls = await readSiteAttendanceControls();
  const validationError = validatePayload(payload, controls);
  if (validationError) return err(400, validationError);

  const actor = access.actor;
  const before = controls.find((item) => item.id === payload.siteControlId)!;
  const next = controls.map((item) =>
    item.id === payload.siteControlId
      ? {
          ...item,
          escalationStatus: payload.escalationStatus ?? item.escalationStatus,
          actionOwner: payload.actionOwner?.trim() ?? item.actionOwner,
          transportRisk: payload.transportRisk ?? item.transportRisk,
          nextReviewAt: payload.nextReviewAt ?? item.nextReviewAt,
          controlNote: payload.controlNote?.trim() ?? item.controlNote,
        }
      : item,
  );

  const updated = next.find((item) => item.id === payload.siteControlId)!;
  await writeSiteAttendanceControls(next);
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-site',
    entityId: updated.id,
    action: 'SITE_ATTENDANCE_CONTROL_UPDATED',
    actor,
    summary: `${actor} updated site attendance control for ${updated.site} to ${updated.escalationStatus}.`,
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return ok(updated);
}
