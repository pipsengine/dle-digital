import { NextResponse } from 'next/server';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import {
  buildDefaultTimesheetRecords,
  getTimesheetDate,
  getTimesheetMatrixColumns,
  getTimesheetProjectCatalog,
  readTimesheetRecords,
  writeTimesheetRecords,
  type DisplayColumn,
  type TimesheetAllocation,
  type TimesheetApprovalDecision,
  type TimesheetApprovalStep,
  type TimesheetEntryMode,
  type TimesheetRecord,
  type TimesheetStatus,
} from '@/lib/timesheet-entry-store';
import type { StructureInsight } from '@/lib/organization-data';

type TimesheetPayload = {
  generatedAt: string;
  timesheetDate: string;
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canApprove: boolean;
    canViewCosts: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalEmployees: number;
    bookedHours: number;
    usedHours: number;
    idleHours: number;
    projectHours: number;
    nonProjectHours: number;
    pendingApprovals: number;
    overtimeHours: number;
  };
  filterOptions: {
    departments: string[];
    projects: string[];
    locations: string[];
    supervisors: string[];
    shifts: string[];
    businessUnits: string[];
    modes: TimesheetEntryMode[];
    statuses: TimesheetStatus[];
  };
  matrixColumns: DisplayColumn[];
  projectCatalog: ReturnType<typeof getTimesheetProjectCatalog>;
  records: TimesheetRecord[];
  analytics: {
    utilizationByDepartment: Array<{
      department: string;
      bookedHours: number;
      availableHours: number;
      utilizationPct: number;
      idlePct: number;
      labourCostNgn: number;
    }>;
    projectDashboard: Array<{
      projectCode: string;
      projectName: string;
      labourHours: number;
      labourCostNgn: number;
      billableHours: number;
      idleHours: number;
      overtimeHours: number;
    }>;
  };
  aiInsights: StructureInsight[];
};

type UpdatePayload = {
  action?:
    | 'SAVE_DRAFT'
    | 'SUBMIT'
    | 'APPROVE'
    | 'REJECT'
    | 'RETURN'
    | 'LOCK'
    | 'COPY_PREVIOUS_DAY'
    | 'BULK_APPLY'
    | 'MATRIX_SAVE'
    | 'UPDATE_RECORD';
  recordId?: string;
  recordIds?: string[];
  matrixRecords?: Array<{
    recordId: string;
    allocations: TimesheetAllocation[];
    remarks?: string | null;
    mode?: TimesheetEntryMode;
    approvedOvertimeHours?: number;
  }>;
  allocations?: TimesheetAllocation[];
  overtimeHours?: number;
  approvedOvertimeHours?: number;
  remarks?: string | null;
  mode?: TimesheetEntryMode;
  reviewerNote?: string;
  bulkColumnCode?: string;
  bulkHours?: number;
};

const ok = <T,>(data: T, status = 200) => NextResponse.json({ status: 'success', data }, { status });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const round1 = (value: number) => Math.round(value * 10) / 10;
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);

const idleHourTypes = new Set(['Idle', 'Standby', 'Equipment Downtime', 'Material Delay', 'Waiting Instruction', 'No Assignment']);
const nonProjectHourTypes = new Set(['Internal Work', 'Meeting', 'Training', 'Travel', 'Safety Meeting', 'Toolbox Talk', 'Rework', 'Leave', 'Holiday']);

const summarizeRecord = (record: TimesheetRecord) => {
  const bookedHours = round1(record.allocations.reduce((sum, item) => sum + item.hours, 0));
  const projectHours = round1(record.allocations.filter((item) => item.kind === 'project').reduce((sum, item) => sum + item.hours, 0));
  const idleHours = round1(record.allocations.filter((item) => idleHourTypes.has(item.hourType)).reduce((sum, item) => sum + item.hours, 0));
  const nonProjectHours = round1(record.allocations.filter((item) => nonProjectHourTypes.has(item.hourType)).reduce((sum, item) => sum + item.hours, 0));
  const usedHours = round1(bookedHours - idleHours);
  const labourCostNgn = Math.round(record.allocations.reduce((sum, item) => sum + item.labourCostNgn, 0));
  return { bookedHours, projectHours, idleHours, nonProjectHours, usedHours, labourCostNgn };
};

