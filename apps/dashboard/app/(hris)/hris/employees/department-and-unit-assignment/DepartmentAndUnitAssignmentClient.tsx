'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  ChevronRight,
  Download,
  Filter,
  Fingerprint,
  GitCompare,
  History,
  LayoutGrid,
  Lock,
  Pencil,
  Printer,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Line Manager'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type EmployeeJob = Record<string, string | null>;
type EmployeeEmployment = Record<string, string | null>;

type AssignmentRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Line Manager Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Review'
  | 'Pending HR Director Approval'
  | 'Pending Payroll Review'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type AssignmentRequestType =
  | 'Department Transfer'
  | 'Unit Transfer'
  | 'Business Unit Transfer'
  | 'Cost Center Change'
  | 'Reporting Manager Change'
  | 'Project Reassignment'
  | 'Site Reassignment'
  | 'Temporary Assignment'
  | 'Secondment'
  | 'Acting Assignment';

type AssignmentRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  requestType: AssignmentRequestType;
  status: AssignmentRequestStatus;
  effectiveDate: string;
  endDate?: string | null;
  reason: string;
  notes?: string | null;
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
  assignmentType: string;
  assignmentStatus: string;
  supportingDocuments: { id: string; name: string }[];
  approvals: { id: string; at: string; stage: AssignmentRequestStatus; decision: 'Approved' | 'Rejected'; by: string; reason?: string | null }[];
  audit: { id: string; at: string; action: string; performedBy: string; oldValue?: string; newValue?: string; reason?: string }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isBulk?: boolean;
  bulkEmployeeIds?: string[];
};

type DepartmentUnitAssignmentPayload = {
  employeeId: string;
  employeeName: string;
  assignment: Record<string, string | null>;
  reporting: Record<string, string | null>;
  project: Record<string, string | null>;
  approvalStatus: AssignmentRequestStatus;
  approvalRef?: string | null;
  lastUpdatedAt: string;
  pendingChanges: number;
  requests: AssignmentRequest[];
  aiInsights: AIInsight[];
};

type AssignmentHistoryRow = {
  id: string;
  referenceNo: string;
  employeeId: string;
  employeeName: string;
  assignmentType: string;
  previousDepartment?: string | null;
  newDepartment?: string | null;
  previousUnit?: string | null;
  newUnit?: string | null;
  previousManager?: string | null;
  newManager?: string | null;
  previousCostCenter?: string | null;
  newCostCenter?: string | null;
  effectiveDate: string;
  endDate?: string | null;
  approvalStatus: string;
  approvedBy?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  requestId?: string | null;
  isBulk?: boolean;
};

type FormOptions = {
  departments: string[];
  businessUnits: string[];
  divisions: string[];
  units: string[];
  teams: string[];
  costCenters: string[];
  locations: string[];
  officeSites: string[];
  projects: { name: string; code: string; location: string; client: string }[];
  projectSites: string[];
  assignmentTypes: string[];
  assignmentStatuses: string[];
  mobilizationStatuses: string[];
  hseInductionStatuses: string[];
  employees: { employeeId: string; fullName: string; currentDepartment: string; currentUnit: string; currentManager: string; location: string; employmentStatus: string }[];
};

type AIInsight = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  confidence: number;
  recommendation: string;
  actionLabel: string;
};

type ApiState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string };

const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateUtc = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const formatDateTimeUtc = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
};

const severityStyle = (s: 'high' | 'medium' | 'low') => {
  if (s === 'high') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  if (s === 'medium') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
};

async function apiFetch<T>(employeeId: string, resource: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
  const res = await fetch(`/api/hris/employees/${encodeURIComponent(employeeId)}/${resource}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'x-hris-role': init.role,
      ...(init.viewerEmployeeId ? { 'x-hris-employee-id': init.viewerEmployeeId } : {}),
    },
  });
  const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
  if (!res.ok || !json || json.status !== 'success') throw new Error(json?.error || 'Request failed');
  return json.data as T;
}

async function apiFetchGlobal<T>(path: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'x-hris-role': init.role,
      ...(init.viewerEmployeeId ? { 'x-hris-employee-id': init.viewerEmployeeId } : {}),
    },
  });
  const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
  if (!res.ok || !json || json.status !== 'success') throw new Error(json?.error || 'Request failed');
  return json.data as T;
}

async function apiPostGlobal<T>(path: string, body: any, init: { role: Role; viewerEmployeeId?: string }) {
  return apiFetchGlobal<T>(path, {
    method: 'POST',
    role: init.role,
    viewerEmployeeId: init.viewerEmployeeId,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-slate-200/60 rounded-2xl shadow-sm ${className || ''}`}>{children}</div>
);

const Pill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold">{label}</span>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
    <div className="text-sm font-extrabold text-slate-900 mt-1">{value || '—'}</div>
  </div>
);

