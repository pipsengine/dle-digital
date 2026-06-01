import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildBaseAttendanceRecords } from '@/lib/attendance-data';

export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Returned' | 'Locked';
export type TimesheetApprovalDecision = 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'Locked';
export type TimesheetEntryMode =
  | 'Employee Self-Service'
  | 'Supervisor Entry'
  | 'Bulk Team Entry'
  | 'Project Engineer Entry'
  | 'Foreman Entry';
export type HourType =
  | 'Project Work'
  | 'Internal Work'
  | 'Meeting'
  | 'Training'
  | 'Travel'
  | 'Idle'
  | 'Standby'
  | 'Equipment Downtime'
  | 'Material Delay'
  | 'Waiting Instruction'
  | 'Leave'
  | 'Holiday'
  | 'Overtime'
  | 'Rework'
  | 'Safety Meeting'
  | 'Toolbox Talk'
  | 'No Assignment';
export type AllocationBucket =
  | 'Productive Time'
  | 'Non-Productive Time'
  | 'Idle Time'
  | 'Rework Time'
  | 'Safety Meeting Time'
  | 'Toolbox Talk Time'
  | 'Travel Time'
  | 'Waiting Material Time'
  | 'Waiting Instruction Time'
  | 'Equipment Downtime Time'
  | 'Leave Time';
export type ColumnKind = 'project' | 'internal' | 'idle' | 'leave';

export type DisplayColumn = {
  code: string;
  label: string;
  kind: ColumnKind;
};

export type ProjectCatalogItem = {
  code: string;
  label: string;
  name: string;
  kind: ColumnKind;
  hourType: HourType;
  billable: boolean;
  phase: string;
  workPackage: string;
  activity: string;
  task: string;
  costCode: string;
  wbs: string;
  client: string | null;
};

export type TimesheetAllocation = {
  id: string;
  projectCode: string;
  projectName: string;
  projectLabel: string;
  kind: ColumnKind;
  hourType: HourType;
  bucket: AllocationBucket;
  phase: string;
  workPackage: string;
  activity: string;
  task: string;
  costCode: string;
  wbs: string;
  hours: number;
  billable: boolean;
  labourRateNgn: number;
  labourCostNgn: number;
};

export type TimesheetApprovalStep = {
  stage: 'Employee' | 'Supervisor' | 'Project Engineer' | 'Department Head' | 'HR' | 'Payroll';
  status: TimesheetApprovalDecision;
  by: string | null;
  actedAt: string | null;
  comment: string | null;
};

export type TimesheetRecord = {
  id: string;
  timesheetDate: string;
  employeeId: string;
  employeeName: string;
  department: string;
  businessUnit: string;
  location: string;
  site: string;
  supervisor: string;
  shift: string;
  labourRateNgn: number;
  standardHours: number;
  overtimeHours: number;
  approvedOvertimeHours: number;
  mode: TimesheetEntryMode;
  status: TimesheetStatus;
  remarks: string | null;
  submittedAt: string | null;
  updatedAt: string;
  allocations: TimesheetAllocation[];
  approvals: TimesheetApprovalStep[];
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'timesheet-entry.json');
const TIMESHEET_DATE = '2026-05-29';