const normalizeApprovals = (record: TimesheetRecord, actor: string, nextStatus: TimesheetStatus, reviewerNote?: string | null): TimesheetApprovalStep[] => {
  const now = new Date().toISOString();
  const approvals = record.approvals.map((item) => ({ ...item }));
  const findStage = (stage: TimesheetApprovalStep['stage']) => approvals.find((item) => item.stage === stage);

  if (nextStatus === 'Draft') return approvals;

  if (nextStatus === 'Submitted') {
    const employeeStep = findStage('Employee');
    if (employeeStep) {
      employeeStep.status = 'Approved';
      employeeStep.by = record.employeeName;
      employeeStep.actedAt = now;
      employeeStep.comment = 'Timesheet submitted.';
    }
    const supervisorStep = findStage('Supervisor');
    if (supervisorStep) supervisorStep.status = 'Pending';
    return approvals;
  }

  if (nextStatus === 'Approved' || nextStatus === 'Locked') {
    approvals.forEach((item, index) => {
      item.status = nextStatus === 'Locked' || index < approvals.length ? 'Approved' : 'Pending';
      item.by = item.by || (index === 0 ? record.employeeName : index === approvals.length - 1 ? actor : `${item.stage} Approver`);
      item.actedAt = item.actedAt || now;
      item.comment = item.comment || (item.stage === 'Payroll' ? 'Released for payroll and billing.' : 'Approved.');
    });
    if (nextStatus === 'Locked') {
      const payrollStep = findStage('Payroll');
      if (payrollStep) {
        payrollStep.status = 'Locked';
        payrollStep.by = actor;
        payrollStep.actedAt = now;
        payrollStep.comment = reviewerNote || 'Attendance register locked for payroll.';
      }
    }
    return approvals;
  }

  if (nextStatus === 'Rejected' || nextStatus === 'Returned') {
    const supervisorStep = findStage('Supervisor');
    if (supervisorStep) {
      supervisorStep.status = nextStatus === 'Rejected' ? 'Rejected' : 'Returned';
      supervisorStep.by = actor;
      supervisorStep.actedAt = now;
      supervisorStep.comment = reviewerNote || (nextStatus === 'Rejected' ? 'Timesheet rejected.' : 'Timesheet returned for correction.');
    }
    return approvals;
  }

  return approvals;
};

const validateRecord = (record: TimesheetRecord) => {
  const totalHours = round1(record.allocations.reduce((sum, item) => sum + item.hours, 0));
  const expectedHours = round1(record.standardHours + record.overtimeHours);
  if (record.allocations.some((item) => !isFinite(item.hours) || item.hours < 0)) return 'Allocation hours must be valid positive values.';
  if (record.status === 'Draft') {
    if (totalHours > expectedHours) return `Draft hours cannot exceed ${expectedHours} hours for ${record.employeeName}.`;
    return null;
  }
  if (totalHours !== expectedHours) return `Daily allocation must equal ${expectedHours} hours for ${record.employeeName}.`;
  if (record.overtimeHours > record.approvedOvertimeHours && ['Submitted', 'Approved', 'Locked'].includes(record.status)) {
    return `Overtime for ${record.employeeName} exceeds approved overtime.`;
  }
  return null;
};