const Modal = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => (
  <AnimatePresence>
    {open ? (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          className="mx-auto mt-10 w-[96%] max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

const buildPdf = (title: string, lines: string[]) => {
  const escapePdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const clean = (s: string) => escapePdf(s.replace(/\r?\n/g, ' ').slice(0, 170));
  const fontSize = 10;
  const lineHeight = 12;
  const startY = 760;
  const x = 40;
  const all = [title, ...lines].slice(0, 55);
  const streamParts: string[] = [];
  streamParts.push(`BT /F1 ${fontSize} Tf ${x} ${startY} Td`);
  for (let i = 0; i < all.length; i++) {
    streamParts.push(`(${clean(all[i] || '')}) Tj`);
    if (i !== all.length - 1) streamParts.push(`0 -${lineHeight} Td`);
  }
  streamParts.push('ET');
  const stream = streamParts.join('\n');

  const encoder = new TextEncoder();
  const xref: number[] = [0];
  let out = '%PDF-1.4\n';
  const pushObj = (obj: string) => {
    xref.push(out.length);
    out += obj;
  };
  pushObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pushObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pushObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  pushObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  const streamBytes = encoder.encode(stream);
  pushObj(`5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  const startXref = out.length;
  out += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xref.length; i++) out += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return encoder.encode(out);
};

export default function DepartmentAndUnitAssignmentClient({ initialNow, employeeId }: { initialNow: string; employeeId: string }) {
  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);
  const [employeeInput, setEmployeeInput] = useState(employeeId);
  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [employment, setEmployment] = useState<ApiState<EmployeeEmployment>>({ status: 'idle' });
  const [assignment, setAssignment] = useState<ApiState<DepartmentUnitAssignmentPayload>>({ status: 'idle' });
  const [assignmentHistory, setAssignmentHistory] = useState<ApiState<AssignmentHistoryRow[]>>({ status: 'idle' });
  const [formOptions, setFormOptions] = useState<ApiState<FormOptions>>({ status: 'idle' });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string; tone: 'ok' | 'warn' | 'err' } | null>(null);
  const [view, setView] = useState<'overview' | 'assignment' | 'reporting' | 'project' | 'workflow' | 'history' | 'audit'>('overview');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestAudit, setRequestAudit] = useState<ApiState<{ id: string; at: string; action: string; performedBy: string; oldValue?: string; newValue?: string; reason?: string }[]>>({ status: 'idle' });
  const [draft, setDraft] = useState<{
    requestId?: string;
    requestType: AssignmentRequestType;
    assignmentType: string;
    assignmentStatus: string;
    effectiveDate: string;
    endDate: string;
    reason: string;
    notes: string;
    newValues: Record<string, string | null>;
    supportingDocuments: { id: string; name: string }[];
  }>({
    requestType: 'Department Transfer',
    assignmentType: 'Permanent Assignment',
    assignmentStatus: 'Pending Approval',
    effectiveDate: initialNow,
    endDate: '',
    reason: '',
    notes: '',
    newValues: {},
    supportingDocuments: [],
  });
  const [bulkDraft, setBulkDraft] = useState<{
    employeeIdsText: string;
    requestType: AssignmentRequestType;
    effectiveDate: string;
    endDate: string;
    reason: string;
    notes: string;
    newValues: Record<string, string | null>;
    assignmentType: string;
    assignmentStatus: string;
  }>({
    employeeIdsText: '',
    requestType: 'Department Transfer',
    effectiveDate: initialNow,
    endDate: '',
    reason: '',
    notes: '',
    newValues: {},
    assignmentType: 'Permanent Assignment',
    assignmentStatus: 'Pending Approval',
  });

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);
  const nowMs = useMemo(() => new Date(initialNow).getTime(), [initialNow]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setEmployment({ status: 'loading' });
      setAssignment({ status: 'loading' });
      setAssignmentHistory({ status: 'loading' });
      try {
        const [emp, asg, hist] = await Promise.all([
          apiFetch<EmployeeEmployment>(activeEmployeeId, 'employment', { method: 'GET', role, viewerEmployeeId }),
          apiFetch<DepartmentUnitAssignmentPayload>(activeEmployeeId, 'department-unit-assignment', { method: 'GET', role, viewerEmployeeId }),
          apiFetch<AssignmentHistoryRow[]>(activeEmployeeId, 'assignment-history', { method: 'GET', role, viewerEmployeeId }),
        ]);
        if (cancelled) return;
        setEmployment({ status: 'ready', data: emp });
        setAssignment({ status: 'ready', data: asg });
        setAssignmentHistory({ status: 'ready', data: hist });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unable to load department/unit assignment';
        setEmployment({ status: 'error', error: msg });
        setAssignment({ status: 'error', error: msg });
        setAssignmentHistory({ status: 'error', error: msg });
      }
    };
    const t = setTimeout(() => void run(), 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  useEffect(() => {
    if (!employeePickerOpen && !requestModalOpen && !bulkModalOpen) return;
    if (formOptions.status === 'ready' || formOptions.status === 'loading') return;
    let cancelled = false;
    const run = async () => {
      try {
        setFormOptions({ status: 'loading' });
        const data = await apiFetchGlobal<FormOptions>('/api/hris/assignment/form-options?includeEmployees=1', { method: 'GET', role, viewerEmployeeId });
        if (cancelled) return;
        setFormOptions({ status: 'ready', data });
      } catch (e) {
        if (cancelled) return;
        setFormOptions({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load form options' });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [employeePickerOpen, requestModalOpen, bulkModalOpen, formOptions.status, role, viewerEmployeeId]);

  const empData = employment.data;
  const asgData = assignment.data;
  const assignmentRows = useMemo(() => assignmentHistory.data || [], [assignmentHistory.data]);
  const requests = useMemo(() => asgData?.requests || [], [asgData?.requests]);
  const latestRequest = requests[0] || null;
  const approvalStatus = asgData?.approvalStatus || 'Approved';

  const pendingDraft = requests.find((r) => r.status === 'Draft' || r.status === 'Rejected') || null;

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Department & Unit Assignment</span>
    </div>
  );

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Building2 className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Department & Unit Assignment</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Organization placement center for department, business unit, division, and location assignments—fully aligned to workflow-approved movements.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href={`/hris/employees/employee-profile?employeeId=${encodeURIComponent(activeEmployeeId)}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserCircle2 className="w-4 h-4" />
            Open Profile
          </Link>
          <Link
            href={`/hris/employees/job-information?employeeId=${encodeURIComponent(activeEmployeeId)}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Job Information
          </Link>
          <Link
            href={`/hris/employees/employment-history?employeeId=${encodeURIComponent(activeEmployeeId)}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" />
            Employment History
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!asgData) {
                setToast({ title: 'Not ready', detail: 'Wait for assignment to load.', tone: 'warn' });
                return;
              }
              const cur = asgData;
              setDraft({
                requestId: undefined,
                requestType: 'Department Transfer',
                assignmentType: cur.assignment.assignmentType || 'Permanent Assignment',
                assignmentStatus: cur.assignment.assignmentStatus || 'Pending Approval',
                effectiveDate: initialNow,
                endDate: '',
                reason: '',
                notes: '',
                newValues: {
                  ...cur.assignment,
                  ...cur.reporting,
                  ...cur.project,
                },
                supportingDocuments: [],
              });
              setRequestModalOpen(true);
              setView('workflow');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            New Assignment
          </button>
          <button
            type="button"
            onClick={async () => {
              const d = pendingDraft;
              if (!d) {
                setToast({ title: 'No draft request', detail: 'Create a draft assignment request first.', tone: 'warn' });
                setRequestModalOpen(true);
                setView('workflow');
                return;
              }
              try {
                await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(d.id)}/submit`, { reason: d.reason }, { role, viewerEmployeeId });
                setToast({ title: 'Submitted', detail: d.id, tone: 'ok' });
                setRefreshToken((n) => n + 1);
                setView('workflow');
              } catch (e) {
                setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors"
          >
            <Send className="w-4 h-4" />
            Submit Transfer Request
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkModalOpen(true);
              setView('workflow');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <GitCompare className="w-4 h-4" />
            Bulk Reassignment
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Assignment Report
          </button>
          <button
            type="button"
            onClick={() => setToast({ title: 'Org structure', detail: 'Org structure viewer is queued for the next HRIS iteration.', tone: 'ok' })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            View Org Structure
          </button>
          <button
            type="button"
            onClick={() => setRefreshToken((n) => n + 1)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    </Card>
  );

  const toolbar = (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={employeeInput}
              onChange={(e) => setEmployeeInput(e.target.value)}
              placeholder="Employee ID (e.g., DLE-EMP-00001)"
              className="w-[260px] max-w-[70vw] text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const next = employeeInput.trim();
              if (!next) return;
              setActiveEmployeeId(next);
              setToast({ title: 'Employee loaded', detail: next, tone: 'ok' });
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors"
          >
            <Users className="w-4 h-4" />
            Load
          </button>
          <button
            type="button"
            onClick={() => setEmployeePickerOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Search className="w-4 h-4" />
            Employee Selector
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Controls
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-600">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:outline-none"
          >
            {(
              [
                'Super Admin',
                'HR Director',
                'HR Manager',
                'HR Officer',
                'Department Head',
                'Line Manager',
                'Payroll Officer',
                'Auditor',
                'Employee',
                'Executive Management',
              ] as Role[]
            ).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="text-[11px] font-extrabold text-slate-600">Viewer Employee ID</span>
            <input
              value={viewerEmployeeId || ''}
              onChange={(e) => setViewerEmployeeId(e.target.value.trim() || undefined)}
              placeholder="Optional"
              className="w-[180px] max-w-[60vw] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {(
          [
            { key: 'overview', label: 'Overview', icon: Building2 },
            { key: 'assignment', label: 'Current Assignment', icon: LayoutGrid },
            { key: 'reporting', label: 'Reporting Line', icon: Users },
            { key: 'project', label: 'Project/Site', icon: Building2 },
            { key: 'workflow', label: 'Workflow', icon: ShieldCheck },
            { key: 'history', label: 'History', icon: GitCompare },
            { key: 'audit', label: 'Audit', icon: Fingerprint },
          ] as const
        ).map((t) => {
          const on = view === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                on ? 'border-emerald-700 bg-emerald-700/5 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </Card>
  );

  const summary = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {(() => {
        const a = asgData?.assignment || {};
        const r = asgData?.reporting || {};
        const p = asgData?.project || {};
        const eff = a.effectiveDate ? new Date(String(a.effectiveDate)).getTime() : NaN;
        const effective = Number.isFinite(eff) ? formatDateUtc(String(a.effectiveDate)) : '—';
        const pending = asgData?.pendingChanges ?? 0;
        const cards = [
          { label: 'Current Department', value: a.department || '—', detail: r.departmentHead || '—', icon: Building2, tone: 'bg-emerald-600/10 text-emerald-700 border-emerald-200' },
          { label: 'Current Unit', value: a.unit || '—', detail: a.team || '—', icon: LayoutGrid, tone: 'bg-slate-50 text-slate-800 border-slate-200' },
          { label: 'Business Unit', value: a.businessUnit || '—', detail: a.division || '—', icon: Building2, tone: 'bg-slate-900 text-white border-slate-200/60' },
          { label: 'Division', value: a.division || '—', detail: a.costCenter || '—', icon: Building2, tone: 'bg-white text-slate-800 border-slate-200' },
          { label: 'Cost Center', value: a.costCenter || '—', detail: empData?.payrollGroup || '—', icon: Fingerprint, tone: 'bg-white text-slate-800 border-slate-200' },
          { label: 'Reporting Manager', value: r.reportingManager || '—', detail: r.functionalManager || '—', icon: Users, tone: 'bg-amber-600/10 text-amber-700 border-amber-200' },
          { label: 'Project/Site', value: p.projectName || a.projectSite || '—', detail: p.siteLocation || '—', icon: Building2, tone: 'bg-white text-slate-800 border-slate-200' },
          { label: 'Assignment Status', value: a.assignmentStatus || '—', detail: approvalStatus, icon: ShieldCheck, tone: approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200' },
          { label: 'Effective Date', value: effective, detail: a.endDate ? `End: ${formatDateUtc(String(a.endDate))}` : '—', icon: History, tone: 'bg-white text-slate-800 border-slate-200' },
          { label: 'Pending Changes', value: String(pending), detail: asgData?.approvalRef || '—', icon: ShieldAlert, tone: pending > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200' },
        ];
        return cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-slate-600">{c.label}</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{c.value}</div>
                </div>
                <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${c.tone}`}>
                  <Icon className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500 font-semibold truncate">Updated: {formatDateUtc(asgData?.lastUpdatedAt || initialNow)} • {c.detail}</div>
            </Card>
          );
        });
      })()}
    </div>
  );

  const aiPanel = (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Assignment Intelligence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Validates cost center, manager routing, unit/team presence, and project assignment integrity.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(asgData?.aiInsights?.length || 0)} checks</span>
      </div>

      <div className="mt-4 space-y-3">
        {assignment.status === 'loading' ? (
          <div className="text-sm text-slate-600 font-semibold">Generating insights…</div>
        ) : assignment.status === 'error' ? (
          <div className="text-sm text-slate-600 font-semibold">{assignment.error || 'Unable to generate insights'}</div>
        ) : asgData?.aiInsights && asgData.aiInsights.length ? (
          asgData.aiInsights.slice(0, 6).map((i) => {
            const st = severityStyle(i.severity);
            return (
              <div key={i.id} className={`rounded-2xl border ${st.border} bg-white p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${st.bg} ${st.fg}`}>{i.severity.toUpperCase()}</span>
                      <span className="text-sm font-extrabold text-slate-900">{i.title}</span>
                      <span className="text-[11px] font-extrabold text-slate-500">Confidence: {formatNumber(Math.round(i.confidence * 100))}%</span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold mt-2">{i.recommendation}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setView('workflow');
                      setRequestModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                    {i.actionLabel}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 font-semibold">No anomalies detected for this employee’s assignment.</div>
        )}
      </div>
    </Card>
  );

  const overviewView = (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900">Current Assignment</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">Manage department, unit, cost center, location, and assignment type/status through controlled requests.</div>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-extrabold ${approvalStatus === 'Approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <ShieldCheck className="w-4 h-4" />
              {approvalStatus}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Department" value={(asgData?.assignment.department || '—') as string} />
            <Field label="Division" value={(asgData?.assignment.division || '—') as string} />
            <Field label="Unit" value={(asgData?.assignment.unit || '—') as string} />
            <Field label="Team" value={(asgData?.assignment.team || '—') as string} />
            <Field label="Business Unit" value={(asgData?.assignment.businessUnit || '—') as string} />
            <Field label="Cost Center" value={(asgData?.assignment.costCenter || '—') as string} />
            <Field label="Location" value={(asgData?.assignment.location || empData?.workLocation || '—') as string} />
            <Field label="Office Site" value={(asgData?.assignment.officeSite || '—') as string} />
            <Field label="Project Site" value={(asgData?.assignment.projectSite || '—') as string} />
            <Field label="Work Mode" value={(asgData?.assignment.workMode || empData?.workMode || '—') as string} />
            <Field label="Shift Pattern" value={(asgData?.assignment.shiftPattern || empData?.shiftPattern || '—') as string} />
            <Field label="Assignment Type" value={(asgData?.assignment.assignmentType || '—') as string} />
            <Field label="Assignment Status" value={(asgData?.assignment.assignmentStatus || '—') as string} />
            <Field label="Effective Date" value={asgData?.assignment.effectiveDate ? formatDateUtc(String(asgData.assignment.effectiveDate)) : '—'} />
            <Field label="End Date" value={asgData?.assignment.endDate ? formatDateUtc(String(asgData.assignment.endDate)) : '—'} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900">Reporting Line</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">Used for workflow routing, matrix reporting support, and access control.</div>
              </div>
            </div>
            <Link href={`/hris/employees/reporting-line?employeeId=${encodeURIComponent(activeEmployeeId)}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
              Open Reporting Line
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Reporting Manager" value={(asgData?.reporting.reportingManager || '—') as string} />
            <Field label="Functional Manager" value={(asgData?.reporting.functionalManager || '—') as string} />
            <Field label="Department Head" value={(asgData?.reporting.departmentHead || '—') as string} />
            <Field label="Unit Head" value={(asgData?.reporting.unitHead || '—') as string} />
            <Field label="Business Unit Head" value={(asgData?.reporting.businessUnitHead || '—') as string} />
            <Field label="Project Manager" value={(asgData?.reporting.projectManager || '—') as string} />
            <Field label="Site Supervisor" value={(asgData?.reporting.siteSupervisor || '—') as string} />
            <Field label="Matrix Manager" value={(asgData?.reporting.matrixManager || '—') as string} />
            <Field label="Delegated Approver" value={(asgData?.reporting.delegatedApprover || '—') as string} />
            <Field label="HR Business Partner" value={(asgData?.reporting.hrBusinessPartner || '—') as string} />
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {aiPanel}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900">Workflow Summary</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">All assignment updates require approval before applying changes.</div>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold text-slate-700">Latest request</div>
              <div className="text-xs text-slate-600 font-semibold mt-2">{latestRequest ? `${latestRequest.requestType} • ${latestRequest.status} • ${formatDateUtc(latestRequest.updatedAt)}` : 'No assignment request found.'}</div>
            </div>
            <button type="button" onClick={() => setView('workflow')} className="inline-flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors">
              View workflow <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );

  const currentAssignmentView = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <LayoutGrid className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Current Assignment Section</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Read-only snapshot. Use “New Assignment” to submit controlled changes.</div>
          </div>
        </div>
        <button type="button" onClick={() => setRequestModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors">
          <Pencil className="w-4 h-4" />
          New Assignment
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Employee ID" value={asgData?.employeeId || activeEmployeeId} />
        <Field label="Employee Name" value={asgData?.employeeName || '—'} />
        <Field label="Department" value={(asgData?.assignment.department || '—') as string} />
        <Field label="Division" value={(asgData?.assignment.division || '—') as string} />
        <Field label="Unit" value={(asgData?.assignment.unit || '—') as string} />
        <Field label="Team" value={(asgData?.assignment.team || '—') as string} />
        <Field label="Business Unit" value={(asgData?.assignment.businessUnit || '—') as string} />
        <Field label="Cost Center" value={(asgData?.assignment.costCenter || '—') as string} />
        <Field label="Location" value={(asgData?.assignment.location || empData?.workLocation || '—') as string} />
        <Field label="Office Site" value={(asgData?.assignment.officeSite || '—') as string} />
        <Field label="Project Site" value={(asgData?.assignment.projectSite || '—') as string} />
        <Field label="Work Mode" value={(asgData?.assignment.workMode || empData?.workMode || '—') as string} />
        <Field label="Shift Pattern" value={(asgData?.assignment.shiftPattern || empData?.shiftPattern || '—') as string} />
        <Field label="Assignment Type" value={(asgData?.assignment.assignmentType || '—') as string} />
        <Field label="Assignment Status" value={(asgData?.assignment.assignmentStatus || '—') as string} />
        <Field label="Effective Date" value={asgData?.assignment.effectiveDate ? formatDateUtc(String(asgData.assignment.effectiveDate)) : '—'} />
        <Field label="End Date" value={asgData?.assignment.endDate ? formatDateUtc(String(asgData.assignment.endDate)) : '—'} />
      </div>
    </Card>
  );

  const reportingView = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Reporting Line Section</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Manager search is supported through controlled change requests (demo).</div>
          </div>
        </div>
        <button type="button" onClick={() => setRequestModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors">
          <Pencil className="w-4 h-4" />
          Change Managers
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Reporting Manager" value={(asgData?.reporting.reportingManager || '—') as string} />
        <Field label="Functional Manager" value={(asgData?.reporting.functionalManager || '—') as string} />
        <Field label="Department Head" value={(asgData?.reporting.departmentHead || '—') as string} />
        <Field label="Unit Head" value={(asgData?.reporting.unitHead || '—') as string} />
        <Field label="Business Unit Head" value={(asgData?.reporting.businessUnitHead || '—') as string} />
        <Field label="Project Manager" value={(asgData?.reporting.projectManager || '—') as string} />
        <Field label="Site Supervisor" value={(asgData?.reporting.siteSupervisor || '—') as string} />
        <Field label="Matrix Manager" value={(asgData?.reporting.matrixManager || '—') as string} />
        <Field label="Delegated Approver" value={(asgData?.reporting.delegatedApprover || '—') as string} />
        <Field label="HR Business Partner" value={(asgData?.reporting.hrBusinessPartner || '—') as string} />
      </div>
    </Card>
  );

  const projectView = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Project / Site Assignment Section</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Track project/site assignment details and mobilization/HSE readiness.</div>
          </div>
        </div>
        <button type="button" onClick={() => setRequestModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors">
          <Pencil className="w-4 h-4" />
          Change Assignment
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Project Name" value={(asgData?.project.projectName || '—') as string} />
        <Field label="Project Code" value={(asgData?.project.projectCode || '—') as string} />
        <Field label="Client" value={(asgData?.project.client || '—') as string} />
        <Field label="Project Location" value={(asgData?.project.projectLocation || '—') as string} />
        <Field label="Site Location" value={(asgData?.project.siteLocation || '—') as string} />
        <Field label="Site Supervisor" value={(asgData?.reporting.siteSupervisor || '—') as string} />
        <Field label="Assignment Start Date" value={asgData?.project.assignmentStartDate ? formatDateUtc(String(asgData.project.assignmentStartDate)) : '—'} />
        <Field label="Assignment End Date" value={asgData?.project.assignmentEndDate ? formatDateUtc(String(asgData.project.assignmentEndDate)) : '—'} />
        <Field label="Mobilization Status" value={(asgData?.project.mobilizationStatus || '—') as string} />
        <Field label="Demobilization Status" value={(asgData?.project.demobilizationStatus || '—') as string} />
        <Field label="Site Access Requirement" value={(asgData?.project.siteAccessRequirement || '—') as string} />
        <Field label="PPE Requirement" value={(asgData?.project.ppeRequirement || '—') as string} />
        <Field label="HSE Induction Status" value={(asgData?.project.hseInductionStatus || '—') as string} />
      </div>
    </Card>
  );

  const workflowView = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Transfer & Reassignment Workflow</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Draft → submit → approvals → approved updates assignment and creates employment history.</div>
          </div>
        </div>
        <button type="button" onClick={() => setRequestModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition-colors">
          <Pencil className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      <div className="hidden md:block overflow-auto">
        <table className="min-w-[1280px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Request ID', 'Type', 'Effective', 'Status', 'Created', 'Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length ? (
              requests.slice(0, 25).map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.id}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.requestType}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.effectiveDate)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.status}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.updatedAt)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            requestId: r.id,
                            requestType: r.requestType,
                            assignmentType: r.assignmentType,
                            assignmentStatus: r.assignmentStatus,
                            effectiveDate: r.effectiveDate,
                            endDate: r.endDate ? String(r.endDate) : '',
                            reason: r.reason,
                            notes: r.notes || '',
                            newValues: { ...r.newValues },
                            supportingDocuments: r.supportingDocuments || [],
                          });
                          setRequestModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-4 h-4" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(r.id)}/submit`, { reason: r.reason }, { role, viewerEmployeeId });
                            setToast({ title: 'Submitted', detail: r.id, tone: 'ok' });
                            setRefreshToken((n) => n + 1);
                          } catch (e) {
                            setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                          }
                        }}
                        disabled={!(r.status === 'Draft' || r.status === 'Rejected')}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border ${
                          r.status === 'Draft' || r.status === 'Rejected' ? 'border-emerald-700 bg-emerald-700/5 text-emerald-800 hover:bg-emerald-700/10' : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-4 h-4" />
                        Submit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(r.id)}/approve`, { reason: 'Approved' }, { role, viewerEmployeeId });
                            setToast({ title: 'Approved', detail: r.id, tone: 'ok' });
                            setRefreshToken((n) => n + 1);
                          } catch (e) {
                            setToast({ title: 'Approve failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                          }
                        }}
                        disabled={!['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review', 'Approved'].includes(r.status)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border ${
                          ['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review', 'Approved'].includes(r.status)
                            ? 'border-emerald-700 bg-emerald-700/5 text-emerald-800 hover:bg-emerald-700/10'
                            : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(r.id)}/reject`, { reason: 'Rejected' }, { role, viewerEmployeeId });
                            setToast({ title: 'Rejected', detail: r.id, tone: 'ok' });
                            setRefreshToken((n) => n + 1);
                          } catch (e) {
                            setToast({ title: 'Reject failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                          }
                        }}
                        disabled={!['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review'].includes(r.status)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border ${
                          ['Submitted', 'Pending Line Manager Review', 'Pending Department Head Approval', 'Pending HR Review', 'Pending HR Director Approval', 'Pending Payroll Review'].includes(r.status)
                            ? 'border-red-700 bg-red-700/5 text-red-800 hover:bg-red-700/10'
                            : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(r.id)}/reverse`, { reason: 'Reversed' }, { role, viewerEmployeeId });
                            setToast({ title: 'Reversed', detail: r.id, tone: 'ok' });
                            setRefreshToken((n) => n + 1);
                          } catch (e) {
                            setToast({ title: 'Reverse failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                          }
                        }}
                        disabled={!['Approved', 'Completed'].includes(r.status)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border ${
                          ['Approved', 'Completed'].includes(r.status) ? 'border-amber-700 bg-amber-700/5 text-amber-800 hover:bg-amber-700/10' : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <GitCompare className="w-4 h-4" />
                        Reverse
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedRequestId(r.id);
                          setAuditModalOpen(true);
                          setRequestAudit({ status: 'loading' });
                          try {
                            const a = await apiFetchGlobal<{ id: string; at: string; action: string; performedBy: string; oldValue?: string; newValue?: string; reason?: string }[]>(
                              `/api/hris/assignment-requests/${encodeURIComponent(r.id)}/audit`,
                              { method: 'GET', role, viewerEmployeeId },
                            );
                            setRequestAudit({ status: 'ready', data: a });
                          } catch (e) {
                            setRequestAudit({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load audit log' });
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                      >
                        <Fingerprint className="w-4 h-4" />
                        Audit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No assignment requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-4 space-y-3">
        {requests.length ? (
          requests.slice(0, 14).map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200/60 bg-white p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill label={r.requestType} />
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{r.status}</span>
              </div>
              <div className="text-xs text-slate-500 font-semibold mt-2">Effective: {formatDateUtc(r.effectiveDate)} • Updated: {formatDateUtc(r.updatedAt)}</div>
              <div className="text-xs text-slate-700 font-semibold mt-2 line-clamp-2">{r.reason}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setRequestModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800">
                  <Pencil className="w-4 h-4" />
                  View
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-2 py-8 text-center text-sm text-slate-600 font-semibold">No assignment requests found.</div>
        )}
      </div>
    </Card>
  );

  const historyView = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-600/10 border border-amber-200 flex items-center justify-center text-amber-700">
            <GitCompare className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Assignment History</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Audit-ready placement history with workflow linkage and reversal controls.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(assignmentRows.length)} records</span>
      </div>

      <div className="md:hidden p-4 space-y-3">
        {assignmentHistory.status === 'loading' ? (
          <div className="px-2 py-8 text-center text-sm text-slate-600 font-semibold">Loading history…</div>
        ) : assignmentHistory.status === 'error' ? (
          <div className="px-2 py-8 text-center text-sm text-slate-600 font-semibold">{assignmentHistory.error || 'Unable to load history'}</div>
        ) : assignmentRows.length ? (
          assignmentRows.slice(0, 18).map((h) => (
            <div key={h.id} className="rounded-2xl border border-slate-200/60 bg-white p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill label={h.assignmentType} />
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{h.approvalStatus}</span>
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{h.referenceNo}</span>
              </div>
              <div className="text-xs text-slate-500 font-semibold mt-2">Effective: {formatDateUtc(h.effectiveDate)}</div>
              <div className="text-xs text-slate-700 font-semibold mt-2">{(h.previousDepartment || '—') + ' → ' + (h.newDepartment || '—')}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (h.requestId) {
                      setSelectedRequestId(h.requestId);
                      setView('workflow');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                  Workflow
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-2 py-8 text-center text-sm text-slate-600 font-semibold">No assignment history found.</div>
        )}
      </div>

      <div className="hidden md:block overflow-auto">
        <table className="min-w-[1400px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {[
                'Reference',
                'Type',
                'Prev Dept',
                'New Dept',
                'Prev Unit',
                'New Unit',
                'Prev Manager',
                'New Manager',
                'Prev Cost',
                'New Cost',
                'Effective',
                'End',
                'Status',
                'Approved By',
                'Created By',
                'Actions',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignmentHistory.status === 'loading' ? (
              <tr>
                <td colSpan={16} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  Loading history…
                </td>
              </tr>
            ) : assignmentHistory.status === 'error' ? (
              <tr>
                <td colSpan={16} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  {assignmentHistory.error || 'Unable to load history'}
                </td>
              </tr>
            ) : assignmentRows.length ? (
              assignmentRows.slice(0, 60).map((h) => (
                <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{h.referenceNo}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.assignmentType}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousDepartment || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newDepartment || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousUnit || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newUnit || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousManager || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newManager || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousCostCenter || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newCostCenter || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(h.effectiveDate)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.endDate ? formatDateUtc(String(h.endDate)) : '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.approvalStatus}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.approvedBy || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.createdBy || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (h.requestId) {
                            setSelectedRequestId(h.requestId);
                            setView('workflow');
                          } else {
                            setView('workflow');
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                        Workflow
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const lines: string[] = [];
                          lines.push(`Reference: ${h.referenceNo}`);
                          lines.push(`Employee: ${h.employeeId} • ${h.employeeName}`);
                          lines.push(`Effective: ${formatDateUtc(h.effectiveDate)}`);
                          lines.push(`Department: ${(h.previousDepartment || '—') + ' → ' + (h.newDepartment || '—')}`);
                          lines.push(`Unit: ${(h.previousUnit || '—') + ' → ' + (h.newUnit || '—')}`);
                          lines.push(`Manager: ${(h.previousManager || '—') + ' → ' + (h.newManager || '—')}`);
                          lines.push(`Cost Center: ${(h.previousCostCenter || '—') + ' → ' + (h.newCostCenter || '—')}`);
                          lines.push(`Status: ${h.approvalStatus}`);
                          const bytes = buildPdf('DLE HRIS — Assignment Letter', lines);
                          const blob = new Blob([bytes], { type: 'application/pdf' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `assignment-letter_${h.referenceNo}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          setToast({ title: 'Downloaded', detail: 'Assignment letter PDF', tone: 'ok' });
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800"
                      >
                        <Download className="w-4 h-4" />
                        Letter
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={16} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No assignment history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const auditView = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Audit Trail</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Open a request audit log for evidence of submission, approvals, and reversals.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            const id = selectedRequestId || latestRequest?.id;
            if (!id) {
              setToast({ title: 'No request selected', detail: 'Select a request in Workflow first.', tone: 'warn' });
              return;
            }
            setSelectedRequestId(id);
            setAuditModalOpen(true);
            setRequestAudit({ status: 'loading' });
            try {
              const a = await apiFetchGlobal<{ id: string; at: string; action: string; performedBy: string; oldValue?: string; newValue?: string; reason?: string }[]>(
                `/api/hris/assignment-requests/${encodeURIComponent(id)}/audit`,
                { method: 'GET', role, viewerEmployeeId },
              );
              setRequestAudit({ status: 'ready', data: a });
            } catch (e) {
              setRequestAudit({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load audit log' });
            }
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors"
        >
          <Fingerprint className="w-4 h-4" />
          Open Audit Log
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Selected Request" value={selectedRequestId || latestRequest?.id || '—'} />
        <Field label="Approval Status" value={approvalStatus} />
      </div>
    </Card>
  );

  const drawer = (
    <AnimatePresence>
      {drawerOpen ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl border-l border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  <Filter className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Controls</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">This page is employee-scoped. Use Employment History for org-wide movements.</div>
                </div>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-extrabold text-slate-700">Quick links</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Link
                    href={`/hris/employees/employee-profile?employeeId=${encodeURIComponent(activeEmployeeId)}`}
                    className="inline-flex items-center justify-between px-3 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Employee Profile <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/hris/employees/employment-history?employeeId=${encodeURIComponent(activeEmployeeId)}`}
                    className="inline-flex items-center justify-between px-3 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Employment History <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                  <Lock className="w-4 h-4" />
                  Governance note
                </div>
                <div className="text-xs text-slate-600 font-semibold mt-2">Assignment is updated only after workflow approval. Reverse incorrect approved assignments to restore previous values.</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const exportModal = (
    <Modal open={exportOpen} onClose={() => setExportOpen(false)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Download className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Export Assignment Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Exports assignment record in CSV, Excel, or PDF.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-extrabold text-slate-700">Included fields</div>
          <div className="text-xs text-slate-600 font-semibold mt-2">Department/division/unit/team, business unit, cost center, reporting, project/site assignment, and assignment workflow context.</div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setExportOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `/api/hris/assignment/export?format=csv&employeeId=${encodeURIComponent(activeEmployeeId)}`;
              window.open(url, '_blank', 'noopener,noreferrer');
              setToast({ title: 'Export started', detail: 'CSV download opened.', tone: 'ok' });
              setExportOpen(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `/api/hris/assignment/export?format=xls&employeeId=${encodeURIComponent(activeEmployeeId)}`;
              window.open(url, '_blank', 'noopener,noreferrer');
              setToast({ title: 'Export started', detail: 'Excel download opened.', tone: 'ok' });
              setExportOpen(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `/api/hris/assignment/export?format=pdf&employeeId=${encodeURIComponent(activeEmployeeId)}`;
              window.open(url, '_blank', 'noopener,noreferrer');
              setToast({ title: 'Export started', detail: 'PDF download opened.', tone: 'ok' });
              setExportOpen(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => {
              if (!asgData) {
                setToast({ title: 'Not ready', detail: 'Wait for assignment data to load before printing.', tone: 'warn' });
                return;
              }
              const w = window.open('', '_blank', 'noopener,noreferrer');
              if (!w) return;
              const safe = (s: string) => s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
              const a = asgData.assignment;
              const r = asgData.reporting;
              const p = asgData.project;
              const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Assignment Report</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:24px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #e5e7eb;padding:8px;font-size:12px;vertical-align:top}th{background:#f8fafc;text-align:left}</style></head><body><h1>DLE HRIS — Department & Unit Assignment</h1><div style="margin-top:6px;font-size:12px;color:#475569">Employee: ${safe(asgData.employeeId)} • ${safe(asgData.employeeName)} • Generated: ${safe(nowStamp)}</div><h2>Assignment</h2><table><tbody><tr><th>Department</th><td>${safe(String(a.department || '—'))}</td><th>Unit</th><td>${safe(String(a.unit || '—'))}</td></tr><tr><th>Business Unit</th><td>${safe(String(a.businessUnit || '—'))}</td><th>Cost Center</th><td>${safe(String(a.costCenter || '—'))}</td></tr><tr><th>Location</th><td>${safe(String(a.location || '—'))}</td><th>Status</th><td>${safe(String(a.assignmentStatus || '—'))}</td></tr></tbody></table><h2>Reporting</h2><table><tbody><tr><th>Reporting Manager</th><td>${safe(String(r.reportingManager || '—'))}</td><th>Functional Manager</th><td>${safe(String(r.functionalManager || '—'))}</td></tr><tr><th>Department Head</th><td>${safe(String(r.departmentHead || '—'))}</td><th>HRBP</th><td>${safe(String(r.hrBusinessPartner || '—'))}</td></tr></tbody></table><h2>Project/Site</h2><table><tbody><tr><th>Project</th><td>${safe(String(p.projectName || '—'))}</td><th>Site</th><td>${safe(String(p.siteLocation || '—'))}</td></tr></tbody></table><script>window.print();</script></body></html>`;
              w.document.open();
              w.document.write(html);
              w.document.close();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>
    </Modal>
  );

  const employeePickerModal = (
    <Modal open={employeePickerOpen} onClose={() => setEmployeePickerOpen(false)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Search className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Employee Selector</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Search by ID, name, department, unit, manager, location, employment status.</div>
          </div>
        </div>
        <button type="button" onClick={() => setEmployeePickerOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {formOptions.status === 'loading' ? (
          <div className="text-sm text-slate-600 font-semibold">Loading employees…</div>
        ) : formOptions.status === 'error' ? (
          <div className="text-sm text-slate-600 font-semibold">{formOptions.error || 'Unable to load employees'}</div>
        ) : formOptions.data ? (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {['Employee ID', 'Name', 'Department', 'Unit', 'Manager', 'Location', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formOptions.data.employees
                    .filter((e) => {
                      const q = employeeInput.trim().toLowerCase();
                      if (!q) return true;
                      const blob = `${e.employeeId} ${e.fullName} ${e.currentDepartment} ${e.currentUnit} ${e.currentManager} ${e.location} ${e.employmentStatus}`.toLowerCase();
                      return blob.includes(q);
                    })
                    .slice(0, 120)
                    .map((e) => (
                      <tr
                        key={e.employeeId}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setEmployeePickerOpen(false);
                          setEmployeeInput(e.employeeId);
                          setActiveEmployeeId(e.employeeId);
                          setToast({ title: 'Employee loaded', detail: `${e.employeeId} • ${e.fullName}`, tone: 'ok' });
                        }}
                      >
                        <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{e.employeeId}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.fullName}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentDepartment}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentUnit}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentManager}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.location}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.employmentStatus}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );

  const requestModal = (
    <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center">
            <Pencil className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Assignment Request</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Create/update a draft request. Submit for approval to apply assignment changes.</div>
          </div>
        </div>
        <button type="button" onClick={() => setRequestModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Request Type</div>
            <select value={draft.requestType} onChange={(e) => setDraft((d) => ({ ...d, requestType: e.target.value as AssignmentRequestType }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
              {(
                [
                  'Department Transfer',
                  'Unit Transfer',
                  'Business Unit Transfer',
                  'Cost Center Change',
                  'Reporting Manager Change',
                  'Project Reassignment',
                  'Site Reassignment',
                  'Temporary Assignment',
                  'Secondment',
                  'Acting Assignment',
                ] as AssignmentRequestType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Effective Date</div>
            <input
              type="date"
              value={draft.effectiveDate ? draft.effectiveDate.slice(0, 10) : ''}
              onChange={(e) => setDraft((d) => ({ ...d, effectiveDate: `${e.target.value}T00:00:00.000Z` }))}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">End Date</div>
            <input
              type="date"
              value={draft.endDate ? draft.endDate.slice(0, 10) : ''}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' }))}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none"
            />
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Required for temporary assignments.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Assignment Type / Status</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <select value={draft.assignmentType} onChange={(e) => setDraft((d) => ({ ...d, assignmentType: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                {(formOptions.data?.assignmentTypes || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <select value={draft.assignmentStatus} onChange={(e) => setDraft((d) => ({ ...d, assignmentStatus: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                {(formOptions.data?.assignmentStatuses || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Reason</div>
          <textarea value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} rows={3} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none" placeholder="Provide a clear audit-ready reason." />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">New Values</div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Department</div>
              <select value={draft.newValues.department || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, department: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.departments || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Business Unit</div>
              <select value={draft.newValues.businessUnit || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, businessUnit: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.businessUnits || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Division</div>
              <select value={draft.newValues.division || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, division: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.divisions || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Unit</div>
              <select value={draft.newValues.unit || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, unit: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.units || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Cost Center</div>
              <select value={draft.newValues.costCenter || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, costCenter: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.costCenters || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Location</div>
              <select value={draft.newValues.workLocation || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, workLocation: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
                <option value="">Select…</option>
                {(formOptions.data?.locations || []).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setRequestModalOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Close
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await apiFetch<AssignmentRequest>(activeEmployeeId, 'department-unit-assignment', {
                  method: 'PATCH',
                  role,
                  viewerEmployeeId,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    requestId: draft.requestId,
                    requestType: draft.requestType,
                    assignmentType: draft.assignmentType,
                    assignmentStatus: draft.assignmentStatus,
                    effectiveDate: draft.effectiveDate,
                    endDate: draft.endDate || null,
                    reason: draft.reason,
                    notes: draft.notes,
                    newValues: draft.newValues,
                    supportingDocuments: draft.supportingDocuments.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim() })),
                  }),
                });
                setDraft((d) => ({ ...d, requestId: res.id }));
                setToast({ title: 'Saved', detail: res.id, tone: 'ok' });
                setRequestModalOpen(false);
                setRefreshToken((n) => n + 1);
                setView('workflow');
              } catch (e) {
                setToast({ title: 'Save failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-700 bg-emerald-700/5 text-emerald-800 text-xs font-extrabold hover:bg-emerald-700/10"
          >
            <Pencil className="w-4 h-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await apiFetch<AssignmentRequest>(activeEmployeeId, 'department-unit-assignment', {
                  method: 'PATCH',
                  role,
                  viewerEmployeeId,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    requestId: draft.requestId,
                    requestType: draft.requestType,
                    assignmentType: draft.assignmentType,
                    assignmentStatus: draft.assignmentStatus,
                    effectiveDate: draft.effectiveDate,
                    endDate: draft.endDate || null,
                    reason: draft.reason,
                    notes: draft.notes,
                    newValues: draft.newValues,
                    supportingDocuments: draft.supportingDocuments.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim() })),
                  }),
                });
                await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(res.id)}/submit`, { reason: res.reason }, { role, viewerEmployeeId });
                setToast({ title: 'Submitted', detail: res.id, tone: 'ok' });
                setRequestModalOpen(false);
                setRefreshToken((n) => n + 1);
                setView('workflow');
              } catch (e) {
                setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors"
          >
            <Send className="w-4 h-4" />
            Submit
          </button>
        </div>
      </div>
    </Modal>
  );

  const bulkModal = (
    <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <GitCompare className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Bulk Reassignment</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Upload/paste employees, preview, validate, submit for approval, apply after approval.</div>
          </div>
        </div>
        <button type="button" onClick={() => setBulkModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Employee IDs</div>
          <textarea value={bulkDraft.employeeIdsText} onChange={(e) => setBulkDraft((d) => ({ ...d, employeeIdsText: e.target.value }))} rows={4} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none" placeholder="Paste one Employee ID per line" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Bulk Request Type</div>
            <select value={bulkDraft.requestType} onChange={(e) => setBulkDraft((d) => ({ ...d, requestType: e.target.value as AssignmentRequestType }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
              {(
                ['Department Transfer', 'Unit Transfer', 'Business Unit Transfer', 'Cost Center Change', 'Reporting Manager Change', 'Project Reassignment', 'Site Reassignment'] as AssignmentRequestType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Effective Date</div>
            <input
              type="date"
              value={bulkDraft.effectiveDate ? bulkDraft.effectiveDate.slice(0, 10) : ''}
              onChange={(e) => setBulkDraft((d) => ({ ...d, effectiveDate: `${e.target.value}T00:00:00.000Z` }))}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">New Department</div>
          <select value={bulkDraft.newValues.department || ''} onChange={(e) => setBulkDraft((d) => ({ ...d, newValues: { ...d.newValues, department: e.target.value || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-900 focus:outline-none">
            <option value="">Select…</option>
            {(formOptions.data?.departments || []).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Reason</div>
          <textarea value={bulkDraft.reason} onChange={(e) => setBulkDraft((d) => ({ ...d, reason: e.target.value }))} rows={2} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setBulkModalOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Close
          </button>
          <button
            type="button"
            onClick={async () => {
              const employeeIds = bulkDraft.employeeIdsText
                .split(/\r?\n/g)
                .map((s) => s.trim())
                .filter(Boolean);
              try {
                const res = await apiPostGlobal<AssignmentRequest>(
                  '/api/hris/assignment-requests/bulk',
                  {
                    employeeIds,
                    requestType: bulkDraft.requestType,
                    effectiveDate: bulkDraft.effectiveDate,
                    endDate: bulkDraft.endDate || null,
                    reason: bulkDraft.reason,
                    notes: bulkDraft.notes,
                    newValues: bulkDraft.newValues,
                    assignmentType: bulkDraft.assignmentType,
                    assignmentStatus: bulkDraft.assignmentStatus,
                  },
                  { role, viewerEmployeeId },
                );
                await apiPostGlobal(`/api/hris/assignment-requests/${encodeURIComponent(res.id)}/submit`, { reason: res.reason }, { role, viewerEmployeeId });
                setToast({ title: 'Bulk submitted', detail: res.id, tone: 'ok' });
                setBulkModalOpen(false);
                setRefreshToken((n) => n + 1);
                setView('workflow');
              } catch (e) {
                setToast({ title: 'Bulk failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors"
          >
            <Send className="w-4 h-4" />
            Create & Submit
          </button>
        </div>
      </div>
    </Modal>
  );

  const auditModal = (
    <Modal open={auditModalOpen} onClose={() => setAuditModalOpen(false)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Request Audit Log</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">{selectedRequestId || '—'}</div>
          </div>
        </div>
        <button type="button" onClick={() => setAuditModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6">
        {requestAudit.status === 'loading' ? (
          <div className="text-sm text-slate-600 font-semibold">Loading audit log…</div>
        ) : requestAudit.status === 'error' ? (
          <div className="text-sm text-slate-600 font-semibold">{requestAudit.error || 'Unable to load audit log'}</div>
        ) : requestAudit.data && requestAudit.data.length ? (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {['Time', 'Action', 'By', 'Reason', 'Old', 'New'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requestAudit.data.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateTimeUtc(a.at)}</td>
                      <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{a.action}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{a.performedBy}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{a.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{a.oldValue ? String(a.oldValue).slice(0, 140) : '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{a.newValue ? String(a.newValue).slice(0, 140) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-600 font-semibold">No audit log entries.</div>
        )}
      </div>
    </Modal>
  );

  const loading = assignment.status === 'loading' || employment.status === 'loading' || assignmentHistory.status === 'loading';
  const hasError = assignment.status === 'error' || employment.status === 'error' || assignmentHistory.status === 'error';

  return (
    <div className="bg-white space-y-6">
      {breadcrumbs}
      {header}
      {toolbar}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[110px] rounded-2xl border border-slate-200/60 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : hasError ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-200 flex items-center justify-center text-red-700">
              <X className="w-5 h-5" />
            </span>
            <div>
              <div className="text-sm font-extrabold text-slate-900">Unable to load assignment</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{assignment.error || employment.error || assignmentHistory.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {summary}
          {view === 'overview'
            ? overviewView
            : view === 'assignment'
              ? currentAssignmentView
              : view === 'reporting'
                ? reportingView
                : view === 'project'
                  ? projectView
                  : view === 'workflow'
                    ? workflowView
                    : view === 'history'
                      ? historyView
                      : auditView}
        </>
      )}

      {drawer}
      {exportModal}
      {employeePickerModal}
      {requestModal}
      {bulkModal}
      {auditModal}

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.16 }} className="fixed bottom-6 right-6 z-50">
            <div className={`w-[380px] rounded-2xl border shadow-lg p-4 bg-white ${toast.tone === 'err' ? 'border-red-200' : toast.tone === 'warn' ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">{toast.title}</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">{toast.detail}</div>
                </div>
                <button type="button" onClick={() => setToast(null)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