const projectCatalog: ProjectCatalogItem[] = [
  { code: 'PRJ-001', label: 'PRJ-001', name: 'Dangote Refinery Pipe Fabrication', kind: 'project', hourType: 'Project Work', billable: true, phase: 'Mechanical', workPackage: 'Pipe Shop', activity: 'Pipe Fabrication', task: 'Fit-Up and Welding', costCode: 'FAB-001', wbs: 'PRJ-001.MEC.PSHOP.FAB', client: 'Dangote Refinery' },
  { code: 'PRJ-002', label: 'PRJ-002', name: 'NLNG Train 7 E&I Works', kind: 'project', hourType: 'Project Work', billable: true, phase: 'E&I', workPackage: 'Commissioning Loop', activity: 'Instrumentation Calibration', task: 'Loop Testing', costCode: 'EIN-014', wbs: 'PRJ-002.EIN.CAL.LOOP', client: 'NLNG' },
  { code: 'PRJ-003', label: 'PRJ-003', name: 'Bonga Shutdown Support', kind: 'project', hourType: 'Project Work', billable: true, phase: 'Shutdown', workPackage: 'Maintenance Bundle', activity: 'Shutdown Maintenance', task: 'Critical Path Support', costCode: 'SD-301', wbs: 'PRJ-003.SD.MNT.CRIT', client: 'Shell' },
  { code: 'PRJ-004', label: 'PRJ-004', name: 'Marine Logistics Operations', kind: 'project', hourType: 'Project Work', billable: true, phase: 'Operations', workPackage: 'Jetty Support', activity: 'Marine Logistics', task: 'Crew and Materials Dispatch', costCode: 'OPS-003', wbs: 'PRJ-004.OPS.JETTY.LOG', client: 'Offshore Support' },
  { code: 'INTERNAL', label: 'INTERNAL', name: 'Internal Operations', kind: 'internal', hourType: 'Internal Work', billable: false, phase: 'Corporate', workPackage: 'Internal Delivery', activity: 'Internal Operations', task: 'Administrative Support', costCode: 'INT-001', wbs: 'INT.CORP.OPS', client: null },
  { code: 'TRAINING', label: 'TRAINING', name: 'Training and Competency', kind: 'internal', hourType: 'Training', billable: false, phase: 'Capability', workPackage: 'Workforce Development', activity: 'Training', task: 'Technical and HSE Training', costCode: 'TRN-010', wbs: 'INT.CAP.TRN', client: null },
  { code: 'MEETING', label: 'MEETING', name: 'Meeting and Coordination', kind: 'internal', hourType: 'Meeting', billable: false, phase: 'Coordination', workPackage: 'Team Governance', activity: 'Meeting', task: 'Production and Coordination Meeting', costCode: 'MGT-020', wbs: 'INT.MGT.MEET', client: null },
  { code: 'TRAVEL', label: 'TRAVEL', name: 'Work Travel', kind: 'internal', hourType: 'Travel', billable: false, phase: 'Mobilization', workPackage: 'Field Movement', activity: 'Travel', task: 'Travel to Worksite', costCode: 'TRV-100', wbs: 'INT.MOB.TRAVEL', client: null },
  { code: 'SAFETY', label: 'SAFETY', name: 'Safety Meeting Time', kind: 'internal', hourType: 'Safety Meeting', billable: false, phase: 'HSE', workPackage: 'Daily Safety', activity: 'Safety Meeting', task: 'Daily HSE Briefing', costCode: 'HSE-001', wbs: 'INT.HSE.SAFE', client: null },
  { code: 'TOOLBOX', label: 'TOOLBOX', name: 'Toolbox Talk Time', kind: 'internal', hourType: 'Toolbox Talk', billable: false, phase: 'HSE', workPackage: 'Toolbox Talk', activity: 'Toolbox Talk', task: 'Daily Toolbox Brief', costCode: 'HSE-002', wbs: 'INT.HSE.TBT', client: null },
  { code: 'REWORK', label: 'REWORK', name: 'Rework Time', kind: 'internal', hourType: 'Rework', billable: false, phase: 'Quality', workPackage: 'Correction', activity: 'Rework', task: 'Correction of Defects', costCode: 'QAL-310', wbs: 'INT.QLT.REWORK', client: null },
  { code: 'IDLE', label: 'IDLE', name: 'Idle Time', kind: 'idle', hourType: 'Idle', billable: false, phase: 'Idle', workPackage: 'Idle', activity: 'Idle Time', task: 'No Productive Work', costCode: 'IDL-001', wbs: 'IDL.TIME', client: null },
  { code: 'STANDBY', label: 'STANDBY', name: 'Standby Time', kind: 'idle', hourType: 'Standby', billable: false, phase: 'Idle', workPackage: 'Standby', activity: 'Standby', task: 'Awaiting Deployment', costCode: 'IDL-002', wbs: 'IDL.STANDBY', client: null },
  { code: 'WAIT_MATERIAL', label: 'WAIT_MATERIAL', name: 'Waiting for Materials', kind: 'idle', hourType: 'Material Delay', billable: false, phase: 'Idle', workPackage: 'Material Delay', activity: 'Waiting Material', task: 'Waiting for Material Release', costCode: 'IDL-003', wbs: 'IDL.MAT', client: null },
  { code: 'WAIT_INSTRUCTION', label: 'WAIT_INSTRUCTION', name: 'Waiting for Instructions', kind: 'idle', hourType: 'Waiting Instruction', billable: false, phase: 'Idle', workPackage: 'Instruction Delay', activity: 'Waiting Instruction', task: 'Waiting for Supervisor Direction', costCode: 'IDL-004', wbs: 'IDL.INSTR', client: null },
  { code: 'EQUIP_DOWN', label: 'EQUIP_DOWN', name: 'Equipment Downtime', kind: 'idle', hourType: 'Equipment Downtime', billable: false, phase: 'Idle', workPackage: 'Downtime', activity: 'Equipment Downtime', task: 'Equipment Unavailable', costCode: 'IDL-005', wbs: 'IDL.EQDN', client: null },
  { code: 'NO_ASSIGNMENT', label: 'NO_ASSIGNMENT', name: 'No Assignment', kind: 'idle', hourType: 'No Assignment', billable: false, phase: 'Idle', workPackage: 'No Assignment', activity: 'No Assignment', task: 'No Work Assigned', costCode: 'IDL-006', wbs: 'IDL.NOASSIGN', client: null },
  { code: 'LEAVE', label: 'LEAVE', name: 'Leave and Authorized Absence', kind: 'leave', hourType: 'Leave', billable: false, phase: 'Leave', workPackage: 'Leave', activity: 'Leave', task: 'Authorized Leave Day', costCode: 'LV-001', wbs: 'LEAVE.AUTH', client: null },
];

