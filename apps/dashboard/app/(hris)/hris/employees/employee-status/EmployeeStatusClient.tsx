'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  Download,
  Fingerprint,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
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
  | 'IT Administrator'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type Severity = 'high' | 'medium' | 'low';

type StatusOption =
  | 'Active'
  | 'Probation'
  | 'Confirmed'
  | 'On Leave'
  | 'Suspended'
  | 'Terminated'
  | 'Resigned'
  | 'Retired'
  | 'Contract Active'
  | 'Contract Expired'
  | 'Seconded'
  | 'Inactive'
  | 'Exited'
  | 'Reactivated'
  | 'Blacklisted'
  | 'Deceased';

type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Director Approval'
  | 'Pending Payroll Review'
  | 'Pending IT Access Review'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  actionLabel: string;
  action: string;
};

type EmployeeOption = {
  employeeId: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
  currentStatus?: string;
  manager?: string;
  location?: string;
  contractStatus?: string;
};

type StatusImpact = {
  payroll: string[];
  systemAccess: string[];
  emailAccess: string[];
  attendance: string[];
  leaveEntitlement: string[];
  benefits: string[];
  assetRecovery: string[];
  documentClearance: string[];
  reportingLine: string[];
  workflowApprovals: string[];
  projectAssignment: string[];
  contractRenewal: string[];
};

type StatusChangeRequest = {
  id: string;
  scope: 'Single' | 'Bulk';
  employeeId: string;
  employeeName: string;
  bulkEmployeeIds?: string[];
  action: string;
  previousStatus: Record<string, string | null>;
  newStatus: Record<string, string | null>;
  effectiveDate: string;
  reason: string;
  responsibleOfficer: string | null;
  workflowStatus: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvals: { id: string; at: string; stage: string; decision: 'Approved' | 'Rejected'; by: string; reason?: string | null }[];
  impact: StatusImpact;
  audit: { id: string; at: string; action: string; performedBy: string; oldValue?: string; newValue?: string; reason?: string }[];
};

type StatusHistoryRow = {
  id: string;
  referenceNo: string;
  employeeId: string;
  employeeName: string;
  previousStatus: string;
  newStatus: string;
  statusCategory: string;
  effectiveDate: string;
  reason: string;
  approvalStatus: string;
  approvedBy: string | null;
  createdBy: string;
  createdAt: string;
};

type StatusPayload = {
  employeeId: string;
  employeeName: string;
  currentStatus: {
    employmentStatus: string;
    employmentType: string;
    hrStatus: string;
    payrollStatus: string;
    accessStatus: string;
    leaveStatus: string;
    probationStatus: string;
    contractStatus: string;
    confirmationStatus: string;
    complianceStatus: string;
    exitStatus: string;
    effectiveDate: string;
    statusReason: string;
    responsibleOfficer: string;
    updatedAt: string;
  };
  summary: {
    lastStatusChangeAt: string | null;
    pendingRequestCount: number;
  };
  aiInsights: AIInsight[];
  requests: StatusChangeRequest[];
  auditTrail: { id: string; at: string; action: string; performedBy: string; reason?: string; oldValue?: string; newValue?: string }[];
};

type StatusFormOptions = {
  statusOptions: StatusOption[];
  actions: string[];
  employees?: EmployeeOption[];
};

type BulkPreview = {
  requestId: string;
  impactedCount: number;
  impacted: { employeeId: string; employeeName: string; currentStatus: string; proposedStatus: string }[];
  aiRisks: AIInsight[];
};

type ApiState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');
const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);

const formatDateUtc = (isoOrDate: string) => {
  const s = isoOrDate?.includes('T') ? isoOrDate : `${isoOrDate}T00:00:00.000Z`;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const formatDateTimeUtc = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
};

const statusPill = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v.includes('active') || v.includes('confirmed') || v.includes('approved') || v.includes('completed')) return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('submitted') || v.includes('probation') || v.includes('leave') || v.includes('review')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('rejected') || v.includes('expired') || v.includes('terminated') || v.includes('resigned') || v.includes('suspended') || v.includes('blacklisted') || v.includes('deceased') || v.includes('exited')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700' };
};

