'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  Download,
  FileUp,
  Fingerprint,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Employee'
  | 'Line Manager'
  | 'HSE Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Executive Management';

type Severity = 'high' | 'medium' | 'low';

type VerificationStatus = 'Unverified' | 'Pending Verification' | 'Verified' | 'Rejected' | 'Update Required' | 'Expired Verification';

type EvidenceStatus = 'Missing' | 'Uploaded' | 'Verified' | 'Rejected';

type PreferredContactMethod =
  | 'Phone Confirmation'
  | 'SMS Confirmation'
  | 'Email Confirmation'
  | 'Document Review'
  | 'Employee Declaration'
  | 'HR Manual Verification'
  | 'Compliance Review'
  | 'Other';

type NextOfKinBeneficiary = {
  isBeneficiary: boolean;
  beneficiaryPercentage: number | null;
  benefitCategory: string | null;
  nominationDate: string | null;
  nominationStatus: 'Draft' | 'Pending HR Review' | 'Approved' | 'Rejected';
  approvedBy: string | null;
  approvalDate: string | null;
  notes: string | null;
};

type NextOfKinEvidence = {
  id: string;
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'Uploaded' | 'Verified' | 'Rejected' | 'Archived';
  uploadedAt: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
};

type NextOfKinRecord = {
  id: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  primaryPhone: string;
  alternatePhone?: string | null;
  email?: string | null;
  residentialAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  nearestLandmark?: string | null;
  preferredContactMethod?: PreferredContactMethod | null;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  verificationStatus: VerificationStatus;
  lastVerifiedAt?: string | null;
  verifiedBy?: string | null;
  relationshipEvidenceType?: string | null;
  evidenceStatus: EvidenceStatus;
  evidence?: NextOfKinEvidence[] | null;
  beneficiary: NextOfKinBeneficiary;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
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

const validateEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const validatePhone = (s: string) => /^[+]?[\d\s()-]{7,20}$/.test(s.trim());

const statusPill = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v.includes('verified') || v.includes('approved') || v.includes('ready')) return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('uploaded') || v.includes('partially') || v.includes('required')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('rejected') || v.includes('expired') || v.includes('not ready') || v.includes('missing')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
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

const computeReadiness = (records: NextOfKinRecord[]) => {
  const primary = records.find((r) => r.isPrimary) || null;
  const hasPrimary = Boolean(primary);
  const hasVerified = records.some((r) => r.verificationStatus === 'Verified');
  const hasEvidence = records.some((r) => r.evidenceStatus === 'Uploaded' || r.evidenceStatus === 'Verified');
  const hasBeneficiary = records.some((r) => r.beneficiary?.isBeneficiary);
  const hasAddress = records.some((r) => Boolean((r.residentialAddress || '').trim()) || Boolean((r.city || '').trim()) || Boolean((r.state || '').trim()) || Boolean((r.country || '').trim()));
  const verifiedRecent = (() => {
    const last = records
      .map((r) => r.lastVerifiedAt)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return false;
    return Date.now() - last < 365 * 24 * 3600 * 1000;
  })();
  const checks = [hasPrimary, hasVerified, hasEvidence, hasAddress, verifiedRecent, hasBeneficiary];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const state = score >= 85 ? 'Ready' : score >= 55 ? 'Partially Ready' : score >= 35 ? 'Requires Update' : 'Not Ready';
  return { score, state, primary, hasPrimary, hasVerified, hasEvidence, hasAddress, verifiedRecent, hasBeneficiary };
};

type Draft = {
  id?: string;
  fullName: string;
  relationship: string;
  gender: string;
  dateOfBirth: string;
  primaryPhone: string;
  alternatePhone: string;
  email: string;
  residentialAddress: string;
  city: string;
  state: string;
  country: string;
  nearestLandmark: string;
  preferredContactMethod: PreferredContactMethod;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isBeneficiary: boolean;
  beneficiaryPercentage: string;
  benefitCategory: string;
  relationshipEvidenceType: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  fullName: '',
  relationship: 'Other',
  gender: '',
  dateOfBirth: '',
  primaryPhone: '',
  alternatePhone: '',
  email: '',
  residentialAddress: '',
  city: '',
  state: '',
  country: '',
  nearestLandmark: '',
  preferredContactMethod: 'Phone Confirmation',
  isPrimary: false,
  isEmergencyContact: true,
  isBeneficiary: false,
  beneficiaryPercentage: '',
  benefitCategory: 'Death Benefit',
  relationshipEvidenceType: '',
  notes: '',
});

