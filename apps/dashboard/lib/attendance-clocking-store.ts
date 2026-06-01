import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildBaseAttendanceRecords, type AttendanceStatus, type BaseAttendanceRecord, type BiometricSource, type Shift } from '@/lib/attendance-data';

export type ClockingMode = 'Ready To Clock In' | 'Clocked In' | 'Clocked Out' | 'Exception';

export type ClockingEvent = {
  id: string;
  employeeId: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'MANUAL_OVERRIDE';
  timestamp: string;
  source: BiometricSource;
  actor: string;
  note: string | null;
};

export type ClockingRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  businessUnit: string;
  jobTitle: string;
  location: string;
  site: string;
  shift: Shift;
  attendanceStatus: AttendanceStatus;
  scheduledStart: string;
  scheduledEnd: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  minutesLate: number;
  overtimeHours: number;
  source: BiometricSource;
  supervisor: string;
  clockingMode: ClockingMode;
  deviceName: string;
  lastActionAt: string | null;
  exceptionNote: string | null;
  events: ClockingEvent[];
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'attendance-clocking.json');

const determineClockingMode = (record: Pick<ClockingRecord, 'attendanceStatus' | 'clockInTime' | 'clockOutTime'>): ClockingMode => {
  if (record.attendanceStatus === 'Absent' || record.attendanceStatus === 'Excused' || record.attendanceStatus === 'On Leave') return 'Exception';
  if (!record.clockInTime) return 'Ready To Clock In';
  if (record.clockInTime && !record.clockOutTime) return 'Clocked In';
  return 'Clocked Out';
};

const defaultDeviceName = (site: string) => {
  if (site === 'Head Office') return 'Gate A Biometric';
  if (site === 'Onne Yard') return 'Onne Main Reader';
  if (site === 'Fabrication Yard') return 'Fabrication Access Reader';
  if (site === 'Marine Base') return 'Marine Jetty Reader';
  return 'Mobile Attendance Gateway';
};

const buildDefaultRecord = (record: BaseAttendanceRecord): ClockingRecord => ({
  id: `clk-${record.employeeId.toLowerCase()}`,
  employeeId: record.employeeId,
  employeeName: record.employeeName,
  department: record.department,
  businessUnit: record.businessUnit,
  jobTitle: record.jobTitle,
  location: record.location,
  site: record.site,
  shift: record.shift,
  attendanceStatus: record.status,
  scheduledStart: record.scheduledStart,
  scheduledEnd: record.scheduledEnd,
  clockInTime: record.checkInTime,
  clockOutTime: record.checkOutTime,
  minutesLate: record.minutesLate,
  overtimeHours: record.overtimeHours,
  source: record.biometricSource,
  supervisor: record.supervisor,
  clockingMode: determineClockingMode({ attendanceStatus: record.status, clockInTime: record.checkInTime, clockOutTime: record.checkOutTime }),
  deviceName: defaultDeviceName(record.site),
  lastActionAt: record.checkOutTime || record.checkInTime,
  exceptionNote: record.status === 'Absent' ? 'No valid punch captured for the shift.' : record.status === 'On Leave' ? 'Approved leave day.' : record.status === 'Excused' ? 'Supervisor-approved absence.' : null,
  events: record.checkInTime
    ? [
        {
          id: `evt-in-${record.employeeId.toLowerCase()}`,
          employeeId: record.employeeId,
          action: 'CLOCK_IN',
          timestamp: `2026-05-29T${record.checkInTime}:00.000Z`,
          source: record.biometricSource,
          actor: 'Attendance Device',
          note: null,
        },
        ...(record.checkOutTime
          ? [
              {
                id: `evt-out-${record.employeeId.toLowerCase()}`,
                employeeId: record.employeeId,
                action: 'CLOCK_OUT' as const,
                timestamp: `2026-05-29T${record.checkOutTime}:00.000Z`,
                source: record.biometricSource,
                actor: 'Attendance Device',
                note: null,
              },
            ]
          : []),
      ]
    : [],
});

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify([], null, 2), 'utf8');
  }
};

export const readClockingRecords = async (): Promise<ClockingRecord[]> => {
  await ensureStore();
  let stored: ClockingRecord[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as ClockingRecord[];
  } catch {
    stored = [];
  }

  const defaults = buildBaseAttendanceRecords().map(buildDefaultRecord);
  const storedByEmployee = new Map(stored.map((record) => [record.employeeId, record]));

  const merged = defaults.map((record) => {
    const existing = storedByEmployee.get(record.employeeId);
    if (!existing) return record;

    const next = {
      ...record,
      ...existing,
      employeeName: record.employeeName,
      department: record.department,
      businessUnit: record.businessUnit,
      jobTitle: record.jobTitle,
      location: record.location,
      site: record.site,
      shift: record.shift,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      supervisor: record.supervisor,
      deviceName: existing.deviceName || record.deviceName,
      events: existing.events || record.events,
    };

    return {
      ...next,
      clockingMode: determineClockingMode(next),
    };
  });

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeClockingRecords = async (records: ClockingRecord[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
};