export const timesheetMatrixColumns: DisplayColumn[] = projectCatalog.map((item) => ({
  code: item.code,
  label: item.label,
  kind: item.kind,
}));

const approvalStages: TimesheetApprovalStep['stage'][] = ['Employee', 'Supervisor', 'Project Engineer', 'Department Head', 'HR', 'Payroll'];

const rateForEmployee = (index: number, jobTitle: string) => {
  const base = jobTitle.includes('Engineer') ? 11000 : jobTitle.includes('Supervisor') ? 12500 : jobTitle.includes('Coordinator') ? 9500 : 8000;
  return base + (index % 4) * 850;
};

const bucketForHourType = (hourType: HourType): AllocationBucket => {
  if (hourType === 'Project Work') return 'Productive Time';
  if (hourType === 'Internal Work' || hourType === 'Meeting' || hourType === 'Training') return 'Non-Productive Time';
  if (hourType === 'Rework') return 'Rework Time';
  if (hourType === 'Safety Meeting') return 'Safety Meeting Time';
  if (hourType === 'Toolbox Talk') return 'Toolbox Talk Time';
  if (hourType === 'Travel') return 'Travel Time';
  if (hourType === 'Material Delay') return 'Waiting Material Time';
  if (hourType === 'Waiting Instruction') return 'Waiting Instruction Time';
  if (hourType === 'Equipment Downtime') return 'Equipment Downtime Time';
  if (hourType === 'Leave' || hourType === 'Holiday') return 'Leave Time';
  return 'Idle Time';
};

const catalogByCode = new Map(projectCatalog.map((item) => [item.code, item]));

const buildAllocation = (employeeId: string, code: string, hours: number, labourRateNgn: number, suffix: string): TimesheetAllocation => {
  const meta = catalogByCode.get(code) || projectCatalog[0];
  return {
    id: `${employeeId.toLowerCase()}-${suffix}-${code.toLowerCase()}`,
    projectCode: meta.code,
    projectName: meta.name,
    projectLabel: meta.label,
    kind: meta.kind,
    hourType: meta.hourType,
    bucket: bucketForHourType(meta.hourType),
    phase: meta.phase,
    workPackage: meta.workPackage,
    activity: meta.activity,
    task: meta.task,
    costCode: meta.costCode,
    wbs: meta.wbs,
    hours,
    billable: meta.billable,
    labourRateNgn,
    labourCostNgn: Math.round(hours * labourRateNgn),
  };
};

