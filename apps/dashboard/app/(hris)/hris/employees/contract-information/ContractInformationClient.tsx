'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  Download,
  FileText,
  Fingerprint,
  GitCompare,
  History,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Department Head'
  | 'Legal Officer'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management';

type Severity = 'high' | 'medium' | 'low';

type ContractType =
  | 'Permanent Employment'
  | 'Fixed-Term Contract'
  | 'Temporary Contract'
  | 'Consultancy Contract'
  | 'Internship'
  | 'Industrial Training'
  | 'NYSC Placement'
  | 'Expatriate Contract'
  | 'Outsourced Staff Contract'
  | 'Project-Based Contract'
  | 'Secondment Agreement';

type ContractStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Active'
  | 'Due for Renewal'
  | 'Renewed'
  | 'Expired'
  | 'Terminated'
  | 'Suspended'
  | 'Cancelled'
  | 'Archived';

type WorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending HR Review'
  | 'Pending Department Head Approval'
  | 'Pending Legal Review'
  | 'Pending HR Director Approval'
  | 'Pending Executive Approval'
  | 'Approved'
  | 'Rejected'
  | 'Active'
  | 'Expired'
  | 'Terminated'
  | 'Archived';

type DocumentCategory =
  | 'Offer Letter'
  | 'Employment Contract'
  | 'Renewal Letter'
  | 'Amendment Letter'
  | 'Secondment Agreement'
  | 'Consultancy Agreement'
  | 'Project Assignment Letter'
  | 'Termination Letter'
  | 'Signed Acceptance Copy'
  | 'Legal Review Document'
  | 'Supporting Approval Memo';

type SignatureStatus = 'Missing' | 'Unsigned' | 'Signed';
type LegalReviewStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';

type AuditLog = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
};

type ApprovalStep = {
  id: string;
  at: string;
  stage: string;
  decision: 'Approved' | 'Rejected';
  by: string;
  reason?: string | null;
};

type ContractTerms = {
  durationMonths: number | null;
  workingHours: string | null;
  workMode: 'Onsite' | 'Hybrid' | 'Remote' | null;
  noticePeriodDays: number | null;
  renewalClause: string | null;
  terminationClause: string | null;
  confidentialityClause: string | null;
  nonCompeteClause: string | null;
  probationClause: string | null;
  benefitsEligibility: string | null;
  leaveEligibility: string | null;
  medicalEligibility: string | null;
  pensionEligibility: string | null;
  allowancesEligibility: string | null;
  overtimeEligibility: string | null;
  projectAssignmentClause: string | null;
  hseComplianceRequirement: string | null;
  travelRequirement: string | null;
};

type ContractDocument = {
  id: string;
  category: DocumentCategory;
  name: string;
  version: number;
  mimeType: string;
  sizeBytes: number;
  signatureStatus: SignatureStatus;
  legalReviewStatus: LegalReviewStatus;
  expiryDate: string | null;
  status: 'Active' | 'Archived';
  uploadedAt: string;
  uploadedBy: string;
};

type EmployeeContract = {
  id: string;
  employeeId: string;
  employeeName: string;
  contractReferenceNo: string;
  contractType: ContractType;
  contractCategory: string;
  contractStatus: ContractStatus;
  workflowStatus: WorkflowStatus;
  startDate: string;
  endDate: string | null;
  probationApplicable: boolean;
  probationStartDate: string | null;
  probationEndDate: string | null;
  confirmationDueDate: string | null;
  department: string | null;
  jobTitle: string | null;
  jobGrade: string | null;
  workLocation: string | null;
  reportingManager: string | null;
  hrOfficer: string | null;
  renewalStatus: string;
  approvalStatus: 'Not Started' | 'In Progress' | 'Approved' | 'Rejected';
  documentStatus: 'Missing' | 'Partial' | 'Complete';
  lastAmendmentAt: string | null;
  terms: ContractTerms;
  documents: ContractDocument[];
  approvals: ApprovalStep[];
  audit: AuditLog[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  renewalOfContractId?: string | null;
  amendedFromContractId?: string | null;
  terminationDate?: string | null;
};

type ContractRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  contractReferenceNo: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  contractStatus: string;
  renewalStatus: string;
  approvalStatus: string;
  documentStatus: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  currentManager?: string;
  location?: string;
  businessUnit?: string;
};

type ReportingLineFormOptions = { employees: EmployeeOption[] };

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
  if (v.includes('active') || v.includes('approved') || v === 'complete') return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('submitted') || v.includes('in progress') || v.includes('due')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('rejected') || v.includes('expired') || v.includes('terminated') || v.includes('cancelled') || v.includes('missing')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700' };
};

