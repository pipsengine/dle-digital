import { NextResponse } from 'next/server';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import {
  calculateTimesheetPeriod,
  generateProjectCode,
  idleReasons,
  readProjects,
  readTimesheetData,
  syncAttendanceForTimesheet,
  writeProjects,
  writeTimesheetData,
  workflowStages,
  type TimesheetHeader,
  type TimesheetLine,
  type TimesheetPeriod,
  type IdleReason,
  type DisplayColumn,
  type TimesheetAllocation,
  type TimesheetApprovalDecision,
  type TimesheetApprovalStep,
  type TimesheetEntryMode,
  type TimesheetRecord,
  type TimesheetStatus,
  type Project,
  type WorkflowStage,
} from '@/lib/timesheet-entry-store';
import { readBiometricDevices, type BiometricDeviceRecord } from '@/lib/biometric-attendance-store';
import type { StructureInsight } from '@/lib/organization-data';

type TimesheetPayload = {
  generatedAt: string;
  timesheetDate: string;
  period: TimesheetPeriod;
  header: TimesheetHeader | null;
  lines: TimesheetLine[];
  idleReasons: IdleReason[];
  projects: Project[];
  nextProjectCode: string;
  workflowStages: WorkflowStage[];
  biometricDevices: BiometricDeviceRecord[];
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
    presentEmployees: number;
    absentEmployees: number;
    onLeaveEmployees: number;
    sickEmployees: number;
    notSyncedEmployees: number;
    bookedHours: number;
    usedHours: number;
    idleHours: number;
    productivityPct: number;
    pendingApprovals: number;
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
  projectCatalog: any[];
  aiInsights: StructureInsight[];
};

type UpdatePayload = {
  action?:
    | 'SYNC_ATTENDANCE'
    | 'SAVE_DRAFT'
    | 'SUBMIT'
    | 'APPROVE'
    | 'REJECT'
    | 'MATRIX_SAVE'
    | 'CREATE_PROJECT'
    | 'COPY_PREVIOUS_DAY'
    | 'BULK_APPLY';
  date?: string;
  supervisorId?: string;
  workCenterName?: string;
  headerId?: string;
  lines?: TimesheetLine[];
  reviewerNote?: string;
  project?: Omit<Project, 'id'>;
  bulkAllocation?: {
    employeeIds: string[];
    projectCode: string;
    hours: number;
  };
};

async function handleBulkApply(request: Request, payload: UpdatePayload) {
  if (!payload.bulkAllocation || !payload.headerId) {
    throw new Error('Bulk allocation details and header ID are required.');
  }
  const { employeeIds, projectCode, hours } = payload.bulkAllocation;
  const { headers, lines: allLines } = await readTimesheetData();
  
  const header = headers.find(h => h.id === payload.headerId);
  if (!header) throw new Error('Header not found');

  const otherLines = allLines.filter(l => l.headerId !== header.id);
  const currentLines = allLines.filter(l => l.headerId === header.id);

  const updatedLines = currentLines.map(line => {
    if (!employeeIds.includes(line.employeeId)) return line;

    const allocations = [...line.projectAllocations];
    const pIdx = allocations.findIndex(p => p.projectCode === projectCode);
    if (pIdx >= 0) {
      allocations[pIdx].hours = hours;
    } else {
      allocations.push({
        projectId: projectCode,
        projectCode,
        projectName: projectCode,
        hours,
        remarks: null
      });
    }

    const usedHours = round1(allocations.reduce((sum, p) => sum + p.hours, 0));
    const totalHours = round1(usedHours + line.idleHours);

    return {
      ...line,
      projectAllocations: allocations,
      usedHours,
      totalHours,
      variance: round1(totalHours - (line.attendanceDuration || 0)),
      validationStatus: totalHours === 8 ? 'Valid' : (totalHours > 8 ? 'Error' : 'Incomplete'),
    } as TimesheetLine;
  });

  await writeTimesheetData({ headers, lines: [...otherLines, ...updatedLines] });
  return header;
}

