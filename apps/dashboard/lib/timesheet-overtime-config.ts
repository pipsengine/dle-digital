import type { OvertimeAuthorization, OvertimeBookingOptions } from '@/lib/timesheet-entry-shared';

export type { OvertimeAuthorization, OvertimeBookingOptions } from '@/lib/timesheet-entry-shared';

export type OvertimeAuthorizationBooking = OvertimeAuthorization & {
  reason: string;
};

const readBool = (value: string | undefined, fallback: boolean) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const isProduction = () => process.env.NODE_ENV === 'production';

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Timesheet overtime booking.
 * - Local/dev: enabled by default (NODE_ENV !== production).
 * - Production deploy: set HRIS_TIMESHEET_OVERTIME_BOOKING_ENABLED=false.
 */
export const isTimesheetOvertimeBookingEnabled = () =>
  readBool(process.env.HRIS_TIMESHEET_OVERTIME_BOOKING_ENABLED, !isProduction());

/**
 * Relaxed rules for local E2E testing (PM-approved counts; synthetic auth if none exist).
 * Disabled in production unless explicitly turned on.
 */
export const isTimesheetOvertimeDevRelaxed = () =>
  isTimesheetOvertimeBookingEnabled() &&
  readBool(process.env.HRIS_TIMESHEET_OVERTIME_DEV_RELAXED, !isProduction());

/**
 * Post approved overtime onto payroll-ready timesheets (e.g. June corrections after first payroll run).
 * Disabled in production unless explicitly turned on.
 */
export const isTimesheetOvertimeRetroCorrection = () =>
  isTimesheetOvertimeBookingEnabled() &&
  readBool(process.env.HRIS_TIMESHEET_OVERTIME_RETRO_CORRECTION, !isProduction());

/**
 * Open overtime booking without MD authorization (test/reconciliation until go-live).
 * Disabled in production unless explicitly turned on.
 */
export const isTimesheetOvertimeOpenBooking = () =>
  isTimesheetOvertimeBookingEnabled() &&
  readBool(process.env.HRIS_TIMESHEET_OVERTIME_OPEN_BOOKING, !isProduction());

export const resolveOvertimeBookingOptions = (
  overrides?: Partial<OvertimeBookingOptions>,
): OvertimeBookingOptions => ({
  enabled: overrides?.enabled ?? isTimesheetOvertimeBookingEnabled(),
  devRelaxed: overrides?.devRelaxed ?? isTimesheetOvertimeDevRelaxed(),
  retroCorrection: overrides?.retroCorrection ?? isTimesheetOvertimeRetroCorrection(),
  openBooking: overrides?.openBooking ?? isTimesheetOvertimeOpenBooking(),
});

export const approvedOvertimeStatuses = (devRelaxed = isTimesheetOvertimeDevRelaxed()): string[] =>
  devRelaxed ? ['MD Approved', 'Project Manager Approved'] : ['MD Approved'];

const normalizeStatus = (status: string) => status.trim().replace(/\s+/g, '_');

const editableTimesheetStatuses = new Set(['Draft', 'Returned', 'Rejected']);

const retroOvertimeTimesheetStatuses = new Set([
  'Submitted',
  'Supervisor_Reviewed',
  'Project_Manager_Reviewed',
  'Cost_Control_Reviewed',
  'HR_Reviewed',
  'Project_Control_Reviewed',
  'Approved',
  'HR_Acknowledged',
  'Locked',
]);

/** Approved/posted timesheets that can receive retro overtime corrections. */
export const isRetroOvertimeTimesheetStatus = (status: string) =>
  retroOvertimeTimesheetStatuses.has(normalizeStatus(status));

export const canBookOvertimeOnTimesheet = (
  header: { status: string } | null | undefined,
  period: { status: string } | null | undefined,
  options: OvertimeBookingOptions,
) => {
  if (!options.enabled || !header) return false;
  const status = normalizeStatus(header.status || 'Draft');
  const periodOpen = period?.status === 'Open';
  if (periodOpen && editableTimesheetStatuses.has(status)) return true;
  if (!options.retroCorrection) return false;
  return isRetroOvertimeTimesheetStatus(status);
};

const mergeProjects = (
  catalog: Array<{ code: string; name: string }>,
  lineProjects: Array<{ code: string; name: string }> = [],
) => {
  const merged = new Map<string, { code: string; name: string }>();
  for (const project of [...catalog, ...lineProjects]) {
    const code = String(project.code || '').trim().toUpperCase();
    if (!code) continue;
    merged.set(code, { code, name: project.name || code });
  }
  return Array.from(merged.values());
};

const syntheticAuthorizations = (
  projects: Array<{ code: string; name: string }>,
  crewSize: number,
  idPrefix: string,
  reason: string,
): OvertimeAuthorizationBooking[] => {
  const headcount = Math.max(crewSize, 1);
  const source = projects.length ? projects : [{ code: 'GENERAL', name: 'General Project Work' }];
  return source.slice(0, 8).map((project) => ({
    id: `${idPrefix}-${project.code}`,
    projectCode: project.code,
    projectName: project.name,
    requestedHours: round1(Math.max(crewSize * 24, headcount * 12)),
    requestedHeadcount: headcount,
    workCenter: '',
    reason,
  }));
};

/**
 * Resolve overtime authorizations for the timesheet UI and booking API.
 * When openBooking is on, MD workflow authorizations are ignored until go-live.
 */
export const resolveOvertimeAuthorizationsForBooking = (
  authorizations: OvertimeAuthorization[],
  projects: Array<{ code: string; name: string }>,
  crewSize: number,
  options: OvertimeBookingOptions,
  lineProjects: Array<{ code: string; name: string }> = [],
): OvertimeAuthorizationBooking[] => {
  if (!options.enabled) return [];

  const mergedProjects = mergeProjects(projects, lineProjects);
  const headcount = Math.max(crewSize, 1);

  if (options.openBooking) {
    return syntheticAuthorizations(
      mergedProjects,
      headcount,
      'open-ot',
      'Open test booking — MD authorization not required until go-live.',
    );
  }

  if (options.devRelaxed && authorizations.length === 0) {
    return syntheticAuthorizations(
      mergedProjects,
      headcount,
      'dev-ot',
      'Dev/test synthetic authorization.',
    );
  }

  return authorizations.map((auth) => ({
    ...auth,
    reason: 'MD approved overtime authorization.',
  }));
};

/** @deprecated Use resolveOvertimeAuthorizationsForBooking */
export const augmentDevOvertimeAuthorizations = (
  authorizations: OvertimeAuthorization[],
  projects: Array<{ code: string; name: string }>,
  crewSize: number,
  options: OvertimeBookingOptions,
): OvertimeAuthorization[] =>
  resolveOvertimeAuthorizationsForBooking(authorizations, projects, crewSize, options);
