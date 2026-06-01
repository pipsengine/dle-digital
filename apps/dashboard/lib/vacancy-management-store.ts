import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HealthStatus, PositionRecord } from '@/lib/organization-data';

export type VacancyRequisitionStatus = 'Open' | 'On Hold' | 'Cancelled';
export type VacancyStage = 'Intake' | 'Sourcing' | 'Screening' | 'Interview' | 'Offer' | 'Background Check' | 'Ready to Hire';
export type VacancyPriority = 'Critical' | 'High' | 'Medium';
export type VacancyApprovalStatus = 'Approved' | 'Pending Review' | 'Escalated';
export type VacancySourceChannel = 'Internal Mobility' | 'External Hire' | 'Referral' | 'Contract Conversion' | 'Campus';

export type VacancyPipeline = {
  sourced: number;
  screened: number;
  interviewed: number;
  finalists: number;
  offerExtended: number;
};

export type VacancyManagementRecord = {
  id: string;
  positionId: string;
  positionCode: string;
  title: string;
  department: string;
  businessUnit: string;
  location: string;
  gradeCode: string;
  positionType: PositionRecord['positionType'];
  positionStatus: PositionRecord['positionStatus'];
  criticality: PositionRecord['criticality'];
  replacementPriority: PositionRecord['replacementPriority'];
  healthStatus: HealthStatus;
  requisitionStatus: VacancyRequisitionStatus;
  recruitmentStage: VacancyStage;
  priority: VacancyPriority;
  approvalStatus: VacancyApprovalStatus;
  sourceChannel: VacancySourceChannel;
  recruiter: string;
  hiringManager: string;
  openedDate: string;
  targetFillDate: string;
  lastActivityDate: string;
  openDays: number;
  pipeline: VacancyPipeline;
  justification: string;
  riskNote: string;
  lifecycleStatus: 'Active' | 'Closed';
  closedAt: string | null;
  closureReason: string | null;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'vacancy-management.json');

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const subtractDays = (date: Date, days: number) => addDays(date, -days);

const defaultRecruiter = (position: PositionRecord) => {
  if (position.businessUnit === 'Operations') return 'Lead Recruiter, Operations';
  if (position.businessUnit === 'Projects') return 'Lead Recruiter, Projects';
  return 'Lead Recruiter, Corporate Services';
};

const defaultPriority = (position: PositionRecord): VacancyPriority => {
  if (position.criticality === 'Critical') return 'Critical';
  if (position.criticality === 'Core') return 'High';
  return 'Medium';
};

const defaultRequisitionStatus = (position: PositionRecord): VacancyRequisitionStatus => {
  if (position.positionStatus === 'Frozen') return 'On Hold';
  if (position.positionStatus === 'Under Review') return 'Open';
  return 'Open';
};

const defaultApprovalStatus = (position: PositionRecord): VacancyApprovalStatus => {
  if (position.positionStatus === 'Under Review') return 'Pending Review';
  if (position.criticality === 'Critical' && position.approvalCoveragePct < 90) return 'Escalated';
  return 'Approved';
};

const defaultStage = (position: PositionRecord): VacancyStage => {
  if (position.positionStatus === 'Frozen') return 'Intake';
  if (position.positionStatus === 'Under Review') return 'Intake';
  if (position.openDays >= 50) return 'Interview';
  if (position.openDays >= 30) return 'Screening';
  if (position.openDays >= 10) return 'Sourcing';
  return 'Intake';
};

const defaultPipeline = (position: PositionRecord): VacancyPipeline => {
  if (position.positionStatus === 'Frozen') {
    return { sourced: 0, screened: 0, interviewed: 0, finalists: 0, offerExtended: 0 };
  }
  if (position.positionStatus === 'Under Review') {
    return { sourced: 2, screened: 1, interviewed: 0, finalists: 0, offerExtended: 0 };
  }
  if (position.openDays >= 50) {
    return { sourced: 14, screened: 8, interviewed: 4, finalists: 2, offerExtended: 1 };
  }
  if (position.openDays >= 30) {
    return { sourced: 10, screened: 6, interviewed: 3, finalists: 1, offerExtended: 0 };
  }
  return { sourced: 6, screened: 3, interviewed: 1, finalists: 0, offerExtended: 0 };
};

