'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  TimerReset,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import type { StructureInsight } from '@/lib/organization-data';

type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Returned' | 'Locked';
type TimesheetApprovalDecision = 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'Locked';
type TimesheetEntryMode =
  | 'Employee Self-Service'
  | 'Supervisor Entry'
  | 'Bulk Team Entry'
  | 'Project Engineer Entry'
  | 'Foreman Entry';
type ColumnKind = 'project' | 'internal' | 'idle' | 'leave';

type DisplayColumn = {
  code: string;
  label: string;
  kind: ColumnKind;
};

type ProjectCatalogItem = {
  code: string;
  label: string;
  name: string;
  kind: ColumnKind;
  hourType: string;
  billable: boolean;
  phase: string;
  workPackage: string;
  activity: string;
  task: string;
  costCode: string;
  wbs: string;
  client: string | null;
};

type TimesheetAllocation = {
  id: string;
  projectCode: string;
  projectName: string;
  projectLabel: string;
  kind: ColumnKind;
  hourType: string;
  bucket: string;
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

type TimesheetApprovalStep = {
  stage: 'Employee' | 'Supervisor' | 'Project Engineer' | 'Department Head' | 'HR' | 'Payroll';
  status: TimesheetApprovalDecision;
  by: string | null;
  actedAt: string | null;
  comment: string | null;
};

type TimesheetRecord = {
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

type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  summary: string;
  createdAt: string;
};

type Payload = {
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
  projectCatalog: ProjectCatalogItem[];
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

type MatrixRowDraft = Record<string, number>;

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);
const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-NG');
const round1 = (value: number) => Math.round(value * 10) / 10;

const statusTone = (status: TimesheetStatus | TimesheetApprovalDecision) => {
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Returned' || status === 'Pending' || status === 'Submitted' || status === 'Draft') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'Locked') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

const idleHourTypes = new Set(['Idle', 'Standby', 'Equipment Downtime', 'Material Delay', 'Waiting Instruction', 'No Assignment']);
const nonProjectHourTypes = new Set(['Internal Work', 'Meeting', 'Training', 'Travel', 'Safety Meeting', 'Toolbox Talk', 'Rework', 'Leave', 'Holiday']);

export default function TimesheetEntryClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'All' | string>('All');
  const [projectFilter, setProjectFilter] = useState<'All' | string>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [supervisorFilter, setSupervisorFilter] = useState<'All' | string>('All');
  const [shiftFilter, setShiftFilter] = useState<'All' | string>('All');
  const [businessUnitFilter, setBusinessUnitFilter] = useState<'All' | string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | TimesheetStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [allocationEditor, setAllocationEditor] = useState<TimesheetAllocation[]>([]);
  const [remarks, setRemarks] = useState('');
  const [mode, setMode] = useState<TimesheetEntryMode>('Employee Self-Service');
  const [approvedOvertimeHours, setApprovedOvertimeHours] = useState('0');
  const [bulkColumnCode, setBulkColumnCode] = useState('PRJ-001');
  const [bulkHours, setBulkHours] = useState('8');
  const [importText, setImportText] = useState('');
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [matrixEdits, setMatrixEdits] = useState<Record<string, MatrixRowDraft>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-entry', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load timesheet entry');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.records[0]?.id || null);
      setSelectedRecordIds((prev) => (prev.length ? prev : data.records.slice(0, 5).map((item) => item.id)));

      if (data.permissions.canViewAudit) {
        const auditRes = await fetch('/api/hris/organization/audit-log?module=attendance&limit=12', {
          cache: 'no-store',
          headers: {
            'x-hris-actor': data.permissions.actor,
            'x-hris-role': data.permissions.role,
          },
        });
        const auditJson = await auditRes.json();
        if (auditRes.ok && auditJson?.status === 'success') {
          setAuditEvents((auditJson.data?.events || []) as AuditEvent[]);
        } else {
          setAuditEvents([]);
        }
      } else {
        setAuditEvents([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load timesheet entry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.records || []).filter((record) => {
      if (departmentFilter !== 'All' && record.department !== departmentFilter) return false;
      if (locationFilter !== 'All' && record.location !== locationFilter) return false;
      if (supervisorFilter !== 'All' && record.supervisor !== supervisorFilter) return false;
      if (shiftFilter !== 'All' && record.shift !== shiftFilter) return false;
      if (businessUnitFilter !== 'All' && record.businessUnit !== businessUnitFilter) return false;
      if (statusFilter !== 'All' && record.status !== statusFilter) return false;
      if (projectFilter !== 'All' && !record.allocations.some((item) => item.projectCode === projectFilter)) return false;
      if (!q) return true;
      return [
        record.employeeId,
        record.employeeName,
        record.department,
        record.businessUnit,
        record.site,
        record.supervisor,
        record.shift,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [payload?.records, query, departmentFilter, projectFilter, locationFilter, supervisorFilter, shiftFilter, businessUnitFilter, statusFilter]);

  const selectedRecord = useMemo(
    () => visibleRecords.find((record) => record.id === selectedId) || visibleRecords[0] || null,
    [visibleRecords, selectedId],
  );

  useEffect(() => {
    if (!selectedRecord && visibleRecords.length) setSelectedId(visibleRecords[0].id);
  }, [selectedRecord, visibleRecords]);

  useEffect(() => {
    if (!selectedRecord) return;
    setAllocationEditor(selectedRecord.allocations.map((item) => ({ ...item })));
    setRemarks(selectedRecord.remarks || '');
    setMode(selectedRecord.mode);
    setApprovedOvertimeHours(String(selectedRecord.approvedOvertimeHours));
    setSubmitError(null);
    setIsNewDraft(false);
  }, [selectedRecord]);

  const matrixValue = (record: TimesheetRecord, code: string) =>
    round1(record.allocations.filter((item) => item.projectCode === code).reduce((sum, item) => sum + item.hours, 0));

  const buildMatrixRow = (record: TimesheetRecord): MatrixRowDraft =>
    Object.fromEntries((payload?.matrixColumns || []).map((column) => [column.code, matrixValue(record, column.code)]));

  const buildAllocationsFromMatrix = (record: TimesheetRecord, row: MatrixRowDraft): TimesheetAllocation[] =>
    Object.entries(row)
      .map(([code, hours]) => {
        const meta = projectCatalogMap.get(code);
        if (!meta || !hours || hours <= 0) return null;
        return {
          id: `${record.employeeId.toLowerCase()}-matrix-${code.toLowerCase()}`,
          projectCode: meta.code,
          projectName: meta.name,
          projectLabel: meta.label,
          kind: meta.kind,
          hourType: meta.hourType,
          bucket: meta.kind === 'project' ? 'Productive Time' : meta.kind === 'idle' ? 'Idle Time' : 'Non-Productive Time',
          phase: meta.phase,
          workPackage: meta.workPackage,
          activity: meta.activity,
          task: meta.task,
          costCode: meta.costCode,
          wbs: meta.wbs,
          hours: round1(hours),
          billable: meta.billable,
          labourRateNgn: record.labourRateNgn,
          labourCostNgn: Math.round(hours * record.labourRateNgn),
        } satisfies TimesheetAllocation;
      })
      .filter((item): item is TimesheetAllocation => Boolean(item));

  const getActiveRow = (record: TimesheetRecord): MatrixRowDraft => matrixEdits[record.id] || buildMatrixRow(record);

  const effectiveAllocationsForRecord = (record: TimesheetRecord) =>
    matrixEdits[record.id] ? buildAllocationsFromMatrix(record, matrixEdits[record.id]) : record.allocations;

  const metricsForRecord = (record: Pick<TimesheetRecord, 'allocations' | 'standardHours' | 'overtimeHours' | 'approvedOvertimeHours' | 'labourRateNgn'>) => {
    const bookedHours = round1(record.allocations.reduce((sum, item) => sum + item.hours, 0));
    const projectHours = round1(record.allocations.filter((item) => item.kind === 'project').reduce((sum, item) => sum + item.hours, 0));
    const idleHours = round1(record.allocations.filter((item) => idleHourTypes.has(item.hourType)).reduce((sum, item) => sum + item.hours, 0));
    const nonProjectHours = round1(record.allocations.filter((item) => nonProjectHourTypes.has(item.hourType)).reduce((sum, item) => sum + item.hours, 0));
    const usedHours = round1(bookedHours - idleHours);
    const productiveHours = round1(record.allocations.filter((item) => item.bucket === 'Productive Time').reduce((sum, item) => sum + item.hours, 0));
    const utilizationPct = record.standardHours ? round1((usedHours / record.standardHours) * 100) : 0;
    const labourCostNgn = Math.round(record.allocations.reduce((sum, item) => sum + item.labourCostNgn, 0));
    const directLabourCostNgn = Math.round(record.allocations.filter((item) => item.billable).reduce((sum, item) => sum + item.labourCostNgn, 0));
    const indirectLabourCostNgn = labourCostNgn - directLabourCostNgn;
    return {
      bookedHours,
      projectHours,
      idleHours,
      nonProjectHours,
      usedHours,
      productiveHours,
      utilizationPct,
      labourCostNgn,
      directLabourCostNgn,
      indirectLabourCostNgn,
    };
  };

  const selectedMetrics = useMemo(
    () =>
      selectedRecord
        ? metricsForRecord({
            allocations: matrixEdits[selectedRecord.id] ? buildAllocationsFromMatrix(selectedRecord, matrixEdits[selectedRecord.id]) : allocationEditor,
            standardHours: selectedRecord.standardHours,
            overtimeHours: selectedRecord.overtimeHours,
            approvedOvertimeHours: selectedRecord.approvedOvertimeHours,
            labourRateNgn: selectedRecord.labourRateNgn,
          })
        : null,
    [selectedRecord, allocationEditor],
  );

  const projectCatalogMap = useMemo(
    () => new Map((payload?.projectCatalog || []).map((item) => [item.code, item])),
    [payload?.projectCatalog],
  );

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      ['Employee ID', 'Employee Name', 'Department', 'Business Unit', 'Location', 'Site', 'Shift', 'Status', 'Mode', 'Booked Hours', 'Used Hours', 'Idle Hours', 'Overtime', 'Approved Overtime'],
      ...visibleRecords.map((record) => {
        const metrics = metricsForRecord(record);
        return [
          record.employeeId,
          record.employeeName,
          record.department,
          record.businessUnit,
          record.location,
          record.site,
          record.shift,
          record.status,
          record.mode,
          String(metrics.bookedHours),
          String(metrics.usedHours),
          String(metrics.idleHours),
          String(record.overtimeHours),
          String(record.approvedOvertimeHours),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timesheet-entry.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const updateAllocation = (index: number, key: keyof TimesheetAllocation, value: string) => {
    setAllocationEditor((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === 'projectCode') {
          const meta = projectCatalogMap.get(value);
          if (!meta) return item;
          return {
            ...item,
            projectCode: meta.code,
            projectName: meta.name,
            projectLabel: meta.label,
            kind: meta.kind,
            hourType: meta.hourType,
            phase: meta.phase,
            workPackage: meta.workPackage,
            activity: meta.activity,
            task: meta.task,
            costCode: meta.costCode,
            wbs: meta.wbs,
            billable: meta.billable,
            labourCostNgn: Math.round(item.hours * item.labourRateNgn),
          };
        }

        const nextHours = key === 'hours' ? Number(value) || 0 : item.hours;
        return {
          ...item,
          [key]: key === 'hours' ? nextHours : value,
          labourCostNgn: Math.round(nextHours * item.labourRateNgn),
        };
      }),
    );
  };

  const addAllocation = () => {
    if (!selectedRecord || !payload?.projectCatalog[0]) return;
    const meta = payload.projectCatalog[0];
    setAllocationEditor((current) => [
      ...current,
      {
        id: `${selectedRecord.employeeId.toLowerCase()}-new-${Date.now()}`,
        projectCode: meta.code,
        projectName: meta.name,
        projectLabel: meta.label,
        kind: meta.kind,
        hourType: meta.hourType,
        bucket: meta.kind === 'project' ? 'Productive Time' : meta.kind === 'idle' ? 'Idle Time' : 'Non-Productive Time',
        phase: meta.phase,
        workPackage: meta.workPackage,
        activity: meta.activity,
        task: meta.task,
        costCode: meta.costCode,
        wbs: meta.wbs,
        hours: 0,
        billable: meta.billable,
        labourRateNgn: selectedRecord.labourRateNgn,
        labourCostNgn: 0,
      },
    ]);
  };

  const startNewTimesheetDraft = () => {
    if (!selectedRecord || !payload?.projectCatalog[0]) return;
    const meta = payload.projectCatalog[0];
    setAllocationEditor([
      {
        id: `${selectedRecord.employeeId.toLowerCase()}-draft-${Date.now()}`,
        projectCode: meta.code,
        projectName: meta.name,
        projectLabel: meta.label,
        kind: meta.kind,
        hourType: meta.hourType,
        bucket: meta.kind === 'project' ? 'Productive Time' : meta.kind === 'idle' ? 'Idle Time' : 'Non-Productive Time',
        phase: meta.phase,
        workPackage: meta.workPackage,
        activity: meta.activity,
        task: meta.task,
        costCode: meta.costCode,
        wbs: meta.wbs,
        hours: 0,
        billable: meta.billable,
        labourRateNgn: selectedRecord.labourRateNgn,
        labourCostNgn: 0,
      },
    ]);
    setRemarks('');
    setMode('Employee Self-Service');
    setApprovedOvertimeHours('0');
    setSubmitError(null);
    setShowImport(false);
    setShowBulkEntry(false);
    setIsNewDraft(true);
    setMatrixEdits((current) => ({
      ...current,
      [selectedRecord.id]: Object.fromEntries((payload?.matrixColumns || []).map((column) => [column.code, 0])),
    }));
  };

  const removeAllocation = (index: number) => {
    setAllocationEditor((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const applyImportTemplate = () => {
    if (!selectedRecord || !importText.trim()) return;
    const next: TimesheetAllocation[] = [];
    const lines = importText
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const [lineIndex, line] of lines.entries()) {
      const [codeRaw, hoursRaw] = line.split(',').map((part) => part.trim());
      const meta = projectCatalogMap.get(codeRaw);
      const hours = Number(hoursRaw);
      if (!meta || Number.isNaN(hours)) continue;
      next.push({
        id: `${selectedRecord.employeeId.toLowerCase()}-import-${lineIndex}-${meta.code.toLowerCase()}`,
        projectCode: meta.code,
        projectName: meta.name,
        projectLabel: meta.label,
        kind: meta.kind,
        hourType: meta.hourType,
        bucket: meta.kind === 'project' ? 'Productive Time' : meta.kind === 'idle' ? 'Idle Time' : 'Non-Productive Time',
        phase: meta.phase,
        workPackage: meta.workPackage,
        activity: meta.activity,
        task: meta.task,
        costCode: meta.costCode,
        wbs: meta.wbs,
        hours: round1(hours),
        billable: meta.billable,
        labourRateNgn: selectedRecord.labourRateNgn,
        labourCostNgn: Math.round(hours * selectedRecord.labourRateNgn),
      });
    }
    if (next.length) {
      setAllocationEditor(next);
      setShowImport(false);
      setImportText('');
    }
  };

  const runRecordAction = async (
    action: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'LOCK' | 'COPY_PREVIOUS_DAY' | 'UPDATE_RECORD',
  ) => {
    if (!selectedRecord) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const effectiveAllocations = matrixEdits[selectedRecord.id]
        ? buildAllocationsFromMatrix(selectedRecord, matrixEdits[selectedRecord.id])
        : allocationEditor;
      const res = await fetch('/api/hris/time-and-logs/timesheet-entry', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Timesheet Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          action,
          recordId: selectedRecord.id,
          allocations: effectiveAllocations,
          remarks,
          mode,
          approvedOvertimeHours: Number(approvedOvertimeHours) || 0,
          reviewerNote: remarks || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to update timesheet entry');
      await load();
      setSelectedId(selectedRecord.id);
      setIsNewDraft(false);
      setMatrixEdits((current) => {
        const next = { ...current };
        delete next[selectedRecord.id];
        return next;
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to update timesheet entry');
    } finally {
      setSubmitting(false);
    }
  };

  const updateMatrixCell = (record: TimesheetRecord, columnCode: string, value: string) => {
    const parsed = value === '' ? 0 : Number(value);
    const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setMatrixEdits((current) => {
      const baseRow = current[record.id] || buildMatrixRow(record);
      return {
        ...current,
        [record.id]: {
          ...baseRow,
          [columnCode]: safeValue,
        },
      };
    });

    if (selectedRecord?.id === record.id) {
      const nextRow = {
        ...(matrixEdits[record.id] || buildMatrixRow(record)),
        [columnCode]: safeValue,
      };
      setAllocationEditor(buildAllocationsFromMatrix(record, nextRow));
      setIsNewDraft(false);
    }
  };

  const runMatrixSave = async () => {
    const dirtyRecords = visibleRecords.filter((record) => matrixEdits[record.id]);
    if (!dirtyRecords.length) {
      setSubmitError('Edit one or more matrix cells before saving the matrix.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const matrixRecords = dirtyRecords.map((record) => ({
        recordId: record.id,
        allocations: buildAllocationsFromMatrix(record, getActiveRow(record)),
        remarks: record.id === selectedRecord?.id ? remarks : record.remarks,
        mode: record.id === selectedRecord?.id ? mode : record.mode,
        approvedOvertimeHours: record.id === selectedRecord?.id ? Number(approvedOvertimeHours) || 0 : record.approvedOvertimeHours,
      }));

      const res = await fetch('/api/hris/time-and-logs/timesheet-entry', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Timesheet Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          action: 'MATRIX_SAVE',
          matrixRecords,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to save matrix changes');
      await load();
      setMatrixEdits({});
      setIsNewDraft(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to save matrix changes');
    } finally {
      setSubmitting(false);
    }
  };

  const runBulkApply = async () => {
    if (!selectedRecordIds.length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-entry', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Timesheet Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          action: 'BULK_APPLY',
          recordIds: selectedRecordIds,
          bulkColumnCode,
          bulkHours: Number(bulkHours) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to apply bulk entry');
      await load();
      setShowBulkEntry(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to apply bulk entry');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectedRecord = (id: string) => {
    setSelectedRecordIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const selectVisible = () => {
    setSelectedRecordIds(visibleRecords.map((item) => item.id));
  };

  const selectedProjectDashboard = useMemo(() => {
    if (!payload || !selectedRecord) return [];
    return payload.analytics.projectDashboard.filter((item) => selectedRecord.allocations.some((allocation) => allocation.projectCode === item.projectCode)).slice(0, 6);
  }, [payload, selectedRecord]);

  return (
    <PageTemplate
      title="Timesheet Entry"
      description="Daily labour allocation and project time booking."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Time and Logs', href: '/hris/time-and-logs' },
        { label: 'Timesheet Entry' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export', onClick: exportCsv, icon: Download }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Enterprise Labour Utilization and Project Costing</div>
            <div className="text-xs text-slate-500 mt-1">Timesheet date: {payload ? formatDate(payload.timesheetDate) : '—'} · Actor: {payload?.permissions.actor || '—'} · Role: {payload?.permissions.role || '—'}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={startNewTimesheetDraft} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="w-4 h-4 inline mr-2" />
              New Timesheet
            </button>
            <button type="button" onClick={() => void runRecordAction('COPY_PREVIOUS_DAY')} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Copy className="w-4 h-4 inline mr-2" />
              Copy Previous Day
            </button>
            <button type="button" onClick={() => setShowBulkEntry((current) => !current)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Users className="w-4 h-4 inline mr-2" />
              Bulk Entry
            </button>
            <button type="button" onClick={() => setShowImport((current) => !current)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="w-4 h-4 inline mr-2" />
              Import
            </button>
            <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runMatrixSave()} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <Save className="w-4 h-4 inline mr-2" />
              Save Matrix
            </button>
            <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runRecordAction('SUBMIT')} className="px-3 py-2 rounded-lg bg-dle-blue text-white text-sm font-medium hover:bg-dle-blue-deep disabled:opacity-60">
              <Send className="w-4 h-4 inline mr-2" />
              Submit
            </button>
            <button type="button" disabled={submitting || !payload?.permissions.canApprove} onClick={() => void runRecordAction('APPROVE')} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              <CheckCircle2 className="w-4 h-4 inline mr-2" />
              Approve
            </button>
            <button type="button" disabled={submitting || !payload?.permissions.canApprove} onClick={() => void runRecordAction('REJECT')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
              <XCircle className="w-4 h-4 inline mr-2" />
              Reject
            </button>
          </div>
        </div>

        {isNewDraft && selectedRecord ? (
          <div className="rounded-2xl border border-dle-blue/20 bg-dle-blue/5 px-4 py-3 text-sm text-slate-700">
            Creating a new draft template for <span className="font-semibold text-slate-900">{selectedRecord.employeeName}</span>. You can save this draft even before the full `8` hours are allocated.
          </div>
        ) : null}

        {showBulkEntry ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Bulk Team Entry</div>
            <div className="text-xs text-slate-500">Apply one allocation column and hour value to the selected team or visible filtered employees.</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <SelectField label="Allocation Column" value={bulkColumnCode} onChange={setBulkColumnCode} options={(payload?.matrixColumns || []).map((item) => item.code)} />
              <Field label="Hours" value={bulkHours} onChange={setBulkHours} type="number" />
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center text-sm text-slate-700">Selected Records: {formatNumber(selectedRecordIds.length)}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectVisible} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-white">Select Visible</button>
                <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runBulkApply()} className="px-3 py-2 rounded-lg bg-dle-blue text-white text-sm font-medium hover:bg-dle-blue-deep disabled:opacity-60">Apply To Selected</button>
              </div>
            </div>
          </div>
        ) : null}

        {showImport ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Import Helper</div>
            <div className="text-xs text-slate-500">Paste `COLUMN_CODE,HOURS` per line to replace the selected employee allocation grid.</div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              placeholder={`PRJ-001,3\nMEETING,1\nIDLE,4`}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20 resize-y"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={applyImportTemplate} className="px-3 py-2 rounded-lg bg-dle-blue text-white text-sm font-medium hover:bg-dle-blue-deep">Apply Import</button>
              <button type="button" onClick={() => setShowImport(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-white">Close</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-4">
        <MetricCard icon={Users} label="Total Employees" value={payload ? formatNumber(payload.summary.totalEmployees) : '—'} detail="Employees in active timesheet scope" />
        <MetricCard icon={CheckCircle2} label="Booked Hours" value={payload ? `${payload.summary.bookedHours}h` : '—'} detail="Total hours recorded" />
        <MetricCard icon={ShieldCheck} label="Used Hours" value={payload ? `${payload.summary.usedHours}h` : '—'} detail="Productive and non-idle hours" />
        <MetricCard icon={TimerReset} label="Idle Hours" value={payload ? `${payload.summary.idleHours}h` : '—'} detail="Idle and waiting time" />
        <MetricCard icon={Users} label="Project Hours" value={payload ? `${payload.summary.projectHours}h` : '—'} detail="Direct project allocations" />
        <MetricCard icon={Users} label="Non-Project Hours" value={payload ? `${payload.summary.nonProjectHours}h` : '—'} detail="Internal and support work" />
        <MetricCard icon={AlertTriangle} label="Pending Approvals" value={payload ? formatNumber(payload.summary.pendingApprovals) : '—'} detail="Records awaiting workflow action" />
        <MetricCard icon={AlertTriangle} label="Overtime Hours" value={payload ? `${payload.summary.overtimeHours}h` : '—'} detail="Daily overtime captured" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee, department, site, or supervisor..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={departmentFilter} onChange={(value) => setDepartmentFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.departments || [])]} labels={{ All: 'All Departments' }} />
        <Select value={projectFilter} onChange={(value) => setProjectFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.projects || [])]} labels={{ All: 'All Projects' }} />
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={supervisorFilter} onChange={(value) => setSupervisorFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.supervisors || [])]} labels={{ All: 'All Supervisors' }} />
        <Select value={shiftFilter} onChange={(value) => setShiftFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.shifts || [])]} labels={{ All: 'All Shifts' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:w-[440px]">
          <Select value={businessUnitFilter} onChange={(value) => setBusinessUnitFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.businessUnits || [])]} labels={{ All: 'All Business Units' }} />
          <Select value={statusFilter} onChange={(value) => setStatusFilter(value as 'All' | TimesheetStatus)} options={['All', ...(payload?.filterOptions.statuses || [])]} labels={{ All: 'All Statuses' }} />
        </div>
        <div className="text-xs text-slate-500">
          Matrix records: <span className="font-semibold text-slate-700">{formatNumber(visibleRecords.length)}</span>
          {' '}<span className="mx-2">•</span>
          Selected for bulk: <span className="font-semibold text-slate-700">{formatNumber(selectedRecordIds.length)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Timesheet Matrix</div>
          <div className="text-xs text-slate-500 mt-1">Spreadsheet-style daily labour allocation across projects, non-project activities, and idle categories, editable for multiple employees at once.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left min-w-[1800px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Pick</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Employee</th>
                {(payload?.matrixColumns || []).map((column) => (
                  <th key={column.code} className="px-3 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{column.label}</th>
                ))}
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Used</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Idle</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const row = getActiveRow(record);
                const metrics = metricsForRecord({
                  allocations: effectiveAllocationsForRecord(record),
                  standardHours: record.standardHours,
                  overtimeHours: record.overtimeHours,
                  approvedOvertimeHours: record.approvedOvertimeHours,
                  labourRateNgn: record.labourRateNgn,
                });
                const active = selectedRecord?.id === record.id;
                return (
                  <tr key={record.id} className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${active ? 'bg-dle-blue/5' : ''}`} onClick={() => setSelectedId(record.id)}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectedRecord(record.id);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{record.employeeName}</div>
                      <div className="text-xs text-slate-500">{record.employeeId}</div>
                    </td>
                    {(payload?.matrixColumns || []).map((column) => (
                      <td key={`${record.id}-${column.code}`} className="px-2 py-2 text-sm text-slate-700">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row[column.code] ?? 0}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateMatrixCell(record, column.code, e.target.value)}
                          className="w-[72px] py-1.5 px-2 rounded-lg border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{metrics.usedHours}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{metrics.idleHours}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{metrics.bookedHours}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusTone(record.status)}`}>{record.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-slate-500">Capture hours directly in the matrix across multiple employees, then use `Save Matrix` to persist all edited rows together.</div>
          <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runMatrixSave()} className="px-3 py-2 rounded-lg bg-dle-blue text-white text-sm font-medium hover:bg-dle-blue-deep disabled:opacity-60">
            <Save className="w-4 h-4 inline mr-2" />
            Save Matrix
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Daily Allocation Panel</div>
              <div className="text-xs text-slate-500 mt-1">Review daily labour split, productive versus idle time, overtime, and validation posture.</div>
            </div>
            <div className="p-5">
              {selectedRecord && selectedMetrics ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusTone(selectedRecord.status)}`}>{selectedRecord.status}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedRecord.mode}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedRecord.employeeName}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedRecord.department}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Standard Hours" value={`${selectedRecord.standardHours}h`} />
                    <DetailStat label="Booked Hours" value={`${selectedMetrics.bookedHours}h`} />
                    <DetailStat label="Used Time" value={`${selectedMetrics.usedHours}h`} />
                    <DetailStat label="Idle Time" value={`${selectedMetrics.idleHours}h`} />
                    <DetailStat label="Project Hours" value={`${selectedMetrics.projectHours}h`} />
                    <DetailStat label="Non-Project Hours" value={`${selectedMetrics.nonProjectHours}h`} />
                    <DetailStat label="Productive Time" value={`${selectedMetrics.productiveHours}h`} />
                    <DetailStat label="Utilization" value={`${selectedMetrics.utilizationPct}%`} />
                    <DetailStat label="Overtime" value={`${selectedRecord.overtimeHours}h`} />
                    <DetailStat label="Approved Overtime" value={`${selectedRecord.approvedOvertimeHours}h`} />
                    <DetailStat label="Labour Rate" value={formatMoney(selectedRecord.labourRateNgn)} />
                    <DetailStat label="Total Labour Cost" value={formatMoney(selectedMetrics.labourCostNgn)} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a timesheet to inspect the daily allocation breakdown.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Project Allocation Grid</div>
              <div className="text-xs text-slate-500 mt-1">Allocate labour hours by project, WBS, cost code, internal activity, and idle categories.</div>
            </div>
            <div className="p-4 space-y-3">
              {allocationEditor.map((allocation, index) => (
                <div key={allocation.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="grid grid-cols-1 xl:grid-cols-[220px_110px_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-start">
                    <SelectField label="Column" value={allocation.projectCode} onChange={(value) => updateAllocation(index, 'projectCode', value)} options={(payload?.projectCatalog || []).map((item) => item.code)} />
                    <Field label="Hours" value={String(allocation.hours)} onChange={(value) => updateAllocation(index, 'hours', value)} type="number" />
                    <ReadOnlyField label="Phase" value={allocation.phase} />
                    <ReadOnlyField label="Work Package" value={allocation.workPackage} />
                    <ReadOnlyField label="Activity" value={allocation.activity} />
                    <ReadOnlyField label="Cost Code" value={allocation.costCode} />
                    <ReadOnlyField label="WBS" value={allocation.wbs} />
                    <button type="button" onClick={() => removeAllocation(index)} className="mt-6 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 text-xs text-slate-600">
                    <span>Task: {allocation.task}</span>
                    <span>Type: {allocation.hourType}</span>
                    <span>Bucket: {allocation.bucket}</span>
                    <span>Cost: {formatMoney(allocation.labourCostNgn)}</span>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addAllocation} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Plus className="w-4 h-4 inline mr-2" />
                Add Allocation Row
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Approval Workflow Panel</div>
              <div className="text-xs text-slate-500 mt-1">Track the full approval path across employee, supervisor, engineering, HR, and payroll.</div>
            </div>
            <div className="p-4 space-y-3">
              {(selectedRecord?.approvals || []).map((step) => (
                <div key={step.stage} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{step.stage}</div>
                    <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${statusTone(step.status)}`}>{step.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{step.by || 'Pending actor'}</div>
                  <div className="text-xs text-slate-500 mt-1">{step.actedAt ? formatDate(step.actedAt) : 'No action yet'}</div>
                  <div className="text-sm text-slate-600 mt-2">{step.comment || 'No workflow comment recorded.'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Resource Utilization Dashboard</div>
              <div className="text-xs text-slate-500 mt-1">View labour utilization, direct versus indirect cost, and departmental productivity posture.</div>
            </div>
            <div className="p-4 space-y-4">
              {selectedMetrics ? (
                <div className="grid grid-cols-2 gap-3">
                  <DetailStat label="Utilization %" value={`${selectedMetrics.utilizationPct}%`} />
                  <DetailStat label="Idle %" value={`${selectedRecord ? round1((selectedMetrics.idleHours / selectedRecord.standardHours) * 100) : 0}%`} />
                  <DetailStat label="Direct Labour Cost" value={formatMoney(selectedMetrics.directLabourCostNgn)} />
                  <DetailStat label="Indirect Labour Cost" value={formatMoney(selectedMetrics.indirectLabourCostNgn)} />
                  <DetailStat label="Client Billing Base" value={formatMoney(Math.round(selectedMetrics.directLabourCostNgn * 1.15))} />
                  <DetailStat label="Project Profitability Signal" value={selectedMetrics.directLabourCostNgn > selectedMetrics.indirectLabourCostNgn ? 'Recoverable' : 'At Risk'} />
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">Department Utilization</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(payload?.analytics.utilizationByDepartment || []).slice(0, 6).map((item) => (
                    <div key={item.department} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{item.department}</div>
                        <div className="text-sm text-slate-700">{item.utilizationPct}%</div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Booked {item.bookedHours}h / Available {item.availableHours}h · Idle {item.idlePct}% · Cost {formatMoney(item.labourCostNgn)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Submission Section</div>
              <div className="text-xs text-slate-500 mt-1">Finalize entry mode, overtime approval, remarks, and workflow decision for the selected timesheet.</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectField label="Entry Mode" value={mode} onChange={(value) => setMode(value as TimesheetEntryMode)} options={payload?.filterOptions.modes || []} />
                <Field label="Approved Overtime Hours" value={approvedOvertimeHours} onChange={setApprovedOvertimeHours} type="number" />
              </div>
              <TextAreaField label="Remarks" value={remarks} onChange={setRemarks} placeholder="Capture project notes, idle reasons, approval comments, or submission context." />

              {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runRecordAction('SAVE_DRAFT')} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save Draft</button>
                <button type="button" disabled={submitting || !payload?.permissions.canEdit} onClick={() => void runRecordAction('SUBMIT')} className="px-3 py-2 rounded-lg bg-dle-blue text-white text-sm font-medium hover:bg-dle-blue-deep disabled:opacity-60">Submit</button>
                <button type="button" disabled={submitting || !payload?.permissions.canApprove} onClick={() => void runRecordAction('APPROVE')} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                <button type="button" disabled={submitting || !payload?.permissions.canApprove} onClick={() => void runRecordAction('RETURN')} className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 disabled:opacity-60">Return</button>
                <button type="button" disabled={submitting || !payload?.permissions.canApprove} onClick={() => void runRecordAction('REJECT')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">Reject</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-900">Project Dashboard</div>
            <div className="text-xs text-slate-500 mt-1">Project labour hours, cost, recoverable billing base, and overtime burden for related allocations.</div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Project', 'Labour Hours', 'Labour Cost', 'Billable Hours', 'Idle Hours', 'Overtime Hours'].map((header) => (
                    <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedProjectDashboard.map((item) => (
                  <tr key={item.projectCode} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{item.projectCode}</div>
                      <div className="text-xs text-slate-500">{item.projectName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.labourHours}h</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(item.labourCostNgn)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.billableHours}h</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.idleHours}h</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.overtimeHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">AI Timesheet Insights</div>
              <div className="text-xs text-slate-500 mt-1">AI-driven prompts on idle risk, labour waste, anomalies, and utilization pressure.</div>
            </div>
            <div className="p-4 space-y-3">
              {(payload?.aiInsights || []).map((insight) => (
                <div key={insight.id} className={`rounded-2xl border p-4 ${insightTone(insight.severity)}`}>
                  <div className="text-sm font-semibold text-slate-900">{insight.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{insight.recommendation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Recent Audit Activity</div>
              <div className="text-xs text-slate-500 mt-1">Recent attendance and timesheet audit events for governance and traceability.</div>
            </div>
            <div className="p-4 space-y-3">
              {payload?.permissions.canViewAudit ? (
                auditEvents.length ? (
                  auditEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{event.action}</div>
                        <div className="text-[11px] text-slate-500 font-semibold">{formatDate(event.createdAt)}</div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{event.actor}</div>
                      <div className="text-sm text-slate-700 mt-2">{event.summary}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">No attendance audit events are available yet.</div>
                )
              ) : (
                <div className="text-sm text-slate-600">Your current role cannot view the attendance audit log.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string; detail: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
          <div className="text-xs text-slate-500 mt-2">{detail}</div>
        </div>
        <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 text-dle-blue flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <div className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white">{value}</div>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20 resize-y"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] || option}
        </option>
      ))}
    </select>
  );
}
