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

const DATA_DIR = process.env.DLE_HRIS_DATA_DIR ? path.resolve(process.env.DLE_HRIS_DATA_DIR) : path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'biometric-attendance.json');
const uniquePaths = (paths: Array<string | null | undefined>) => Array.from(new Set(paths.reduce<string[]>((items, item) => {
  if (item) items.push(path.normalize(item));
  return items;
}, [])));
const repoMirrorPath = (file: string) => {
  const normalizedFile = path.normalize(file);
  const markers = [
    path.normalize(path.join('deployment', 'iis', 'site', 'apps', 'dashboard', 'data', 'hris')),
    path.normalize(path.join('deployment', 'iis', 'site-publish', 'apps', 'dashboard', 'data', 'hris')),
  ];
  const marker = markers.find((candidate) => normalizedFile.toLowerCase().lastIndexOf(candidate.toLowerCase()) !== -1);
  if (!marker) return null;
  const markerIndex = normalizedFile.toLowerCase().lastIndexOf(marker.toLowerCase());
  const repoRoot = normalizedFile.slice(0, markerIndex);
  return path.join(repoRoot, 'apps', 'dashboard', 'data', 'hris', path.basename(normalizedFile));
};
const BIOMETRIC_FILE_PATHS = uniquePaths([
  FILE_PATH,
  repoMirrorPath(FILE_PATH),
  path.join(resolveDashboardRoot(), 'data', 'hris', 'biometric-attendance.json'),
  path.join(process.cwd(), 'apps', 'dashboard', 'data', 'hris', 'biometric-attendance.json'),
]);

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

const parseDevices = (raw: string): BiometricDeviceRecord[] => {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed as BiometricDeviceRecord[] : [];
};

const readDeviceFile = async (): Promise<BiometricDeviceRecord[]> => {
  for (const file of BIOMETRIC_FILE_PATHS) {
    try {
      return parseDevices(await readFile(file, 'utf8'));
    } catch {
      // Try the next candidate path.
    }
  }
  return [];
};

const writeDeviceFile = async (devices: BiometricDeviceRecord[], required: boolean) => {
  const content = JSON.stringify(devices, null, 2);
  let lastError: unknown = null;
  for (const file of BIOMETRIC_FILE_PATHS) {
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, 'utf8');
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (required && lastError) throw lastError;
  if (lastError) console.warn('[Biometric Attendance] Local JSON write skipped:', lastError instanceof Error ? lastError.message : lastError);
};

const ensureStore = async () => {
  for (const file of BIOMETRIC_FILE_PATHS) {
    try {
      await access(file);
      return;
    } catch {
      // Try the next candidate path.
    }
  }
  await writeDeviceFile(defaultDevices, false);
};

export const readBiometricDevices = async (): Promise<BiometricDeviceRecord[]> => {
  await ensureStore();
  const stored = await readDeviceFile();

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

  await writeDeviceFile(merged, false);
  return merged;
};

export const writeBiometricDevices = async (devices: BiometricDeviceRecord[]) => {
  await ensureStore();
  await writeDeviceFile(devices, true);
};
