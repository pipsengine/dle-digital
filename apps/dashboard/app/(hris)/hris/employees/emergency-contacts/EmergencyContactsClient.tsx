'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  Download,
  Fingerprint,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Line Manager'
  | 'Employee'
  | 'Auditor'
  | 'HSE Officer'
  | 'Compliance Officer';

type Severity = 'high' | 'medium' | 'low';

type VerificationStatus = 'Unverified' | 'Pending Verification' | 'Verified' | 'Verification Failed' | 'Update Required' | 'Expired Verification';

type PreferredContactMethod =
  | 'Phone Call'
  | 'SMS Confirmation'
  | 'Email Confirmation'
  | 'Employee Declaration'
  | 'HR Manual Verification'
  | 'Document Evidence'
  | 'Other';

type EmergencyContact = {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  alternativePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  nearestLandmark?: string | null;
  preferredContactMethod?: PreferredContactMethod | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  isPrimary: boolean;
  isNextOfKin: boolean;
  isBeneficiary: boolean;
  beneficiaryPercentage?: number | null;
  verificationStatus?: VerificationStatus;
  lastVerifiedAt?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
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
  if (v.includes('verified') || v.includes('ready')) return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('partially') || v.includes('required')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('failed') || v.includes('expired') || v.includes('not ready') || v.includes('missing')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
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

const computeReadiness = (contacts: EmergencyContact[]) => {
  const primary = contacts.find((c) => c.isPrimary) || null;
  const hasPrimary = Boolean(primary);
  const hasVerifiedPhone = contacts.some((c) => c.verificationStatus === 'Verified' && validatePhone(String(c.phoneNumber || '')));
  const hasAddress = contacts.some((c) => Boolean((c.address || '').trim()) || Boolean((c.city || '').trim()) || Boolean((c.state || '').trim()) || Boolean((c.country || '').trim()));
  const hasNextOfKin = contacts.some((c) => c.isNextOfKin);
  const hasBeneficiary = contacts.some((c) => c.isBeneficiary);
  const verifiedRecent = (() => {
    const last = contacts
      .map((c) => c.lastVerifiedAt)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return false;
    return Date.now() - last < 365 * 24 * 3600 * 1000;
  })();
  const checks = [hasPrimary, hasVerifiedPhone, hasAddress, hasNextOfKin, hasBeneficiary, verifiedRecent];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const state = score >= 85 ? 'Ready' : score >= 55 ? 'Partially Ready' : score >= 35 ? 'Requires Update' : 'Not Ready';
  return { score, state, primary, hasPrimary, hasVerifiedPhone, hasAddress, hasNextOfKin, hasBeneficiary, verifiedRecent };
};

type Draft = {
  id?: string;
  fullName: string;
  relationship: string;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
  alternativePhone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  nearestLandmark: string;
  preferredContactMethod: PreferredContactMethod;
  isPrimary: boolean;
  isNextOfKin: boolean;
  isBeneficiary: boolean;
  beneficiaryPercentage: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  fullName: '',
  relationship: 'Other',
  gender: '',
  dateOfBirth: '',
  phoneNumber: '',
  alternativePhone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: '',
  nearestLandmark: '',
  preferredContactMethod: 'Phone Call',
  isPrimary: false,
  isNextOfKin: false,
  isBeneficiary: false,
  beneficiaryPercentage: '',
  notes: '',
});

