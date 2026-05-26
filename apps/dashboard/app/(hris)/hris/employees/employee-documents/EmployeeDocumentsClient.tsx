'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileClock,
  FileDown,
  FilePlus2,
  FileSearch,
  FileUp,
  FolderKanban,
  Grid2X2,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Legal Officer'
  | 'Compliance Officer'
  | 'HSE Officer'
  | 'Payroll Officer'
  | 'Auditor'
  | 'Employee'
  | 'Line Manager'
  | 'Executive Management'
  | 'IT Administrator';

type Severity = 'high' | 'medium' | 'low';

type DocumentStatus = 'Not Required' | 'Pending Verification' | 'Verified' | 'Rejected' | 'Expired' | 'Update Required' | 'Archived' | 'Uploaded';
type ComplianceStatus = 'Compliant' | 'At Risk' | 'Non-Compliant' | 'Unknown';
type ConfidentialityLevel = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

type DocumentItem = {
  id: string;
  category: string;
  documentTitle?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  issueDate?: string | null;
  expiresAt?: string | null;
  status: DocumentStatus;
  complianceStatus?: ComplianceStatus;
  confidentialityLevel?: ConfidentialityLevel;
  versionNumber?: number;
  uploadedBy?: string | null;
  uploadedAt: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  notes?: string | null;
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

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  actionLabel: string;
  action: string;
};

type ExpiringRow = {
  documentId: string;
  employeeId: string;
  employeeName: string;
  category: string;
  fileName: string;
  expiresAt: string;
  daysToExpiry: number;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
};

type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  previousFileName: string;
  newFileName: string;
  previousMimeType: string;
  newMimeType: string;
  previousSizeBytes: number;
  newSizeBytes: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  verificationStatus: DocumentStatus;
};

type AuditEntry = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  employeeId?: string;
  documentId?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
};

type DocumentDetailsResponse = { document: DocumentItem; audit: AuditEntry[] };

type ApiState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');

const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const formatDateUtc = (isoOrDate: string | null | undefined) => {
  if (!isoOrDate) return '—';
  const s = isoOrDate.includes('T') ? isoOrDate : `${isoOrDate}T00:00:00.000Z`;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const formatDateTimeUtc = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
};

const statusPill = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v.includes('verified') || v.includes('compliant') || v.includes('valid')) return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('uploaded') || v.includes('expiring') || v.includes('at risk')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('rejected') || v.includes('expired') || v.includes('non') || v.includes('missing') || v.includes('denied')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  if (v.includes('archived')) return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700' };
  return { border: 'border-slate-200', bg: 'bg-white', fg: 'text-slate-700' };
};

const severityStyle = (s: Severity) => {
  if (s === 'high') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  if (s === 'medium') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
};

const confidentialityStyle = (s: ConfidentialityLevel) => {
  if (s === 'Restricted') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800', icon: Lock };
  if (s === 'Confidential') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800', icon: Lock };
  if (s === 'Public') return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800', icon: ShieldCheck };
  return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700', icon: ShieldCheck };
};

const docCategories = [
  'Employment Letter',
  'Offer Letter',
  'Signed Employment Contract',
  'CV / Resume',
  'Academic Certificate',
  'Professional Certificate',
  'Government ID',
  'NIN',
  'BVN',
  'International Passport',
  'Tax Document',
  'Pension Document',
  'Medical Certificate',
  'Guarantor Form',
  'Reference Letter',
  'Promotion Letter',
  'Transfer Letter',
  'Warning Letter',
  'Disciplinary Letter',
  'Training Certificate',
  'HSE Certificate',
  'Contract Renewal Letter',
  'Exit Document',
  'Clearance Form',
  'Other Document',
] as const;

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

const autoCategoryForFileName = (fileName: string) => {
  const v = (fileName || '').toLowerCase();
  if (v.includes('nin')) return 'NIN';
  if (v.includes('bvn')) return 'BVN';
  if (v.includes('passport')) return 'International Passport';
  if (v.includes('tax')) return 'Tax Document';
  if (v.includes('pension')) return 'Pension Document';
  if (v.includes('medical')) return 'Medical Certificate';
  if (v.includes('hse')) return 'HSE Certificate';
  if (v.includes('cv') || v.includes('resume')) return 'CV / Resume';
  if (v.includes('offer')) return 'Offer Letter';
  if (v.includes('employment') && v.includes('contract')) return 'Signed Employment Contract';
  if (v.includes('contract')) return 'Signed Employment Contract';
  if (v.includes('letter')) return 'Employment Letter';
  return 'Other Document';
};

const requiredCategoriesForEmploymentType = (employmentType: string) => {
  const et = (employmentType || '').toLowerCase();
  const required = new Set<string>(['Government ID', 'NIN']);
  if (et.includes('contract')) {
    required.add('Signed Employment Contract');
    required.add('Contract Renewal Letter');
  }
  return required;
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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
    if (!res.ok || !json || json.status !== 'success') throw new Error(json?.error || 'Request failed');
    return json.data as T;
  }
  if (!res.ok) throw new Error('Request failed');
  return (null as unknown) as T;
}

const Card = ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
  <div {...rest} className={`rounded-2xl border border-slate-200/60 bg-white shadow-sm ${className || ''}`.trim()}>
    {children}
  </div>
);

