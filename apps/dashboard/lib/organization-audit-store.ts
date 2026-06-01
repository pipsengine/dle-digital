import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type OrganizationAuditEvent = {
  id: string;
  module: 'positions' | 'workforce-planning' | 'vacancy-management' | 'attendance';
  entityType: 'position' | 'workforce-request' | 'vacancy' | 'attendance-clock' | 'attendance-device' | 'attendance-mobile-site' | 'attendance-site' | 'attendance-register';
  entityId: string;
  action: string;
  actor: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'organization-audit-log.json');

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};

export const readOrganizationAuditLog = async (): Promise<OrganizationAuditEvent[]> => {
  await ensureStore();
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as OrganizationAuditEvent[];
  } catch {
    // Fall back to an empty audit trail if the file is missing or malformed.
  }

  await writeFile(FILE_PATH, JSON.stringify([], null, 2), 'utf8');
  return [];
};

export const writeOrganizationAuditLog = async (events: OrganizationAuditEvent[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(events, null, 2), 'utf8');
};

export const appendOrganizationAuditEvent = async (event: Omit<OrganizationAuditEvent, 'id' | 'createdAt'>) => {
  const existing = await readOrganizationAuditLog();
  const nextEvent: OrganizationAuditEvent = {
    ...event,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [nextEvent, ...existing].slice(0, 5000);
  await writeOrganizationAuditLog(next);
  return nextEvent;
};