async function handleCopyPreviousDay(request: Request, date: string, supervisorId: string, workCenterName: string) {
  const { headers, lines: allLines } = await readTimesheetData();
  
  // 1. Find previous day's header
  const targetDate = new Date(date);
  const prevDate = new Date(targetDate);
  prevDate.setDate(targetDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const prevHeader = headers.find(h => h.timesheetDate === prevDateStr && h.supervisorId === supervisorId);
  if (!prevHeader) {
    throw new Error(`No timesheet found for previous day (${prevDateStr}) to copy from.`);
  }

  const prevLines = allLines.filter(l => l.headerId === prevHeader.id);
  if (prevLines.length === 0) {
    throw new Error('Previous day timesheet has no data lines.');
  }

  // 2. Find or create current day's header
  let currentHeader = headers.find(h => h.timesheetDate === date && h.supervisorId === supervisorId);
  if (!currentHeader) {
    const period = calculateTimesheetPeriod(targetDate);
    currentHeader = {
      id: `hdr-${date}-${supervisorId.toLowerCase().replace(/\s+/g, '-')}`,
      periodId: period.id,
      timesheetDate: date,
      supervisorId,
      supervisorName: supervisorId,
      workCenterId: workCenterName.toLowerCase().replace(/\s+/g, '-'),
      workCenterName,
      status: 'Draft',
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      lastSyncAt: new Date().toISOString(),
    };
    headers.push(currentHeader);
  }

  // 3. Map allocations from previous lines to current employees
  // We keep current attendance (clockIn/Out) but copy project/idle allocations
  const currentLines = allLines.filter(l => l.headerId === currentHeader!.id);
  const otherLines = allLines.filter(l => l.headerId !== currentHeader!.id);

  const updatedLines = currentLines.map(line => {
    const prevLine = prevLines.find(pl => pl.employeeId === line.employeeId);
    if (!prevLine) return line;

    return {
      ...line,
      projectAllocations: [...prevLine.projectAllocations],
      idleAllocations: [...prevLine.idleAllocations],
      usedHours: prevLine.usedHours,
      idleHours: prevLine.idleHours,
      totalHours: prevLine.totalHours,
      variance: round1(prevLine.totalHours - (line.attendanceDuration || 0)),
      validationStatus: prevLine.totalHours === 8 ? 'Valid' : (prevLine.totalHours > 8 ? 'Error' : 'Incomplete'),
      validationMessage: null,
    } as TimesheetLine;
  });

  await writeTimesheetData({ headers, lines: [...otherLines, ...updatedLines] });
  return currentHeader;
}

const ok = <T,>(data: T, status = 200) => NextResponse.json({ status: 'success', data }, { status });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const round1 = (value: number) => Math.round(value * 10) / 10;

const buildPayload = async (request: Request, date?: string, supervisorId?: string): Promise<TimesheetPayload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const { headers, lines: allLines } = await readTimesheetData();
  const projects = await readProjects();
  const nextProjectCode = await generateProjectCode();
  const biometricDevices = await readBiometricDevices();

  const targetDate = date || '2026-06-03';
  const targetSupervisor = supervisorId || access.actor;

  const header = headers.find((h) => h.timesheetDate === targetDate && h.supervisorId === targetSupervisor) || null;
  const lines = header ? allLines.filter((l) => l.headerId === header.id) : [];

  const activeProjects = projects.filter(p => ['Active', 'Approved', 'Open'].includes(p.status));

  const summary = {
    totalEmployees: lines.length,
    presentEmployees: lines.filter((l) => l.clockIn).length,
    absentEmployees: lines.filter((l) => !l.clockIn).length,
    onLeaveEmployees: 0, // Mock
    sickEmployees: 0, // Mock
    notSyncedEmployees: 0, // Mock
    bookedHours: round1(lines.reduce((sum, l) => sum + l.totalHours, 0)),
    usedHours: round1(lines.reduce((sum, l) => sum + l.usedHours, 0)),
    idleHours: round1(lines.reduce((sum, l) => sum + l.idleHours, 0)),
    productivityPct: lines.reduce((sum, l) => sum + l.totalHours, 0) > 0 
      ? round1((lines.reduce((sum, l) => sum + l.usedHours, 0) / lines.reduce((sum, l) => sum + l.totalHours, 0)) * 100)
      : 0,
    pendingApprovals: headers.filter((h) => h.status === 'Submitted').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    timesheetDate: targetDate,
    period: calculateTimesheetPeriod(new Date(targetDate)),
    header,
    lines,
    idleReasons,
    projects: activeProjects,
    nextProjectCode,
    workflowStages,
    biometricDevices,
    permissions: {
      actor: uiPermissions.actor,
      role: uiPermissions.role,
      canEdit: uiPermissions.canEditAttendance,
      canExport: true,
      canApprove: uiPermissions.canApproveTimesheet || uiPermissions.role === 'OrganizationAdmin',
      canViewCosts: true,
      canViewAudit: uiPermissions.canViewAudit,
    },
    summary,
    filterOptions: {
      departments: ['Human Capital', 'Project Controls', 'Finance', 'Mechanical Engineering', 'HSE', 'Quality Assurance', 'IT & Support', 'Electrical & Instrumentation', 'Procurement', 'Civil Engineering', 'Executive Office', 'Operations', 'Legal & Compliance'],
      projects: activeProjects.map(p => p.code),
      locations: ['Lagos HQ', 'Port Harcourt', 'Warri', 'Bonny', 'Abuja'],
      supervisors: Array.from(new Set(headers.map((h) => h.supervisorName))),
      shifts: ['Day', 'Night', 'Rotational'],
      businessUnits: ['DLE Corporate', 'DLE Projects', 'DLE Fabrication', 'DLE Marine'],
      modes: ['Supervisor Entry'],
      statuses: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Locked'],
    },
    matrixColumns: activeProjects.slice(0, 4).map(p => ({ code: p.code, label: p.code, kind: 'project' })),
    projectCatalog: activeProjects,
    aiInsights: [
      {
        id: 'ts-ins-1',
        severity: summary.idleHours > summary.usedHours * 0.2 ? 'high' : 'low',
        title: 'High Idle Time Detected',
        recommendation: 'Review work center assignments and check for material or equipment delays.',
      },
      {
        id: 'ts-ins-2',
        severity: summary.absentEmployees > 2 ? 'medium' : 'low',
        title: 'Attendance Variance',
        recommendation: 'Some employees with biometric records are missing from the timesheet. Sync attendance to update.',
      },
    ],
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;
  const supervisorId = searchParams.get('supervisorId') || undefined;
  return ok(await buildPayload(request, date, supervisorId));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  const payload = (await request.json()) as UpdatePayload;
  const { action, date, supervisorId, workCenterName, headerId, lines: updatedLines } = payload;

  try {
    if (action === 'CREATE_PROJECT') {
      if (!payload.project) return err(400, 'Project details are required.');
      const projects = await readProjects();
      const newProject: Project = {
        ...payload.project,
        id: `prj-${Date.now()}`,
      };
      projects.push(newProject);
      await writeProjects(projects);
      return ok(await buildPayload(request, date, supervisorId));
    }

    if (action === 'COPY_PREVIOUS_DAY') {
      if (!date || !supervisorId || !workCenterName) return err(400, 'Date, supervisor, and work center are required for copy.');
      await handleCopyPreviousDay(request, date, supervisorId, workCenterName);
      return ok(await buildPayload(request, date, supervisorId));
    }

    if (action === 'BULK_APPLY') {
      await handleBulkApply(request, payload);
      return ok(await buildPayload(request, date, supervisorId));
    }

    const { headers, lines: allLines } = await readTimesheetData();

    if (action === 'SYNC_ATTENDANCE') {
      if (!date || !supervisorId || !workCenterName) return err(400, 'Date, Supervisor ID, and Work Center Name are required.');
      await syncAttendanceForTimesheet(date, supervisorId, workCenterName);
      return ok(await buildPayload(request, date, supervisorId));
    }

    if (action === 'MATRIX_SAVE' || action === 'SAVE_DRAFT' || action === 'SUBMIT') {
      if (!headerId || !updatedLines) return err(400, 'Header ID and Lines are required.');
      
      const header = headers.find(h => h.id === headerId);
      if (!header) return err(404, 'Timesheet header not found.');

      // Validate 8-hour rule
      for (const line of updatedLines) {
        if (line.totalHours > 8.001) {
          return err(400, `Total hours for ${line.employeeName} cannot exceed 8 hours.`);
        }
        if (Math.abs(line.usedHours + line.idleHours - line.totalHours) > 0.01) {
          return err(400, `Hours mismatch for ${line.employeeName}: Used + Idle must equal Total.`);
        }
      }

      const otherLines = allLines.filter(l => l.headerId !== headerId);
      
      if (action === 'SUBMIT') {
        header.status = 'Submitted';
        header.submittedAt = new Date().toISOString();
        header.submittedBy = access.actor;
      } else {
        header.status = 'Draft';
      }

      await writeTimesheetData({ headers, lines: [...otherLines, ...updatedLines] });
      return ok(await buildPayload(request, header.timesheetDate, header.supervisorId));
    }

    if (action === 'APPROVE' || action === 'REJECT') {
      if (!headerId) return err(400, 'Header ID is required.');
      const header = headers.find(h => h.id === headerId);
      if (!header) return err(404, 'Timesheet header not found.');

      if (action === 'APPROVE') {
        // Logic for multi-stage could be added here
        if (header.status === 'Submitted') header.status = 'HR_Reviewed';
        else if (header.status === 'HR_Reviewed') header.status = 'Project_Control_Reviewed';
        else if (header.status === 'Project_Control_Reviewed') header.status = 'Approved';
        
        header.approvedAt = new Date().toISOString();
        header.approvedBy = access.actor;
      } else {
        header.status = 'Rejected';
      }

      await writeTimesheetData({ headers, lines: allLines });
      return ok(await buildPayload(request, header.timesheetDate, header.supervisorId));
    }

    return err(400, 'Invalid action.');
  } catch (error) {
    console.error('Timesheet Action Error:', error);
    return err(500, error instanceof Error ? error.message : 'Internal Server Error');
  }
}