const severityStyle = (s: Severity) => {
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

async function apiFetchContract<T>(path: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'x-hris-role': init.role,
      ...(init.viewerEmployeeId ? { 'x-hris-employee-id': init.viewerEmployeeId } : {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
    if (!res.ok || !json || json.status !== 'success') throw new Error(json?.error || 'Request failed');
    return json.data as T;
  }
  if (!res.ok) throw new Error('Request failed');
  return (null as unknown) as T;
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

const computeDaysToExpiry = (endDate: string | null) => {
  if (!endDate) return null;
  const ms = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil((ms - Date.now()) / (24 * 3600 * 1000));
};

const defaultTerms = (): ContractTerms => ({
  durationMonths: null,
  workingHours: 'Mon–Fri, 08:00–17:00',
  workMode: 'Onsite',
  noticePeriodDays: 30,
  renewalClause: 'Renewal subject to performance review and business need.',
  terminationClause: 'Termination subject to notice period and HR approval workflow.',
  confidentialityClause: 'Confidentiality applies to all company and client information.',
  nonCompeteClause: null,
  probationClause: 'Probation applies where configured and must be confirmed by HR.',
  benefitsEligibility: 'Standard',
  leaveEligibility: 'Eligible',
  medicalEligibility: 'Eligible',
  pensionEligibility: 'Eligible',
  allowancesEligibility: 'As applicable',
  overtimeEligibility: 'As applicable',
  projectAssignmentClause: null,
  hseComplianceRequirement: 'Mandatory',
  travelRequirement: 'As required',
});

type ContractDraft = {
  employeeId: string;
  employeeName: string;
  contractReferenceNo: string;
  contractType: ContractType;
  contractCategory: string;
  startDate: string;
  endDate: string;
  probationApplicable: boolean;
  probationStartDate: string;
  probationEndDate: string;
  confirmationDueDate: string;
  department: string;
  jobTitle: string;
  jobGrade: string;
  workLocation: string;
  reportingManager: string;
  hrOfficer: string;
  terms: ContractTerms;
  reason: string;
};

const emptyDraft = (employeeId: string, employeeName: string, today: string): ContractDraft => ({
  employeeId,
  employeeName,
  contractReferenceNo: '',
  contractType: 'Fixed-Term Contract',
  contractCategory: 'Standard',
  startDate: today,
  endDate: '',
  probationApplicable: false,
  probationStartDate: '',
  probationEndDate: '',
  confirmationDueDate: '',
  department: '',
  jobTitle: '',
  jobGrade: '',
  workLocation: '',
  reportingManager: '',
  hrOfficer: '',
  terms: defaultTerms(),
  reason: '',
});

export default function ContractInformationClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [employeesState, setEmployeesState] = useState<ApiState<EmployeeOption[]>>({ status: 'idle' });

  const [contractsState, setContractsState] = useState<ApiState<ContractRow[]>>({ status: 'idle' });
  const [contractState, setContractState] = useState<ApiState<EmployeeContract | null>>({ status: 'idle' });
  const [aiState, setAiState] = useState<ApiState<AIInsight[]>>({ status: 'idle' });

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTitle, setAuditTitle] = useState('Audit Trail');
  const [auditLogs, setAuditLogs] = useState<ApiState<AuditLog[]>>({ status: 'idle' });

  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractModalMode, setContractModalMode] = useState<'create' | 'edit' | 'renew' | 'amend' | 'terminate'>('create');
  const [contractDraft, setContractDraft] = useState<ContractDraft>(() => emptyDraft(activeEmployeeId, '', initialNow.slice(0, 10)));
  const [editingContractId, setEditingContractId] = useState<string | null>(null);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Employment Contract');
  const [docName, setDocName] = useState('');
  const [docMime, setDocMime] = useState('application/pdf');
  const [docSizeBytes, setDocSizeBytes] = useState(120_000);
  const [docSignatureStatus, setDocSignatureStatus] = useState<SignatureStatus>('Unsigned');
  const [docLegalStatus, setDocLegalStatus] = useState<LegalReviewStatus>('Not Required');
  const [docExpiryDate, setDocExpiryDate] = useState('');

  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setEmployeesState({ status: 'loading' });
      try {
        const data = await apiFetchContract<ReportingLineFormOptions>(`/api/hris/reporting-line/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId });
        if (cancelled) return;
        setEmployeesState({ status: 'ready', data: data.employees || [] });
      } catch (e) {
        if (cancelled) return;
        setEmployeesState({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load employees' });
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
      setContractsState({ status: 'loading' });
      setAiState({ status: 'loading' });
      try {
        const [rows, ai] = await Promise.all([
          apiFetch<ContractRow[]>(activeEmployeeId, 'contracts', { method: 'GET', role, viewerEmployeeId }),
          apiFetchContract<AIInsight[]>(`/api/hris/contracts/ai-insights?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId }).catch(() => [] as AIInsight[]),
        ]);
        if (cancelled) return;
        setContractsState({ status: 'ready', data: rows });
        setAiState({ status: 'ready', data: ai });

        if (!selectedContractId) {
          const preferred =
            rows.find((r) => String(r.contractStatus) === 'Active') ||
            rows.find((r) => String(r.contractStatus).includes('Due')) ||
            rows[0] ||
            null;
          setSelectedContractId(preferred ? preferred.id : null);
        } else if (selectedContractId && !rows.some((r) => r.id === selectedContractId)) {
          setSelectedContractId(rows[0]?.id || null);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load contracts';
        setContractsState({ status: 'error', error: msg });
        setAiState({ status: 'error', error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId, selectedContractId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedContractId) {
        setContractState({ status: 'ready', data: null });
        return;
      }
      setContractState({ status: 'loading' });
      try {
        const c = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(selectedContractId)}`, { method: 'GET', role, viewerEmployeeId });
        if (cancelled) return;
        setContractState({ status: 'ready', data: c });
      } catch (e) {
        if (cancelled) return;
        setContractState({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load contract' });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedContractId, refreshToken, role, viewerEmployeeId]);

  const employees = useMemo(() => employeesState.data ?? [], [employeesState.data]);
  const filteredEmployees = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 60);
    return employees
      .filter((e) => [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentManager, e.location, e.businessUnit].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)))
      .slice(0, 120);
  }, [employees, selectorQuery]);

  const contract = contractState.data || null;
  const contractRows = contractsState.data || [];

  const daysToExpiry = contract ? computeDaysToExpiry(contract.endDate) : null;

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Contract Information</span>
    </div>
  );

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

  const openCreate = () => {
    const empName = employees.find((e) => e.employeeId === activeEmployeeId)?.fullName || '';
    setContractModalMode('create');
    setEditingContractId(null);
    setContractDraft(emptyDraft(activeEmployeeId, empName, initialNow.slice(0, 10)));
    setContractModalOpen(true);
  };

  const openEditDraft = (c: EmployeeContract) => {
    setContractModalMode('edit');
    setEditingContractId(c.id);
    setContractDraft({
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      contractReferenceNo: c.contractReferenceNo || '',
      contractType: c.contractType,
      contractCategory: c.contractCategory || 'Standard',
      startDate: c.startDate,
      endDate: c.endDate || '',
      probationApplicable: c.probationApplicable,
      probationStartDate: c.probationStartDate || '',
      probationEndDate: c.probationEndDate || '',
      confirmationDueDate: c.confirmationDueDate || '',
      department: c.department || '',
      jobTitle: c.jobTitle || '',
      jobGrade: c.jobGrade || '',
      workLocation: c.workLocation || '',
      reportingManager: c.reportingManager || '',
      hrOfficer: c.hrOfficer || '',
      terms: c.terms || defaultTerms(),
      reason: '',
    });
    setContractModalOpen(true);
  };

  const openRenew = () => {
    if (!contract) {
      setToast({ title: 'No contract selected', detail: 'Select a contract first.', tone: 'warn' });
      return;
    }
    setContractModalMode('renew');
    setEditingContractId(contract.id);
    setContractDraft((d) => ({
      ...d,
      employeeId: contract.employeeId,
      employeeName: contract.employeeName,
      contractReferenceNo: '',
      contractType: contract.contractType,
      contractCategory: contract.contractCategory,
      startDate: contract.endDate || initialNow.slice(0, 10),
      endDate: '',
      probationApplicable: contract.probationApplicable,
      terms: contract.terms,
      reason: 'Renewal',
    }));
    setContractModalOpen(true);
  };

  const openAmend = () => {
    if (!contract) {
      setToast({ title: 'No contract selected', detail: 'Select a contract first.', tone: 'warn' });
      return;
    }
    setContractModalMode('amend');
    setEditingContractId(contract.id);
    setContractDraft((d) => ({
      ...d,
      employeeId: contract.employeeId,
      employeeName: contract.employeeName,
      contractReferenceNo: '',
      contractType: contract.contractType,
      contractCategory: contract.contractCategory,
      startDate: contract.startDate,
      endDate: contract.endDate || '',
      probationApplicable: contract.probationApplicable,
      terms: contract.terms,
      reason: 'Amendment',
    }));
    setContractModalOpen(true);
  };

  const openTerminate = () => {
    if (!contract) {
      setToast({ title: 'No contract selected', detail: 'Select a contract first.', tone: 'warn' });
      return;
    }
    setContractModalMode('terminate');
    setEditingContractId(contract.id);
    setContractDraft((d) => ({
      ...d,
      employeeId: contract.employeeId,
      employeeName: contract.employeeName,
      contractType: contract.contractType,
      contractCategory: contract.contractCategory,
      startDate: contract.startDate,
      endDate: contract.endDate || '',
      reason: 'Termination',
    }));
    setContractModalOpen(true);
  };

  const submitContractModal = async () => {
    const today = initialNow.slice(0, 10);
    const effStart = contractDraft.startDate || today;
    const effEnd = contractDraft.endDate || '';
    const payload = {
      employeeId: contractDraft.employeeId,
      employeeName: contractDraft.employeeName,
      contractReferenceNo: contractDraft.contractReferenceNo || undefined,
      contractType: contractDraft.contractType,
      contractCategory: contractDraft.contractCategory,
      startDate: effStart,
      endDate: effEnd || undefined,
      probationApplicable: contractDraft.probationApplicable,
      probationStartDate: contractDraft.probationStartDate || undefined,
      probationEndDate: contractDraft.probationEndDate || undefined,
      confirmationDueDate: contractDraft.confirmationDueDate || undefined,
      department: contractDraft.department || undefined,
      jobTitle: contractDraft.jobTitle || undefined,
      jobGrade: contractDraft.jobGrade || undefined,
      workLocation: contractDraft.workLocation || undefined,
      reportingManager: contractDraft.reportingManager || undefined,
      hrOfficer: contractDraft.hrOfficer || undefined,
      terms: contractDraft.terms,
      reason: contractDraft.reason || undefined,
    };

    try {
      if (contractModalMode === 'create') {
        const created = await apiFetchContract<EmployeeContract>(`/api/hris/contracts`, {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setContractModalOpen(false);
        setSelectedContractId(created.id);
        setToast({ title: 'Contract created', detail: created.contractReferenceNo, tone: 'ok' });
        setRefreshToken((n) => n + 1);
        router.push(`/hris/employees/contract-information/${encodeURIComponent(activeEmployeeId)}`);
        return;
      }

      if (contractModalMode === 'edit') {
        if (!editingContractId) throw new Error('No contract selected');
        const updated = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(editingContractId)}`, {
          method: 'PATCH',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setContractModalOpen(false);
        setSelectedContractId(updated.id);
        setToast({ title: 'Draft updated', detail: updated.contractReferenceNo, tone: 'ok' });
        setRefreshToken((n) => n + 1);
        return;
      }

      if (contractModalMode === 'renew') {
        if (!editingContractId) throw new Error('No contract selected');
        const created = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(editingContractId)}/renew`, {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, reason: contractDraft.reason || 'Renewal' }),
        });
        setContractModalOpen(false);
        setSelectedContractId(created.id);
        setToast({ title: 'Renewal draft created', detail: created.contractReferenceNo, tone: 'ok' });
        setRefreshToken((n) => n + 1);
        return;
      }

      if (contractModalMode === 'amend') {
        if (!editingContractId) throw new Error('No contract selected');
        const created = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(editingContractId)}/amend`, {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, reason: contractDraft.reason || 'Amendment' }),
        });
        setContractModalOpen(false);
        setSelectedContractId(created.id);
        setToast({ title: 'Amendment draft created', detail: created.contractReferenceNo, tone: 'ok' });
        setRefreshToken((n) => n + 1);
        return;
      }

      if (contractModalMode === 'terminate') {
        if (!editingContractId) throw new Error('No contract selected');
        await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(editingContractId)}/terminate`, {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: contractDraft.reason || 'Termination', terminationDate: initialNow.slice(0, 10) }),
        });
        setContractModalOpen(false);
        setToast({ title: 'Contract terminated', detail: editingContractId, tone: 'ok' });
        setRefreshToken((n) => n + 1);
        return;
      }
    } catch (e) {
      setToast({ title: 'Action failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const contractAction = async (id: string, action: 'submit' | 'approve' | 'reject') => {
    await apiFetchContract(`/api/hris/contracts/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: action }),
    });
  };

  const uploadDoc = async () => {
    if (!contract) {
      setToast({ title: 'No contract selected', detail: 'Select a contract first.', tone: 'warn' });
      return;
    }
    try {
      await apiFetchContract<ContractDocument>(`/api/hris/contracts/${encodeURIComponent(contract.id)}/documents`, {
        method: 'POST',
        role,
        viewerEmployeeId,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: docCategory,
          name: docName || undefined,
          mimeType: docMime,
          sizeBytes: docSizeBytes,
          signatureStatus: docSignatureStatus,
          legalReviewStatus: docLegalStatus,
          expiryDate: docExpiryDate || undefined,
        }),
      });
      setDocModalOpen(false);
      setDocName('');
      setToast({ title: 'Document uploaded', detail: docCategory, tone: 'ok' });
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Upload failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const archiveDoc = async (docId: string) => {
    if (!contract) return;
    try {
      await apiFetchContract(`/api/hris/contracts/${encodeURIComponent(contract.id)}/documents`, {
        method: 'POST',
        role,
        viewerEmployeeId,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'archive', docId }),
      });
      setToast({ title: 'Document archived', detail: docId, tone: 'ok' });
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Archive failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const selectorModal = (
    <Modal open={selectorOpen} onClose={() => setSelectorOpen(false)} maxW="max-w-4xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Search className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Employee Selector</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Search by ID, name, department, job title, manager, location.</div>
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
          <table className="min-w-[950px] w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Employee ID', 'Employee Name', 'Department', 'Job Title', 'Manager', 'Location'].map((h) => (
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
                    setSelectedContractId(null);
                    setActiveEmployeeId(e.employeeId);
                    router.push(`/hris/employees/contract-information/${encodeURIComponent(e.employeeId)}`);
                    setToast({ title: 'Employee loaded', detail: `${e.employeeId} — ${e.fullName}`, tone: 'ok' });
                    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  }}
                >
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{e.employeeId}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.fullName}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.department || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.jobTitle || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.currentManager || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{e.location || '—'}</td>
                </tr>
              ))}
              {!filteredEmployees.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                    No results.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {employeesState.status === 'error' ? <div className="text-xs font-semibold text-red-700">{employeesState.error}</div> : null}
      </div>
    </Modal>
  );

  const contractModal = (
    <Modal open={contractModalOpen} onClose={() => setContractModalOpen(false)} maxW="max-w-5xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              {contractModalMode === 'create'
                ? 'Create Contract'
                : contractModalMode === 'edit'
                  ? 'Edit Contract (Draft)'
                  : contractModalMode === 'renew'
                    ? 'Renew Contract (Draft)'
                    : contractModalMode === 'amend'
                      ? 'Amend Contract (Draft)'
                      : 'Terminate Contract'}
            </div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Capture contract records, terms, probation and compliance fields.</div>
          </div>
        </div>
        <button type="button" onClick={() => setContractModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4 overflow-auto max-h-[72vh]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Employee</div>
            <div className="mt-2 text-xs font-extrabold text-slate-900">{contractDraft.employeeId}</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">{contractDraft.employeeName || '—'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Contract Reference</div>
            <input value={contractDraft.contractReferenceNo} onChange={(e) => setContractDraft((d) => ({ ...d, contractReferenceNo: e.target.value }))} placeholder="Optional (auto-generated)" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Contract Type</div>
            <select value={contractDraft.contractType} onChange={(e) => setContractDraft((d) => ({ ...d, contractType: e.target.value as ContractType }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(
                [
                  'Permanent Employment',
                  'Fixed-Term Contract',
                  'Temporary Contract',
                  'Consultancy Contract',
                  'Internship',
                  'Industrial Training',
                  'NYSC Placement',
                  'Expatriate Contract',
                  'Outsourced Staff Contract',
                  'Project-Based Contract',
                  'Secondment Agreement',
                ] as ContractType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Start Date</div>
            <input value={contractDraft.startDate} onChange={(e) => setContractDraft((d) => ({ ...d, startDate: e.target.value }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">End Date</div>
            <input value={contractDraft.endDate} onChange={(e) => setContractDraft((d) => ({ ...d, endDate: e.target.value }))} placeholder="Required for fixed-term" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Category</div>
            <input value={contractDraft.contractCategory} onChange={(e) => setContractDraft((d) => ({ ...d, contractCategory: e.target.value }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Probation & Confirmation</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">Probation must be consistent and confirmation due date should be set.</div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700">
              <input type="checkbox" checked={contractDraft.probationApplicable} onChange={(e) => setContractDraft((d) => ({ ...d, probationApplicable: e.target.checked }))} />
              Probation Applicable
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Probation Start</div>
              <input value={contractDraft.probationStartDate} onChange={(e) => setContractDraft((d) => ({ ...d, probationStartDate: e.target.value }))} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Probation End</div>
              <input value={contractDraft.probationEndDate} onChange={(e) => setContractDraft((d) => ({ ...d, probationEndDate: e.target.value }))} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Confirmation Due</div>
              <input value={contractDraft.confirmationDueDate} onChange={(e) => setContractDraft((d) => ({ ...d, confirmationDueDate: e.target.value }))} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">Assignment & Stakeholders</div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              ['department', 'Department'],
              ['jobTitle', 'Job Title'],
              ['jobGrade', 'Job Grade'],
              ['workLocation', 'Work Location'],
              ['reportingManager', 'Reporting Manager'],
              ['hrOfficer', 'Responsible HR Officer'],
            ].map(([k, label]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
                <input value={(contractDraft as any)[k] || ''} onChange={(e) => setContractDraft((d) => ({ ...d, [k]: e.target.value } as any))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">Contract Terms</div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Duration (months)</div>
              <input
                value={contractDraft.terms.durationMonths === null ? '' : String(contractDraft.terms.durationMonths)}
                onChange={(e) => setContractDraft((d) => ({ ...d, terms: { ...d.terms, durationMonths: e.target.value ? Number(e.target.value) : null } }))}
                placeholder="Optional"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Work Mode</div>
              <select value={contractDraft.terms.workMode || ''} onChange={(e) => setContractDraft((d) => ({ ...d, terms: { ...d.terms, workMode: (e.target.value as any) || null } }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
                {['', 'Onsite', 'Hybrid', 'Remote'].map((x) => (
                  <option key={x || 'none'} value={x}>
                    {x || '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">Notice Period (days)</div>
              <input
                value={contractDraft.terms.noticePeriodDays === null ? '' : String(contractDraft.terms.noticePeriodDays)}
                onChange={(e) => setContractDraft((d) => ({ ...d, terms: { ...d.terms, noticePeriodDays: e.target.value ? Number(e.target.value) : null } }))}
                placeholder="Optional"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[
              ['renewalClause', 'Renewal Clause'],
              ['terminationClause', 'Termination Clause'],
              ['confidentialityClause', 'Confidentiality Clause'],
              ['nonCompeteClause', 'Non-Compete Clause'],
              ['probationClause', 'Probation Clause'],
              ['projectAssignmentClause', 'Project Assignment Clause'],
              ['hseComplianceRequirement', 'HSE Compliance Requirement'],
              ['travelRequirement', 'Travel Requirement'],
            ].map(([k, label]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
                <input value={(contractDraft.terms as any)[k] || ''} onChange={(e) => setContractDraft((d) => ({ ...d, terms: { ...d.terms, [k]: e.target.value || null } as any }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Reason</div>
          <input value={contractDraft.reason} onChange={(e) => setContractDraft((d) => ({ ...d, reason: e.target.value }))} placeholder="Reason / notes for audit" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setContractModalOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={() => void submitContractModal()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
            <BadgeCheck className="w-4 h-4" />
            {contractModalMode === 'terminate' ? 'Confirm Termination' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );

  const docModal = (
    <Modal open={docModalOpen} onClose={() => setDocModalOpen(false)} maxW="max-w-3xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Upload Contract Document</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Validated upload with access control and audit logging.</div>
          </div>
        </div>
        <button type="button" onClick={() => setDocModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Category</div>
            <select value={docCategory} onChange={(e) => setDocCategory(e.target.value as DocumentCategory)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(
                [
                  'Offer Letter',
                  'Employment Contract',
                  'Renewal Letter',
                  'Amendment Letter',
                  'Secondment Agreement',
                  'Consultancy Agreement',
                  'Project Assignment Letter',
                  'Termination Letter',
                  'Signed Acceptance Copy',
                  'Legal Review Document',
                  'Supporting Approval Memo',
                ] as DocumentCategory[]
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">File Name</div>
            <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. contract_signed.pdf" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">MIME Type</div>
            <select value={docMime} onChange={(e) => setDocMime(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Size (bytes)</div>
            <input value={String(docSizeBytes)} onChange={(e) => setDocSizeBytes(Number(e.target.value || 0))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Signature Status</div>
            <select value={docSignatureStatus} onChange={(e) => setDocSignatureStatus(e.target.value as SignatureStatus)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(['Unsigned', 'Signed'] as SignatureStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Legal Review</div>
            <select value={docLegalStatus} onChange={(e) => setDocLegalStatus(e.target.value as LegalReviewStatus)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(['Not Required', 'Pending', 'Approved', 'Rejected'] as LegalReviewStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="text-[11px] font-extrabold text-slate-600">Expiry Date (optional)</div>
            <input value={docExpiryDate} onChange={(e) => setDocExpiryDate(e.target.value)} placeholder="YYYY-MM-DD" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setDocModalOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={() => void uploadDoc()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
            <Upload className="w-4 h-4" />
            Upload
          </button>
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
            <div className="text-sm font-extrabold text-slate-900">Export Contract Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">CSV / Excel / PDF export for contracts.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {['csv', 'xls', 'pdf'].map((fmt) => (
          <a
            key={fmt}
            href={`/api/hris/contracts/export?format=${encodeURIComponent(fmt)}&employeeId=${encodeURIComponent(activeEmployeeId)}`}
            className="inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
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
            <div className="text-xs text-slate-500 font-semibold mt-1">Contract actions, document downloads, approvals, and timestamps.</div>
          </div>
        </div>
        <button type="button" onClick={() => setAuditOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6">
        {auditLogs.status === 'loading' ? <div className="text-sm text-slate-600 font-semibold">Loading…</div> : null}
        {auditLogs.status === 'error' ? <div className="text-sm text-slate-600 font-semibold">{auditLogs.error}</div> : null}
        {auditLogs.status === 'ready' ? (
          <div className="space-y-3">
            {(auditLogs.data || []).slice(0, 120).map((a) => (
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

  const loading = contractsState.status === 'loading' || contractState.status === 'loading' || employeesState.status === 'loading';
  const hasError = contractsState.status === 'error' || contractState.status === 'error';

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <FileText className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Contract Information</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Manage employee contract records, renewals, expiry alerts, amendments, approvals, and compliance documentation.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            {contract?.employeeName ? <Pill label={`Name: ${contract.employeeName}`} /> : null}
            {selectedContractId ? <Pill label={`Contract: ${selectedContractId}`} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton onClick={openCreate} label="Create Contract" tone="primary" icon={FileText} />
          <HeaderButton onClick={openRenew} label="Renew Contract" tone="secondary" icon={BadgeCheck} disabled={!contract} />
          <HeaderButton onClick={openAmend} label="Amend Contract" tone="secondary" icon={GitCompare} disabled={!contract} />
          <HeaderButton onClick={openTerminate} label="Terminate Contract" tone="secondary" icon={ShieldCheck} disabled={!contract} />
          <HeaderButton onClick={() => setDocModalOpen(true)} label="Upload Contract Document" tone="secondary" icon={Upload} disabled={!contract} />
          <HeaderButton onClick={() => setExportOpen(true)} label="Export Contract Report" tone="dark" icon={Download} />
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
          <button
            type="button"
            onClick={() => {
              if (!selectedContractId) {
                setToast({ title: 'No contract selected', detail: 'Select a contract row first.', tone: 'warn' });
                return;
              }
              void contractAction(selectedContractId, 'submit').then(() => setRefreshToken((n) => n + 1));
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90"
          >
            <BadgeCheck className="w-4 h-4" />
            Submit for Approval
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedContractId) return;
              void contractAction(selectedContractId, 'approve').then(() => setRefreshToken((n) => n + 1));
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedContractId) return;
              void contractAction(selectedContractId, 'reject').then(() => setRefreshToken((n) => n + 1));
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-extrabold text-red-800 hover:bg-red-100"
          >
            Reject
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-600">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:outline-none">
            {(
              ['Super Admin', 'HR Director', 'HR Manager', 'HR Officer', 'Department Head', 'Legal Officer', 'Payroll Officer', 'Auditor', 'Employee', 'Executive Management'] as Role[]
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

  const summaryCards = contract ? (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {[
        { title: 'Current Contract Type', value: contract.contractType, detail: 'Contract classification', status: contract.contractType },
        { title: 'Contract Status', value: contract.contractStatus, detail: 'Lifecycle state', status: contract.contractStatus },
        { title: 'Start Date', value: formatDateUtc(contract.startDate), detail: 'Start', status: 'UTC' },
        { title: 'End Date', value: contract.endDate ? formatDateUtc(contract.endDate) : '—', detail: 'End', status: contract.endDate ? 'Configured' : 'N/A' },
        { title: 'Days to Expiry', value: daysToExpiry === null ? '—' : String(daysToExpiry), detail: 'Expiry tracking', status: daysToExpiry !== null && daysToExpiry <= 30 ? 'Warning' : 'OK' },
        { title: 'Renewal Status', value: contract.renewalStatus, detail: 'Renewal tracking', status: contract.renewalStatus },
        { title: 'Approval Status', value: contract.approvalStatus, detail: 'Workflow status', status: contract.workflowStatus },
        { title: 'Document Status', value: contract.documentStatus, detail: 'Compliance documents', status: contract.documentStatus },
        { title: 'Last Amendment', value: contract.lastAmendmentAt ? formatDateUtc(contract.lastAmendmentAt) : '—', detail: 'Change tracking', status: contract.lastAmendmentAt ? 'Updated' : 'None' },
        { title: 'Responsible HR Officer', value: contract.hrOfficer || '—', detail: 'Owner', status: contract.hrOfficer ? 'Assigned' : 'Missing' },
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
                <FileText className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.status}</span>
              <span className="text-[11px] font-extrabold text-slate-500">{formatDateUtc(contract.updatedAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  const aiPanel = (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Contract Intelligence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Expiry and compliance monitoring with recommended actions.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber((aiState.data || []).length)} insights</span>
      </div>
      <div className="mt-4 space-y-3">
        {(aiState.data || []).slice(0, 8).map((i) => {
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
                    if (i.action === 'renew') openRenew();
                    else if (i.action === 'submit') {
                      if (selectedContractId) void contractAction(selectedContractId, 'submit').then(() => setRefreshToken((n) => n + 1));
                    } else if (i.action === 'upload_document') setDocModalOpen(true);
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
        {aiState.status === 'error' ? <div className="text-xs font-semibold text-slate-600">{aiState.error}</div> : null}
      </div>
    </Card>
  );

  const currentContractSection = contract ? (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Current Contract</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Record details for contract type, dates, probation, and stakeholders.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(contract.contractStatus).border} ${statusPill(contract.contractStatus).bg} ${statusPill(contract.contractStatus).fg}`}>{contract.contractStatus}</span>
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          ['Employee ID', contract.employeeId],
          ['Employee Name', contract.employeeName],
          ['Contract Reference Number', contract.contractReferenceNo],
          ['Contract Type', contract.contractType],
          ['Contract Category', contract.contractCategory],
          ['Contract Status', contract.contractStatus],
          ['Contract Start Date', formatDateUtc(contract.startDate)],
          ['Contract End Date', contract.endDate ? formatDateUtc(contract.endDate) : '—'],
          ['Probation Applicable', contract.probationApplicable ? 'Yes' : 'No'],
          ['Probation Start Date', contract.probationStartDate ? formatDateUtc(contract.probationStartDate) : '—'],
          ['Probation End Date', contract.probationEndDate ? formatDateUtc(contract.probationEndDate) : '—'],
          ['Confirmation Due Date', contract.confirmationDueDate ? formatDateUtc(contract.confirmationDueDate) : '—'],
          ['Department', contract.department || '—'],
          ['Job Title', contract.jobTitle || '—'],
          ['Job Grade', contract.jobGrade || '—'],
          ['Work Location', contract.workLocation || '—'],
          ['Reporting Manager', contract.reportingManager || '—'],
          ['HR Officer', contract.hrOfficer || '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(value || '—')}</div>
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  const termsSection = contract ? (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div>
          <div className="text-sm font-extrabold text-slate-900">Contract Terms</div>
          <div className="text-xs text-slate-500 font-semibold mt-1">Working conditions, clauses, eligibility and compliance terms.</div>
        </div>
      </div>
      <div className="mt-5 overflow-auto">
        <table className="min-w-[1000px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Term', 'Value'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Contract Duration (months)', contract.terms.durationMonths === null ? '—' : String(contract.terms.durationMonths)],
              ['Working Hours', contract.terms.workingHours || '—'],
              ['Work Mode', contract.terms.workMode || '—'],
              ['Notice Period (days)', contract.terms.noticePeriodDays === null ? '—' : String(contract.terms.noticePeriodDays)],
              ['Renewal Clause', contract.terms.renewalClause || '—'],
              ['Termination Clause', contract.terms.terminationClause || '—'],
              ['Confidentiality Clause', contract.terms.confidentialityClause || '—'],
              ['Non-Compete Clause', contract.terms.nonCompeteClause || '—'],
              ['Probation Clause', contract.terms.probationClause || '—'],
              ['Benefits Eligibility', contract.terms.benefitsEligibility || '—'],
              ['Leave Eligibility', contract.terms.leaveEligibility || '—'],
              ['Medical Eligibility', contract.terms.medicalEligibility || '—'],
              ['Pension Eligibility', contract.terms.pensionEligibility || '—'],
              ['Allowances Eligibility', contract.terms.allowancesEligibility || '—'],
              ['Overtime Eligibility', contract.terms.overtimeEligibility || '—'],
              ['Project Assignment Clause', contract.terms.projectAssignmentClause || '—'],
              ['HSE Compliance Requirement', contract.terms.hseComplianceRequirement || '—'],
              ['Travel Requirement', contract.terms.travelRequirement || '—'],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{k}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-700 min-w-[560px]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  const documentsSection = contract ? (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-600/10 border border-amber-200 flex items-center justify-center text-amber-700">
            <Upload className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Contract Documents</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Upload, preview/download, version control, signature and legal review status.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(contract.documentStatus).border} ${statusPill(contract.documentStatus).bg} ${statusPill(contract.documentStatus).fg}`}>{contract.documentStatus}</span>
      </div>
      <div className="mt-5 overflow-auto">
        <table className="min-w-[1200px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Category', 'Name', 'Version', 'Signature', 'Legal', 'Expiry', 'Status', 'Uploaded', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contract.documents.length ? (
              contract.documents.map((d) => {
                const st = statusPill(d.status);
                return (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{d.category}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.name}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">v{d.version}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.signatureStatus}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.legalReviewStatus}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{d.expiryDate ? formatDateUtc(d.expiryDate) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateUtc(d.uploadedAt)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/hris/contracts/${encodeURIComponent(contract.id)}?downloadDocId=${encodeURIComponent(d.id)}`}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                        {d.status === 'Active' ? (
                          <button type="button" onClick={() => void archiveDoc(d.id)} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-[11px] font-extrabold text-amber-800 hover:bg-amber-100">
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No documents uploaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  const renewalExpirySection = contract ? (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
          <History className="w-5 h-5" />
        </span>
        <div>
          <div className="text-sm font-extrabold text-slate-900">Renewal & Expiry</div>
          <div className="text-xs text-slate-500 font-semibold mt-1">Expiry alerts, renewal eligibility, and responsible officer tracking.</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          ['Days to Expiry', daysToExpiry === null ? '—' : String(daysToExpiry)],
          ['Renewal Eligibility', daysToExpiry !== null && daysToExpiry <= 90 ? 'Eligible' : 'Monitor'],
          ['Renewal Recommendation', daysToExpiry !== null && daysToExpiry <= 30 ? 'Start renewal now' : 'Track'],
          ['Renewal Approval Status', contract.approvalStatus],
          ['Renewal Request Date', contract.renewalOfContractId ? formatDateUtc(contract.createdAt) : '—'],
          ['Renewal Effective Date', contract.renewalOfContractId ? formatDateUtc(contract.startDate) : '—'],
          ['Renewal End Date', contract.renewalOfContractId && contract.endDate ? formatDateUtc(contract.endDate) : '—'],
          ['Renewal Notes', contract.renewalStatus || '—'],
          ['Responsible Officer', contract.hrOfficer || '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-extrabold text-slate-700">Automations</div>
        <div className="mt-2 text-xs text-slate-600 font-semibold">90/60/30/14/7-day expiry alerts and escalation are generated via AI insights and workflow routing.</div>
      </div>
    </Card>
  ) : null;

  const workflowSection = contract ? (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <GitCompare className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Approval Workflow</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Submit, approve, reject and activate contracts through controlled stages.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(contract.workflowStatus).border} ${statusPill(contract.workflowStatus).bg} ${statusPill(contract.workflowStatus).fg}`}>{contract.workflowStatus}</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1000px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['At', 'Stage', 'Decision', 'By', 'Reason'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contract.approvals.length ? (
              contract.approvals.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{formatDateTimeUtc(a.at)}</td>
                  <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{a.stage}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{a.decision}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{a.by}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[360px]">{a.reason || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No approval steps yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  ) : null;

  const historySection = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-600/10 border border-slate-200/60 flex items-center justify-center text-purple-700">
            <History className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Contract History</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">All contract records for the selected employee.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(contractRows.length)} rows</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1400px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Reference No.', 'Contract Type', 'Start', 'End', 'Status', 'Renewal', 'Approval', 'Documents', 'Created By', 'Approved By', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contractRows.length ? (
              contractRows.map((r) => {
                const st = statusPill(r.contractStatus);
                return (
                  <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedContractId === r.id ? 'bg-slate-50' : ''}`}>
                    <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.contractReferenceNo || r.id}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.contractType}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.startDate ? formatDateUtc(r.startDate) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.endDate ? formatDateUtc(r.endDate) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{r.contractStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.renewalStatus}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.approvalStatus}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.documentStatus}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.createdBy || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.approvedBy || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.createdAt ? formatDateUtc(r.createdAt) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContractId(r.id);
                            setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const c = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(r.id)}`, { method: 'GET', role, viewerEmployeeId });
                              if (c.workflowStatus === 'Draft' || c.workflowStatus === 'Rejected') openEditDraft(c);
                              else setToast({ title: 'Not editable', detail: 'Only Draft/Rejected can be edited.', tone: 'warn' });
                            } catch (e) {
                              setToast({ title: 'Load failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                            }
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Edit Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => void contractAction(r.id, 'submit').then(() => setRefreshToken((n) => n + 1))}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-dle-blue text-white text-[11px] font-extrabold hover:bg-dle-blue/90"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const c = await apiFetchContract<EmployeeContract>(`/api/hris/contracts/${encodeURIComponent(r.id)}`, { method: 'GET', role, viewerEmployeeId });
                              await openAudit(`Contract Audit — ${c.contractReferenceNo || c.id}`, async () => c.audit || []);
                            } catch (e) {
                              setToast({ title: 'Audit failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
                            }
                          }}
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
                <td colSpan={12} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No contract records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const auditPreview = contract ? (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Audit Trail</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Contract viewed/created/edited/submitted/approved/rejected/renewed/terminated and document actions.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void openAudit(`Contract Audit — ${contract.contractReferenceNo || contract.id}`, async () => contract.audit || [])}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
        >
          <Fingerprint className="w-4 h-4" />
          Open Full Audit
        </button>
      </div>
      <div className="p-4 space-y-2">
        {(contract.audit || []).slice(0, 20).map((a) => (
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
  ) : null;

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
              <div className="text-sm font-extrabold text-slate-900">Unable to load contract information</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{contractsState.error || contractState.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {summaryCards}
          {aiPanel}
          {currentContractSection}
          {termsSection}
          {documentsSection}
          {renewalExpirySection}
          {historySection}
          {workflowSection}
          {auditPreview}
        </>
      )}

      {selectorModal}
      {contractModal}
      {docModal}
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