const buildPayload = async (request: Request): Promise<TimesheetPayload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const records = await readTimesheetRecords();

  const summary = records.reduce(
    (acc, record) => {
      const metrics = summarizeRecord(record);
      acc.totalEmployees += 1;
      acc.bookedHours += metrics.bookedHours;
      acc.usedHours += metrics.usedHours;
      acc.idleHours += metrics.idleHours;
      acc.projectHours += metrics.projectHours;
      acc.nonProjectHours += metrics.nonProjectHours;
      acc.pendingApprovals += record.status === 'Submitted' || record.status === 'Returned' ? 1 : 0;
      acc.overtimeHours += record.overtimeHours;
      return acc;
    },
    {
      totalEmployees: 0,
      bookedHours: 0,
      usedHours: 0,
      idleHours: 0,
      projectHours: 0,
      nonProjectHours: 0,
      pendingApprovals: 0,
      overtimeHours: 0,
    },
  );

  const utilizationByDepartment = Array.from(
    records.reduce<Map<string, TimesheetRecord[]>>((acc, record) => {
      const current = acc.get(record.department) || [];
      current.push(record);
      acc.set(record.department, current);
      return acc;
    }, new Map()).entries(),
  ).map(([department, departmentRecords]) => {
    const bookedHours = round1(departmentRecords.reduce((sum, item) => sum + summarizeRecord(item).usedHours, 0));
    const availableHours = round1(departmentRecords.reduce((sum, item) => sum + item.standardHours, 0));
    const idleHours = round1(departmentRecords.reduce((sum, item) => sum + summarizeRecord(item).idleHours, 0));
    const labourCostNgn = Math.round(departmentRecords.reduce((sum, item) => sum + summarizeRecord(item).labourCostNgn, 0));
    return {
      department,
      bookedHours,
      availableHours,
      utilizationPct: availableHours ? round1((bookedHours / availableHours) * 100) : 0,
      idlePct: availableHours ? round1((idleHours / availableHours) * 100) : 0,
      labourCostNgn,
    };
  });

  const projectDashboard = Array.from(
    records
      .flatMap((record) =>
        record.allocations.map((allocation) => ({
          record,
          allocation,
        })),
      )
      .reduce<Map<string, { projectCode: string; projectName: string; labourHours: number; labourCostNgn: number; billableHours: number; idleHours: number; overtimeHours: number }>>((acc, item) => {
        const current = acc.get(item.allocation.projectCode) || {
          projectCode: item.allocation.projectCode,
          projectName: item.allocation.projectName,
          labourHours: 0,
          labourCostNgn: 0,
          billableHours: 0,
          idleHours: 0,
          overtimeHours: 0,
        };
        current.labourHours += item.allocation.hours;
        current.labourCostNgn += item.allocation.labourCostNgn;
        current.billableHours += item.allocation.billable ? item.allocation.hours : 0;
        current.idleHours += idleHourTypes.has(item.allocation.hourType) ? item.allocation.hours : 0;
        current.overtimeHours += item.record.overtimeHours;
        acc.set(item.allocation.projectCode, current);
        return acc;
      }, new Map())
      .values(),
  ).sort((a, b) => b.labourHours - a.labourHours);

  const missingTimesheet = records.filter((record) => record.status === 'Draft' && summarizeRecord(record).bookedHours < record.standardHours);
  const repeatedIdle = records.filter((record) => summarizeRecord(record).idleHours >= 2);
  const overutilized = records.filter((record) => summarizeRecord(record).bookedHours > record.standardHours + record.approvedOvertimeHours);
  const underutilized = records.filter((record) => summarizeRecord(record).usedHours < 6);
  const costAnomaly = projectDashboard.find((item) => item.labourCostNgn > 150000);

  const aiInsights: StructureInsight[] = [
    {
      id: 'ts-ai-1',
      severity: repeatedIdle.length >= 3 ? 'high' : 'medium',
      title: `${repeatedIdle.length} employees show repeated idle exposure`,
      recommendation: `Potential labour waste is approximately NGN ${new Intl.NumberFormat('en-NG').format(repeatedIdle.reduce((sum, item) => sum + summarizeRecord(item).idleHours * item.labourRateNgn, 0))}. Reallocate crews or resolve material and instruction delays.`,
    },
    {
      id: 'ts-ai-2',
      severity: underutilized.length >= 3 ? 'medium' : 'low',
      title: `${underutilized.length} workers are underutilized below target hours`,
      recommendation: 'Review departmental loading, assign available workers to productive WBS tasks, and reduce no-assignment hours.',
    },
    {
      id: 'ts-ai-3',
      severity: overutilized.length >= 1 ? 'high' : 'low',
      title: `${overutilized.length} workers exceed approved daily capacity`,
      recommendation: 'Approve or rebalance overtime before payroll and client billing to avoid unapproved labour cost leakage.',
    },
    {
      id: 'ts-ai-4',
      severity: missingTimesheet.length >= 1 ? 'medium' : 'low',
      title: `${missingTimesheet.length} timesheets are incomplete or not fully booked`,
      recommendation: 'Push supervisors to clear incomplete timesheets before approval cut-off.',
    },
    {
      id: 'ts-ai-5',
      severity: costAnomaly ? 'medium' : 'low',
      title: `${costAnomaly?.projectCode || 'No project'} is carrying the highest labour cost exposure`,
      recommendation: 'Compare labour burn against progress achieved and validate whether the project is trending toward overrun or recoverable billing.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    timesheetDate: getTimesheetDate(),
    permissions: {
      actor: uiPermissions.actor,
      role: uiPermissions.role,
      canEdit: uiPermissions.canEditAttendance,
      canExport: true,
      canApprove: uiPermissions.canEditAttendance,
      canViewCosts: true,
      canViewAudit: uiPermissions.canViewAudit,
    },
    summary: {
      totalEmployees: summary.totalEmployees,
      bookedHours: round1(summary.bookedHours),
      usedHours: round1(summary.usedHours),
      idleHours: round1(summary.idleHours),
      projectHours: round1(summary.projectHours),
      nonProjectHours: round1(summary.nonProjectHours),
      pendingApprovals: summary.pendingApprovals,
      overtimeHours: round1(summary.overtimeHours),
    },
    filterOptions: {
      departments: Array.from(new Set(records.map((item) => item.department))).sort((a, b) => a.localeCompare(b)),
      projects: getTimesheetProjectCatalog().map((item) => item.code),
      locations: Array.from(new Set(records.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      supervisors: Array.from(new Set(records.map((item) => item.supervisor))).sort((a, b) => a.localeCompare(b)),
      shifts: Array.from(new Set(records.map((item) => item.shift))).sort((a, b) => a.localeCompare(b)),
      businessUnits: Array.from(new Set(records.map((item) => item.businessUnit))).sort((a, b) => a.localeCompare(b)),
      modes: ['Employee Self-Service', 'Supervisor Entry', 'Bulk Team Entry', 'Project Engineer Entry', 'Foreman Entry'],
      statuses: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Returned', 'Locked'],
    },
    matrixColumns: getTimesheetMatrixColumns(),
    projectCatalog: getTimesheetProjectCatalog(),
    records,
    analytics: {
      utilizationByDepartment: utilizationByDepartment.sort((a, b) => b.utilizationPct - a.utilizationPct),
      projectDashboard,
    },
    aiInsights,
  };
};

const updateAllocations = (record: TimesheetRecord, allocations: TimesheetAllocation[]) => {
  const nextAllocations = allocations
    .filter((item) => item.hours > 0)
    .map((item) => ({
      ...item,
      hours: round1(item.hours),
      labourCostNgn: Math.round(item.hours * item.labourRateNgn),
    }));
  const totalHours = round1(nextAllocations.reduce((sum, item) => sum + item.hours, 0));
  const overtimeHours = Math.max(0, round1(totalHours - record.standardHours));
  return {
    ...record,
    allocations: nextAllocations,
    overtimeHours,
    updatedAt: new Date().toISOString(),
  };
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'attendance.manage')) return err(403, 'You do not have permission to manage timesheet entries.');

  const actor = access.actor;
  const payload = (await request.json()) as UpdatePayload;
  const action = payload.action || 'UPDATE_RECORD';
  const existing = await readTimesheetRecords();

  if (action === 'MATRIX_SAVE') {
    if (!payload.matrixRecords?.length) return err(400, 'Matrix save requires one or more edited timesheet rows.');

    const updatesById = new Map(payload.matrixRecords.map((item) => [item.recordId, item]));
    const beforeRecords = existing.filter((item) => updatesById.has(item.id));

    const next = existing.map((record) => {
      const update = updatesById.get(record.id);
      if (!update) return record;

      let nextRecord = updateAllocations(record, update.allocations);
      nextRecord = {
        ...nextRecord,
        status: 'Draft',
        remarks: update.remarks !== undefined ? update.remarks : nextRecord.remarks,
        mode: update.mode || nextRecord.mode,
        approvedOvertimeHours:
          update.approvedOvertimeHours !== undefined ? round1(update.approvedOvertimeHours) : nextRecord.approvedOvertimeHours,
        updatedAt: new Date().toISOString(),
      };

      return nextRecord;
    });

    const validationError = next
      .filter((item) => updatesById.has(item.id))
      .map(validateRecord)
      .find(Boolean);
    if (validationError) return err(400, validationError);

    await writeTimesheetRecords(next);
    await appendOrganizationAuditEvent({
      module: 'attendance',
      entityType: 'attendance-register',
      entityId: 'timesheet-matrix-save',
      action: 'TIMESHEET_MATRIX_SAVE',
      actor,
      summary: `${actor} saved matrix updates for ${payload.matrixRecords.length} timesheet rows.`,
      before: { recordIds: beforeRecords.map((item) => item.id) },
      after: { recordIds: payload.matrixRecords.map((item) => item.recordId) },
    });

    return ok({
      updated: payload.matrixRecords.length,
      recordIds: payload.matrixRecords.map((item) => item.recordId),
    });
  }

  if (action === 'BULK_APPLY') {
    if (!payload.recordIds?.length || !isNonEmpty(payload.bulkColumnCode) || Number.isNaN(asNumber(payload.bulkHours))) {
      return err(400, 'Bulk entry requires selected timesheets, a column code, and bulk hours.');
    }
    const bulkColumnCode = payload.bulkColumnCode;
    const columnMeta = getTimesheetProjectCatalog().find((item) => item.code === bulkColumnCode);
    if (!columnMeta) return err(400, 'The selected bulk-entry column is invalid.');

    const next = existing.map((record) => {
      if (!payload.recordIds?.includes(record.id)) return record;
      const appliedHours = round1(payload.bulkHours || 0);
      const allocations: TimesheetAllocation[] = [
        {
          id: `${record.employeeId.toLowerCase()}-bulk-${bulkColumnCode.toLowerCase()}`,
          projectCode: columnMeta.code,
          projectName: columnMeta.name,
          projectLabel: columnMeta.label,
          kind: columnMeta.kind,
          hourType: columnMeta.hourType,
          bucket: columnMeta.kind === 'project' ? 'Productive Time' : columnMeta.kind === 'idle' ? 'Idle Time' : 'Non-Productive Time',
          phase: columnMeta.phase,
          workPackage: columnMeta.workPackage,
          activity: columnMeta.activity,
          task: columnMeta.task,
          costCode: columnMeta.costCode,
          wbs: columnMeta.wbs,
          hours: appliedHours,
          billable: columnMeta.billable,
          labourRateNgn: record.labourRateNgn,
          labourCostNgn: Math.round(appliedHours * record.labourRateNgn),
        },
      ];
      if (appliedHours < record.standardHours) {
        allocations.push({
          id: `${record.employeeId.toLowerCase()}-bulk-idle`,
          projectCode: 'IDLE',
          projectName: 'Idle Time',
          projectLabel: 'IDLE',
          kind: 'idle',
          hourType: 'Idle',
          bucket: 'Idle Time',
          phase: 'Idle',
          workPackage: 'Idle',
          activity: 'Idle Time',
          task: 'No Productive Work',
          costCode: 'IDL-001',
          wbs: 'IDL.TIME',
          hours: round1(record.standardHours - appliedHours),
          billable: false,
          labourRateNgn: record.labourRateNgn,
          labourCostNgn: Math.round((record.standardHours - appliedHours) * record.labourRateNgn),
        });
      }
      return updateAllocations({ ...record, mode: 'Bulk Team Entry' }, allocations);
    });

    const validationError = next.map(validateRecord).find(Boolean);
    if (validationError) return err(400, validationError);
    await writeTimesheetRecords(next);
    await appendOrganizationAuditEvent({
      module: 'attendance',
      entityType: 'attendance-register',
      entityId: 'timesheet-bulk-entry',
      action: 'TIMESHEET_BULK_APPLY',
      actor,
      summary: `${actor} applied ${payload.bulkHours}h of ${payload.bulkColumnCode} to ${payload.recordIds.length} timesheets.`,
      before: { recordIds: payload.recordIds },
      after: { bulkColumnCode: payload.bulkColumnCode, bulkHours: payload.bulkHours },
    });
    return ok({ updated: payload.recordIds.length });
  }

  if (!isNonEmpty(payload.recordId)) return err(400, 'A timesheet record is required.');
  const current = existing.find((item) => item.id === payload.recordId);
  if (!current) return err(404, 'The selected timesheet record could not be found.');

  const defaultRecord = buildDefaultTimesheetRecords().find((item) => item.id === current.id);

  let nextRecord: TimesheetRecord = { ...current };
  if (action === 'COPY_PREVIOUS_DAY' && defaultRecord) {
    nextRecord = {
      ...current,
      allocations: defaultRecord.allocations,
      overtimeHours: defaultRecord.overtimeHours,
      approvedOvertimeHours: defaultRecord.approvedOvertimeHours,
      remarks: 'Copied standard template from previous working pattern.',
      updatedAt: new Date().toISOString(),
    };
  } else if (payload.allocations?.length) {
    nextRecord = updateAllocations(current, payload.allocations);
  }

  if (payload.mode) nextRecord.mode = payload.mode;
  if (payload.remarks !== undefined) nextRecord.remarks = payload.remarks;
  if (!Number.isNaN(asNumber(payload.approvedOvertimeHours))) nextRecord.approvedOvertimeHours = round1(payload.approvedOvertimeHours || 0);
  if (!Number.isNaN(asNumber(payload.overtimeHours))) nextRecord.overtimeHours = round1(payload.overtimeHours || 0);

  if (action === 'SAVE_DRAFT' || action === 'UPDATE_RECORD' || action === 'COPY_PREVIOUS_DAY') nextRecord.status = 'Draft';
  if (action === 'SUBMIT') {
    nextRecord.status = 'Submitted';
    nextRecord.submittedAt = new Date().toISOString();
  }
  if (action === 'APPROVE') nextRecord.status = 'Approved';
  if (action === 'REJECT') nextRecord.status = 'Rejected';
  if (action === 'RETURN') nextRecord.status = 'Returned';
  if (action === 'LOCK') nextRecord.status = 'Locked';

  nextRecord.approvals = normalizeApprovals(nextRecord, actor, nextRecord.status, payload.reviewerNote);
  nextRecord.updatedAt = new Date().toISOString();

  const validationError = validateRecord(nextRecord);
  if (validationError) return err(400, validationError);

  const next = existing.map((item) => (item.id === nextRecord.id ? nextRecord : item));
  await writeTimesheetRecords(next);
  await appendOrganizationAuditEvent({
    module: 'attendance',
    entityType: 'attendance-register',
    entityId: nextRecord.id,
    action: `TIMESHEET_${action}`,
    actor,
    summary: `${actor} executed ${action} for ${nextRecord.employeeName} on ${nextRecord.timesheetDate}.`,
    before: current as unknown as Record<string, unknown>,
    after: nextRecord as unknown as Record<string, unknown>,
  });

  return ok(nextRecord);
}
