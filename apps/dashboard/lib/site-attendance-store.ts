import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SiteEscalationStatus = 'Normal Monitoring' | 'Supervisor Follow-Up' | 'HR Escalation' | 'Critical Response';

export type SiteAttendanceControl = {
  id: string;
  location: string;
  site: string;
  escalationStatus: SiteEscalationStatus;
  actionOwner: string;
  transportRisk: 'Low' | 'Medium' | 'High';
  nextReviewAt: string;
  controlNote: string | null;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'site-attendance.json');

const defaultControls: SiteAttendanceControl[] = [
  {
    id: 'site-att-lagos-head-office',
    location: 'Lagos HQ',
    site: 'Head Office',
    escalationStatus: 'Normal Monitoring',
    actionOwner: 'B. Adeyemi',
    transportRisk: 'Low',
    nextReviewAt: '2026-05-29T12:00:00.000Z',
    controlNote: 'Corporate site operating within expected attendance tolerance.',
  },
  {
    id: 'site-att-portharcourt-onne-yard',
    location: 'Port Harcourt',
    site: 'Onne Yard',
    escalationStatus: 'HR Escalation',
    actionOwner: 'M. Ibrahim',
    transportRisk: 'Medium',
    nextReviewAt: '2026-05-29T10:30:00.000Z',
    controlNote: 'Late arrivals and one absence require supervisor confirmation and cover review.',
  },
  {
    id: 'site-att-warri-fabrication-yard',
    location: 'Warri',
    site: 'Fabrication Yard',
    escalationStatus: 'Supervisor Follow-Up',
    actionOwner: 'K. Johnson',
    transportRisk: 'Medium',
    nextReviewAt: '2026-05-29T11:00:00.000Z',
    controlNote: 'Monitor shift punctuality and confirm yard access timing.',
  },
  {
    id: 'site-att-bonny-marine-base',
    location: 'Bonny',
    site: 'Marine Base',
    escalationStatus: 'Critical Response',
    actionOwner: 'S. Danjuma',
    transportRisk: 'High',
    nextReviewAt: '2026-05-29T09:15:00.000Z',
    controlNote: 'Terminal outage and attendance exceptions require immediate operational oversight.',
  },
  {
    id: 'site-att-abuja-liaison-office',
    location: 'Abuja',
    site: 'Liaison Office',
    escalationStatus: 'Normal Monitoring',
    actionOwner: 'L. Yusuf',
    transportRisk: 'Low',
    nextReviewAt: '2026-05-29T13:00:00.000Z',
    controlNote: 'Small site monitored through mobile attendance and remote coverage.',
  },
];

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify(defaultControls, null, 2), 'utf8');
  }
};

export const readSiteAttendanceControls = async (): Promise<SiteAttendanceControl[]> => {
  await ensureStore();
  let stored: SiteAttendanceControl[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as SiteAttendanceControl[];
  } catch {
    stored = [];
  }

  const storedById = new Map(stored.map((item) => [item.id, item]));
  const merged = defaultControls.map((item) => ({
    ...item,
    ...(storedById.get(item.id) || {}),
    id: item.id,
    location: item.location,
    site: item.site,
  }));

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeSiteAttendanceControls = async (controls: SiteAttendanceControl[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(controls, null, 2), 'utf8');
};