export default function EmergencyContactsClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement | null>(null);

  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [employeesState, setEmployeesState] = useState<ApiState<EmployeeOption[]>>({ status: 'idle' });
  const [contactsState, setContactsState] = useState<ApiState<EmergencyContact[]>>({ status: 'idle' });
  const [aiState, setAiState] = useState<ApiState<AIInsight[]>>({ status: 'idle' });

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyContactId, setVerifyContactId] = useState<string | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<PreferredContactMethod>('HR Manual Verification');

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
      setContactsState({ status: 'loading' });
      setAiState({ status: 'loading' });
      try {
        const [contacts, ai] = await Promise.all([
          apiFetchEmployee<EmergencyContact[]>(activeEmployeeId, 'emergency-contacts', { method: 'GET', role, viewerEmployeeId }),
          apiFetchModule<AIInsight[]>(`/api/hris/emergency-contacts/ai-insights?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId }).catch(() => [] as AIInsight[]),
        ]);
        if (cancelled) return;
        setContactsState({ status: 'ready', data: contacts });
        setAiState({ status: 'ready', data: ai });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Unable to load emergency contacts';
        setContactsState({ status: 'error', error: msg });
        setAiState({ status: 'error', error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshToken, role, viewerEmployeeId]);

  const employees = useMemo(() => employeesState.data ?? [], [employeesState.data]);
  const contacts = useMemo(() => contactsState.data ?? [], [contactsState.data]);
  const readiness = useMemo(() => computeReadiness(contacts), [contacts]);

  const filteredEmployees = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 70);
    return employees
      .filter((e) => [e.employeeId, e.fullName, e.department, e.jobTitle, e.currentManager, e.location, e.businessUnit].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)))
      .slice(0, 140);
  }, [employees, selectorQuery]);

  const primary = contacts.find((c) => c.isPrimary) || null;
  const nextOfKin = contacts.find((c) => c.isNextOfKin) || null;
  const beneficiary = contacts.find((c) => c.isBeneficiary) || null;
  const verifiedCount = contacts.filter((c) => c.verificationStatus === 'Verified').length;
  const unverifiedCount = contacts.length - verifiedCount;
  const missingStatus = !contacts.length ? 'No contacts' : !primary ? 'Missing Primary' : readiness.state;

  const lastUpdated = (() => {
    const last = contacts
      .map((c) => c.lastVerifiedAt || null)
      .filter(Boolean)
      .map((x) => new Date(String(x)).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (!last) return null;
    return new Date(last).toISOString();
  })();

  const openAdd = () => {
    setModalMode('add');
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const openEdit = (c: EmergencyContact) => {
    setModalMode('edit');
    setDraft({
      id: c.id,
      fullName: c.fullName || '',
      relationship: c.relationship || 'Other',
      gender: c.gender || '',
      dateOfBirth: c.dateOfBirth || '',
      phoneNumber: c.phoneNumber || '',
      alternativePhone: c.alternativePhone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      country: c.country || '',
      nearestLandmark: c.nearestLandmark || '',
      preferredContactMethod: (c.preferredContactMethod as PreferredContactMethod) || 'Phone Call',
      isPrimary: Boolean(c.isPrimary),
      isNextOfKin: Boolean(c.isNextOfKin),
      isBeneficiary: Boolean(c.isBeneficiary),
      beneficiaryPercentage: typeof c.beneficiaryPercentage === 'number' ? String(c.beneficiaryPercentage) : '',
      notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const saveContact = async () => {
    try {
      const fullName = draft.fullName.trim();
      const relationship = draft.relationship.trim();
      const phone = draft.phoneNumber.trim();
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
        phoneNumber: phone,
        alternativePhone: draft.alternativePhone || undefined,
        email: email || undefined,
        address: draft.address || undefined,
        city: draft.city || undefined,
        state: draft.state || undefined,
        country: draft.country || undefined,
        nearestLandmark: draft.nearestLandmark || undefined,
        preferredContactMethod: draft.preferredContactMethod,
        isPrimary: draft.isPrimary,
        isNextOfKin: draft.isNextOfKin,
        isBeneficiary: draft.isBeneficiary,
        beneficiaryPercentage: pct === null ? undefined : pct,
        notes: draft.notes || undefined,
      };

      if (modalMode === 'add') {
        await apiFetchEmployee<EmergencyContact>(activeEmployeeId, 'emergency-contacts', {
          method: 'POST',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setToast({ title: 'Contact added', detail: fullName, tone: 'ok' });
      } else {
        if (!draft.id) throw new Error('Missing contactId');
        await apiFetchEmployee<EmergencyContact[]>(activeEmployeeId, `emergency-contacts/${encodeURIComponent(draft.id)}`, {
          method: 'PATCH',
          role,
          viewerEmployeeId,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setToast({ title: 'Contact updated', detail: fullName, tone: 'ok' });
      }
      setModalOpen(false);
      setRefreshToken((n) => n + 1);
    } catch (e) {
      setToast({ title: 'Save failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' });
    }
  };

  const requestEmployeeUpdate = async () => {
    try {
      await apiFetchEmployee<any>(activeEmployeeId, 'emergency-contacts/request-update', {
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

  const setPrimary = async (contactId: string) => {
    await apiFetchEmployee<EmergencyContact[]>(activeEmployeeId, `emergency-contacts/${encodeURIComponent(contactId)}/set-primary`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
  };

  const setNextOfKin = async (contactId: string, value: boolean) => {
    await apiFetchEmployee<EmergencyContact[]>(activeEmployeeId, `emergency-contacts/${encodeURIComponent(contactId)}/set-next-of-kin`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  };

  const verifyContact = async () => {
    if (!verifyContactId) return;
    await apiFetchEmployee<EmergencyContact>(activeEmployeeId, `emergency-contacts/${encodeURIComponent(verifyContactId)}/verify`, {
      method: 'POST',
      role,
      viewerEmployeeId,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verificationStatus: 'Verified', method: verifyMethod }),
    });
  };

  const deleteContact = async (contactId: string) => {
    await apiFetchEmployee<any>(activeEmployeeId, `emergency-contacts/${encodeURIComponent(contactId)}`, {
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
      <span>Emergency Contacts</span>
    </div>
  );

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Emergency Contacts</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Manage employee emergency contacts, next-of-kin details, verification status, beneficiary indicators, and emergency communication readiness.</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            <Pill label={`Readiness: ${readiness.state} (${readiness.score}%)`} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton onClick={openAdd} label="Add Emergency Contact" tone="primary" icon={UserPlus} disabled={role === 'Employee'} />
          <HeaderButton onClick={() => void requestEmployeeUpdate()} label="Request Employee Update" tone="secondary" icon={BadgeCheck} />
          <HeaderButton
            onClick={() => {
              const target = primary || contacts.find((c) => c.verificationStatus !== 'Verified') || null;
              if (!target) {
                setToast({ title: 'No contact', detail: 'Add an emergency contact first.', tone: 'warn' });
                return;
              }
              setVerifyContactId(target.id);
              setVerifyMethod('HR Manual Verification');
              setVerifyOpen(true);
            }}
            label="Verify Contact"
            tone="secondary"
            icon={ShieldCheck}
            disabled={role === 'Employee' || contactsState.status !== 'ready' || !contacts.length}
          />
          <HeaderButton onClick={() => setExportOpen(true)} label="Export Contact Report" tone="dark" icon={Download} disabled={role === 'Employee'} />
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
              ['Super Admin', 'HR Director', 'HR Manager', 'HR Officer', 'Admin Officer', 'Line Manager', 'Employee', 'Auditor', 'HSE Officer', 'Compliance Officer'] as Role[]
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
        { title: 'Total Contacts', value: String(contacts.length), detail: 'Registered contacts', status: contacts.length ? 'OK' : 'Missing' },
        { title: 'Primary Emergency Contact', value: primary ? primary.fullName : '—', detail: primary ? primary.relationship : 'Set primary', status: primary ? 'Configured' : 'Missing' },
        { title: 'Next of Kin', value: nextOfKin ? nextOfKin.fullName : '—', detail: nextOfKin ? nextOfKin.relationship : 'Not set', status: nextOfKin ? 'Configured' : 'Missing' },
        { title: 'Beneficiary Contact', value: beneficiary ? beneficiary.fullName : '—', detail: beneficiary ? `${beneficiary.beneficiaryPercentage ?? 0}%` : 'Not set', status: beneficiary ? 'Configured' : 'Missing' },
        { title: 'Verified Contacts', value: String(verifiedCount), detail: 'Verified', status: verifiedCount ? 'Verified' : 'Unverified' },
        { title: 'Unverified Contacts', value: String(unverifiedCount), detail: 'Needs verification', status: unverifiedCount ? 'Pending' : 'OK' },
        { title: 'Missing Contact Status', value: missingStatus, detail: 'Readiness / compliance', status: missingStatus },
        { title: 'Last Updated', value: lastUpdated ? formatDateUtc(lastUpdated) : '—', detail: 'Last verification or update', status: lastUpdated ? 'Updated' : 'None' },
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
                <ShieldCheck className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.status}</span>
              <span className="text-[11px] font-extrabold text-slate-500">{initialNow ? formatDateUtc(initialNow) : '—'}</span>
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
            <div className="text-sm font-extrabold text-slate-900">AI Emergency Contact Intelligence</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Missing primary contact, invalid phone, stale verification, duplicate detection, and readiness scoring.</div>
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
                    else if (i.action === 'open_primary' && primary) void setPrimary(primary.id).then(() => setRefreshToken((n) => n + 1));
                    else if (i.action === 'open_verify') {
                      const t = primary || contacts[0] || null;
                      if (t) {
                        setVerifyContactId(t.id);
                        setVerifyMethod('HR Manual Verification');
                        setVerifyOpen(true);
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
            <div className="text-sm font-extrabold text-slate-900">Primary Contact</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Primary emergency contact and quick actions for communication and verification.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(primary?.verificationStatus || 'Unverified').border} ${statusPill(primary?.verificationStatus || 'Unverified').bg} ${statusPill(primary?.verificationStatus || 'Unverified').fg}`}>
          {primary?.verificationStatus || 'Unverified'}
        </span>
      </div>

      {!primary ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-extrabold text-slate-900">No primary contact configured</div>
            <div className="text-xs text-slate-600 font-semibold mt-1">Add a contact and mark it as primary to improve emergency readiness.</div>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
            <UserPlus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              ['Full Name', primary.fullName],
              ['Relationship', primary.relationship],
              ['Primary Phone', primary.phoneNumber],
              ['Alternate Phone', primary.alternativePhone || '—'],
              ['Email', primary.email || '—'],
              ['Residential Address', primary.address || '—'],
              ['City', primary.city || '—'],
              ['State', primary.state || '—'],
              ['Country', primary.country || '—'],
              ['Preferred Contact Method', primary.preferredContactMethod || '—'],
              ['Last Verification Date', primary.lastVerifiedAt ? formatDateUtc(primary.lastVerifiedAt) : '—'],
              ['Verified By', primary.verifiedBy || '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 truncate">{String(v || '—')}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <a href={`tel:${encodeURIComponent(primary.phoneNumber)}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Phone className="w-4 h-4" />
              Call Contact
            </a>
            <a href={primary.email ? `mailto:${encodeURIComponent(primary.email)}` : '#'} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 ${primary.email ? '' : 'opacity-60 pointer-events-none'}`}>
              <Mail className="w-4 h-4" />
              Send Email
            </a>
            <a href={`sms:${encodeURIComponent(primary.phoneNumber)}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Phone className="w-4 h-4" />
              Send SMS
            </a>
            <button
              type="button"
              onClick={() => {
                setVerifyContactId(primary.id);
                setVerifyMethod('HR Manual Verification');
                setVerifyOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
              disabled={role === 'Employee'}
            >
              <ShieldCheck className="w-4 h-4" />
              Mark as Verified
            </button>
            <button type="button" onClick={() => void requestEmployeeUpdate()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <BadgeCheck className="w-4 h-4" />
              Request Update
            </button>
            <button type="button" onClick={() => openEdit(primary)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
              Edit Contact
            </button>
          </div>
        </>
      )}
    </Card>
  );

  const listTable = (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Contact List</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Emergency contacts, next-of-kin, beneficiary indicators, verification status and actions.</div>
          </div>
        </div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{formatNumber(contacts.length)} rows</span>
      </div>
      <div className="p-4 overflow-auto">
        <table className="min-w-[1500px] w-full text-left bg-white">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Contact Name', 'Relationship', 'Primary Phone', 'Alternate Phone', 'Email', 'Address', 'Primary', 'Next of Kin', 'Beneficiary', 'Verification Status', 'Last Verified', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-extrabold text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.length ? (
              contacts.map((c) => {
                const st = statusPill(c.verificationStatus || 'Unverified');
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-extrabold text-slate-900 whitespace-nowrap">{c.fullName}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.relationship}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.phoneNumber}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.alternativePhone || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 min-w-[320px]">{c.address || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.isPrimary ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.isNextOfKin ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.isBeneficiary ? `Yes (${c.beneficiaryPercentage ?? 0}%)` : 'No'}</td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${st.border} ${st.bg} ${st.fg}`}>{c.verificationStatus || 'Unverified'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{c.lastVerifiedAt ? formatDateUtc(c.lastVerifiedAt) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEdit(c)} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
                          View / Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void setPrimary(c.id)
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
                          onClick={() =>
                            void setNextOfKin(c.id, !c.isNextOfKin)
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Action failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          {c.isNextOfKin ? 'Unset NOK' : 'Set NOK'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyContactId(c.id);
                            setVerifyMethod('HR Manual Verification');
                            setVerifyOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => void requestEmployeeUpdate()}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Request Update
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void deleteContact(c.id)
                              .then(() => setRefreshToken((n) => n + 1))
                              .catch((e) => setToast({ title: 'Delete failed', detail: e instanceof Error ? e.message : 'Request failed', tone: 'err' }))
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-[11px] font-extrabold text-red-800 hover:bg-red-100 disabled:opacity-60 disabled:pointer-events-none"
                          disabled={role === 'Employee'}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="px-6 py-10 text-center text-sm text-slate-600 font-semibold">
                  No emergency contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const verificationPanel = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Verification & Approval</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Verification status, methods and HR-controlled actions.</div>
          </div>
        </div>
        <button type="button" onClick={() => void openAudit()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <Fingerprint className="w-4 h-4" />
          Open Audit Trail
        </button>
      </div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-4 gap-3">
        {[
          ['Primary Verified', primary?.verificationStatus === 'Verified' ? 'Yes' : 'No'],
          ['Verified Contacts', String(verifiedCount)],
          ['Unverified Contacts', String(unverifiedCount)],
          ['Pending Update Requests', role === 'Employee' ? 'N/A' : 'Tracked via AI'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const readinessPanel = (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Emergency Notification Readiness</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Primary contact, verified phone, address completeness, NOK, beneficiary and verification recency.</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(readiness.state).border} ${statusPill(readiness.state).bg} ${statusPill(readiness.state).fg}`}>{readiness.state}</span>
      </div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Readiness Score</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{readiness.score}%</div>
          <div className="text-xs text-slate-600 font-semibold mt-2">State: {readiness.state}</div>
        </div>
        {(
          [
            ['Primary contact available', readiness.hasPrimary],
            ['At least one verified phone number', readiness.hasVerifiedPhone],
            ['At least one address available', readiness.hasAddress],
            ['Next-of-kin available', readiness.hasNextOfKin],
            ['Beneficiary record available', readiness.hasBeneficiary],
            ['Last verified within policy period', readiness.verifiedRecent],
          ] as Array<[string, boolean]>
        ).map(([k, ok]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-extrabold text-slate-600">{k}</div>
            <div className="mt-2 text-sm font-extrabold text-slate-900">{ok ? 'Yes' : 'No'}</div>
            <div className="mt-3">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusPill(ok ? 'Ready' : 'Requires Update').border} ${statusPill(ok ? 'Ready' : 'Requires Update').bg} ${statusPill(ok ? 'Ready' : 'Requires Update').fg}`}>
                {ok ? 'Ready' : 'Requires Update'}
              </span>
            </div>
          </div>
        ))}
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
                    router.push(`/hris/employees/emergency-contacts/${encodeURIComponent(e.employeeId)}`);
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

  const contactModal = (
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} maxW="max-w-5xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <UserPlus className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">{modalMode === 'add' ? 'Add Emergency Contact' : 'Edit Emergency Contact'}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Validation: one primary, valid phone/email, beneficiary total ≤ 100%.</div>
          </div>
        </div>
        <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[75vh] overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            ['fullName', 'Contact Full Name', 'Required'],
            ['relationship', 'Relationship', 'Required'],
            ['gender', 'Gender', 'Optional'],
            ['dateOfBirth', 'Date of Birth', 'Optional (YYYY-MM-DD)'],
            ['phoneNumber', 'Primary Phone Number', 'Required'],
            ['alternativePhone', 'Alternate Phone Number', 'Optional'],
            ['email', 'Email Address', 'Optional'],
            ['address', 'Residential Address', 'Optional'],
            ['city', 'City', 'Optional'],
            ['state', 'State', 'Optional'],
            ['country', 'Country', 'Optional'],
            ['nearestLandmark', 'Nearest Landmark', 'Optional'],
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
              {(['Phone Call', 'SMS Confirmation', 'Email Confirmation', 'Employee Declaration', 'HR Manual Verification', 'Document Evidence', 'Other'] as PreferredContactMethod[]).map((m) => (
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
              <div className="text-xs text-slate-500 font-semibold mt-1">Primary contact must be exactly one per employee.</div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {[
                ['isPrimary', 'Primary Emergency Contact'],
                ['isNextOfKin', 'Next of Kin'],
                ['isBeneficiary', 'Beneficiary Flag'],
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
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-extrabold text-slate-600">Notes</div>
          <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Optional notes for audit and HR review" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={() => void saveContact()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-60 disabled:pointer-events-none" disabled={role === 'Employee'}>
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
            <div className="text-sm font-extrabold text-slate-900">Verify Contact</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Record verification method and mark contact as verified.</div>
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
            {(['Phone Call', 'SMS Confirmation', 'Email Confirmation', 'Employee Declaration', 'HR Manual Verification', 'Document Evidence', 'Other'] as PreferredContactMethod[]).map((m) => (
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
              void verifyContact()
                .then(() => {
                  setVerifyOpen(false);
                  setToast({ title: 'Verified', detail: 'Contact marked as verified.', tone: 'ok' });
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

  const exportModal = (
    <Modal open={exportOpen} onClose={() => setExportOpen(false)} maxW="max-w-2xl">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Download className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Export Contact Report</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">CSV / Excel / PDF export for emergency contacts.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(false)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {['csv', 'xls', 'pdf'].map((fmt) => (
          <a key={fmt} href={`/api/hris/emergency-contacts/export?format=${encodeURIComponent(fmt)}&employeeId=${encodeURIComponent(activeEmployeeId)}`} className="inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
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
            <div className="text-sm font-extrabold text-slate-900">Emergency Contacts Audit Trail</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">Contact viewed/created/edited/deleted, primary changed, verified, update requested.</div>
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

  const loading = contactsState.status === 'loading' || employeesState.status === 'loading';
  const hasError = contactsState.status === 'error';

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
              <div className="text-sm font-extrabold text-slate-900">Unable to load emergency contacts</div>
              <div className="text-xs text-slate-600 font-semibold mt-1">{contactsState.error || 'Request failed'}</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {summaryCards}
          {aiPanel}
          {primarySection}
          {listTable}
          {verificationPanel}
          {readinessPanel}
        </>
      )}

      {selectorModal}
      {contactModal}
      {verifyModal}
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
