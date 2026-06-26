import {
  DAILY_BREAK_HOURS,
  DEFAULT_BREAK_IDLE_REASON_ID,
  DEFAULT_BREAK_IDLE_REASON_NAME,
  GROSS_TIMESHEET_HOURS,
  STANDARD_TIMESHEET_HOURS,
  type TimesheetDayContext,
  type TimesheetLine,
  timesheetDayRulesForDate,
  normalizeIdleAllocations,
  normalizeProjectAllocations,
  sumProjectAllocationHours,
  consolidateProjectAllocationsToPrimary,
  resolvePrimaryProjectCode,
  attendanceDurationFromClock,
  repairStackedOvertimeProductiveHours,
  canonicalProjectCode,
} from '@/lib/timesheet-entry-shared';

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Apply break-time defaults (1h break) on clocked-in lines. */
export const applyTimesheetLineDefaults = (
  line: TimesheetLine,
  dayContext: TimesheetDayContext,
  projectCodes: string[] = [],
): TimesheetLine => {
  if (!line.clockIn) {
    return {
      ...line,
      projectAllocations: normalizeProjectAllocations(line.projectAllocations),
      idleAllocations: normalizeIdleAllocations(line.idleAllocations || []),
    };
  }

  const rules = timesheetDayRulesForDate(dayContext.date, dayContext.holidayDates);
  const primaryCode = resolvePrimaryProjectCode(projectCodes, line.projectAllocations);
  const existingProjects = normalizeProjectAllocations(line.projectAllocations);
  const primaryName = existingProjects.find((item) => item.projectCode === primaryCode)?.projectName || primaryCode;

  let projectAllocations = existingProjects.map((item) => {
    if (canonicalProjectCode(item.projectCode) !== primaryCode) return item;
    return {
      ...item,
      hours: repairStackedOvertimeProductiveHours(
        Number(item.hours || 0),
        rules.standardProductiveHours,
        item.remarks,
      ),
    };
  });
  let idleAllocations = normalizeIdleAllocations(
    (line.idleAllocations || []).length
      ? line.idleAllocations || []
      : [{ reasonId: DEFAULT_BREAK_IDLE_REASON_ID, reasonName: DEFAULT_BREAK_IDLE_REASON_NAME, hours: DAILY_BREAK_HOURS, remarks: null }],
  );

  const hasBreak = idleAllocations.some((item) => item.hours > 0);

  if (!hasBreak) {
    idleAllocations = normalizeIdleAllocations([
      { reasonId: DEFAULT_BREAK_IDLE_REASON_ID, reasonName: DEFAULT_BREAK_IDLE_REASON_NAME, hours: DAILY_BREAK_HOURS, remarks: null },
    ]);
  }

  const usedHours = sumProjectAllocationHours(projectAllocations);
  const idleHours = round1(idleAllocations.reduce((sum, item) => sum + Number(item.hours || 0), 0));
  const totalHours = round1(usedHours + idleHours);

  projectAllocations = consolidateProjectAllocationsToPrimary(projectAllocations, primaryCode, primaryName);

  const consolidatedUsed = sumProjectAllocationHours(projectAllocations);
  const consolidatedTotal = round1(consolidatedUsed + idleHours);
  const clockDuration = attendanceDurationFromClock(line.clockIn, line.clockOut);
  const attendanceDuration =
    clockDuration !== null && clockDuration > 0
      ? clockDuration
      : line.clockIn && !line.clockOut
        ? round1(Math.min(line.attendanceDuration || 0, rules.grossHours))
        : line.attendanceDuration;

  return {
    ...line,
    projectAllocations,
    idleAllocations,
    attendanceDuration,
    usedHours: consolidatedUsed,
    idleHours,
    totalHours: consolidatedTotal,
    variance: round1(consolidatedTotal - rules.grossHours),
  };
};

export const defaultProductiveHoursForDate = (dayContext: TimesheetDayContext) =>
  timesheetDayRulesForDate(dayContext.date, dayContext.holidayDates).standardProductiveHours;

export const defaultGrossHoursForDate = (dayContext: TimesheetDayContext) =>
  timesheetDayRulesForDate(dayContext.date, dayContext.holidayDates).grossHours;

export const weekdayGrossHours = () => GROSS_TIMESHEET_HOURS;

export const weekdayStandardHours = () => STANDARD_TIMESHEET_HOURS;
