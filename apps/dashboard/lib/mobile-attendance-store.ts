import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type GeofenceHealth = 'Healthy' | 'Warning' | 'Breached';
export type PolicyStatus = 'Active' | 'Restricted' | 'Suspended';

export type MobileAttendanceSitePolicy = {
  id: string;
  location: string;
  site: string;
  policyStatus: PolicyStatus;
  geofenceHealth: GeofenceHealth;
  allowedRadiusMeters: number;
  expectedMobileUsers: number;
  gpsAccuracyThresholdMeters: number;
  offlineSyncWindowMinutes: number;
  lastComplianceReviewAt: string;
  incidentNote: string | null;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'mobile-attendance.json');

const defaultPolicies: MobileAttendanceSitePolicy[] = [
  {
    id: 'mobile-head-office',
    location: 'Lagos HQ',
    site: 'Head Office',
    policyStatus: 'Restricted',
    geofenceHealth: 'Warning',
    allowedRadiusMeters: 150,
    expectedMobileUsers: 8,
    gpsAccuracyThresholdMeters: 35,
    offlineSyncWindowMinutes: 20,
    lastComplianceReviewAt: '2026-05-29T08:00:00.000Z',
    incidentNote: 'Mobile punches are limited to approved field and leadership exceptions.',
  },
  {
    id: 'mobile-onne-yard',
    location: 'Port Harcourt',
    site: 'Onne Yard',
    policyStatus: 'Active',
    geofenceHealth: 'Healthy',
    allowedRadiusMeters: 250,
    expectedMobileUsers: 14,
    gpsAccuracyThresholdMeters: 40,
    offlineSyncWindowMinutes: 30,
    lastComplianceReviewAt: '2026-05-29T07:50:00.000Z',
    incidentNote: null,
  },
  {
    id: 'mobile-fabrication-yard',
    location: 'Warri',
    site: 'Fabrication Yard',
    policyStatus: 'Restricted',
    geofenceHealth: 'Warning',
    allowedRadiusMeters: 200,
    expectedMobileUsers: 6,
    gpsAccuracyThresholdMeters: 30,
    offlineSyncWindowMinutes: 20,
    lastComplianceReviewAt: '2026-05-29T07:55:00.000Z',
    incidentNote: 'Mobile fallback only when yard terminal is unavailable or supervisor-approved.',
  },
  {
    id: 'mobile-marine-base',
    location: 'Bonny',
    site: 'Marine Base',
    policyStatus: 'Active',
    geofenceHealth: 'Breached',
    allowedRadiusMeters: 350,
    expectedMobileUsers: 18,
    gpsAccuracyThresholdMeters: 45,
    offlineSyncWindowMinutes: 45,
    lastComplianceReviewAt: '2026-05-29T06:45:00.000Z',
    incidentNote: 'Mobile attendance is currently absorbing traffic due to biometric terminal outage.',
  },
  {
    id: 'mobile-liaison-office',
    location: 'Abuja',
    site: 'Liaison Office',
    policyStatus: 'Active',
    geofenceHealth: 'Healthy',
    allowedRadiusMeters: 120,
    expectedMobileUsers: 10,
    gpsAccuracyThresholdMeters: 25,
    offlineSyncWindowMinutes: 15,
    lastComplianceReviewAt: '2026-05-29T08:05:00.000Z',
    incidentNote: null,
  },
];

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify(defaultPolicies, null, 2), 'utf8');
  }
};

export const readMobileAttendancePolicies = async (): Promise<MobileAttendanceSitePolicy[]> => {
  await ensureStore();
  let stored: MobileAttendanceSitePolicy[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as MobileAttendanceSitePolicy[];
  } catch {
    stored = [];
  }

  const storedById = new Map(stored.map((policy) => [policy.id, policy]));
  const merged = defaultPolicies.map((policy) => ({
    ...policy,
    ...(storedById.get(policy.id) || {}),
    id: policy.id,
    location: policy.location,
    site: policy.site,
  }));

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeMobileAttendancePolicies = async (policies: MobileAttendanceSitePolicy[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(policies, null, 2), 'utf8');
};