const defaultSourceChannel = (position: PositionRecord): VacancySourceChannel => {
  if (!position.standardPosition) return 'External Hire';
  if (position.level === 'Entry') return 'Campus';
  if (position.positionType === 'Temporary') return 'Contract Conversion';
  if (position.criticality === 'Critical') return 'Referral';
  return 'Internal Mobility';
};

const buildDefaultRecord = (position: PositionRecord): VacancyManagementRecord => {
  const today = new Date();
  const openedDate = subtractDays(today, Math.max(position.openDays, 1));
  const targetDays = position.criticality === 'Critical' ? 30 : position.positionType === 'Temporary' ? 21 : 45;
  const targetFillDate = addDays(openedDate, targetDays);

  return {
    id: `vac-${position.id}`,
    positionId: position.id,
    positionCode: position.code,
    title: position.title,
    department: position.department,
    businessUnit: position.businessUnit,
    location: position.location,
    gradeCode: position.gradeCode,
    positionType: position.positionType,
    positionStatus: position.positionStatus,
    criticality: position.criticality,
    replacementPriority: position.replacementPriority,
    healthStatus: position.healthStatus,
    requisitionStatus: defaultRequisitionStatus(position),
    recruitmentStage: defaultStage(position),
    priority: defaultPriority(position),
    approvalStatus: defaultApprovalStatus(position),
    sourceChannel: defaultSourceChannel(position),
    recruiter: defaultRecruiter(position),
    hiringManager: position.reportingTo,
    openedDate: isoDate(openedDate),
    targetFillDate: isoDate(targetFillDate),
    lastActivityDate: isoDate(subtractDays(today, Math.min(Math.max(Math.floor(position.openDays / 4), 0), 10))),
    openDays: position.openDays,
    pipeline: defaultPipeline(position),
    justification: `Approved vacancy for ${position.title} in ${position.department} to sustain delivery capacity and position coverage.`,
    riskNote: position.criticality === 'Critical'
      ? 'Critical delivery exposure if the vacancy remains unresolved beyond the target fill date.'
      : 'Monitor pipeline conversion and maintain shortlist readiness to avoid delivery delays.',
    lifecycleStatus: 'Active',
    closedAt: null,
    closureReason: null,
  };
};

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};

export const readVacancyManagement = async (positions: PositionRecord[]): Promise<VacancyManagementRecord[]> => {
  await ensureStore();

  let stored: VacancyManagementRecord[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as VacancyManagementRecord[];
  } catch {
    stored = [];
  }

  const allPositionsById = new Map(positions.map((position) => [position.id, position]));
  const activePositions = positions.filter((position) => position.positionStatus !== 'Filled');
  const storedByPosition = new Map(stored.map((record) => [record.positionId, record]));

  const mergedActive = activePositions.map((position) => {
    const defaults = buildDefaultRecord(position);
    const existing = storedByPosition.get(position.id);
    if (!existing) return defaults;

    return {
      ...defaults,
      ...existing,
      id: defaults.id,
      positionId: position.id,
      positionCode: position.code,
      title: position.title,
      department: position.department,
      businessUnit: position.businessUnit,
      location: position.location,
      gradeCode: position.gradeCode,
      positionType: position.positionType,
      positionStatus: position.positionStatus,
      criticality: position.criticality,
      replacementPriority: position.replacementPriority,
      healthStatus: position.healthStatus,
      openDays: position.openDays,
      hiringManager: existing.hiringManager || defaults.hiringManager,
      pipeline: existing.pipeline || defaults.pipeline,
      lifecycleStatus: 'Active' as const,
      closedAt: null,
      closureReason: null,
    };
  });

  const historicalClosed = stored
    .filter((record) => !activePositions.some((position) => position.id === record.positionId))
    .map((record) => {
      const relatedPosition = allPositionsById.get(record.positionId);
      const alreadyClosed = record.lifecycleStatus === 'Closed';
      return {
        ...record,
        positionStatus: relatedPosition?.positionStatus ?? record.positionStatus,
        lifecycleStatus: 'Closed' as const,
        closedAt: alreadyClosed ? record.closedAt : isoDate(new Date()),
        closureReason: alreadyClosed
          ? record.closureReason
          : relatedPosition?.positionStatus === 'Filled'
            ? 'Position filled'
            : 'Position removed from active vacancy tracking',
      };
    });

  const merged = [...mergedActive, ...historicalClosed].sort((a, b) => b.lastActivityDate.localeCompare(a.lastActivityDate));

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeVacancyManagement = async (records: VacancyManagementRecord[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
};
