'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRightLeft,
  BadgeCheck,
  ChevronRight,
  Download,
  Fingerprint,
  GitCompare,
  History,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Users,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Unit Head'
  | 'Line Manager'
  | 'Project Manager'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type ReportingLineStatus = 'Active' | 'Pending Approval' | 'Scheduled' | 'Temporary' | 'Expired' | 'Cancelled';

type ReportingChangeStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending HR Director Approval'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

type ReportingChangeType =
  | 'Manager Change'
  | 'Functional Manager Change'
  | 'Department Head Change'
  | 'Project Manager Change'
  | 'Matrix Manager Change'
  | 'Delegated Approver Change'
  | 'Temporary Reporting Assignment'
  | 'Bulk Manager Reassignment';

type AuditLog = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  device?: string;
  reason?: string;
};

type AIInsight = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  confidence: number;
  recommendation: string;
  actionLabel: string;
  action: string;
};

type ReportingDelegation = {
  id: string;
  assignmentType: string;
  assignedEmployee: string;
  delegatedRole: string;
  startDate: string;
  endDate: string;
  delegationReason: string;
  approvalScope: string;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Cancelled';
};

type ApprovalChain = {
  key: string;
  level1Approver: string;
  level2Approver: string;
  level3Approver: string;
  escalationApprover: string;
  fallbackApprover: string;
  slaHours: number;
  escalationRule: string;
};

type OrgChartNode = {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  department: string;
  status: string;
  directReports: number;
  level: 'employee' | 'manager' | 'departmentHead' | 'businessUnitHead' | 'projectManager' | 'matrixManager' | 'peer' | 'subordinate';
};

type OrgChartEdge = { from: string; to: string; relation: 'reports_to' | 'matrix_to' | 'dotted_to' | 'peer' };

type ReportingChangeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  changeType: ReportingChangeType;
  status: ReportingChangeStatus;
  effectiveDate: string;
  endDate?: string | null;
  reason: string;
  notes?: string | null;
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
  delegations: ReportingDelegation[];
  supportingDocuments: { id: string; name: string }[];
  approvals: { id: string; at: string; stage: ReportingChangeStatus; decision: 'Approved' | 'Rejected'; by: string; reason?: string | null }[];
  audit: AuditLog[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isBulk?: boolean;
  bulkEmployeeIds?: string[];
};

type ReportingHistoryRow = {
  id: string;
  referenceNo: string;
  employeeId: string;
  employeeName: string;
  changeType: string;
  previousManager: string | null;
  newManager: string | null;
  previousFunctionalManager: string | null;
  newFunctionalManager: string | null;
  effectiveDate: string;
  endDate: string | null;
  approvalStatus: string;
  approvedBy?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  createdDate?: string | null;
  updatedAt?: string | null;
  requestId?: string | null;
  reverseOf?: string | null;
  isBulk?: boolean;
};