const severityStyle = (s: Severity) => {
  if (s === 'high') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  if (s === 'medium') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
};

async function apiFetchEmployee<T>(employeeId: string, resource: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
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

async function apiFetchModule<T>(path: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
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

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-slate-200/60 rounded-2xl shadow-sm ${className || ''}`}>{children}</div>
);

const Pill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold">{label}</span>
);

const Modal = ({ open, onClose, children, maxW }: { open: boolean; onClose: () => void; children: React.ReactNode; maxW?: string }) => (
  <AnimatePresence>
    {open ? (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          className={`mx-auto mt-10 w-[96%] ${maxW || 'max-w-5xl'} rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

const HeaderButton = ({ onClick, label, tone, icon: Icon, disabled }: { onClick: () => void; label: string; tone: 'primary' | 'secondary' | 'dark'; icon: any; disabled?: boolean }) => {
  const cls =
    tone === 'primary'
      ? 'bg-dle-blue text-white hover:bg-dle-blue/90'
      : tone === 'dark'
        ? 'bg-slate-900 text-white hover:bg-slate-800'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-colors disabled:opacity-60 disabled:pointer-events-none ${cls}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

const emptyImpact = (): StatusImpact => ({
  payroll: [],
  systemAccess: [],
  emailAccess: [],
  attendance: [],
  leaveEntitlement: [],
  benefits: [],
  assetRecovery: [],
  documentClearance: [],
  reportingLine: [],
  workflowApprovals: [],
  projectAssignment: [],
  contractRenewal: [],
});

const actionToStatus = (action: string): StatusOption => {
  const a = action.toLowerCase();
  if (a.includes('suspend')) return 'Suspended';
  if (a.includes('leave') && a.includes('return')) return 'Active';
  if (a.includes('leave')) return 'On Leave';
  if (a.includes('terminate')) return 'Terminated';
  if (a.includes('resign')) return 'Resigned';
  if (a.includes('retire')) return 'Retired';
  if (a.includes('deceased')) return 'Deceased';
  if (a.includes('reactivate')) return 'Reactivated';
  if (a.includes('confirm')) return 'Confirmed';
  if (a.includes('probation')) return 'Probation';
  if (a.includes('blacklist')) return 'Blacklisted';
  if (a.includes('contract expired')) return 'Contract Expired';
  if (a.includes('contract renewed')) return 'Contract Active';
  if (a.includes('activate')) return 'Active';
  return 'Active';
};

export default function EmployeeStatusClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [formState, setFormState] = useState<ApiState<StatusFormOptions>>({ status: 'idle' });
  const [statusState, setStatusState] = useState<ApiState<StatusPayload>>({ status: 'idle' });
  const [historyState, setHistoryState] = useState<ApiState<StatusHistoryRow[]>>({ status: 'idle' });

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [changeOpen, setChangeOpen] = useState(false);
  const [changeMode, setChangeMode] = useState<'create' | 'edit'>('create');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<string>('Suspend Employee');
  const [draftEffectiveDate, setDraftEffectiveDate] = useState<string>(initialNow.slice(0, 10));
  const [draftReason, setDraftReason] = useState<string>('');
  const [draftResponsibleOfficer, setDraftResponsibleOfficer] = useState<string>('');
  const [draftImpact, setDraftImpact] = useState<StatusImpact>(emptyImpact());

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('Contract expiry update');
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [bulkPreview, setBulkPreview] = useState<ApiState<BulkPreview>>({ status: 'idle' });

  const [impactOpen, setImpactOpen] = useState(false);
  const [impactTitle, setImpactTitle] = useState('Status Impact');
  const [impactData, setImpactData] = useState<StatusImpact>(emptyImpact());

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTitle, setAuditTitle] = useState('Audit Trail');
  const [auditRows, setAuditRows] = useState<ApiState<{ id: string; at: string; action: string; performedBy: string; reason?: string }[]>>({ status: 'idle' });

  const [exportOpen, setExportOpen] = useState(false);

  const [toast, setToast] = useState<{ title: string; detail: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setFormState({ status: 'loading' });
      try {
        const data = await apiFetchModule<StatusFormOptions>(`/api/hris/status/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId });
        if (cancelled) return;
        setFormState({ status: 'ready', data });
      } catch (e) {
        if (cancelled) return;
        setFormState({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load options' });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [role, viewerEmployeeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatusState({ status: 'loading' });
      setHistoryState({ status: 'loading' });
      try {
        const [payload, hist] = await Promise.all([
          apiFetchEmployee<StatusPayload>(activeEmployeeId, 'status', { method: 'GET', role, viewerEmployeeId }),
          apiFetchEmployee<StatusHistoryRow[]>(activeEmployeeId, 'status-history', { method: 'GET', role, viewerEmployeeId }),
        ]);
        if (cancelled) return;
        setStatusState({ status: 'ready', data: payload });
        setHistoryState({ status: 'ready', data: hist });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load status';
        setStatusState({ status: 'error', error: msg });
        setHistoryState({ status: 'error', error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  const employees = useMemo(() => formState.data?.employees ?? [], [formState.data?.employees]);
  const actions = useMemo(() => formState.data?.actions ?? [], [formState.data?.actions]);

  const filteredEmployees = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 70);
    return employees
      .filter((e) => [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentStatus, e.manager, e.location, e.contractStatus].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)))
      .slice(0, 140);
  }, [employees, selectorQuery]);

  const payload = statusState.data;

  const openAudit = async (title: string, loader: () => Promise<{ id: string; at: string; action: string; performedBy: string; reason?: string }[]>) => {
    setAuditTitle(title);
    setAuditOpen(true);
    setAuditRows({ status: 'loading' });
    try {
      const rows = await loader();
      setAuditRows({ status: 'ready', data: rows });
    } catch (e) {
      setAuditRows({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load audit' });
    }
  };

  const openChange = () => {
    const suggested = payload?.aiInsights?.[0]?.action === 'open_create' ? 'Reactivate Employee' : 'Suspend Employee';
    setChangeMode('create');
    setEditingRequestId(null);
    setDraftAction(actions.includes(suggested) ? suggested : actions[0] || 'Suspend Employee');
    setDraftEffectiveDate(initialNow.slice(0, 10));
    setDraftReason('');
    setDraftResponsibleOfficer('');
    setDraftImpact(emptyImpact());
    setChangeOpen(true);
  };

  const openEdit = (r: StatusChangeRequest) => {
    setChangeMode('edit');
    setEditingRequestId(r.id);
    setDraftAction(r.action);
    setDraftEffectiveDate(r.effectiveDate);
    setDraftReason(r.reason);
    setDraftResponsibleOfficer(r.responsibleOfficer || '');
    setDraftImpact(r.impact || emptyImpact());
    setChangeOpen(true);
  };

  const saveDraft = async () => {
    try {
      if (!draftEffectiveDate) throw new Error('Effective date is required');
      if (!draftReason.trim()) throw new Error('Status change reason is required');
      const newStatus = actionToStatus(draftAction);
      const body = {
        action: draftAction,
        newEmploymentStatus: newStatus,
        effectiveDate: draftEffectiveDate,
        reason: draftReason,
        responsibleOfficer: draftResponsibleOfficer || undefined,
      };
      if (changeMode === 'create') {
        const created = await apiFetchEmployee<StatusChangeRequest>(activeEmployeeId, 'status-change-request', {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        setDraftImpact(created.impact || emptyImpact());
        setToast({ title: 'Draft created', detail: created.id, tone: 'ok' });
      } else {
        if (!editingRequestId) throw new Error('No draft selected');
        const updated = await apiFetchEmployee<StatusChangeRequest>(activeEmployeeId, 'status', {
          method: 'PATCH',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, requestId: editingRequestId }),
        });
        setDraftImpact(updated.impact || emptyImpact());
        setToast({ title: 'Draft updated', detail: editingRequestId, tone: 'ok' });
      }
      setChangeOpen(false);
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Save failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const submitOrWorkflow = async (requestId: string, actionKey: 'submit' | 'approve' | 'reject' | 'reverse') => {
    await apiFetchModule(`/api/hris/status-change-requests/${encodeURIComponent(requestId)}/${actionKey}`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: actionKey }),
    });
  };

  const previewBulk = async () => {
    setBulkPreview({ status: 'loading' });
    try {
      if (!bulkEmployeeIds.length) throw new Error('Select at least one employee');
      const data = await apiFetchModule<BulkPreview>(`/api/hris/status/bulk-update`, {
        method: 'POST',
        role,
        viewerEmployeeId,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeIds: bulkEmployeeIds, action: bulkAction, effectiveDate: initialNow.slice(0, 10), reason: 'Bulk status update' }),
      });
      setBulkPreview({ status: 'ready', data });
    } catch (e) {
      setBulkPreview({ status: 'error', error: e instanceof Error ? e.message : 'Bulk preview failed' });
    }
  };

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Employee Status</span>
    </div>
  );

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Employee Status</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Manage employee lifecycle status, approval-controlled status changes, payroll eligibility, access status, and compliance impact.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            {payload?.employeeName ? <Pill label={`Name: ${payload.employeeName}`} /> : null}
            {payload?.currentStatus?.employmentStatus ? <Pill label={`Status: ${payload.currentStatus.employmentStatus}`} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton onClick={openChange} label="Change Status" tone="primary" icon={BadgeCheck} disabled={statusState.status !== 'ready'} />
          <HeaderButton
            onClick={() => {
              const req = payload?.requests?.find((r) => r.workflowStatus === 'Draft') || null;
              if (!req) {
                setToast({ title: 'No draft request', detail: 'Create a draft first.', tone: 'warn' });
                return;
              }
              void submitOrWorkflow(req.id, 'submit')
                .then(() => setRefreshToken((n) => n + 1))
                .catch((e) => setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }));
            }}
            label="Submit Status Request"
            tone="secondary"
            icon={BadgeCheck}
            disabled={statusState.status !== 'ready'}
          />
          <HeaderButton onClick={() => setBulkOpen(true)} label="Bulk Status Update" tone="secondary" icon={Users} />
          <HeaderButton onClick={() => setExportOpen(true)} label="Export Status Report" tone="dark" icon={Download} />
          <HeaderButton onClick={() => setRefreshToken((n) => n + 1)} label="Refresh" tone="secondary" icon={RefreshCcw} />
        </div>
      </div>
    </Card>
  );

  const toolbar = (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setSelectorOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <Search className="w-4 h-4" />
            Employee Selector
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-600">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:outline-none">
            {(
              ['Super Admin', 'HR Director', 'HR Manager', 'HR Officer', 'Department Head', 'Line Manager', 'Payroll Officer', 'IT Administrator', 'Compliance Officer', 'Auditor', 'Employee', 'Executive Management'] as Role[]
            ).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="text-[11px] font-extrabold text-slate-600">Viewer Employee ID</span>
            <input value={viewerEmployeeId || ''} onChange={(e) => setViewerEmployeeId(e.target.value.trim() || undefined)} placeholder="Optional" className="w-[180px] max-w-[60vw] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
          </div>
        </div>
      </div>
    </Card>
  );

  const summaryCards = payload ? (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {[
        { title: 'Current Employee Status', value: payload.currentStatus.employmentStatus, detail: 'Lifecycle state', status: payload.currentStatus.employmentStatus },
        { title: 'Employment Type', value: payload.currentStatus.employmentType, detail: 'Type', status: payload.currentStatus.employmentType },
        { title: 'Payroll Eligibility', value: payload.currentStatus.payrollStatus, detail: 'Payroll impact', status: payload.currentStatus.payrollStatus },
        { title: 'System Access Status', value: payload.currentStatus.accessStatus, detail: 'Access control', status: payload.currentStatus.accessStatus },
        { title: 'Leave Status', value: payload.currentStatus.leaveStatus, detail: 'Leave state', status: payload.currentStatus.leaveStatus },
        { title: 'Probation Status', value: payload.currentStatus.probationStatus, detail: 'Probation', status: payload.currentStatus.probationStatus },
        { title: 'Contract Status', value: payload.currentStatus.contractStatus, detail: 'Contract validity', status: payload.currentStatus.contractStatus },
        { title: 'Compliance Status', value: payload.currentStatus.complianceStatus, detail: 'Controls', status: payload.currentStatus.complianceStatus },
        { title: 'Last Status Change', value: payload.summary.lastStatusChangeAt ? formatDateUtc(payload.summary.lastStatusChangeAt) : '—', detail: 'Last update', status: payload.summary.lastStatusChangeAt ? 'Updated' : 'None' },
        { title: 'Pending Status Request', value: String(payload.summary.pendingRequestCount), detail: 'Workflow', status: payload.summary.pendingRequestCount > 0 ? 'Pending' : 'None' },
      ].map((c) => {
        const st = statusPill(c.status);
        return (
          <div key={c.title} className="rounded-2xl border border-slate-200/60 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-slate-600">{c.title}</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(c.value || '—')}</div>
                <div className="text-[11px] text-slate-500 font-semibold mt-2 truncate">{c.detail}</div>
              </div>
              <span className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                <ShieldAlert className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.status}</span>
              <span className="text-[11px] font-extrabold text-slate-500">{formatDateUtc(payload.currentStatus.updatedAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  const aiPanel = payload ? (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Status Intelligence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Validation of payroll/access/contract/leave mismatches and compliance risks.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(payload.aiInsights.length)} insights</span>
      </div>
      <div className="mt-4 space-y-3">
        {payload.aiInsights.slice(0, 10).map((i) => {
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
                    if (i.action === 'open_change') openChange();
                    else if (i.action === 'open_bulk') setBulkOpen(true);
                    else topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                  {i.actionLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  ) : null;

  const currentStatusSection = payload ? (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Current Status</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Employment lifecycle, HR/payroll/access states and compliance alignment.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(payload.currentStatus.employmentStatus).border} ${statusPill(payload.currentStatus.employmentStatus).bg} ${statusPill(payload.currentStatus.employmentStatus).fg}`}>{payload.currentStatus.employmentStatus}</span>
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          ['Employee ID', payload.employeeId],
          ['Employee Name', payload.employeeName],
          ['Employment Status', payload.currentStatus.employmentStatus],
          ['Employment Type', payload.currentStatus.employmentType],
          ['HR Status', payload.currentStatus.hrStatus],
          ['Payroll Status', payload.currentStatus.payrollStatus],
          ['Access Status', payload.currentStatus.accessStatus],
          ['Leave Status', payload.currentStatus.leaveStatus],
          ['Probation Status', payload.currentStatus.probationStatus],
          ['Contract Status', payload.currentStatus.contractStatus],
          ['Confirmation Status', payload.currentStatus.confirmationStatus],
          ['Compliance Status', payload.currentStatus.complianceStatus],
          ['Exit Status', payload.currentStatus.exitStatus],
          ['Effective Date', formatDateUtc(payload.currentStatus.effectiveDate)],
          ['Status Reason', payload.currentStatus.statusReason || '—'],
          ['Responsible Officer', payload.currentStatus.responsibleOfficer || '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(value || '—')}</div>
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  const requestsSection = payload ? (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
            <BadgeCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Status Change Workflow</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Draft → approvals → apply status and downstream impacts.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(payload.requests.length)} requests</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1200px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Request ID', 'Action', 'Effective', 'Workflow', 'Created By', 'Updated', 'Scope', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.requests.length ? (
              payload.requests.map((r) => {
                const st = statusPill(r.workflowStatus);
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.id}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.action}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.effectiveDate)}</td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{r.workflowStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.createdBy}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.scope}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEdit(r)} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImpactTitle(`Impact — ${r.action}`);
                            setImpactData(r.impact || emptyImpact());
                            setImpactOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Impact
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void submitOrWorkflow(r.id, 'submit')
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-dle-blue text-white text-[11px] font-extrabold hover:bg-dle-blue/90"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void submitOrWorkflow(r.id, 'approve')
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Approve failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold hover:bg-slate-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void submitOrWorkflow(r.id, 'reject')
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Reject failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-[11px] font-extrabold text-red-800 hover:bg-red-100"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void submitOrWorkflow(r.id, 'reverse')
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Reverse failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Reverse
                        </button>
                        <button
                          type="button"
                          onClick={() => void openAudit(`Request Audit — ${r.id}`, async () => r.audit || [])}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Audit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No status change requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  const historySection = payload ? (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Status History</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Approved status changes with audit evidence and reversal visibility.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber((historyState.data || []).length)} rows</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1400px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Reference No.', 'Previous', 'New', 'Category', 'Effective', 'Reason', 'Approval', 'Approved By', 'Created By', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(historyState.data || []).length ? (
              (historyState.data || []).map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.referenceNo}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.previousStatus}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.newStatus}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.statusCategory}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.effectiveDate)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[320px]">{r.reason}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.approvalStatus}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.approvedBy || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.createdBy}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void openAudit(`Employee Audit — ${payload.employeeId}`, async () => payload.auditTrail || [])}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                    >
                      <Fingerprint className="w-4 h-4" />
                      Audit Log
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No history rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  const auditPreview = payload ? (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Audit Trail</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Status viewed/created/submitted/approved/rejected/reversed and impact changes.</div>
          </div>
        </div>
        <button type="button" onClick={() => void openAudit(`Employee Audit — ${payload.employeeId}`, async () => payload.auditTrail || [])} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <Fingerprint className="w-4 h-4" />
          Open Full Audit
        </button>
      </div>
      <div className="p-4 space-y-2">
        {(payload.auditTrail || []).slice(0, 20).map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-extrabold text-slate-900">{a.action}</div>
              <div className="text-[11px] font-extrabold text-slate-500">{formatDateTimeUtc(a.at)}</div>
            </div>
            <div className="mt-2 text-xs text-slate-600 font-semibold">Performed By: {a.performedBy}</div>
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  const selectorModal = (
    <Modal open={selectorOpen} onClose={() => setSelectorOpen(false)} maxW="max-w-4xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Search className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Employee Selector</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Search by ID, name, department, job title, status, manager, location.</div>
          </div>
        </div>
        <button type="button" onClick={() => setSelectorOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white w-full">
          <Search className="w-4 h-4 text-slate-500" />
          <input value={selectorQuery} onChange={(e) => setSelectorQuery(e.target.value)} placeholder="Search employees..." className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
        </div>
        <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1000px] w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Employee ID', 'Employee Name', 'Department', 'Job Title', 'Current Status', 'Contract', 'Location'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((e) => (
                <tr
                  key={e.employeeId}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setSelectorOpen(false);
                    setSelectorQuery('');
                    setActiveEmployeeId(e.employeeId);
                    router.push(`/hris/employees/employee-status/${encodeURIComponent(e.employeeId)}`);
                    setToast({ title: 'Employee loaded', detail: `${e.employeeId} — ${e.fullName}`, tone: 'ok' });
                    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                >
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{e.employeeId}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.fullName}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.department || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.jobTitle || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentStatus || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.contractStatus || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.location || '—'}</td>
                </tr>
              ))}
              {!filteredEmployees.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                    No results.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {formState.status === 'error' ? <div className="text-xs font-semibold text-red-700">{formState.error}</div> : null}
      </div>
    </Modal>
  );

  const changeModal = (
    <Modal open={changeOpen} onClose={() => setChangeOpen(false)} maxW="max-w-4xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <BadgeCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{changeMode === 'create' ? 'Status Change Request' : 'Edit Draft Status Request'}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Draft → submit → approvals → apply downstream impacts.</div>
          </div>
        </div>
        <button type="button" onClick={() => setChangeOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Change Type</div>
            <select value={draftAction} onChange={(e) => setDraftAction(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(actions.length ? actions : ['Suspend Employee', 'Reactivate Employee', 'Place on Leave', 'Return from Leave', 'Terminate Employee', 'Confirm Employee', 'Mark Contract Expired']).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-slate-500 font-semibold">Proposed Status: {actionToStatus(draftAction)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Effective Date</div>
            <input value={draftEffectiveDate} onChange={(e) => setDraftEffectiveDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="text-[11px] font-extrabold text-slate-600">Status Reason</div>
            <input value={draftReason} onChange={(e) => setDraftReason(e.target.value)} placeholder="Required" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="text-[11px] font-extrabold text-slate-600">Responsible Officer</div>
            <input value={draftResponsibleOfficer} onChange={(e) => setDraftResponsibleOfficer(e.target.value)} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Status Impact Panel</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">Preview operational impact for payroll, access and workflow routing.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setImpactTitle(`Draft Impact — ${draftAction}`);
                setImpactData(draftImpact);
                setImpactOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              View Impact
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              ['Payroll', draftImpact.payroll.length ? `${draftImpact.payroll.length} items` : 'No changes'],
              ['Access', draftImpact.systemAccess.length ? `${draftImpact.systemAccess.length} items` : 'No changes'],
              ['Clearance', draftImpact.documentClearance.length ? `${draftImpact.documentClearance.length} items` : 'No changes'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
                <div className="text-xs font-extrabold text-slate-900 mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setChangeOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={() => void saveDraft()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
            <BadgeCheck className="w-4 h-4" />
            Save Draft
          </button>
        </div>
      </div>
    </Modal>
  );

  const impactModal = (
    <Modal open={impactOpen} onClose={() => setImpactOpen(false)} maxW="max-w-4xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{impactTitle}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Payroll, access, attendance, clearance and workflow routing impacts.</div>
          </div>
        </div>
        <button type="button" onClick={() => setImpactOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[70vh] overflow-auto">
        {(
          [
            ['Payroll', impactData.payroll],
            ['System Access', impactData.systemAccess],
            ['Email Access', impactData.emailAccess],
            ['Attendance', impactData.attendance],
            ['Leave Entitlement', impactData.leaveEntitlement],
            ['Benefits', impactData.benefits],
            ['Asset Recovery', impactData.assetRecovery],
            ['Document Clearance', impactData.documentClearance],
            ['Reporting Line', impactData.reportingLine],
            ['Workflow Approvals', impactData.workflowApprovals],
            ['Project Assignment', impactData.projectAssignment],
            ['Contract Renewal', impactData.contractRenewal],
          ] as const
        ).map(([title, items]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-extrabold text-slate-900">{title}</div>
            <div className="mt-3 space-y-2">
              {items.length ? (
                items.map((x, idx) => (
                  <div key={`${title}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                    {x}
                  </div>
                ))
              ) : (
                <div className="text-xs font-semibold text-slate-500">No changes.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );

  const bulkModal = (
    <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} maxW="max-w-5xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Bulk Status Update</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Select employees, preview impact, AI validate risks, submit for approval.</div>
          </div>
        </div>
        <button type="button" onClick={() => setBulkOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[75vh] overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <div className="text-[11px] font-extrabold text-slate-600">Bulk Action</div>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {[
                'Contract expiry update',
                'Probation confirmation batch',
                'Project demobilization',
                'Suspension batch',
                'Reactivation batch',
                'Exit batch',
                'Leave return batch',
              ].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <div className="mt-3 text-[11px] font-extrabold text-slate-600">Selected</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">{formatNumber(bulkEmployeeIds.length)} employees</div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setBulkEmployeeIds([])} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                Clear
              </button>
              <button type="button" onClick={() => void previewBulk()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
                Preview
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-0 overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-900">Employees</div>
              <div className="text-[11px] font-extrabold text-slate-500">Click rows to toggle selection</div>
            </div>
            <div className="max-h-[380px] overflow-auto">
              <table className="min-w-[900px] w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Select', 'Employee ID', 'Name', 'Status', 'Contract'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 200).map((e) => {
                    const checked = bulkEmployeeIds.includes(e.employeeId);
                    return (
                      <tr
                        key={e.employeeId}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setBulkEmployeeIds((cur) => (cur.includes(e.employeeId) ? cur.filter((x) => x !== e.employeeId) : [...cur, e.employeeId]));
                        }}
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          <input type="checkbox" checked={checked} readOnly />
                        </td>
                        <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{e.employeeId}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.fullName}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentStatus || '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.contractStatus || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">Preview & AI Validation</div>
          <div className="mt-3">
            {bulkPreview.status === 'idle' ? <div className="text-xs font-semibold text-slate-600">Run Preview to generate impact and AI risk checks.</div> : null}
            {bulkPreview.status === 'loading' ? <div className="text-xs font-semibold text-slate-600">Generating preview…</div> : null}
            {bulkPreview.status === 'error' ? <div className="text-xs font-semibold text-red-700">{bulkPreview.error}</div> : null}
            {bulkPreview.status === 'ready' && bulkPreview.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-extrabold text-slate-600">Impacted</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{formatNumber(bulkPreview.data.impactedCount)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                    <div className="text-[11px] font-extrabold text-slate-600">Request</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{bulkPreview.data.requestId}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 overflow-auto">
                  <table className="min-w-[900px] w-full text-left bg-white">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Employee ID', 'Employee Name', 'Current Status', 'Proposed Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.data.impacted.slice(0, 120).map((r) => (
                        <tr key={r.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.employeeId}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.employeeName}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.currentStatus}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.proposedStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-extrabold text-slate-700">AI Risks</div>
                  <div className="mt-2 space-y-2">
                    {bulkPreview.data.aiRisks.length ? (
                      bulkPreview.data.aiRisks.map((i) => {
                        const st = severityStyle(i.severity);
                        return (
                          <div key={i.id} className={`rounded-2xl border ${st.border} bg-white p-4`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${st.bg} ${st.fg}`}>{i.severity.toUpperCase()}</span>
                                  <span className="text-xs font-extrabold text-slate-900">{i.title}</span>
                                </div>
                                <div className="text-xs text-slate-600 font-semibold mt-2">{i.recommendation}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs font-semibold text-slate-600">No high-risk blockers detected.</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkPreview.data) return;
                      void submitOrWorkflow(bulkPreview.data.requestId, 'submit')
                        .then(() => {
                          setToast({ title: 'Bulk request submitted', detail: bulkPreview.data!.requestId, tone: 'ok' });
                          setBulkOpen(false);
                          setRefreshToken((n) => n + 1);
                        })
                        .catch((e) => setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }));
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90"
                  >
                    <BadgeCheck className="w-4 h-4" />
                    Submit for Approval
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );

  const exportModal = (
    <Modal open={exportOpen} onClose={() => setExportOpen(false)} maxW="max-w-2xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Download className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Export Status Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">CSV / Excel / PDF export for status and workflow visibility.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {['csv', 'xls', 'pdf'].map((fmt) => (
          <a key={fmt} href={`/api/hris/status/export?format=${encodeURIComponent(fmt)}&employeeId=${encodeURIComponent(activeEmployeeId)}`} className="inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            {fmt.toUpperCase()} <Download className="w-4 h-4" />
          </a>
        ))}
      </div>
    </Modal>
  );

  const auditModal = (
    <Modal open={auditOpen} onClose={() => setAuditOpen(false)} maxW="max-w-3xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{auditTitle}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Timestamped audit evidence.</div>
          </div>
        </div>
        <button type="button" onClick={() => setAuditOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6">
        {auditRows.status === 'loading' ? <div className="text-sm text-slate-600 font-semibold">Loading…</div> : null}
        {auditRows.status === 'error' ? <div className="text-sm text-slate-600 font-semibold">{auditRows.error}</div> : null}
        {auditRows.status === 'ready' ? (
          <div className="space-y-3">
            {(auditRows.data || []).slice(0, 160).map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">{a.action}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-2">{a.reason ? `Reason: ${a.reason} • ` : ''}By: {a.performedBy}</div>
                  </div>
                  <div className="text-[11px] font-extrabold text-slate-500">{formatDateTimeUtc(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );

  const loading = statusState.status === 'loading' || historyState.status === 'loading' || formState.status === 'loading';
  const hasError = statusState.status === 'error' || historyState.status === 'error';

  return (
    <div className="bg-white space-y-6">
      <div ref={topRef} />
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
              <div className="text-sm font-extrabold text-slate-900">Unable to load employee status</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{statusState.error || historyState.error || formState.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {summaryCards}
          {aiPanel}
          {currentStatusSection}
          {requestsSection}
          {historySection}
          {auditPreview}
        </>
      )}

      {selectorModal}
      {changeModal}
      {impactModal}
      {bulkModal}
      {exportModal}
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