const buildDefaultAllocations = (
  employeeId: string,
  jobTitle: string,
  businessUnit: string,
  location: string,
  status: string,
  labourRateNgn: number,
  index: number,
): TimesheetAllocation[] => {
  if (status === 'On Leave') return [buildAllocation(employeeId, 'LEAVE', 8, labourRateNgn, 'leave')];
  if (status === 'Excused') return [buildAllocation(employeeId, 'LEAVE', 8, labourRateNgn, 'excused')];
  if (status === 'Absent') return [buildAllocation(employeeId, 'NO_ASSIGNMENT', 8, labourRateNgn, 'absent')];

  if (location === 'Bonny') {
    return [
      buildAllocation(employeeId, 'PRJ-004', 4, labourRateNgn, 'main'),
      buildAllocation(employeeId, 'TOOLBOX', 0.5, labourRateNgn, 'toolbox'),
      buildAllocation(employeeId, status === 'Late' ? 'WAIT_INSTRUCTION' : 'EQUIP_DOWN', 1.5, labourRateNgn, 'delay'),
      buildAllocation(employeeId, 'PRJ-003', 2, labourRateNgn, 'support'),
    ];
  }

  if (location === 'Port Harcourt') {
    return [
      buildAllocation(employeeId, 'PRJ-001', 3, labourRateNgn, 'main'),
      buildAllocation(employeeId, 'PRJ-002', 2, labourRateNgn, 'support'),
      buildAllocation(employeeId, 'SAFETY', 0.5, labourRateNgn, 'safety'),
      buildAllocation(employeeId, status === 'Late' ? 'WAIT_MATERIAL' : 'MEETING', 1, labourRateNgn, 'coord'),
      buildAllocation(employeeId, 'IDLE', 1.5, labourRateNgn, 'idle'),
    ];
  }

  if (location === 'Warri') {
    return [
      buildAllocation(employeeId, 'PRJ-001', 4, labourRateNgn, 'main'),
      buildAllocation(employeeId, 'REWORK', jobTitle.includes('QA') ? 1.5 : 1, labourRateNgn, 'rework'),
      buildAllocation(employeeId, 'TOOLBOX', 0.5, labourRateNgn, 'toolbox'),
      buildAllocation(employeeId, status === 'Late' ? 'WAIT_INSTRUCTION' : 'PRJ-003', 2.5, labourRateNgn, 'support'),
    ];
  }

  if (businessUnit.includes('Corporate')) {
    return [
      buildAllocation(employeeId, status === 'Remote' ? 'INTERNAL' : 'PRJ-002', 4, labourRateNgn, 'main'),
      buildAllocation(employeeId, 'MEETING', 1.5, labourRateNgn, 'meeting'),
      buildAllocation(employeeId, 'TRAINING', index % 3 === 0 ? 1.5 : 1, labourRateNgn, 'training'),
      buildAllocation(employeeId, status === 'Remote' ? 'TRAVEL' : 'INTERNAL', status === 'Remote' ? 1 : 1.5, labourRateNgn, 'support'),
    ];
  }

  return [
    buildAllocation(employeeId, 'PRJ-001', 3, labourRateNgn, 'main'),
    buildAllocation(employeeId, 'PRJ-002', 2, labourRateNgn, 'second'),
    buildAllocation(employeeId, 'MEETING', 1, labourRateNgn, 'meeting'),
    buildAllocation(employeeId, 'IDLE', 2, labourRateNgn, 'idle'),
  ];
};

const buildApprovals = (employeeName: string, status: TimesheetStatus): TimesheetApprovalStep[] =>
  approvalStages.map((stage, index) => {
    if (status === 'Draft') return { stage, status: index === 0 ? 'Pending' : 'Pending', by: null, actedAt: null, comment: null };
    if (status === 'Submitted') {
      return index === 0
        ? { stage, status: 'Approved', by: employeeName, actedAt: `${TIMESHEET_DATE}T17:15:00.000Z`, comment: 'Timesheet submitted.' }
        : { stage, status: 'Pending', by: null, actedAt: null, comment: null };
    }
    if (status === 'Approved') {
      const actors = [employeeName, 'Site Supervisor', 'Project Engineer', 'Department Head', 'HR Business Partner', 'Payroll Controller'];
      return { stage, status: 'Approved', by: actors[index], actedAt: `${TIMESHEET_DATE}T${String(10 + index).padStart(2, '0')}:00:00.000Z`, comment: index === 5 ? 'Cleared for payroll.' : 'Approved.' };
    }
    if (status === 'Rejected') return index < 2 ? { stage, status: index === 0 ? 'Approved' : 'Rejected', by: index === 0 ? employeeName : 'Site Supervisor', actedAt: `${TIMESHEET_DATE}T11:00:00.000Z`, comment: index === 1 ? 'Returned due to incomplete allocation.' : 'Submitted.' } : { stage, status: 'Pending', by: null, actedAt: null, comment: null };
    if (status === 'Returned') return index < 2 ? { stage, status: index === 0 ? 'Approved' : 'Returned', by: index === 0 ? employeeName : 'Site Supervisor', actedAt: `${TIMESHEET_DATE}T11:30:00.000Z`, comment: index === 1 ? 'Please correct WBS and idle classification.' : 'Submitted.' } : { stage, status: 'Pending', by: null, actedAt: null, comment: null };
    return index < 6 ? { stage, status: 'Locked', by: index === 5 ? 'Payroll Controller' : `${stage} Approval`, actedAt: `${TIMESHEET_DATE}T18:00:00.000Z`, comment: 'Locked after payroll close.' } : { stage, status: 'Pending', by: null, actedAt: null, comment: null };
  });

