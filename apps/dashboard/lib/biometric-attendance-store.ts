import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type DeviceOperationalStatus = 'Online' | 'Degraded' | 'Offline' | 'Maintenance';
export type SyncHealth = 'Healthy' | 'Delayed' | 'Failed';

export type BiometricDeviceRecord = {
  id: string;
  deviceCode: string;
  deviceName: string;
  location: string;
  site: string;
  deviceType: 'Facial Terminal' | 'Fingerprint Terminal' | 'Hybrid Terminal' | 'Mobile Gateway';
  operationalStatus: DeviceOperationalStatus;
  syncHealth: SyncHealth;
  lastSyncAt: string;
  lastPunchAt: string | null;
  enrolledEmployees: number;
  matchedPunches: number;
  unmatchedPunches: number;
  supervisorOverrides: number;
  batteryLevelPct: number | null;
  networkStrengthPct: number | null;
  incidentNote: string | null;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'biometric-attendance.json');

const defaultDevices: BiometricDeviceRecord[] = [
  {
    id: 'bio-head-office-gate-a',
    deviceCode: 'BIO-HO-001',
    deviceName: 'Gate A Biometric',
    location: 'Lagos HQ',
    site: 'Head Office',
    deviceType: 'Hybrid Terminal',
    operationalStatus: 'Online',
    syncHealth: 'Healthy',
    lastSyncAt: '2026-05-29T08:15:00.000Z',
    lastPunchAt: '2026-05-29T08:11:00.000Z',
    enrolledEmployees: 62,
    matchedPunches: 41,
    unmatchedPunches: 1,
    supervisorOverrides: 2,
    batteryLevelPct: 92,
    networkStrengthPct: 96,
    incidentNote: null,
  },
  {
    id: 'bio-onne-main',
    deviceCode: 'BIO-ONN-001',
    deviceName: 'Onne Main Reader',
    location: 'Port Harcourt',
    site: 'Onne Yard',
    deviceType: 'Fingerprint Terminal',
    operationalStatus: 'Degraded',
    syncHealth: 'Delayed',
    lastSyncAt: '2026-05-29T08:05:00.000Z',
    lastPunchAt: '2026-05-29T08:31:00.000Z',
    enrolledEmployees: 48,
    matchedPunches: 29,
    unmatchedPunches: 4,
    supervisorOverrides: 3,
    batteryLevelPct: 71,
    networkStrengthPct: 64,
    incidentNote: 'Intermittent network latency is delaying transaction sync from the yard terminal.',
  },
  {
    id: 'bio-fabrication-access',
    deviceCode: 'BIO-FAB-001',
    deviceName: 'Fabrication Access Reader',
    location: 'Warri',
    site: 'Fabrication Yard',
    deviceType: 'Facial Terminal',
    operationalStatus: 'Online',
    syncHealth: 'Healthy',
    lastSyncAt: '2026-05-29T08:12:00.000Z',
    lastPunchAt: '2026-05-29T08:22:00.000Z',
    enrolledEmployees: 55,
    matchedPunches: 34,
    unmatchedPunches: 1,
    supervisorOverrides: 1,
    batteryLevelPct: 88,
    networkStrengthPct: 89,
    incidentNote: null,
  },
  {
    id: 'bio-marine-jetty',
    deviceCode: 'BIO-MAR-001',
    deviceName: 'Marine Jetty Reader',
    location: 'Bonny',
    site: 'Marine Base',
    deviceType: 'Hybrid Terminal',
    operationalStatus: 'Offline',
    syncHealth: 'Failed',
    lastSyncAt: '2026-05-29T06:42:00.000Z',
    lastPunchAt: '2026-05-29T07:19:00.000Z',
    enrolledEmployees: 37,
    matchedPunches: 14,
    unmatchedPunches: 5,
    supervisorOverrides: 4,
    batteryLevelPct: 19,
    networkStrengthPct: 21,
    incidentNote: 'Power fluctuation took the terminal offline after the early-morning rotation punches.',
  },
  {
    id: 'bio-mobile-gateway',
    deviceCode: 'BIO-ABJ-001',
    deviceName: 'Mobile Attendance Gateway',
    location: 'Abuja',
    site: 'Liaison Office',
    deviceType: 'Mobile Gateway',
    operationalStatus: 'Online',
    syncHealth: 'Healthy',
    lastSyncAt: '2026-05-29T08:16:00.000Z',
    lastPunchAt: '2026-05-29T08:10:00.000Z',
    enrolledEmployees: 18,
    matchedPunches: 9,
    unmatchedPunches: 0,
    supervisorOverrides: 0,
    batteryLevelPct: null,
    networkStrengthPct: 99,
    incidentNote: null,
  },
];

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify(defaultDevices, null, 2), 'utf8');
  }
};

export const readBiometricDevices = async (): Promise<BiometricDeviceRecord[]> => {
  await ensureStore();
  let stored: BiometricDeviceRecord[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as BiometricDeviceRecord[];
  } catch {
    stored = [];
  }

  const storedById = new Map(stored.map((device) => [device.id, device]));
  const merged = defaultDevices.map((device) => ({
    ...device,
    ...(storedById.get(device.id) || {}),
    id: device.id,
    deviceCode: device.deviceCode,
    deviceName: device.deviceName,
    location: device.location,
    site: device.site,
    deviceType: device.deviceType,
  }));

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeBiometricDevices = async (devices: BiometricDeviceRecord[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(devices, null, 2), 'utf8');
};