export default function NextOfKinClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [employeesState, setEmployeesState] = useState<ApiState<EmployeeOption[]>>({ status: 'idle' });
  const [recordsState, setRecordsState] = useState<ApiState<NextOfKinRecord[]>>({ status: 'idle' });
  const [aiState, setAiState] = useState<ApiState<AIInsight[]>>({ status: 'idle' });

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<'add' | 'edit'>('add');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNokId, setVerifyNokId] = useState<string | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<PreferredContactMethod>('HR Manual Verification');

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceNokId, setEvidenceNokId] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>('Marriage Certificate');
  const [evidenceFileName, setEvidenceFileName] = useState<string>('relationship_evidence.pdf');
  const [evidenceMime, setEvidenceMime] = useState<string>('application/pdf');
  const [evidenceSizeBytes, setEvidenceSizeBytes] = useState<string>('240000');

  const [beneficiaryOpen, setBeneficiaryOpen] = useState(false);
  const [beneficiaryNokId, setBeneficiaryNokId] = useState<string | null>(null);
  const [beneficiaryIs, setBeneficiaryIs] = useState(true);
  const [beneficiaryPct, setBeneficiaryPct] = useState<string>('50');
  const [beneficiaryCategory, setBeneficiaryCategory] = useState<string>('Death Benefit');
  const [beneficiaryNotes, setBeneficiaryNotes] = useState<string>('');

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<ApiState<{ id: string; at: string; action: string; performedBy: string; reason?: string }[]>>({ status: 'idle' });

  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setEmployeesState({ status: 'loading' });
      try {
        const data = await apiFetchModule<ReportingLineFormOptions>(`/api/hris/reporting-line/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId });
        if (cancelled) return;
        setEmployeesState({ status: 'ready', data: data.employees || [] });
      } catch (e) {
        if (cancelled) return;
        setEmployeesState({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load employees' });
      }
    };
    if (role === 'Employee') {
      queueMicrotask(() => {
        if (!cancelled) setEmployeesState({ status: 'ready', data: [] });
      });
      return () => {
        cancelled = true;
      };
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [role, viewerEmployeeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRecordsState({ status: 'loading' });
      setAiState({ status: 'loading' });
      try {
        const [records, ai] = await Promise.all([
          apiFetchEmployee<NextOfKinRecord[]>(activeEmployeeId, 'next-of-kin', { method: 'GET', role, viewerEmployeeId }),
          apiFetchModule<AIInsight[]>(`/api/hris/next-of-kin/ai-insights?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId }).catch(() => [] as AIInsight[]),
        ]);
        if (cancelled) return;
        setRecordsState({ status: 'ready', data: records });
        setAiState({ status: 'ready', data: ai });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load next of kin';
        setRecordsState({ status: 'error', error: msg });
        setAiState({ status: 'error', error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  const employees = useMemo(() => employeesState.data ?? [], [employeesState.data]);
  const records = useMemo(() => recordsState.data ?? [], [recordsState.data]);
  const readiness = useMemo(() => computeReadiness(records), [records]);

  const filteredEmployees = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 70);
    return employees
      .filter((e) => [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentManager, e.location, e.businessUnit].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)))
      .slice(0, 140);
  }, [employees, selectorQuery]);

  const primary = records.find((r) => r.isPrimary) || null;
  const verifiedCount = records.filter((r) => r.verificationStatus === 'Verified').length;
  const unverifiedCount = records.length - verifiedCount;
  const evidenceUploaded = records.filter((r) => r.evidenceStatus === 'Uploaded' || r.evidenceStatus === 'Verified').length;
  const beneficiaryLinked = records.filter((r) => r.beneficiary?.isBeneficiary).length;
  const missingStatus = !records.length ? 'No records' : !primary ? 'Missing Primary NOK' : readiness.state;
  const beneficiaryTotalPct = records.reduce((acc, r) => acc + (r.beneficiary?.isBeneficiary ? (typeof r.beneficiary?.beneficiaryPercentage === 'number' ? r.beneficiary.beneficiaryPercentage : 0) : 0), 0);

  const lastUpdated = (() => {
    const last = records
      .map((r) => r.updatedAt || r.lastVerifiedAt || null)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return null;
    return new Date(last).toISOString();
  })();

  const openAdd = () => {
    setEditMode('add');
    setDraft(emptyDraft());
    setEditOpen(true);
  };

  const openEdit = (r: NextOfKinRecord) => {
    setEditMode('edit');
    setDraft({
      id: r.id,
      fullName: r.fullName || '',
      relationship: r.relationship || 'Other',
      gender: r.gender || '',
      dateOfBirth: r.dateOfBirth || '',
      primaryPhone: r.primaryPhone || '',
      alternatePhone: r.alternatePhone || '',
      email: r.email || '',
      residentialAddress: r.residentialAddress || '',
      city: r.city || '',
      state: r.state || '',
      country: r.country || '',
      nearestLandmark: r.nearestLandmark || '',
      preferredContactMethod: (r.preferredContactMethod as PreferredContactMethod) || 'Phone Confirmation',
      isPrimary: Boolean(r.isPrimary),
      isEmergencyContact: Boolean(r.isEmergencyContact),
      isBeneficiary: Boolean(r.beneficiary?.isBeneficiary),
      beneficiaryPercentage: typeof r.beneficiary?.beneficiaryPercentage === 'number' ? String(r.beneficiary.beneficiaryPercentage) : '',
      benefitCategory: r.beneficiary?.benefitCategory || 'Death Benefit',
      relationshipEvidenceType: r.relationshipEvidenceType || '',
      notes: r.notes || '',
    });
    setEditOpen(true);
  };

  const saveRecord = async () => {
    try {
      const fullName = draft.fullName.trim();
      const relationship = draft.relationship.trim();
      const phone = draft.primaryPhone.trim();
      const email = draft.email.trim();
      if (!fullName) throw new Error('Full name is required');
      if (!relationship) throw new Error('Relationship is required');
      if (!phone) throw new Error('Primary phone number is required');
      if (!validatePhone(phone)) throw new Error('Phone number must be valid');
      if (email && !validateEmail(email)) throw new Error('Email must be valid');

      const pct = draft.isBeneficiary && draft.beneficiaryPercentage.trim() ? Number(draft.beneficiaryPercentage) : null;
      if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) throw new Error('Beneficiary percentage must be between 0 and 100');

      const payload = {
        fullName,
        relationship,
        gender: draft.gender || undefined,
        dateOfBirth: draft.dateOfBirth || undefined,
        primaryPhone: phone,
        alternatePhone: draft.alternatePhone || undefined,
        email: email || undefined,
        residentialAddress: draft.residentialAddress || undefined,
        city: draft.city || undefined,
        state: draft.state || undefined,
        country: draft.country || undefined,
        nearestLandmark: draft.nearestLandmark || undefined,
        preferredContactMethod: draft.preferredContactMethod,
        isPrimary: draft.isPrimary,
        isEmergencyContact: draft.isEmergencyContact,
        isBeneficiary: draft.isBeneficiary,
        beneficiaryPercentage: pct === null ? undefined : pct,
        benefitCategory: draft.benefitCategory || undefined,
        relationshipEvidenceType: draft.relationshipEvidenceType || undefined,
        notes: draft.notes || undefined,
      };

      if (editMode === 'add') {
        await apiFetchEmployee<NextOfKinRecord>(activeEmployeeId, 'next-of-kin', {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setToast({ title: 'Next of kin added', detail: fullName, tone: 'ok' });
      } else {
        if (!draft.id) throw new Error('Missing nokId');
        await apiFetchEmployee<NextOfKinRecord[]>(activeEmployeeId, `next-of-kin/${encodeURIComponent(draft.id)}`, {
          method: 'PATCH',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setToast({ title: 'Next of kin updated', detail: fullName, tone: 'ok' });
      }
      setEditOpen(false);
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Save failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const requestEmployeeUpdate = async () => {
    try {
      await apiFetchEmployee<any>(activeEmployeeId, 'next-of-kin/request-update', {
        method: 'POST',
        role,
        viewerEmployeeId,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Employee update requested' }),
      });
      setToast({ title: 'Update requested', detail: 'HR review pending.', tone: 'ok' });
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Request failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const setPrimary = async (nokId: string) => {
    await apiFetchEmployee<NextOfKinRecord[]>(activeEmployeeId, `next-of-kin/${encodeURIComponent(nokId)}/set-primary`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
  };

  const verifyRecord = async () => {
    if (!verifyNokId) return;
    await apiFetchEmployee<NextOfKinRecord>(activeEmployeeId, `next-of-kin/${encodeURIComponent(verifyNokId)}/verify`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verificationStatus: 'Verified', method: verifyMethod }),
    });
  };

  const uploadEvidence = async () => {
    if (!evidenceNokId) return;
    const size = Number(evidenceSizeBytes);
    if (!Number.isFinite(size) || size <= 0) throw new Error('Size bytes must be a positive number');
    await apiFetchEmployee<NextOfKinRecord>(activeEmployeeId, `next-of-kin/${encodeURIComponent(evidenceNokId)}/upload-evidence`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ evidenceType, fileName: evidenceFileName, mimeType: evidenceMime, sizeBytes: size }),
    });
  };

  const linkBeneficiary = async () => {
    if (!beneficiaryNokId) return;
    const pct = beneficiaryPct.trim() ? Number(beneficiaryPct) : NaN;
    if (beneficiaryIs && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) throw new Error('Beneficiary percentage must be between 1 and 100');
    await apiFetchEmployee<NextOfKinRecord>(activeEmployeeId, `next-of-kin/${encodeURIComponent(beneficiaryNokId)}/link-beneficiary`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        isBeneficiary: beneficiaryIs,
        beneficiaryPercentage: beneficiaryIs ? pct : 0,
        benefitCategory: beneficiaryIs ? beneficiaryCategory : null,
        notes: beneficiaryNotes || undefined,
      }),
    });
  };

  const deleteRecord = async (nokId: string) => {
    await apiFetchEmployee<any>(activeEmployeeId, `next-of-kin/${encodeURIComponent(nokId)}`, {
      method: 'DELETE',
      role,
      viewerEmployeeId,
    });
  };

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditRows({ status: 'loading' });
    try {
      const rows = await apiFetchEmployee<{ id: string; at: string; action: string; performedBy: string; reason?: string }[]>(activeEmployeeId, 'audit-trail', { method: 'GET', role, viewerEmployeeId });
      setAuditRows({ status: 'ready', data: rows });
    } catch (e) {
      setAuditRows({ status: 'error', error: e instanceof Error ? e.message : 'Unable to load audit trail' });
    }
  };

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Next of Kin</span>
    </div>
  );

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <Users className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Next of Kin</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Manage employee next-of-kin records, legal relationship evidence, verification status, beneficiary linkage, and emergency dependency information.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            <Pill label={`Readiness: ${readiness.state} (${readiness.score}%)`} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton onClick={openAdd} label="Add Next of Kin" tone="primary" icon={UserPlus} disabled={role === 'Employee'} />
          <HeaderButton onClick={() => void requestEmployeeUpdate()} label="Request Employee Update" tone="secondary" icon={BadgeCheck} />
          <HeaderButton
            onClick={() => {
              const target = primary || records[0] || null;
              if (!target) {
                setToast({ title: 'No record', detail: 'Add a next of kin record first.', tone: 'warn' });
                return;
              }
              setVerifyNokId(target.id);
              setVerifyMethod('HR Manual Verification');
              setVerifyOpen(true);
            }}
            label="Verify Record"
            tone="secondary"
            icon={ShieldCheck}
            disabled={role === 'Employee' || !records.length}
          />
          <HeaderButton
            onClick={() => {
              const target = primary || records[0] || null;
              if (!target) {
                setToast({ title: 'No record', detail: 'Add a next of kin record first.', tone: 'warn' });
                return;
              }
              setEvidenceNokId(target.id);
              setEvidenceOpen(true);
            }}
            label="Upload Evidence"
            tone="secondary"
            icon={FileUp}
            disabled={role === 'Employee' || !records.length}
          />
          <HeaderButton onClick={() => setExportOpen(true)} label="Export Report" tone="dark" icon={Download} disabled={role === 'Employee'} />
          <HeaderButton onClick={() => setRefreshToken((n) => n + 1)} label="Refresh" tone="secondary" icon={RefreshCcw} />
        </div>
      </div>
    </Card>
  );

  const toolbar = (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setSelectorOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
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
                'Admin Officer',
                'Employee',
                'Line Manager',
                'HSE Officer',
                'Compliance Officer',
                'Auditor',
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

  const summaryCards = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        { title: 'Total Next of Kin', value: String(records.length), detail: 'Registered records', status: records.length ? 'OK' : 'Missing' },
        { title: 'Primary Next of Kin', value: primary ? primary.fullName : '—', detail: primary ? primary.relationship : 'Set primary', status: primary ? 'Configured' : 'Missing' },
        { title: 'Verified Records', value: String(verifiedCount), detail: 'Verified', status: verifiedCount ? 'Verified' : 'Unverified' },
        { title: 'Unverified Records', value: String(unverifiedCount), detail: 'Needs verification', status: unverifiedCount ? 'Pending' : 'OK' },
        { title: 'Evidence Uploaded', value: String(evidenceUploaded), detail: 'Uploaded/verified', status: evidenceUploaded ? 'Uploaded' : 'Missing' },
        { title: 'Beneficiary Linked', value: String(beneficiaryLinked), detail: `Total %: ${beneficiaryTotalPct}%`, status: beneficiaryTotalPct > 100 ? 'Exceeds 100%' : beneficiaryLinked ? 'Linked' : 'None' },
        { title: 'Missing NOK Status', value: missingStatus, detail: 'Readiness / compliance', status: missingStatus },
        { title: 'Last Updated', value: lastUpdated ? formatDateUtc(lastUpdated) : '—', detail: 'Last update', status: lastUpdated ? 'Updated' : 'None' },
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
                <Users className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.status}</span>
              <span className="text-[11px] font-extrabold text-slate-500">{formatDateUtc(initialNow)}</span>
            </div>
          </div>
        );
      })}
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
            <div className="text-sm font-extrabold text-slate-900">AI Next-of-Kin Intelligence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Missing primary NOK, invalid phone, evidence gaps, stale verification, duplicate detection and readiness scoring.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber((aiState.data || []).length)} insights</span>
      </div>
      <div className="mt-4 space-y-3">
        {(aiState.data || []).slice(0, 10).map((i) => {
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
                    if (i.action === 'open_add') openAdd();
                    else if (i.action === 'open_edit') {
                      const t = primary || records[0] || null;
                      if (t) openEdit(t);
                    } else if (i.action === 'open_evidence') {
                      const t = primary || records[0] || null;
                      if (t) {
                        setEvidenceNokId(t.id);
                        setEvidenceOpen(true);
                      }
                    } else if (i.action === 'open_verify') {
                      const t = primary || records[0] || null;
                      if (t) {
                        setVerifyNokId(t.id);
                        setVerifyMethod('HR Manual Verification');
                        setVerifyOpen(true);
                      }
                    } else if (i.action === 'open_beneficiary') {
                      const t = primary || records[0] || null;
                      if (t) {
                        setBeneficiaryNokId(t.id);
                        setBeneficiaryIs(true);
                        setBeneficiaryPct(String(t.beneficiary?.beneficiaryPercentage ?? 50));
                        setBeneficiaryCategory(t.beneficiary?.benefitCategory || 'Death Benefit');
                        setBeneficiaryNotes('');
                        setBeneficiaryOpen(true);
                      }
                    } else if (i.action === 'open_request') void requestEmployeeUpdate();
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

  const primarySection = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Phone className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Primary Next of Kin</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Primary next of kin record, evidence/beneficiary linkage and quick actions.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(primary?.verificationStatus || 'Unverified').border} ${statusPill(primary?.verificationStatus || 'Unverified').bg} ${statusPill(primary?.verificationStatus || 'Unverified').fg}`}>
          {primary?.verificationStatus || 'Unverified'}
        </span>
      </div>

      {!primary ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-slate-900">No primary next of kin configured</div>
            <div className="text-xs text-slate-600 font-semibold mt-1">Add a record and mark it as primary for emergency dependency readiness.</div>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
            <UserPlus className="w-4 h-4" />
            Add NOK
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              ['Full Name', primary.fullName],
              ['Relationship', primary.relationship],
              ['Gender', primary.gender || '—'],
              ['Date of Birth', primary.dateOfBirth ? formatDateUtc(primary.dateOfBirth) : '—'],
              ['Primary Phone', primary.primaryPhone],
              ['Alternate Phone', primary.alternatePhone || '—'],
              ['Email', primary.email || '—'],
              ['Residential Address', primary.residentialAddress || '—'],
              ['City', primary.city || '—'],
              ['State', primary.state || '—'],
              ['Country', primary.country || '—'],
              ['Preferred Contact Method', primary.preferredContactMethod || '—'],
              ['Beneficiary Status', primary.beneficiary?.isBeneficiary ? `Yes (${primary.beneficiary.beneficiaryPercentage ?? 0}%)` : 'No'],
              ['Evidence Status', primary.evidenceStatus],
              ['Last Verified Date', primary.lastVerifiedAt ? formatDateUtc(primary.lastVerifiedAt) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(v || '—')}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <a href={`tel:${encodeURIComponent(primary.primaryPhone)}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Phone className="w-4 h-4" />
              Call
            </a>
            <a href={`sms:${encodeURIComponent(primary.primaryPhone)}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Phone className="w-4 h-4" />
              Send SMS
            </a>
            <a href={primary.email ? `mailto:${encodeURIComponent(primary.email)}` : '#'} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 ${primary.email ? '' : 'opacity-60 pointer-events-none'}`}>
              <Mail className="w-4 h-4" />
              Send Email
            </a>
            <button type="button" onClick={() => openEdit(primary)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
              Edit Record
            </button>
            <button
              type="button"
              onClick={() => {
                setVerifyNokId(primary.id);
                setVerifyMethod('HR Manual Verification');
                setVerifyOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
              disabled={role === 'Employee'}
            >
              <ShieldCheck className="w-4 h-4" />
              Mark Verified
            </button>
            <button type="button" onClick={() => void requestEmployeeUpdate()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <BadgeCheck className="w-4 h-4" />
              Request Update
            </button>
            <button
              type="button"
              onClick={() => {
                setEvidenceNokId(primary.id);
                setEvidenceOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none"
              disabled={role === 'Employee'}
            >
              <FileUp className="w-4 h-4" />
              Upload Evidence
            </button>
            <button type="button" onClick={() => void openAudit()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Fingerprint className="w-4 h-4" />
              View History
            </button>
          </div>
        </>
      )}
    </Card>
  );

  const recordsTable = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Next-of-Kin Records</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Primary NOK, beneficiary linkage, evidence status, verification status and actions.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(records.length)} rows</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1600px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Full Name', 'Relationship', 'Phone', 'Email', 'Address', 'Primary NOK', 'Beneficiary Linked', 'Evidence Status', 'Verification Status', 'Last Verified', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((r) => {
                const st = statusPill(r.verificationStatus);
                const ev = statusPill(r.evidenceStatus);
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{r.fullName}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.relationship}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.primaryPhone}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.email || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 min-w-[320px]">{r.residentialAddress || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.isPrimary ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.beneficiary?.isBeneficiary ? `Yes (${r.beneficiary.beneficiaryPercentage ?? 0}%)` : 'No'}</td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${ev.border} ${ev.bg} ${ev.fg}`}>{r.evidenceStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{r.verificationStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{r.lastVerifiedAt ? formatDateUtc(r.lastVerifiedAt) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEdit(r)} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
                          View / Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void setPrimary(r.id)
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Action failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-dle-blue text-white text-[11px] font-extrabold hover:bg-dle-blue/90 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          Mark Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBeneficiaryNokId(r.id);
                            setBeneficiaryIs(true);
                            setBeneficiaryPct(String(r.beneficiary?.beneficiaryPercentage ?? 50));
                            setBeneficiaryCategory(r.beneficiary?.benefitCategory || 'Death Benefit');
                            setBeneficiaryNotes('');
                            setBeneficiaryOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          Link Beneficiary
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEvidenceNokId(r.id);
                            setEvidenceOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          Upload Evidence
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyNokId(r.id);
                            setVerifyMethod('HR Manual Verification');
                            setVerifyOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          Verify
                        </button>
                        <button type="button" onClick={() => void requestEmployeeUpdate()} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                          Request Update
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void deleteRecord(r.id)
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Delete failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-[11px] font-extrabold text-red-800 hover:bg-red-100 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                        <button type="button" onClick={() => void openAudit()} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                          <Fingerprint className="w-4 h-4" />
                          Audit Log
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No next of kin records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const evidencePanel = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-600/10 border border-amber-200 flex items-center justify-center text-amber-700">
            <FileUp className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Verification & Evidence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Verification states, evidence presence, and compliance review readiness.</div>
          </div>
        </div>
        <button type="button" onClick={() => void openAudit()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <Fingerprint className="w-4 h-4" />
          Open Audit Trail
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-4 gap-3">
        {[
          ['Verified Records', String(verifiedCount)],
          ['Unverified Records', String(unverifiedCount)],
          ['Evidence Uploaded/Verified', String(evidenceUploaded)],
          ['Beneficiary Total %', `${beneficiaryTotalPct}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const beneficiaryPanel = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <BadgeCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Beneficiary Linkage</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Benefit-linked next of kin records (controlled and audited).</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(beneficiaryTotalPct > 100 ? 'Exceeds 100%' : beneficiaryLinked ? 'Linked' : 'None').border} ${statusPill(beneficiaryTotalPct > 100 ? 'Exceeds 100%' : beneficiaryLinked ? 'Linked' : 'None').bg} ${statusPill(beneficiaryTotalPct > 100 ? 'Exceeds 100%' : beneficiaryLinked ? 'Linked' : 'None').fg}`}>
          Total: {beneficiaryTotalPct}% • Linked: {beneficiaryLinked}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {records
          .filter((r) => r.beneficiary?.isBeneficiary)
          .slice(0, 6)
          .map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-extrabold text-slate-900">{r.fullName}</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{r.relationship}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(r.beneficiary.nominationStatus).border} ${statusPill(r.beneficiary.nominationStatus).bg} ${statusPill(r.beneficiary.nominationStatus).fg}`}>
                  {r.beneficiary.nominationStatus}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold">{r.beneficiary.beneficiaryPercentage ?? 0}%</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold">{r.beneficiary.benefitCategory || '—'}</span>
              </div>
            </div>
          ))}
        {!beneficiaryLinked ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 font-semibold lg:col-span-3">No beneficiary linkage records found.</div>
        ) : null}
      </div>
    </Card>
  );

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
                    setActiveEmployeeId(e.employeeId);
                    router.push(`/hris/employees/next-of-kin/${encodeURIComponent(e.employeeId)}`);
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

  const editModal = (
    <Modal open={editOpen} onClose={() => setEditOpen(false)} maxW="max-w-5xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <UserPlus className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{editMode === 'add' ? 'Add Next of Kin' : 'Edit Next of Kin'}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Validation: one primary NOK, valid phone/email, beneficiary total ≤ 100%.</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[75vh] overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            ['fullName', 'Full Name', 'Required'],
            ['relationship', 'Relationship', 'Required'],
            ['gender', 'Gender', 'Optional'],
            ['dateOfBirth', 'Date of Birth', 'Optional (YYYY-MM-DD)'],
            ['primaryPhone', 'Primary Phone Number', 'Required'],
            ['alternatePhone', 'Alternate Phone Number', 'Optional'],
            ['email', 'Email Address', 'Optional'],
            ['residentialAddress', 'Residential Address', 'Optional'],
            ['city', 'City', 'Optional'],
            ['state', 'State', 'Optional'],
            ['country', 'Country', 'Optional'],
            ['nearestLandmark', 'Nearest Landmark', 'Optional'],
            ['relationshipEvidenceType', 'Relationship Evidence Type', 'Optional (evidence document uploaded separately)'],
          ].map(([k, label, hint]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
              <input
                value={(draft as any)[k] || ''}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value } as any))}
                placeholder={String(hint)}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800"
              />
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-3">
            <div className="text-[11px] font-extrabold text-slate-600">Preferred Contact Method</div>
            <select value={draft.preferredContactMethod} onChange={(e) => setDraft((d) => ({ ...d, preferredContactMethod: e.target.value as PreferredContactMethod }))} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {(
                [
                  'Phone Confirmation',
                  'SMS Confirmation',
                  'Email Confirmation',
                  'Document Review',
                  'Employee Declaration',
                  'HR Manual Verification',
                  'Compliance Review',
                  'Other',
                ] as PreferredContactMethod[]
              ).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Flags</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">Primary NOK must be exactly one per employee.</div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {[
                ['isPrimary', 'Is Primary Next of Kin'],
                ['isEmergencyContact', 'Is Emergency Contact'],
                ['isBeneficiary', 'Is Beneficiary'],
              ].map(([k, label]) => (
                <label key={k} className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700">
                  <input type="checkbox" checked={Boolean((draft as any)[k])} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked } as any))} />
                  {label}
                </label>
              ))}
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-extrabold text-slate-600">Beneficiary %</span>
                <input value={draft.beneficiaryPercentage} onChange={(e) => setDraft((d) => ({ ...d, beneficiaryPercentage: e.target.value }))} placeholder="0-100" className="w-[90px] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-extrabold text-slate-600">Benefit Category</span>
                <input value={draft.benefitCategory} onChange={(e) => setDraft((d) => ({ ...d, benefitCategory: e.target.value }))} placeholder="Death Benefit" className="w-[200px] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Notes</div>
          <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Optional notes for audit and HR review" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={() => void saveRecord()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
            <BadgeCheck className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </Modal>
  );

  const verifyModal = (
    <Modal open={verifyOpen} onClose={() => setVerifyOpen(false)} maxW="max-w-2xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Verify Next of Kin Record</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Record verification method and mark as verified.</div>
          </div>
        </div>
        <button type="button" onClick={() => setVerifyOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Verification Method</div>
          <select value={verifyMethod} onChange={(e) => setVerifyMethod(e.target.value as PreferredContactMethod)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
            {(['Phone Confirmation', 'SMS Confirmation', 'Email Confirmation', 'Document Review', 'Employee Declaration', 'HR Manual Verification', 'Compliance Review', 'Other'] as PreferredContactMethod[]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setVerifyOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              void verifyRecord()
                .then(() => {
                  setVerifyOpen(false);
                  setToast({ title: 'Verified', detail: 'Record marked as verified.', tone: 'ok' });
                  setRefreshToken((n) => n + 1);
                })
                .catch((e) => setToast({ title: 'Verify failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
            disabled={role === 'Employee'}
          >
            <ShieldCheck className="w-4 h-4" />
            Mark Verified
          </button>
        </div>
      </div>
    </Modal>
  );

  const evidenceModal = (
    <Modal open={evidenceOpen} onClose={() => setEvidenceOpen(false)} maxW="max-w-3xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <FileUp className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Upload Relationship Evidence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Simulated secure upload with file validation and audit logging.</div>
          </div>
        </div>
        <button type="button" onClick={() => setEvidenceOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Evidence Type</div>
          <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
            {[
              'Marriage Certificate',
              'Birth Certificate',
              'Court Affidavit',
              'Government ID',
              'Employee Declaration Form',
              'HR Verified Declaration',
              'Other Supporting Document',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="text-[11px] font-extrabold text-slate-600">File Name</div>
            <input value={evidenceFileName} onChange={(e) => setEvidenceFileName(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Size (bytes)</div>
            <input value={evidenceSizeBytes} onChange={(e) => setEvidenceSizeBytes(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-3">
            <div className="text-[11px] font-extrabold text-slate-600">MIME Type</div>
            <select value={evidenceMime} onChange={(e) => setEvidenceMime(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {['application/pdf', 'image/png', 'image/jpeg'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEvidenceOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              void uploadEvidence()
                .then(() => {
                  setEvidenceOpen(false);
                  setToast({ title: 'Evidence uploaded', detail: evidenceFileName, tone: 'ok' });
                  setRefreshToken((n) => n + 1);
                })
                .catch((e) => setToast({ title: 'Upload failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
            disabled={role === 'Employee'}
          >
            <FileUp className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>
    </Modal>
  );

  const beneficiaryModal = (
    <Modal open={beneficiaryOpen} onClose={() => setBeneficiaryOpen(false)} maxW="max-w-3xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <BadgeCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Beneficiary Linkage</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Controlled beneficiary linkage with percentage validation and audit logging.</div>
          </div>
        </div>
        <button type="button" onClick={() => setBeneficiaryOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700">
          <input type="checkbox" checked={beneficiaryIs} onChange={(e) => setBeneficiaryIs(e.target.checked)} />
          Is Beneficiary
        </label>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">Beneficiary %</div>
            <input value={beneficiaryPct} onChange={(e) => setBeneficiaryPct(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <div className="text-[11px] font-extrabold text-slate-600">Benefit Category</div>
            <select value={beneficiaryCategory} onChange={(e) => setBeneficiaryCategory(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800">
              {['Death Benefit', 'Insurance Benefit', 'Gratuity', 'Pension Support Record', 'Welfare Benefit', 'Other HR Benefit'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Notes</div>
          <input value={beneficiaryNotes} onChange={(e) => setBeneficiaryNotes(e.target.value)} placeholder="Optional" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setBeneficiaryOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              void linkBeneficiary()
                .then(() => {
                  setBeneficiaryOpen(false);
                  setToast({ title: 'Beneficiary updated', detail: beneficiaryIs ? `${beneficiaryPct}%` : 'Removed', tone: 'ok' });
                  setRefreshToken((n) => n + 1);
                })
                .catch((e) => setToast({ title: 'Update failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
            }
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
            disabled={role === 'Employee'}
          >
            <BadgeCheck className="w-4 h-4" />
            Save
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
            <div className="text-sm font-extrabold text-slate-900">Export Next of Kin Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">CSV / Excel / PDF export for compliance reporting.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {['csv', 'xls', 'pdf'].map((fmt) => (
          <a key={fmt} href={`/api/hris/next-of-kin/export?format=${encodeURIComponent(fmt)}&employeeId=${encodeURIComponent(activeEmployeeId)}`} className="inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
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
            <div className="text-sm font-extrabold text-slate-900">Next of Kin Audit Trail</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Viewed/created/edited/deleted, primary changed, evidence uploaded, verified, beneficiary linked.</div>
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

  const loading = recordsState.status === 'loading' || employeesState.status === 'loading';
  const hasError = recordsState.status === 'error';

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
              <div className="text-sm font-extrabold text-slate-900">Unable to load next of kin records</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{recordsState.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {summaryCards}
          {aiPanel}
          {primarySection}
          {recordsTable}
          {evidencePanel}
          {beneficiaryPanel}
        </>
      )}

      {selectorModal}
      {editModal}
      {verifyModal}
      {evidenceModal}
      {beneficiaryModal}
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