const normalizeHours = (allocations: TimesheetAllocation[]) =>
  allocations
    .filter((item) => item.hours > 0)
    .map((item) => ({
      ...item,
      hours: Math.round(item.hours * 10) / 10,
      labourCostNgn: Math.round(item.hours * item.labourRateNgn),
    }));

const buildDefaultRecords = (): TimesheetRecord[] =>
  buildBaseAttendanceRecords().map((employee, index) => {
    const labourRateNgn = rateForEmployee(index, employee.jobTitle);
    let allocations = normalizeHours(buildDefaultAllocations(employee.employeeId, employee.jobTitle, employee.businessUnit, employee.location, employee.status, labourRateNgn, index));
    const totalHours = allocations.reduce((sum, item) => sum + item.hours, 0);
    if (totalHours < 8 && employee.status !== 'On Leave' && employee.status !== 'Excused' && employee.status !== 'Absent') {
      allocations = normalizeHours([...allocations, buildAllocation(employee.employeeId, 'IDLE', Math.round((8 - totalHours) * 10) / 10, labourRateNgn, 'topup')]);
    }
    const adjustedTotal = allocations.reduce((sum, item) => sum + item.hours, 0);
    const overtimeHours = Math.max(0, Math.round((adjustedTotal - 8) * 10) / 10);
    const approvedOvertimeHours = index % 6 === 0 ? overtimeHours : 0;
    const status: TimesheetStatus = overtimeHours > approvedOvertimeHours ? 'Draft' : employee.status === 'Absent' ? 'Returned' : index % 5 === 0 ? 'Submitted' : 'Draft';

    return {
      id: `ts-${employee.employeeId.toLowerCase()}-${TIMESHEET_DATE}`,
      timesheetDate: TIMESHEET_DATE,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      department: employee.department,
      businessUnit: employee.businessUnit,
      location: employee.location,
      site: employee.site,
      supervisor: employee.supervisor,
      shift: employee.shift,
      labourRateNgn,
      standardHours: 8,
      overtimeHours,
      approvedOvertimeHours,
      mode: employee.location === 'Bonny' ? 'Foreman Entry' : index % 4 === 0 ? 'Project Engineer Entry' : 'Employee Self-Service',
      status,
      remarks:
        employee.status === 'Absent'
          ? 'Absence requires supervisor confirmation.'
          : overtimeHours > approvedOvertimeHours
            ? 'Overtime captured but pending approval.'
            : null,
      submittedAt: status === 'Draft' ? null : `${TIMESHEET_DATE}T17:15:00.000Z`,
      updatedAt: `${TIMESHEET_DATE}T17:30:00.000Z`,
      allocations,
      approvals: buildApprovals(employee.employeeName, status),
    };
  });

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify(buildDefaultRecords(), null, 2), 'utf8');
  }
};

export const readTimesheetRecords = async (): Promise<TimesheetRecord[]> => {
  await ensureStore();
  let stored: TimesheetRecord[] = [];
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed as TimesheetRecord[];
  } catch {
    stored = [];
  }

  const defaults = buildDefaultRecords();
  const storedById = new Map(stored.map((record) => [record.id, record]));
  const merged = defaults.map((record) => {
    const existing = storedById.get(record.id);
    if (!existing) return record;
    return {
      ...record,
      ...existing,
      employeeName: record.employeeName,
      department: record.department,
      businessUnit: record.businessUnit,
      location: record.location,
      site: record.site,
      supervisor: record.supervisor,
      shift: record.shift,
      labourRateNgn: existing.labourRateNgn || record.labourRateNgn,
      allocations: normalizeHours(existing.allocations?.length ? existing.allocations : record.allocations),
      approvals: existing.approvals?.length ? existing.approvals : record.approvals,
    };
  });

  await writeFile(FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
};

export const writeTimesheetRecords = async (records: TimesheetRecord[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
};

export const getTimesheetProjectCatalog = () => projectCatalog;
export const getTimesheetMatrixColumns = () => timesheetMatrixColumns;
export const getTimesheetDate = () => TIMESHEET_DATE;
export const buildDefaultTimesheetRecords = () => buildDefaultRecords();