const Pill = ({ label, tone = 'default' }: { label: string; tone?: 'default' | 'ok' | 'warn' | 'err' }) => {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'err'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-slate-200 bg-white text-slate-700';
  return <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${toneClass}`}>{label}</span>;
};

const HeaderButton = ({
  label,
  icon: Icon,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'secondary' | 'dark';
  onClick: () => void;
  disabled?: boolean;
}) => {
  const base = 'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const cls =
    tone === 'primary'
      ? `${base} bg-dle-blue text-white border-dle-blue hover:bg-dle-blue/90`
      : tone === 'dark'
        ? `${base} bg-slate-900 text-white border-slate-900 hover:bg-slate-800`
        : `${base} bg-white text-slate-700 border-slate-200 hover:bg-slate-50`;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

const Toast = ({
  tone,
  title,
  detail,
  onClose,
}: {
  tone: 'ok' | 'warn' | 'err';
  title: string;
  detail?: string | null;
  onClose: () => void;
}) => {
  const style = tone === 'ok' ? statusPill('verified') : tone === 'warn' ? statusPill('pending') : statusPill('rejected');
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : ShieldX;
  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`w-[360px] max-w-[92vw] rounded-2xl border ${style.border} ${style.bg} shadow-lg`}>
        <div className="p-4 flex items-start gap-3">
          <span className={`w-9 h-9 rounded-xl border ${style.border} bg-white flex items-center justify-center ${style.fg}`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-extrabold ${style.fg}`}>{title}</div>
            {detail ? <div className="text-xs font-semibold text-slate-700 mt-1 break-words">{detail}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/60">
            <X className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ModalShell = ({
  title,
  subtitle,
  onClose,
  children,
  widthClass,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-slate-900/40" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.99 }}
      className={`fixed z-[95] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${widthClass || 'w-[980px]'} max-w-[96vw] max-h-[92vh] overflow-hidden`}
      role="dialog"
      aria-modal="true"
    >
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900">{title}</div>
            {subtitle ? <div className="text-xs font-semibold text-slate-600 mt-1">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
            <X className="w-4 h-4 text-slate-800" />
          </button>
        </div>
        <div className="p-5 overflow-auto max-h-[calc(92vh-72px)]">{children}</div>
      </Card>
    </motion.div>
  </AnimatePresence>
);

export default function EmployeeDocumentsClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [employeesState, setEmployeesState] = useState<ApiState<ReportingLineFormOptions>>({ status: 'idle' });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [docsState, setDocsState] = useState<ApiState<DocumentItem[]>>({ status: 'idle' });
  const [employmentType, setEmploymentType] = useState<string>('');
  const [insightsState, setInsightsState] = useState<ApiState<AIInsight[]>>({ status: 'idle' });
  const [expiringState, setExpiringState] = useState<ApiState<ExpiringRow[]>>({ status: 'idle' });

  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [toast, setToast] = useState<{ title: string; detail?: string | null; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsState, setVersionsState] = useState<ApiState<DocumentVersion[]>>({ status: 'idle' });
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditState, setAuditState] = useState<ApiState<DocumentDetailsResponse>>({ status: 'idle' });

  const [verifyPanelDocId, setVerifyPanelDocId] = useState<string>('');
  const [verifyMethod, setVerifyMethod] = useState<string>('HR Review');
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState<DocumentItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceReason, setReplaceReason] = useState<string>('Updated document');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<(typeof docCategories)[number]>('Other Document');
  const [uploadIssueDate, setUploadIssueDate] = useState<string>(initialNow.slice(0, 10));
  const [uploadExpiryDate, setUploadExpiryDate] = useState<string>('');
  const [uploadOwner, setUploadOwner] = useState<string>('Employee');
  const [uploadConf, setUploadConf] = useState<ConfidentialityLevel>('Internal');
  const [uploadVerificationRequired, setUploadVerificationRequired] = useState<boolean>(true);
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [uploadBusy, setUploadBusy] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkDefaultCategory, setBulkDefaultCategory] = useState<string>('Auto-detect');
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);
  const nowMs = useMemo(() => {
    const ms = new Date(initialNow).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, [initialNow]);

  const beginEmployeesFetch = () => setEmployeesState({ status: 'loading' });
  const beginDocsFetch = () => {
    setDocsState({ status: 'loading' });
    setInsightsState({ status: 'loading' });
    setExpiringState({ status: 'loading' });
  };
  const refreshAll = () => {
    beginDocsFetch();
    setRefreshToken((n) => n + 1);
  };

  useEffect(() => {
    apiFetchModule<ReportingLineFormOptions>(`/api/hris/reporting-line/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId })
      .then((data) => setEmployeesState({ status: 'ready', data }))
      .catch((e) => setEmployeesState({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load employees' }));
  }, [role, viewerEmployeeId]);

  useEffect(() => {
    const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
    void Promise.all([
      apiFetchEmployee<DocumentItem[]>(activeEmployeeId, 'documents', { method: 'GET', role, viewerEmployeeId: viewer }),
      apiFetchEmployee<any>(activeEmployeeId, 'employment', { method: 'GET', role, viewerEmployeeId: viewer }).catch(() => null),
      apiFetchModule<AIInsight[]>(`/api/hris/documents/ai-insights?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId: viewer }).catch(() => [] as AIInsight[]),
      apiFetchModule<ExpiringRow[]>(`/api/hris/documents/expiring?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId: viewer }).catch(() => [] as ExpiringRow[]),
    ])
      .then(([docs, employment, ai, expiring]) => {
        setDocsState({ status: 'ready', data: docs });
        const et = String(employment?.employmentType || employment?.employmentDetails?.employmentType || '');
        setEmploymentType(et);
        setInsightsState({ status: 'ready', data: ai });
        setExpiringState({ status: 'ready', data: expiring });
      })
      .catch((e) => {
        setDocsState({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load documents' });
        setInsightsState({ status: 'ready', data: [] });
        setExpiringState({ status: 'ready', data: [] });
      });
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  const employees = useMemo(() => employeesState.data?.employees || [], [employeesState.data]);
  const activeEmployee = useMemo(() => employees.find((e) => e.employeeId === activeEmployeeId) || null, [employees, activeEmployeeId]);

  const docs = useMemo(() => docsState.data || [], [docsState.data]);
  const filteredDocs = useMemo(() => {
    const cat = categoryFilter;
    const st = statusFilter;
    return docs.filter((d) => {
      if (cat !== 'All Categories' && d.category !== cat) return false;
      if (st !== 'All Statuses' && d.status !== st) return false;
      return true;
    });
  }, [docs, categoryFilter, statusFilter]);

  const requiredCats = useMemo(() => requiredCategoriesForEmploymentType(employmentType), [employmentType]);
  const summary = useMemo(() => {
    const total = docs.length;
    const verified = docs.filter((d) => d.status === 'Verified').length;
    const pending = docs.filter((d) => d.status === 'Pending Verification' || d.status === 'Uploaded').length;
    const rejected = docs.filter((d) => d.status === 'Rejected').length;
    const expired = docs.filter((d) => {
      const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
      return Number.isFinite(exp) && exp < nowMs;
    }).length;
    const expiringSoon = docs.filter((d) => {
      const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
      return Number.isFinite(exp) && exp >= nowMs && exp - nowMs <= 30 * 24 * 3600 * 1000;
    }).length;
    const haveCats = new Set(docs.map((d) => d.category));
    const missingRequired = Array.from(requiredCats).filter((c) => !haveCats.has(c)).length;
    const requiredTotal = requiredCats.size;
    const satisfied = Array.from(requiredCats).filter((c) => {
      const best = docs
        .filter((d) => d.category === c)
        .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))[0];
      if (!best) return false;
      if (best.status !== 'Verified' && best.status !== 'Not Required') return false;
      const exp = best.expiresAt ? new Date(best.expiresAt).getTime() : NaN;
      if (Number.isFinite(exp) && exp < nowMs) return false;
      return true;
    }).length;
    const complianceScore = requiredTotal ? Math.max(0, Math.min(100, Math.round((satisfied / requiredTotal) * 100))) : total ? Math.round((verified / total) * 100) : 0;
    return { total, verified, pending, rejected, expired, expiringSoon, missingRequired, complianceScore };
  }, [docs, requiredCats, nowMs]);

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Employee Documents</span>
    </div>
  );

  const openEmployee = (id: string) => {
    const next = id.toUpperCase();
    setActiveEmployeeId(next);
    setSelectorOpen(false);
    beginDocsFetch();
    router.push(`/hris/employees/employee-documents/${encodeURIComponent(next)}`);
  };

  const validateFile = (f: File) => {
    const sizeBytes = f.size;
    if (!allowedMimeTypes.has(f.type)) return `File type not allowed: ${f.type || 'unknown'}`;
    if (sizeBytes > 15 * 1024 * 1024) return 'File size limit exceeded (15MB)';
    const name = (f.name || '').toLowerCase();
    if (name.includes('eicar') || name.includes('virus')) return 'File blocked by virus scanning policy';
    return null;
  };

  const uploadSingle = async () => {
    if (!uploadFile) {
      setToast({ title: 'Select a file', detail: 'Choose a supported file type to upload.', tone: 'warn' });
      return;
    }
    const err = validateFile(uploadFile);
    if (err) {
      setToast({ title: 'Upload blocked', detail: err, tone: 'err' });
      return;
    }
    if (!uploadCategory) {
      setToast({ title: 'Category required', detail: 'Select a document category.', tone: 'warn' });
      return;
    }
    if (uploadIssueDate && uploadExpiryDate) {
      const a = new Date(`${uploadIssueDate}T00:00:00.000Z`).getTime();
      const b = new Date(`${uploadExpiryDate}T00:00:00.000Z`).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b < a) {
        setToast({ title: 'Invalid dates', detail: 'Expiry date cannot be before issue date.', tone: 'err' });
        return;
      }
    }
    setUploadBusy(true);
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      const title = uploadTitle.trim() || uploadCategory;
      await apiFetchEmployee<DocumentItem>(activeEmployeeId, 'documents', {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: uploadCategory,
          documentTitle: title,
          fileName: uploadFile.name,
          mimeType: uploadFile.type,
          sizeBytes: uploadFile.size,
          issueDate: uploadIssueDate || null,
          expiryDate: uploadExpiryDate || null,
          expiresAt: uploadExpiryDate || null,
          uploadedBy: uploadOwner,
          confidentialityLevel: uploadConf,
          verificationRequired: uploadVerificationRequired,
          notes: uploadNotes || null,
        }),
      });
      setToast({ title: 'Document uploaded', detail: `${uploadFile.name} • ${uploadCategory}`, tone: 'ok' });
      setUploadFile(null);
      setUploadTitle('');
      setUploadExpiryDate('');
      setUploadNotes('');
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Upload failed', detail: e instanceof Error ? e.message : 'Upload failed', tone: 'err' });
    } finally {
      setUploadBusy(false);
    }
  };

  const uploadBulk = async () => {
    if (!bulkFiles.length) {
      setToast({ title: 'No files selected', detail: 'Add files to bulk upload.', tone: 'warn' });
      return;
    }
    const blocked = bulkFiles.map((f) => ({ f, err: validateFile(f) })).filter((x) => x.err);
    if (blocked.length) {
      setToast({ title: 'Bulk upload blocked', detail: `${blocked.length} file(s) failed validation`, tone: 'err' });
      return;
    }
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      const items = bulkFiles.map((f) => {
        const cat = bulkDefaultCategory === 'Auto-detect' ? autoCategoryForFileName(f.name) : bulkDefaultCategory;
        return {
          category: cat,
          documentTitle: cat,
          fileName: f.name,
          mimeType: f.type,
          sizeBytes: f.size,
          issueDate: initialNow.slice(0, 10),
          expiryDate: null,
          confidentialityLevel: 'Internal',
          verificationRequired: true,
          notes: 'Bulk upload',
        };
      });
      await apiFetchEmployee<{ uploaded: number }>(activeEmployeeId, 'documents/bulk-upload', {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      setToast({ title: 'Bulk upload complete', detail: `${bulkFiles.length} file(s) uploaded`, tone: 'ok' });
      setBulkFiles([]);
      setBulkOpen(false);
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Bulk upload failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const openPreview = (d: DocumentItem) => setPreviewDoc(d);
  const openVersions = async (d: DocumentItem) => {
    setVersionsOpen(true);
    setVersionsState({ status: 'loading' });
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      const rows = await apiFetchModule<DocumentVersion[]>(`/api/hris/documents/${encodeURIComponent(d.id)}/versions`, { method: 'GET', role, viewerEmployeeId: viewer });
      setVersionsState({ status: 'ready', data: rows });
    } catch (e) {
      setVersionsState({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load versions' });
    }
  };
  const openAudit = async (d: DocumentItem) => {
    setAuditOpen(true);
    setAuditState({ status: 'loading' });
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      const data = await apiFetchModule<DocumentDetailsResponse>(`/api/hris/documents/${encodeURIComponent(d.id)}`, { method: 'GET', role, viewerEmployeeId: viewer });
      setAuditState({ status: 'ready', data });
    } catch (e) {
      setAuditState({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load audit' });
    }
  };

  const doVerify = async (docId: string) => {
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      await apiFetchModule(`/api/hris/documents/${encodeURIComponent(docId)}/verify`, {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: verifyMethod, reason: verifyNotes || 'Verified' }),
      });
      setToast({ title: 'Document verified', detail: docId, tone: 'ok' });
      setVerifyNotes('');
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Verify failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const doReject = async (docId: string) => {
    const reason = rejectReason.trim();
    if (!reason) {
      setToast({ title: 'Rejection reason required', detail: 'Provide a clear reason for rejection.', tone: 'warn' });
      return;
    }
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      await apiFetchModule(`/api/hris/documents/${encodeURIComponent(docId)}/reject`, {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      setToast({ title: 'Document rejected', detail: docId, tone: 'warn' });
      setRejectReason('');
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Reject failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const doArchive = async (d: DocumentItem) => {
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      await apiFetchModule(`/api/hris/documents/${encodeURIComponent(d.id)}/archive`, {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archiveReason: 'Archived from repository' }),
      });
      setToast({ title: 'Document archived', detail: d.fileName, tone: 'ok' });
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Archive failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const startReplace = (d: DocumentItem) => {
    setReplaceDoc(d);
    setReplaceFile(null);
    setReplaceReason('Updated document');
    setReplaceOpen(true);
  };

  const doReplace = async () => {
    if (!replaceDoc) return;
    if (!replaceFile) {
      setToast({ title: 'Select replacement file', detail: 'Choose the new file to replace the current version.', tone: 'warn' });
      return;
    }
    const err = validateFile(replaceFile);
    if (err) {
      setToast({ title: 'Replacement blocked', detail: err, tone: 'err' });
      return;
    }
    const reason = replaceReason.trim() || 'Replacement';
    try {
      const viewer = role === 'Employee' ? activeEmployeeId : viewerEmployeeId;
      await apiFetchModule(`/api/hris/documents/${encodeURIComponent(replaceDoc.id)}/replace`, {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: replaceFile.name, mimeType: replaceFile.type, sizeBytes: replaceFile.size, reason }),
      });
      setToast({ title: 'Document replaced', detail: `${replaceDoc.id} • v${(replaceDoc.versionNumber || 1) + 1}`, tone: 'ok' });
      setReplaceOpen(false);
      setReplaceDoc(null);
      setReplaceFile(null);
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Replace failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const doExport = (format: 'csv' | 'xls' | 'pdf') => {
    const url = `/api/hris/documents/export?format=${format}&employeeId=${encodeURIComponent(activeEmployeeId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const applyInsightAction = (insight: AIInsight) => {
    if (insight.action === 'open_upload') {
      const recCat = docCategories.find((c) => insight.title.includes(c)) || null;
      if (recCat) setUploadCategory(recCat);
      setToast({ title: 'Upload panel ready', detail: insight.title, tone: 'ok' });
      return;
    }
    if (insight.action === 'open_expiry') {
      setStatusFilter('All Statuses');
      setCategoryFilter('All Categories');
      setToast({ title: 'Expiry tracker loaded', detail: 'Review expiring documents panel.', tone: 'ok' });
      return;
    }
    if (insight.action === 'open_verify') {
      const target = docs.find((d) => insight.title.toLowerCase().includes(d.category.toLowerCase())) || docs.find((d) => d.status === 'Pending Verification') || null;
      if (target) setVerifyPanelDocId(target.id);
      setToast({ title: 'Verification panel ready', detail: target ? target.fileName : 'Select a document to verify.', tone: 'ok' });
      return;
    }
    if (insight.action === 'open_versions') {
      const target = docs[0] || null;
      if (target) void openVersions(target);
      return;
    }
    setToast({ title: 'Insight action queued', detail: insight.actionLabel, tone: 'ok' });
  };

  const selectorMatches = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 60);
    return employees
      .filter((e) => {
        const hay = `${e.employeeId} ${e.fullName} ${e.department || ''} ${e.jobTitle || ''} ${e.currentManager || ''} ${e.location || ''} ${e.businessUnit || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 120);
  }, [employees, selectorQuery]);

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <FolderKanban className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Employee Documents</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">
                Securely manage employee documents, verification, expiry tracking, compliance status, document history, and controlled access.
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            {activeEmployee?.fullName ? <Pill label={`Name: ${activeEmployee.fullName}`} /> : null}
            {employmentType ? <Pill label={`Employment: ${employmentType}`} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton label="Upload Document" tone="primary" icon={Upload} onClick={() => document.getElementById('dle-doc-upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          <HeaderButton label="Bulk Upload" tone="secondary" icon={FileUp} onClick={() => setBulkOpen(true)} />
          <HeaderButton
            label="Request Missing Documents"
            tone="secondary"
            icon={FileClock}
            onClick={() => setToast({ title: 'Request created', detail: 'Missing documents request queued for employee self-service.', tone: 'ok' })}
          />
          <HeaderButton
            label="Verify Documents"
            tone="secondary"
            icon={BadgeCheck}
            onClick={() => {
              const next = docs.find((d) => d.status === 'Pending Verification' || d.status === 'Uploaded') || null;
              if (next) setVerifyPanelDocId(next.id);
              setToast({ title: 'Verification panel ready', detail: next ? next.fileName : 'No pending documents.', tone: next ? 'ok' : 'warn' });
            }}
            disabled={docsState.status !== 'ready'}
          />
          <HeaderButton label="Export Document Report" tone="dark" icon={Download} onClick={() => doExport('csv')} disabled={docsState.status !== 'ready'} />
          <HeaderButton label="Refresh" tone="secondary" icon={RefreshCcw} onClick={refreshAll} />
        </div>
      </div>
    </Card>
  );

  const toolbar = (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Search className="w-4 h-4" />
            Employee Selector
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="text-[11px] font-extrabold text-slate-700">Role</span>
            <select
              value={role}
              onChange={(e) => {
                beginEmployeesFetch();
                beginDocsFetch();
                setRole(e.target.value as Role);
              }}
              className="text-xs font-extrabold text-slate-900 bg-transparent outline-none"
            >
              {[
                'HR Manager',
                'HR Officer',
                'Compliance Officer',
                'Legal Officer',
                'HSE Officer',
                'Payroll Officer',
                'Auditor',
                'Employee',
                'Line Manager',
                'Super Admin',
                'HR Director',
                'Admin Officer',
                'Executive Management',
                'IT Administrator',
              ].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="text-[11px] font-extrabold text-slate-700">Viewer ID</span>
            <input
              value={viewerEmployeeId || ''}
              onChange={(e) => {
                beginEmployeesFetch();
                beginDocsFetch();
                setViewerEmployeeId(e.target.value.trim() || undefined);
              }}
              placeholder="Optional"
              className="w-[180px] max-w-[60vw] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:outline-none">
            <option value="All Categories">All Categories</option>
            {docCategories.map((c) => (
              <option key={c} value={c}>
                {requiredCats.has(c) ? `* ${c}` : c}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:outline-none">
            <option value="All Statuses">All Statuses</option>
            {(['Uploaded', 'Pending Verification', 'Verified', 'Rejected', 'Expired', 'Update Required', 'Archived', 'Not Required'] as DocumentStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-extrabold ${viewMode === 'table' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
          >
            <Table2 className="w-4 h-4" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-extrabold ${viewMode === 'grid' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
          >
            <Grid2X2 className="w-4 h-4" />
            Grid
          </button>
        </div>
      </div>
    </Card>
  );

  const summaryCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        { label: 'Total Documents', value: summary.total, detail: 'All stored files', icon: FileSearch, tone: 'default' as const },
        { label: 'Verified Documents', value: summary.verified, detail: 'Approved / valid', icon: CheckCircle2, tone: 'ok' as const },
        { label: 'Pending Verification', value: summary.pending, detail: 'Needs review', icon: BadgeCheck, tone: 'warn' as const },
        { label: 'Rejected Documents', value: summary.rejected, detail: 'Action required', icon: ShieldX, tone: 'err' as const },
        { label: 'Expired Documents', value: summary.expired, detail: 'Non-compliant', icon: CalendarClock, tone: 'err' as const },
        { label: 'Expiring Soon', value: summary.expiringSoon, detail: '≤ 30 days', icon: CalendarClock, tone: 'warn' as const },
        { label: 'Missing Required', value: summary.missingRequired, detail: 'By employment type', icon: AlertTriangle, tone: summary.missingRequired ? ('err' as const) : ('ok' as const) },
        { label: 'Compliance Score', value: `${summary.complianceScore}%`, detail: 'Required doc coverage', icon: ShieldCheck, tone: summary.complianceScore >= 85 ? ('ok' as const) : summary.complianceScore >= 65 ? ('warn' as const) : ('err' as const) },
      ].map((c) => (
        <Card key={c.label} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">{c.label}</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{typeof c.value === 'number' ? formatNumber(c.value) : c.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">{c.detail}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Pill label={c.tone === 'ok' ? 'Good' : c.tone === 'warn' ? 'Attention' : c.tone === 'err' ? 'Critical' : 'Info'} tone={c.tone} />
                <Pill label={`Updated: ${formatDateUtc(initialNow)}`} />
              </div>
            </div>
            <span className="w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-dle-blue">
              {(() => {
                const Icon = c.icon;
                return <Icon className="w-5 h-5" />;
              })()}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );

  const aiPanel = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Document Intelligence</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Automated checks for missing documents, expiry risk, duplicates, and category anomalies.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refreshAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <RefreshCcw className="w-4 h-4" />
            Refresh Insights
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insightsState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading insights…</div>
        ) : (insightsState.data || []).length ? (
          (insightsState.data || []).slice(0, 10).map((ins) => {
            const st = severityStyle(ins.severity);
            return (
              <div key={ins.id} className={`rounded-2xl border ${st.border} ${st.bg} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-xs font-extrabold ${st.fg}`}>{ins.severity.toUpperCase()} • {Math.round(ins.confidence * 100)}% confidence</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{ins.title}</div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">{ins.recommendation}</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Pill label={`Action: ${ins.actionLabel}`} tone={ins.severity === 'high' ? 'err' : ins.severity === 'medium' ? 'warn' : 'ok'} />
                    </div>
                  </div>
                  <button type="button" onClick={() => applyInsightAction(ins)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                    <Sparkles className="w-4 h-4" />
                    {ins.actionLabel}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs font-semibold text-slate-600">No insights available (may be restricted for this role).</div>
        )}
      </div>
    </Card>
  );

  const uploadPanel = (
    <Card className="p-5" id="dle-doc-upload">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <FilePlus2 className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Document Upload</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Drag-and-drop, validation, access control, and verification workflow.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <FileUp className="w-4 h-4" />
            Bulk Upload
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0] || null;
            if (!f) return;
            setUploadFile(f);
            setUploadCategory(autoCategoryForFileName(f.name) as (typeof docCategories)[number]);
            setUploadTitle('');
          }}
          className="rounded-2xl border border-dashed border-slate-300 bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-800">
              <Upload className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900">Drag & drop file</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">PDF, JPG, PNG, WEBP, DOCX, XLSX, CSV</div>
            </div>
          </div>
          <div className="mt-3">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setUploadFile(f);
                if (f) setUploadCategory(autoCategoryForFileName(f.name) as (typeof docCategories)[number]);
              }}
              className="block w-full text-xs font-semibold text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:text-xs file:font-extrabold file:text-slate-700 hover:file:bg-slate-50"
            />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-extrabold text-slate-900 truncate">{uploadFile ? uploadFile.name : 'No file selected'}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-1">{uploadFile ? `${uploadFile.type || 'unknown'} • ${formatBytes(uploadFile.size)}` : 'Select a file to begin upload.'}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Category</div>
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as any)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                {docCategories.map((c) => (
                  <option key={c} value={c}>
                    {requiredCats.has(c) ? `* ${c}` : c}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] font-semibold text-slate-600">Required: {requiredCats.has(uploadCategory) ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Document Title</div>
              <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="E.g. Signed Employment Contract" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900 placeholder:text-slate-400" />
              <div className="mt-2 text-[11px] font-semibold text-slate-600">Used for repository display and audit trails.</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Issue Date</div>
              <input type="date" value={uploadIssueDate} onChange={(e) => setUploadIssueDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Expiry Date</div>
              <input type="date" value={uploadExpiryDate} onChange={(e) => setUploadExpiryDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Document Owner</div>
              <input value={uploadOwner} onChange={(e) => setUploadOwner(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Confidentiality</div>
              <select value={uploadConf} onChange={(e) => setUploadConf(e.target.value as ConfidentialityLevel)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                {(['Public', 'Internal', 'Confidential', 'Restricted'] as ConfidentialityLevel[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Verification Required</div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-1">When enabled, upload routes into verification workflow.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadVerificationRequired((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-extrabold ${uploadVerificationRequired ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  {uploadVerificationRequired ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                  {uploadVerificationRequired ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Notes</div>
              <textarea value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={3} placeholder="Verification notes, special handling, retention notes…" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill label="Encrypted storage (simulated)" />
              <Pill label="Virus scanning (policy)" />
              <Pill label="Signed links (simulated)" />
            </div>
            <div className="flex items-center gap-2">
              <HeaderButton label={uploadBusy ? 'Uploading…' : 'Upload'} tone="primary" icon={Upload} onClick={() => void uploadSingle()} disabled={uploadBusy || docsState.status === 'loading'} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const repository = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <FolderKanban className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Document Repository</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Table/grid view with secure preview, download, workflow actions, version history, and audit logs.</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => doExport('csv')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <FileDown className="w-4 h-4" />
            Export CSV
          </button>
          <button type="button" onClick={() => doExport('xls')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <FileDown className="w-4 h-4" />
            Export Excel
          </button>
          <button type="button" onClick={() => doExport('pdf')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>
      <div className="mt-4">
        {docsState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading documents…</div>
        ) : docsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">{docsState.error || 'Failed to load documents'}</div>
        ) : !filteredDocs.length ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">No documents match the selected filters.</div>
        ) : viewMode === 'table' ? (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  {[
                    'Document Name',
                    'Category',
                    'File Type',
                    'Size',
                    'Issue Date',
                    'Expiry Date',
                    'Verification Status',
                    'Compliance',
                    'Confidentiality',
                    'Uploaded By',
                    'Uploaded Date',
                    'Version',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDocs.slice(0, 250).map((d) => {
                  const statusStyle = statusPill(d.status);
                  const compStyle = statusPill(d.complianceStatus || 'Unknown');
                  const conf = (d.confidentialityLevel || 'Internal') as ConfidentialityLevel;
                  const confStyle = confidentialityStyle(conf);
                  const ConfIcon = confStyle.icon;
                  const expiryMs = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
                  const expiredNow = Number.isFinite(expiryMs) && expiryMs < nowMs;
                  return (
                    <tr key={d.id} className="text-xs text-slate-800">
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold text-slate-900 truncate max-w-[260px]">{d.documentTitle || d.category}</div>
                        <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[260px]">{d.fileName}</div>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold">{d.category}</div>
                        {requiredCats.has(d.category) ? <div className="text-[11px] font-semibold text-red-700 mt-1">Required</div> : <div className="text-[11px] font-semibold text-slate-500 mt-1">Optional</div>}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">{d.mimeType || '—'}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">{formatBytes(d.sizeBytes)}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">{formatDateUtc(d.issueDate)}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold">{formatDateUtc(d.expiresAt)}</div>
                        {expiredNow ? <div className="text-[11px] font-semibold text-red-700 mt-1">Expired</div> : null}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${statusStyle.border} ${statusStyle.bg} ${statusStyle.fg}`}>{d.status}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${compStyle.border} ${compStyle.bg} ${compStyle.fg}`}>{d.complianceStatus || 'Unknown'}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold ${confStyle.border} ${confStyle.bg} ${confStyle.fg}`}>
                          <ConfIcon className="w-4 h-4" />
                          {conf}
                        </span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">{d.uploadedBy || 'System'}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">{formatDateUtc(d.uploadedAt)}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className="font-extrabold">v{d.versionNumber || 1}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => openPreview(d)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                            <Eye className="w-4 h-4" />
                            Preview
                          </button>
                          <a
                            href={`/api/hris/documents/${encodeURIComponent(d.id)}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => setVerifyPanelDocId(d.id)}
                            className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            Verify
                          </button>
                          <button type="button" onClick={() => startReplace(d)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                            <FilePlus2 className="w-4 h-4" />
                            Replace
                          </button>
                          <button type="button" onClick={() => void openVersions(d)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                            <Copy className="w-4 h-4" />
                            Versions
                          </button>
                          <button type="button" onClick={() => void openAudit(d)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                            <FileClock className="w-4 h-4" />
                            Audit
                          </button>
                          <button type="button" onClick={() => void doArchive(d)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-[11px] font-extrabold text-red-800 hover:bg-red-100">
                            <Trash2 className="w-4 h-4" />
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredDocs.slice(0, 90).map((d) => {
              const st = statusPill(d.status);
              const conf = (d.confidentialityLevel || 'Internal') as ConfidentialityLevel;
              const confStyle = confidentialityStyle(conf);
              const ConfIcon = confStyle.icon;
              return (
                <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{d.documentTitle || d.category}</div>
                      <div className="text-xs font-semibold text-slate-600 truncate mt-1">{d.fileName}</div>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>{d.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Category</div>
                      <div className="text-xs font-extrabold text-slate-900 mt-1">{d.category}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Version</div>
                      <div className="text-xs font-extrabold text-slate-900 mt-1">v{d.versionNumber || 1}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Expiry</div>
                      <div className="text-xs font-extrabold text-slate-900 mt-1">{formatDateUtc(d.expiresAt)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Confidentiality</div>
                      <div className={`inline-flex items-center gap-2 mt-1 text-xs font-extrabold ${confStyle.fg}`}>
                        <ConfIcon className="w-4 h-4" />
                        {conf}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => openPreview(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <a href={`/api/hris/documents/${encodeURIComponent(d.id)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                    <button type="button" onClick={() => setVerifyPanelDocId(d.id)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <BadgeCheck className="w-4 h-4" />
                      Verify
                    </button>
                    <button type="button" onClick={() => startReplace(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <FilePlus2 className="w-4 h-4" />
                      Replace
                    </button>
                    <button type="button" onClick={() => void openVersions(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <Copy className="w-4 h-4" />
                      Versions
                    </button>
                    <button type="button" onClick={() => void openAudit(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <FileClock className="w-4 h-4" />
                      Audit
                    </button>
                    <button type="button" onClick={() => void doArchive(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-extrabold text-red-800 hover:bg-red-100">
                      <Trash2 className="w-4 h-4" />
                      Archive
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );

  const verificationPanel = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <BadgeCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Verification Panel</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Verify or reject documents with structured methods and notes.</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Select Document</div>
          <select value={verifyPanelDocId} onChange={(e) => setVerifyPanelDocId(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
            <option value="">Choose…</option>
            {docs
              .slice()
              .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
              .slice(0, 250)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.documentTitle || d.category} • {d.status}
                </option>
              ))}
          </select>
          <div className="mt-3 text-[11px] font-semibold text-slate-600">Verification methods</div>
          <select value={verifyMethod} onChange={(e) => setVerifyMethod(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
            {['HR Review', 'Legal Review', 'Compliance Review', 'Original Sighted', 'Employee Declaration', 'Third-Party Verification'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Verification Notes</div>
            <textarea value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} rows={3} placeholder="Add verification notes, reference numbers, or review details…" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <HeaderButton label="Verify" tone="primary" icon={ShieldCheck} onClick={() => void doVerify(verifyPanelDocId)} disabled={!verifyPanelDocId} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Reject Document</div>
              <div className="text-xs font-semibold text-slate-600 mt-1">Rejected documents are tracked, audited, and flagged as non-compliant.</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Rejection Reason</div>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="E.g. mismatch in employee name, unclear scan, expired document, incomplete pages…" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <HeaderButton label="Reject" tone="dark" icon={ShieldX} onClick={() => void doReject(verifyPanelDocId)} disabled={!verifyPanelDocId} />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Selected Document</div>
            {verifyPanelDocId ? (
              (() => {
                const d = docs.find((x) => x.id === verifyPanelDocId) || null;
                if (!d) return <div className="text-xs font-semibold text-slate-700 mt-2">Document not found.</div>;
                const st = statusPill(d.status);
                return (
                  <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{d.documentTitle || d.category}</div>
                      <div className="text-xs font-semibold text-slate-600 mt-1 truncate">{d.fileName}</div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>{d.status}</span>
                        <Pill label={`Issue: ${formatDateUtc(d.issueDate)}`} />
                        <Pill label={`Expiry: ${formatDateUtc(d.expiresAt)}`} />
                        <Pill label={`v${d.versionNumber || 1}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openPreview(d)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <a href={`/api/hris/documents/${encodeURIComponent(d.id)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-xs font-semibold text-slate-700 mt-2">Select a document to verify or reject.</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  const expiryTracker = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <CalendarClock className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Expiry Tracker</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Alerts at 90/60/30/14/7 days, escalation on expiry (simulated).</div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        {expiringState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading expiring documents…</div>
        ) : (expiringState.data || []).length ? (
          <div className="overflow-auto">
            <table className="min-w-[880px] w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  {['Category', 'File', 'Expiry', 'Days', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(expiringState.data || []).slice(0, 80).map((r) => {
                  const st = statusPill(r.status);
                  return (
                    <tr key={r.documentId} className="text-xs text-slate-800">
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold text-slate-900">{r.category}</div>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold truncate max-w-[360px]">{r.fileName}</div>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold">{formatDateUtc(r.expiresAt)}</div>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="font-extrabold">{r.daysToExpiry}</div>
                        <div className="text-[11px] font-semibold text-slate-600 mt-1">{r.daysToExpiry <= 7 ? '7-day alert' : r.daysToExpiry <= 14 ? '14-day alert' : r.daysToExpiry <= 30 ? '30-day alert' : r.daysToExpiry <= 60 ? '60-day alert' : '90-day alert'}</div>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>{r.status}</span>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={`/api/hris/documents/${encodeURIComponent(r.documentId)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const d = docs.find((x) => x.id === r.documentId) || null;
                              if (d) startReplace(d);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                          >
                            <FilePlus2 className="w-4 h-4" />
                            Replace
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">No expiring documents available (may be restricted for this role).</div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="bg-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {breadcrumbs}
        {header}
        {toolbar}
        {summaryCards}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {uploadPanel}
            {repository}
            {verificationPanel}
          </div>
          <div className="space-y-4">
            {aiPanel}
            {expiryTracker}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
                    <FileClock className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Audit Trail</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">Open document-level audit logs from repository actions.</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs font-semibold text-slate-700">
                Use the repository actions “Audit” to review events: viewed, uploaded, downloaded, previewed, verified, rejected, replaced, archived, and access denied attempts.
              </div>
            </Card>
          </div>
        </div>
      </div>

      {selectorOpen ? (
        <ModalShell title="Employee Selector" subtitle="Search by ID, name, department, job title, manager, location, document/compliance status (simulated)." onClose={() => setSelectorOpen(false)} widthClass="w-[980px]">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Search</div>
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                <Search className="w-4 h-4 text-slate-500" />
                <input value={selectorQuery} onChange={(e) => setSelectorQuery(e.target.value)} placeholder="Employee ID, name, department, job title…" className="w-full text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
              <span className="text-[11px] font-extrabold text-slate-700">Matches</span>
              <span className="text-xs font-extrabold text-slate-900">{selectorMatches.length}</span>
            </div>
          </div>
          <div className="mt-4 overflow-auto max-h-[60vh] rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  {['Employee ID', 'Name', 'Department', 'Job Title', 'Manager', 'Location', 'Action'].map((h) => (
                    <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selectorMatches || []).map((e) => (
                  <tr key={e.employeeId} className="text-xs text-slate-800">
                    <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{e.employeeId}</td>
                    <td className="py-3 px-3 border-b border-slate-200/60">
                      <div className="font-extrabold text-slate-900">{e.fullName}</div>
                      <div className="text-[11px] font-semibold text-slate-600 mt-1">{e.businessUnit || '—'}</div>
                    </td>
                    <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{e.department || '—'}</td>
                    <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{e.jobTitle || '—'}</td>
                    <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{e.currentManager || '—'}</td>
                    <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{e.location || '—'}</td>
                    <td className="py-3 px-3 border-b border-slate-200/60">
                      <button type="button" onClick={() => openEmployee(e.employeeId)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                        <ChevronRight className="w-4 h-4" />
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {employeesState.status === 'error' ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">{employeesState.error}</div> : null}
        </ModalShell>
      ) : null}

      {previewDoc ? (
        <ModalShell title="Document Preview" subtitle="Preview is access-controlled; some document types may download instead of render." onClose={() => setPreviewDoc(null)} widthClass="w-[1100px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-3">
              <Card className="p-4">
                <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Document</div>
                <div className="text-sm font-extrabold text-slate-900 mt-2">{previewDoc.documentTitle || previewDoc.category}</div>
                <div className="text-xs font-semibold text-slate-600 mt-1 break-words">{previewDoc.fileName}</div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Pill label={`Status: ${previewDoc.status}`} tone={previewDoc.status === 'Verified' ? 'ok' : previewDoc.status === 'Rejected' || previewDoc.status === 'Expired' ? 'err' : 'warn'} />
                  <Pill label={`v${previewDoc.versionNumber || 1}`} />
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-700">
                  <div>Category: <span className="font-extrabold">{previewDoc.category}</span></div>
                  <div className="mt-1">Issue: <span className="font-extrabold">{formatDateUtc(previewDoc.issueDate)}</span></div>
                  <div className="mt-1">Expiry: <span className="font-extrabold">{formatDateUtc(previewDoc.expiresAt)}</span></div>
                  <div className="mt-1">Uploaded: <span className="font-extrabold">{formatDateTimeUtc(previewDoc.uploadedAt)}</span></div>
                </div>
              </Card>
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/api/hris/documents/${encodeURIComponent(previewDoc.id)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button type="button" onClick={() => void openVersions(previewDoc)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <Copy className="w-4 h-4" />
                  Versions
                </button>
                <button type="button" onClick={() => void openAudit(previewDoc)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <FileClock className="w-4 h-4" />
                  Audit
                </button>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-3 border-b border-slate-200/60 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs font-extrabold text-slate-700">Secure Preview</div>
                  <div className="flex items-center gap-2">
                    <a href={`/api/hris/documents/${encodeURIComponent(previewDoc.id)}/preview`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                      <Eye className="w-4 h-4" />
                      Open in new tab
                    </a>
                  </div>
                </div>
                <div className="h-[66vh] bg-slate-50">
                  <iframe title="Document Preview" src={`/api/hris/documents/${encodeURIComponent(previewDoc.id)}/preview`} className="w-full h-full" />
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {replaceOpen && replaceDoc ? (
        <ModalShell title="Replace Document" subtitle="Replacement creates a new version and may require re-verification." onClose={() => setReplaceOpen(false)} widthClass="w-[860px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Current</div>
              <div className="text-sm font-extrabold text-slate-900 mt-2">{replaceDoc.documentTitle || replaceDoc.category}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1 break-words">{replaceDoc.fileName}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Pill label={`v${replaceDoc.versionNumber || 1}`} />
                <Pill label={`Status: ${replaceDoc.status}`} />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">New File</div>
              <input
                type="file"
                onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                className="mt-2 block w-full text-xs font-semibold text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:text-xs file:font-extrabold file:text-slate-700 hover:file:bg-slate-50"
              />
              <div className="mt-3 text-[11px] font-semibold text-slate-600">{replaceFile ? `${replaceFile.type || 'unknown'} • ${formatBytes(replaceFile.size)}` : 'Select a file to replace this document.'}</div>
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Reason for Replacement</div>
                <textarea value={replaceReason} onChange={(e) => setReplaceReason(e.target.value)} rows={3} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <HeaderButton label="Replace" tone="primary" icon={FilePlus2} onClick={() => void doReplace()} />
              </div>
            </Card>
          </div>
        </ModalShell>
      ) : null}

      {versionsOpen ? (
        <ModalShell title="Document Version History" subtitle="Old versions are retained based on retention policy (simulated)." onClose={() => setVersionsOpen(false)} widthClass="w-[980px]">
          {versionsState.status === 'loading' ? (
            <div className="text-xs font-semibold text-slate-600">Loading versions…</div>
          ) : versionsState.status === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">{versionsState.error}</div>
          ) : !(versionsState.data || []).length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">No version history found.</div>
          ) : (
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[900px] w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                    {['Version', 'Previous File', 'New File', 'Changed By', 'Changed At', 'Reason', 'Verification Status'].map((h) => (
                      <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(versionsState.data || []).slice(0, 50).map((v) => {
                    const st = statusPill(v.verificationStatus || 'Uploaded');
                    return (
                      <tr key={v.id} className="text-xs text-slate-800">
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">v{v.versionNumber}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60">
                          <div className="font-extrabold text-slate-900 truncate max-w-[260px]">{v.previousFileName}</div>
                          <div className="text-[11px] font-semibold text-slate-600 mt-1 truncate max-w-[260px]">{v.previousMimeType}</div>
                        </td>
                        <td className="py-3 px-3 border-b border-slate-200/60">
                          <div className="font-extrabold text-slate-900 truncate max-w-[260px]">{v.newFileName}</div>
                          <div className="text-[11px] font-semibold text-slate-600 mt-1 truncate max-w-[260px]">{v.newMimeType}</div>
                        </td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{v.changedBy}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{formatDateTimeUtc(v.changedAt)}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{v.reason}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>{v.verificationStatus}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ModalShell>
      ) : null}

      {auditOpen ? (
        <ModalShell title="Document Audit Log" subtitle="Tracked events for this document." onClose={() => setAuditOpen(false)} widthClass="w-[980px]">
          {auditState.status === 'loading' ? (
            <div className="text-xs font-semibold text-slate-600">Loading audit log…</div>
          ) : auditState.status === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">{auditState.error}</div>
          ) : !auditState.data ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">No audit log found.</div>
          ) : (
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">{auditState.data.document.documentTitle || auditState.data.document.category}</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1 break-words">{auditState.data.document.fileName}</div>
                  </div>
                  <a href={`/api/hris/documents/${encodeURIComponent(auditState.data.document.id)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </Card>
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-[900px] w-full text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                      {['Timestamp', 'Action', 'Performed By', 'Reason', 'Old Value', 'New Value'].map((h) => (
                        <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(auditState.data.audit || []).slice(0, 200).map((a) => (
                      <tr key={a.id} className="text-xs text-slate-800">
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{formatDateTimeUtc(a.at)}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{a.action}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{a.performedBy}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{a.reason || '—'}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 text-[11px] font-semibold text-slate-700 break-words max-w-[320px]">{a.oldValue || '—'}</td>
                        <td className="py-3 px-3 border-b border-slate-200/60 text-[11px] font-semibold text-slate-700 break-words max-w-[320px]">{a.newValue || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ModalShell>
      ) : null}

      {bulkOpen ? (
        <ModalShell title="Bulk Upload" subtitle="Upload multiple documents in one operation." onClose={() => setBulkOpen(false)} widthClass="w-[920px]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 lg:col-span-1">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Files</div>
              <div className="mt-2">
                <input
                  ref={bulkInputRef}
                  type="file"
                  multiple
                  onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
                  className="block w-full text-xs font-semibold text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:text-xs file:font-extrabold file:text-slate-700 hover:file:bg-slate-50"
                />
              </div>
              <div className="mt-3 text-xs font-extrabold text-slate-900">{bulkFiles.length ? `${bulkFiles.length} file(s) selected` : 'No files selected'}</div>
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Default Category</div>
                <select value={bulkDefaultCategory} onChange={(e) => setBulkDefaultCategory(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                  <option value="Auto-detect">Auto-detect</option>
                  {docCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <HeaderButton label="Upload" tone="primary" icon={FileUp} onClick={() => void uploadBulk()} />
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Preview</div>
              <div className="mt-3 overflow-auto max-h-[58vh] rounded-2xl border border-slate-200">
                <table className="min-w-[640px] w-full text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                      {['File', 'Type', 'Size', 'Auto Category', 'Status'].map((h) => (
                        <th key={h} className="py-3 px-3 font-extrabold border-b border-slate-200/60">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkFiles.slice(0, 150).map((f) => {
                      const err = validateFile(f);
                      const st = err ? statusPill('rejected') : statusPill('uploaded');
                      return (
                        <tr key={`${f.name}-${f.size}-${f.lastModified}`} className="text-xs text-slate-800">
                          <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold truncate max-w-[320px]">{f.name}</td>
                          <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{f.type || '—'}</td>
                          <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">{formatBytes(f.size)}</td>
                          <td className="py-3 px-3 border-b border-slate-200/60 font-extrabold">
                            {bulkDefaultCategory === 'Auto-detect' ? autoCategoryForFileName(f.name) : bulkDefaultCategory}
                          </td>
                          <td className="py-3 px-3 border-b border-slate-200/60">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>{err ? 'Blocked' : 'Ready'}</span>
                            {err ? <div className="text-[11px] font-semibold text-red-700 mt-1">{err}</div> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </ModalShell>
      ) : null}

      <AnimatePresence>{toast ? <Toast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /> : null}</AnimatePresence>
    </div>
  );
}