type ReportingLinePayload = {
  employeeId: string;
  employeeName: string;
  status: ReportingLineStatus;
  effectiveDate: string;
  endDate?: string | null;
  reason: string;
  line: Record<string, string | null>;
  delegations: ReportingDelegation[];
  approvalChains: ApprovalChain[];
  orgChart: { nodes: OrgChartNode[]; edges: OrgChartEdge[] };
  history: any[];
  requests: ReportingChangeRequest[];
  approvalStatus: ReportingChangeStatus;
  approvalRef?: string | null;
  lastUpdatedAt: string;
  pendingChanges: number;
  aiInsights: AIInsight[];
  auditTrail: AuditLog[];
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

const HeaderButton = ({
  onClick,
  label,
  tone,
  icon: Icon,
}: {
  onClick: () => void;
  label: string;
  tone: 'primary' | 'secondary' | 'dark';
  icon: any;
}) => {
  const cls =
    tone === 'primary'
      ? 'bg-dle-blue text-white hover:bg-dle-blue/90'
      : tone === 'dark'
        ? 'bg-slate-900 text-white hover:bg-slate-800'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-colors ${cls}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

const Modal = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => (
  <AnimatePresence>
    {open ? (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          className="mx-auto my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:my-6 sm:max-h-[calc(100dvh-3rem)]"
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

const statusPill = (s: string) => {
  if (s === 'Approved' || s === 'Active') return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (s === 'Draft' || s === 'Submitted' || s.includes('Pending')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (s === 'Rejected' || s === 'Cancelled' || s === 'Expired') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700' };
};

const metricCardStyle = (status: string) => {
  if (status === 'Active' || status === 'Approved' || status === 'Configured' || status === 'Clear') return 'border-emerald-200 bg-emerald-50/70';
  if (status === 'Missing' || status === 'Attention' || status === 'Rejected' || status === 'Cancelled' || status === 'Expired') return 'border-rose-200 bg-rose-50/70';
  if (status === 'Draft' || status === 'Submitted' || status.includes('Pending') || status === 'Scheduled' || status === 'Temporary') return 'border-amber-200 bg-amber-50/70';
  if (status === 'Optional' || status === 'Not set') return 'border-slate-200 bg-slate-50/80';
  return 'border-sky-100 bg-sky-50/60';
};

const nodeTone = (lvl: OrgChartNode['level']) => {
  if (lvl === 'businessUnitHead') return { border: 'border-indigo-200', bg: 'bg-indigo-50', fg: 'text-indigo-800' };
  if (lvl === 'departmentHead') return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (lvl === 'manager') return { border: 'border-dle-blue/20', bg: 'bg-dle-blue/10', fg: 'text-dle-blue' };
  if (lvl === 'matrixManager') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (lvl === 'projectManager') return { border: 'border-purple-200', bg: 'bg-purple-50', fg: 'text-purple-800' };
  return { border: 'border-slate-200', bg: 'bg-white', fg: 'text-slate-800' };
};

type EmployeeOption = { employeeId: string; fullName: string; department?: string; jobTitle?: string; currentManager?: string; location?: string; businessUnit?: string };
type FormOptions = { employees: EmployeeOption[]; changeTypes: ReportingChangeType[]; delegationScopes: string[]; delegationAssignmentTypes: string[] };
type DraftModel = { requestId?: string; changeType: ReportingChangeType; effectiveDate: string; endDate: string; reason: string; notes: string; newValues: Record<string, string>; delegations: ReportingDelegation[] };

function OrgChartPreview({ orgChart }: { orgChart?: { nodes: OrgChartNode[]; edges: OrgChartEdge[] } }) {
  const [scale, setScale] = useState(1);
  const [q, setQ] = useState('');
  const nodes = orgChart?.nodes || [];
  const query = q.trim().toLowerCase();
  const hit = (n: OrgChartNode) => (!query ? true : [n.employeeId, n.name, n.jobTitle, n.department, n.level].some((x) => String(x).toLowerCase().includes(query)));
  const one = (lvl: OrgChartNode['level']) => nodes.find((n) => n.level === lvl) || null;
  const peers = nodes.filter((n) => n.level === 'peer' && hit(n));
  const subs = nodes.filter((n) => n.level === 'subordinate' && hit(n));
  const side = nodes.filter((n) => (n.level === 'matrixManager' || n.level === 'projectManager') && hit(n));

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
          <Search className="w-4 h-4 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within hierarchy..." className="w-[260px] max-w-[70vw] text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScale((s) => Math.max(0.7, Math.round((s - 0.1) * 10) / 10))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            -
          </button>
          <span className="text-[11px] font-extrabold text-slate-600">{formatNumber(Math.round(scale * 100))}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(1.4, Math.round((s + 0.1) * 10) / 10))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            +
          </button>
        </div>
      </div>
      <div className="p-6 overflow-auto">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }} className="min-w-[860px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              {(['businessUnitHead', 'departmentHead', 'manager', 'employee'] as OrgChartNode['level'][]).map((lvl) => {
                const n = one(lvl);
                if (!n) return null;
                const st = nodeTone(n.level);
                return (
                  <div key={n.id} className={`rounded-2xl border ${st.border} ${st.bg} p-4`}>
                    <div className="text-[11px] font-extrabold text-slate-600">{n.level}</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{n.name}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-1">
                      {n.employeeId} • {n.jobTitle}
                    </div>
                    <div className="text-xs text-slate-500 font-semibold mt-1">{n.department}</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-3">
              {side.map((n) => {
                const st = nodeTone(n.level);
                return (
                  <div key={n.id} className={`rounded-2xl border ${st.border} ${st.bg} p-4`}>
                    <div className="text-[11px] font-extrabold text-slate-600">{n.level}</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{n.name}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-1">
                      {n.employeeId} • {n.jobTitle}
                    </div>
                  </div>
                );
              })}
              {!side.length ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 font-semibold">No matrix/project nodes.</div> : null}
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-extrabold text-slate-700">Peers</div>
                <div className="mt-2 space-y-2">
                  {peers.slice(0, 10).map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      {n.name} • {n.jobTitle}
                    </div>
                  ))}
                  {!peers.length ? <div className="text-xs text-slate-500 font-semibold">No peers in view.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-extrabold text-slate-700">Subordinates</div>
                <div className="mt-2 space-y-2">
                  {subs.slice(0, 10).map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      {n.name} • {n.jobTitle} • {n.status}
                    </div>
                  ))}
                  {!subs.length ? <div className="text-xs text-slate-500 font-semibold">No subordinates in view.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkManagerReassignmentModal({
  open,
  onClose,
  role,
  viewerEmployeeId,
  employees,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  viewerEmployeeId?: string;
  employees: EmployeeOption[];
  onCreated: (requestId: string) => void;
}) {
  const [currentManager, setCurrentManager] = useState('');
  const [newManager, setNewManager] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const supervisorOptions = useMemo(
    () => Array.from(new Set(employees.flatMap((e) => [e.fullName, e.employeeId, e.currentManager]).filter((v): v is string => Boolean(v)))).sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const employeeMatches = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    return employees
      .filter((e) => {
        const managerMatch = !currentManager.trim() || String(e.currentManager || '').toLowerCase() === currentManager.trim().toLowerCase();
        const searchMatch =
          !q ||
          [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentManager, e.location, e.businessUnit]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        return managerMatch && searchMatch;
      })
      .slice(0, 80);
  }, [currentManager, employeeSearch, employees]);
  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const visibleSelectedCount = employeeMatches.filter((e) => selectedSet.has(e.employeeId)).length;
  const allVisibleSelected = employeeMatches.length > 0 && visibleSelectedCount === employeeMatches.length;
  const impactedCount = selectedEmployeeIds.length || employees.filter((e) => currentManager.trim() && String(e.currentManager || '').toLowerCase() === currentManager.trim().toLowerCase()).length;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Bulk Supervisor Reassignment</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Move multiple employees from one current manager/supervisor to one new manager/supervisor.</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs font-extrabold text-sky-900">How this works</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-sky-800">
            For employee codes beginning with C, treat this as supervisor assignment. Select a current manager/supervisor, choose a new manager/supervisor, then optionally pick specific employees below. If no employees are selected, the draft will include all employees currently under the selected manager/supervisor.
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Current Manager / Supervisor</div>
            <input value={currentManager} onChange={(e) => { setCurrentManager(e.target.value); setSelectedEmployeeIds([]); }} list="bulk-supervisor-options" placeholder="Search all employees or current supervisor name" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">New Manager / Supervisor</div>
            <input value={newManager} onChange={(e) => setNewManager(e.target.value)} list="bulk-supervisor-options" placeholder="Search all employees to select supervisor" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <datalist id="bulk-supervisor-options">
            {supervisorOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Effective Date</div>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Reason</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Employees to Reassign</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {selectedEmployeeIds.length ? `${selectedEmployeeIds.length} selected employee${selectedEmployeeIds.length === 1 ? '' : 's'}` : `${impactedCount} employee${impactedCount === 1 ? '' : 's'} will be included if none are selected`}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setSelectedEmployeeIds((prev) => (allVisibleSelected ? prev.filter((id) => !employeeMatches.some((e) => e.employeeId === id)) : Array.from(new Set([...prev, ...employeeMatches.map((e) => e.employeeId)]))))}
                disabled={!employeeMatches.length}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
              </button>
              <button type="button" onClick={() => setSelectedEmployeeIds([])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                Clear Selection
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Search all employees by ID, name, department, job title, supervisor..." className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" />
          </div>
          <div className="mt-4 max-h-[min(360px,42dvh)] space-y-2 overflow-y-auto pr-1">
            {employeeMatches.map((e) => (
              <label key={e.employeeId} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={selectedSet.has(e.employeeId)}
                  onChange={(event) =>
                    setSelectedEmployeeIds((prev) => (event.target.checked ? Array.from(new Set([...prev, e.employeeId])) : prev.filter((id) => id !== e.employeeId)))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-slate-900">{e.employeeId} · {e.fullName}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">{e.jobTitle || 'Unassigned'} · {e.department || 'Unassigned'} · Manager/Supervisor: {e.currentManager || 'Not assigned'}</span>
                </span>
              </label>
            ))}
            {!employeeMatches.length ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">No employees match this manager/search.</div> : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await apiFetchGlobal<{ requestId: string }>(`/api/hris/reporting-line/bulk-reassignment`, {
                  method: 'POST',
                  role,
                  viewerEmployeeId,
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ currentManager, newManager, effectiveDate, reason, employeeIds: selectedEmployeeIds }),
                });
                onCreated(res.requestId);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60"
          >
            <Users className="w-4 h-4" />
            Create Draft
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ReportingLineClient({ initialNow, employeeId }: { initialNow: string; employeeId: string }) {
  const router = useRouter();
  const orgRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);
  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [formOptions, setFormOptions] = useState<ApiState<FormOptions>>({ status: 'idle' });
  const [reporting, setReporting] = useState<ApiState<ReportingLinePayload>>({ status: 'idle' });
  const [repHistory, setRepHistory] = useState<ApiState<ReportingHistoryRow[]>>({ status: 'idle' });

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [changeOpen, setChangeOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTitle, setAuditTitle] = useState('Audit');
  const [auditLogs, setAuditLogs] = useState<ApiState<AuditLog[]>>({ status: 'idle' });

  const [toast, setToast] = useState<{ title: string; detail: string; tone: 'ok' | 'warn' | 'err' } | null>(null);
  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setFormOptions({ status: 'loading' });
      try {
        const data = await apiFetchGlobal<FormOptions>(`/api/hris/reporting-line/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId });
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
  }, [role, viewerEmployeeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setReporting({ status: 'loading' });
      setRepHistory({ status: 'loading' });
      try {
        const [r, h] = await Promise.all([
          apiFetch<ReportingLinePayload>(activeEmployeeId, 'reporting-line', { method: 'GET', role, viewerEmployeeId }),
          apiFetch<ReportingHistoryRow[]>(activeEmployeeId, 'reporting-history', { method: 'GET', role, viewerEmployeeId }),
        ]);
        if (cancelled) return;
        setReporting({ status: 'ready', data: r });
        setRepHistory({ status: 'ready', data: h });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load reporting line';
        setReporting({ status: 'error', error: msg });
        setRepHistory({ status: 'error', error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  const payload = reporting.data;
  const line = payload?.line || {};
  const pendingDraft = (payload?.requests || []).find((r) => r.status === 'Draft' || r.status === 'Rejected') || null;
  const [draft, setDraft] = useState<DraftModel>(() => ({ changeType: 'Manager Change', effectiveDate: initialNow.slice(0, 10), endDate: '', reason: '', notes: '', newValues: {}, delegations: [] }));

  const employees = useMemo(() => formOptions.data?.employees ?? [], [formOptions.data?.employees]);
  const filtered = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 60);
    return employees
      .filter((e) => [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentManager, e.location, e.businessUnit].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)))
      .slice(0, 120);
  }, [employees, selectorQuery]);

  const openChange = () => {
    const base: DraftModel = {
      changeType: 'Manager Change',
      effectiveDate: initialNow.slice(0, 10),
      endDate: '',
      reason: '',
      notes: '',
      newValues: {},
      delegations: [],
    };
    if (!payload) {
      setDraft(base);
      setChangeOpen(true);
      return;
    }

    if (pendingDraft) {
      setDraft({
        ...base,
        requestId: pendingDraft.id,
        changeType: pendingDraft.changeType,
        effectiveDate: (pendingDraft.effectiveDate || payload.effectiveDate).slice(0, 10),
        endDate: (pendingDraft.endDate || payload.endDate || '') as string,
        reason: pendingDraft.reason || base.reason,
        notes: (pendingDraft.notes || base.notes) as string,
        newValues: Object.fromEntries(Object.entries(pendingDraft.newValues || {}).map(([k, v]) => [k, v || ''])),
        delegations: pendingDraft.delegations || payload.delegations || [],
      });
    } else {
      setDraft({
        ...base,
        effectiveDate: payload.effectiveDate.slice(0, 10),
        endDate: (payload.endDate || '') as string,
        reason: payload.reason || '',
        newValues: Object.fromEntries(Object.entries(payload.line || {}).map(([k, v]) => [k, v ? String(v) : ''])),
        delegations: payload.delegations || [],
      });
    }
    setChangeOpen(true);
  };

  const openAudit = async (title: string, loader: () => Promise<AuditLog[]>) => {
    setAuditTitle(title);
    setAuditOpen(true);
    setAuditLogs({ status: 'loading' });
    try {
      const rows = await loader();
      setAuditLogs({ status: 'ready', data: rows });
    } catch (e) {
      setAuditLogs({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load audit logs' });
    }
  };

  const saveDraft = async () => {
    const req = await apiFetch<ReportingChangeRequest>(activeEmployeeId, 'reporting-line', {
      method: 'PATCH',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: draft.requestId || undefined,
        changeType: draft.changeType,
        effectiveDate: draft.effectiveDate,
        endDate: draft.endDate || undefined,
        reason: draft.reason,
        notes: draft.notes || undefined,
        newValues: draft.newValues,
        delegations: draft.delegations,
      }),
    });
    setDraft((d) => ({ ...d, requestId: req.id }));
    return req;
  };

  const action = async (requestId: string, key: 'submit' | 'approve' | 'reject' | 'reverse') => {
    await apiFetchGlobal(`/api/hris/reporting-change-requests/${encodeURIComponent(requestId)}/${key}`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: key }),
    });
  };

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Reporting Line</span>
    </div>
  );

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <UsersRound className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Reporting Line</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Manage employee reporting relationships, approval hierarchy, matrix reporting, delegated authority, and organizational alignment.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            {payload?.employeeName ? <Pill label={`Name: ${payload.employeeName}`} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton onClick={openChange} label="Edit Reporting Line" tone="primary" icon={ArrowRightLeft} />
          <HeaderButton
            onClick={() => {
              if (!pendingDraft) {
                setToast({ title: 'No pending draft', detail: 'Create or save a draft first.', tone: 'warn' });
                return;
              }
              void action(pendingDraft.id, 'submit').then(() => setRefreshToken((n) => n + 1));
            }}
            label="Submit Reporting Change"
            tone="secondary"
            icon={BadgeCheck}
          />
          <HeaderButton onClick={() => setBulkOpen(true)} label="Bulk Supervisor Reassignment" tone="secondary" icon={Users} />
          <HeaderButton
            onClick={() => {
              setTimeout(() => orgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
            }}
            label="View Org Chart"
            tone="secondary"
            icon={Network}
          />
          <HeaderButton onClick={() => setExportOpen(true)} label="Export Reporting Report" tone="dark" icon={Download} />
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
              [
                'Super Admin',
                'HR Director',
                'HR Manager',
                'HR Officer',
                'Department Head',
                'Unit Head',
                'Line Manager',
                'Project Manager',
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
            <input value={viewerEmployeeId || ''} onChange={(e) => setViewerEmployeeId(e.target.value.trim() || undefined)} placeholder="Optional" className="w-[180px] max-w-[60vw] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
          </div>
        </div>
      </div>
    </Card>
  );

  const selectorModal = (
    <Modal open={selectorOpen} onClose={() => setSelectorOpen(false)}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Search className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Employee Selector</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Search by ID, name, department, job title, current manager/supervisor, location, business unit.</div>
          </div>
        </div>
        <button type="button" onClick={() => setSelectorOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white w-full">
          <Search className="w-4 h-4 text-slate-500" />
          <input value={selectorQuery} onChange={(e) => setSelectorQuery(e.target.value)} placeholder="Search employees..." className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
        </div>
        <div className="max-h-[min(420px,55dvh)] overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Employee ID', 'Employee Name', 'Department', 'Job Title', 'Current Manager', 'Location', 'Business Unit'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.employeeId}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setSelectorOpen(false);
                    setSelectorQuery('');
                    setActiveEmployeeId(e.employeeId);
                    router.push(`/hris/employees/reporting-line/${encodeURIComponent(e.employeeId)}`);
                    setToast({ title: 'Employee loaded', detail: `${e.employeeId} — ${e.fullName}`, tone: 'ok' });
                  }}
                >
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{e.employeeId}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.fullName}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.department || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.jobTitle || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentManager || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.location || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.businessUnit || '—'}</td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                    No results.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );

  const changeModal = (
    <Modal open={changeOpen} onClose={() => setChangeOpen(false)}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <ArrowRightLeft className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Reporting Change Request</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Draft updates, submit for approvals, and capture audit evidence.</div>
          </div>
        </div>
        <button type="button" onClick={() => setChangeOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Change Type</div>
            <select value={draft.changeType} onChange={(e) => setDraft((d) => ({ ...d, changeType: e.target.value as ReportingChangeType }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(formOptions.data?.changeTypes || ['Manager Change', 'Functional Manager Change', 'Department Head Change', 'Project Manager Change', 'Matrix Manager Change', 'Delegated Approver Change', 'Temporary Reporting Assignment']).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Effective Date</div>
            <input type="date" value={draft.effectiveDate} onChange={(e) => setDraft((d) => ({ ...d, effectiveDate: e.target.value }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">End Date</div>
            <input type="date" value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Reason</div>
            <input value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Notes</div>
            <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">Updated fields</div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              ['directManager', 'Direct Manager'],
              ['functionalManager', 'Functional Manager'],
              ['departmentHead', 'Department Head'],
              ['unitHead', 'Unit Head'],
              ['businessUnitHead', 'Business Unit Head'],
              ['projectManager', 'Project Manager'],
              ['siteSupervisor', 'Site Supervisor'],
              ['matrixManager', 'Matrix Manager'],
              ['dottedLineManager', 'Dotted-Line Manager'],
              ['hrBusinessPartner', 'HR Business Partner'],
              ['delegatedApprover', 'Delegated Approver'],
            ].map(([k, label]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
                <input value={draft.newValues[k] || ''} onChange={(e) => setDraft((d) => ({ ...d, newValues: { ...d.newValues, [k]: e.target.value } }))} list="employee-name-options" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
              </div>
            ))}
          </div>
          <datalist id="employee-name-options">
            {employees.slice(0, 120).map((e) => (
              <option key={e.employeeId} value={e.fullName} />
            ))}
          </datalist>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Delegation & Acting Assignments (Draft)</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">Add acting roles, temporary supervisors, delegated approvers, and alternates.</div>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  delegations: [
                    ...d.delegations,
                    {
                      id: `del-${Math.random().toString(16).slice(2)}`,
                      assignmentType: formOptions.data?.delegationAssignmentTypes?.[0] || 'Delegated approver',
                      assignedEmployee: '',
                      delegatedRole: '',
                      startDate: initialNow.slice(0, 10),
                      endDate: initialNow.slice(0, 10),
                      delegationReason: '',
                      approvalScope: formOptions.data?.delegationScopes?.[0] || 'All Workflow Approvals',
                      status: 'Scheduled',
                    },
                  ],
                }))
              }
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Add Assignment
            </button>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {draft.delegations.length ? (
              draft.delegations.map((d, idx) => (
                <div key={d.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900">Delegation {idx + 1}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">{d.status}</div>
                    </div>
                    <button type="button" onClick={() => setDraft((cur) => ({ ...cur, delegations: cur.delegations.filter((_, i) => i !== idx) }))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
                      <X className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Type</span>
                      <select value={d.assignmentType} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, assignmentType: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800">
                        {(formOptions.data?.delegationAssignmentTypes || []).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Assigned Employee</span>
                      <input value={d.assignedEmployee} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, assignedEmployee: e.target.value } : x)) }))} list="employee-name-options" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Role</span>
                      <input value={d.delegatedRole} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, delegatedRole: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800" />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[11px] font-extrabold text-slate-600">Start</span>
                        <input type="date" value={d.startDate} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, startDate: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-extrabold text-slate-600">End</span>
                        <input type="date" value={d.endDate} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, endDate: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Scope</span>
                      <select value={d.approvalScope} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, approvalScope: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800">
                        {(formOptions.data?.delegationScopes || []).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Status</span>
                      <select value={d.status} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, status: e.target.value as ReportingDelegation['status'] } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800">
                        {(['Active', 'Scheduled', 'Expired', 'Cancelled'] as ReportingDelegation['status'][]).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-extrabold text-slate-600">Reason</span>
                      <input value={d.delegationReason} onChange={(e) => setDraft((cur) => ({ ...cur, delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, delegationReason: e.target.value } : x)) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-800" />
                    </label>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-600">No draft delegations.</div>
            )}
          </div>
          <div className="mt-4 hidden overflow-auto rounded-2xl border border-slate-200 md:block">
            <table className="min-w-[980px] w-full text-left bg-white">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Type', 'Assigned Employee', 'Role', 'Start', 'End', 'Scope', 'Status', 'Reason', ''].map((h) => (
                    <th key={h || 'actions'} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.delegations.length ? (
                  draft.delegations.map((d, idx) => (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="px-4 py-2">
                        <select
                          value={d.assignmentType}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, assignmentType: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        >
                          {(formOptions.data?.delegationAssignmentTypes || []).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={d.assignedEmployee}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, assignedEmployee: e.target.value } : x)),
                            }))
                          }
                          list="employee-name-options"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={d.delegatedRole}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, delegatedRole: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={d.startDate}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, startDate: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={d.endDate}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, endDate: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={d.approvalScope}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, approvalScope: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        >
                          {(formOptions.data?.delegationScopes || []).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={d.status}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, status: e.target.value as ReportingDelegation['status'] } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        >
                          {(['Active', 'Scheduled', 'Expired', 'Cancelled'] as ReportingDelegation['status'][]).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={d.delegationReason}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              delegations: cur.delegations.map((x, i) => (i === idx ? { ...x, delegationReason: e.target.value } : x)),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setDraft((cur) => ({ ...cur, delegations: cur.delegations.filter((_, i) => i !== idx) }))}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                        >
                          <X className="w-4 h-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-600 font-semibold">
                      No draft delegations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={() => setChangeOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const req = await saveDraft();
                setToast({ title: 'Draft saved', detail: req.id, tone: 'ok' });
                setRefreshToken((n) => n + 1);
                setChangeOpen(false);
              } catch (e) {
                setToast({ title: 'Save failed', detail: e instanceof Error ? e.message : 'Unable to save draft', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const req = await saveDraft();
                await action(req.id, 'submit');
                setToast({ title: 'Submitted', detail: req.id, tone: 'ok' });
                setRefreshToken((n) => n + 1);
                setChangeOpen(false);
              } catch (e) {
                setToast({ title: 'Submit failed', detail: e instanceof Error ? e.message : 'Unable to submit', tone: 'err' });
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90"
          >
            Save & Submit
          </button>
        </div>
      </div>
    </Modal>
  );

  const exportModal = (
    <Modal open={exportOpen} onClose={() => setExportOpen(false)}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Download className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Export Reporting Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">CSV / Excel / PDF / PNG (org chart).</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 sm:p-6">
        {['csv', 'xls', 'pdf', 'png'].map((fmt) => (
          <a
            key={fmt}
            href={`/api/hris/reporting-line/export?format=${encodeURIComponent(fmt)}&employeeId=${encodeURIComponent(activeEmployeeId)}`}
            className="inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {fmt.toUpperCase()} <Download className="w-4 h-4" />
          </a>
        ))}
      </div>
    </Modal>
  );

  const auditModal = (
    <Modal open={auditOpen} onClose={() => setAuditOpen(false)}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{auditTitle}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Audit evidence with timestamps and actors.</div>
          </div>
        </div>
        <button type="button" onClick={() => setAuditOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="overflow-y-auto p-4 sm:p-6">
        {auditLogs.status === 'loading' ? <div className="text-sm text-slate-600 font-semibold">Loading…</div> : null}
        {auditLogs.status === 'error' ? <div className="text-sm text-slate-600 font-semibold">{auditLogs.error}</div> : null}
        {auditLogs.status === 'ready' ? (
          <div className="space-y-3">
            {(auditLogs.data || []).slice(0, 80).map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">{a.action}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-2">
                      By: {a.performedBy} {a.reason ? `• Reason: ${a.reason}` : ''}
                    </div>
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

  const loading = reporting.status === 'loading' || repHistory.status === 'loading' || formOptions.status === 'loading';
  const hasError = reporting.status === 'error' || repHistory.status === 'error' || formOptions.status === 'error';

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
              <div className="text-sm font-extrabold text-slate-900">Unable to load reporting line</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{reporting.error || repHistory.error || formOptions.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : payload ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              { title: 'Direct Manager', value: line.directManager || '—', detail: 'Primary reporting line', status: payload.status },
              { title: 'Functional Manager', value: line.functionalManager || '—', detail: 'Matrix / functional reporting', status: line.functionalManager ? 'Configured' : 'Missing' },
              { title: 'Department Head', value: line.departmentHead || '—', detail: 'Department approvals routing', status: line.departmentHead ? 'Configured' : 'Missing' },
              { title: 'Unit Head', value: line.unitHead || '—', detail: 'Unit governance', status: line.unitHead ? 'Configured' : 'Missing' },
              { title: 'Business Unit Head', value: line.businessUnitHead || '—', detail: 'BU governance', status: line.businessUnitHead ? 'Configured' : 'Missing' },
              { title: 'Project Manager', value: line.projectManager || '—', detail: 'Project reporting line', status: line.projectManager ? 'Configured' : 'Optional' },
              { title: 'Approval Line Status', value: payload.approvalStatus, detail: 'Workflow state', status: payload.approvalStatus },
              { title: 'Matrix Reporting', value: line.matrixManager || '—', detail: 'Matrix manager', status: line.matrixManager ? 'Active' : 'Not set' },
              { title: 'Pending Changes', value: String(payload.pendingChanges), detail: 'Draft/submitted approvals', status: payload.pendingChanges ? 'Attention' : 'Clear' },
              { title: 'Last Updated', value: payload.lastUpdatedAt ? formatDateUtc(payload.lastUpdatedAt) : '—', detail: 'Snapshot time', status: 'UTC' },
            ].map((c) => {
              const st = statusPill(c.status);
              return (
                <div key={c.title} className={`rounded-2xl border p-4 ${metricCardStyle(String(c.status))}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold text-slate-600">{c.title}</div>
                      <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(c.value || '—')}</div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-2 truncate">{c.detail}</div>
                    </div>
                    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${st.border} ${st.bg} ${st.fg}`}>
                      <Users className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.status}</span>
                    <span className="text-[11px] font-extrabold text-slate-500">{payload.lastUpdatedAt ? formatDateUtc(payload.lastUpdatedAt) : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">AI Reporting Intelligence</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Validation insights with severity, confidence, and actions.</div>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(payload.aiInsights.length)} insights</span>
            </div>
            <div className="mt-4 space-y-3">
              {payload.aiInsights.slice(0, 8).map((i) => {
                const st = severityStyle(i.severity);
                return (
                  <div key={i.id} className={`rounded-2xl border ${st.border} ${st.bg} p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${st.bg} ${st.fg}`}>{i.severity.toUpperCase()}</span>
                          <span className="text-sm font-extrabold text-slate-900">{i.title}</span>
                          <span className="text-[11px] font-extrabold text-slate-500">Confidence: {formatNumber(Math.round(i.confidence * 100))}%</span>
                        </div>
                        <div className="text-xs text-slate-600 font-semibold mt-2">{i.recommendation}</div>
                      </div>
                      <button type="button" onClick={openChange} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition-colors shrink-0">
                        <ChevronRight className="w-4 h-4" />
                        {i.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  <UsersRound className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Current Reporting Line</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Direct, functional, dotted-line, matrix and delegated authority.</div>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(payload.status).border} ${statusPill(payload.status).bg} ${statusPill(payload.status).fg}`}>{payload.status}</span>
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Field label="Employee ID" value={activeEmployeeId} />
              <Field label="Employee Name" value={payload.employeeName} />
              <Field label="Direct Reporting Manager" value={(line.directManager || '—').toString()} />
              <Field label="Functional Manager" value={(line.functionalManager || '—').toString()} />
              <Field label="Department Head" value={(line.departmentHead || '—').toString()} />
              <Field label="Unit Head" value={(line.unitHead || '—').toString()} />
              <Field label="Business Unit Head" value={(line.businessUnitHead || '—').toString()} />
              <Field label="Project Manager" value={(line.projectManager || '—').toString()} />
              <Field label="Site Supervisor" value={(line.siteSupervisor || '—').toString()} />
              <Field label="Matrix Manager" value={(line.matrixManager || '—').toString()} />
              <Field label="Dotted-Line Manager" value={(line.dottedLineManager || '—').toString()} />
              <Field label="HR Business Partner" value={(line.hrBusinessPartner || '—').toString()} />
              <Field label="Delegated Approver" value={(line.delegatedApprover || '—').toString()} />
              <Field label="Effective Date" value={payload.effectiveDate ? formatDateUtc(payload.effectiveDate) : '—'} />
              <Field label="End Date" value={payload.endDate ? formatDateUtc(payload.endDate) : '—'} />
              <Field label="Reason" value={payload.reason ? String(payload.reason) : '—'} />
            </div>
          </Card>

          <Card className="p-6">
            <div ref={orgRef} />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
                  <Network className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Hierarchy Preview / Org Chart</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Zoom and search the hierarchy view.</div>
                </div>
              </div>
            </div>
            <OrgChartPreview orgChart={payload.orgChart} />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-amber-600/10 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Delegation & Acting Assignments</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Acting roles, temporary supervisors, delegated approvers, leave cover, alternates.</div>
                </div>
              </div>
            </div>
            <div className="mt-5 overflow-auto">
              <table className="min-w-[1100px] w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Type', 'Assigned Employee', 'Role', 'Start', 'End', 'Scope', 'Status', 'Reason'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.delegations.length ? (
                    payload.delegations.map((d) => {
                      const st = statusPill(d.status);
                      return (
                        <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{d.assignmentType}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.assignedEmployee || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.delegatedRole || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(d.startDate)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(d.endDate)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.approvalScope}</td>
                          <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{d.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[340px]">{d.delegationReason}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                        No delegations configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900">Approval Chains</div>
                <div className="text-xs text-slate-500 font-semibold mt-1">Workflow routing hierarchy for key HRIS workflows.</div>
              </div>
            </div>
            <div className="mt-5 overflow-auto">
              <table className="min-w-[1200px] w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Workflow', 'Level 1', 'Level 2', 'Level 3', 'Escalation', 'Fallback', 'SLA (hrs)', 'Rule'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.approvalChains.map((c) => (
                    <tr key={c.key} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{c.key}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.level1Approver}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.level2Approver}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.level3Approver}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.escalationApprover}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.fallbackApprover}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatNumber(c.slaHours)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[260px]">{c.escalationRule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
                  <History className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Reporting History</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Reporting line changes history with approvals and dates.</div>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(repHistory.data?.length || 0)} rows</span>
            </div>
            <div className="p-4 overflow-auto">
              <table className="min-w-[1300px] w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Reference', 'Change Type', 'Prev Manager', 'New Manager', 'Prev Func', 'New Func', 'Effective', 'End', 'Status', 'Approved By', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(repHistory.data || []).length ? (
                    (repHistory.data || []).map((h) => {
                      const st = statusPill(h.approvalStatus);
                      return (
                        <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{h.referenceNo}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.changeType}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousManager || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newManager || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.previousFunctionalManager || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.newFunctionalManager || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(h.effectiveDate)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.endDate ? formatDateUtc(h.endDate) : '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{h.approvalStatus}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{h.approvedBy || '—'}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setTimeout(() => orgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                                }}
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                              >
                                Org Impact
                              </button>
                              {h.requestId ? (
                                <button
                                  type="button"
                                  onClick={() => void openAudit(`Request Audit — ${h.requestId}`, () => apiFetchGlobal<AuditLog[]>(`/api/hris/reporting-change-requests/${encodeURIComponent(h.requestId || '')}/audit`, { method: 'GET', role, viewerEmployeeId }))}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                                >
                                  Audit
                                </button>
                              ) : null}
                              {h.requestId && String(h.approvalStatus) === 'Approved' ? (
                                <button
                                  type="button"
                                  onClick={() => void action(h.requestId || '', 'reverse').then(() => setRefreshToken((n) => n + 1))}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-[11px] font-extrabold text-amber-800 hover:bg-amber-100"
                                >
                                  Reverse
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                        No reporting history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  <GitCompare className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Reporting Change Workflow</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">Submit, approve, reject, and reverse controlled reporting changes.</div>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(payload.requests.length)} requests</span>
            </div>
            <div className="p-4 overflow-auto">
              <table className="min-w-[1100px] w-full text-left bg-white">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Request', 'Type', 'Effective', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.requests.map((r) => {
                    const st = statusPill(r.status);
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.id}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.changeType}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(r.effectiveDate)}</td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => void openAudit(`Request Audit — ${r.id}`, () => apiFetchGlobal<AuditLog[]>(`/api/hris/reporting-change-requests/${encodeURIComponent(r.id)}/audit`, { method: 'GET', role, viewerEmployeeId }))} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                              Audit
                            </button>
                            {r.status === 'Draft' || r.status === 'Rejected' ? (
                              <button type="button" onClick={() => void action(r.id, 'submit').then(() => setRefreshToken((n) => n + 1))} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-dle-blue text-white text-[11px] font-extrabold hover:bg-dle-blue/90">
                                Submit
                              </button>
                            ) : null}
                            {['Submitted', 'Pending HR Review', 'Pending Department Head Approval', 'Pending HR Director Approval'].includes(r.status) ? (
                              <>
                                <button type="button" onClick={() => void action(r.id, 'approve').then(() => setRefreshToken((n) => n + 1))} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold hover:bg-slate-800">
                                  Approve
                                </button>
                                <button type="button" onClick={() => void action(r.id, 'reject').then(() => setRefreshToken((n) => n + 1))} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-[11px] font-extrabold text-red-800 hover:bg-red-100">
                                  Reject
                                </button>
                              </>
                            ) : null}
                            {r.status === 'Approved' ? (
                              <button type="button" onClick={() => void action(r.id, 'reverse').then(() => setRefreshToken((n) => n + 1))} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-[11px] font-extrabold text-amber-800 hover:bg-amber-100">
                                Reverse
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  <Fingerprint className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Audit Trail</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">View and workflow events with timestamps.</div>
                </div>
              </div>
              <button type="button" onClick={() => void openAudit('Employee Audit Trail', () => apiFetch<AuditLog[]>(activeEmployeeId, 'audit-trail', { method: 'GET', role, viewerEmployeeId }))} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                <Fingerprint className="w-4 h-4" />
                Open Full Audit
              </button>
            </div>
            <div className="p-4 space-y-2">
              {payload.auditTrail.slice(0, 25).map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs font-extrabold text-slate-900">{a.action}</div>
                    <div className="text-[11px] font-extrabold text-slate-500">{formatDateTimeUtc(a.at)}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 font-semibold">
                    Performed By: {a.performedBy} {a.reason ? `• Reason: ${a.reason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {selectorModal}
      {changeModal}
      {exportModal}
      <BulkManagerReassignmentModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        role={role}
        viewerEmployeeId={viewerEmployeeId}
        employees={employees}
        onCreated={(requestId) => {
          setBulkOpen(false);
          setToast({ title: 'Bulk draft created', detail: requestId, tone: 'ok' });
          setRefreshToken((n) => n + 1);
        }}
      />
      {auditModal}

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.16 }} className="fixed bottom-6 right-6 z-50">
            <div className={`w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl border bg-white p-4 shadow-lg ${toast.tone === 'err' ? 'border-red-200' : toast.tone === 'warn' ? 'border-amber-200' : 'border-slate-200'}`}>
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
