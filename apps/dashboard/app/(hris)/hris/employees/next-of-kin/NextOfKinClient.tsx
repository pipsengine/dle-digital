'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  Download,
  Eye,
  FileUp,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRoundCheck,
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

type EmployeeOption = {
  employeeId: string;
  employeeCode?: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
  status?: string;
  currentManager?: string;
  managerName?: string;
  location?: string;
  workLocation?: string;
  businessUnit?: string;
};

type EmployeeDirectoryPayload = {
  source: string;
  syncedAt: string;
  employees: EmployeeOption[];
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

type AuditRow = {
  id: string;
  at: string;
  action: string;
  performedBy: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
};

type ApiState<T> = {
  loading: boolean;
  data: T;
  error: string | null;
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

type EvidenceDraft = {
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  markVerified: boolean;
  notes: string;
};

type BeneficiaryDraft = {
  isBeneficiary: boolean;
  beneficiaryPercentage: string;
  benefitCategory: string;
  notes: string;
};

const ROLES: Role[] = ['HR Manager', 'HR Officer', 'HR Director', 'Compliance Officer', 'Auditor', 'Employee', 'Super Admin'];
const RELATIONSHIPS = ['Spouse', 'Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter', 'Guardian', 'Partner', 'Friend', 'Other'];
const CONTACT_METHODS: PreferredContactMethod[] = ['Phone Confirmation', 'SMS Confirmation', 'Email Confirmation', 'Document Review', 'Employee Declaration', 'HR Manual Verification', 'Compliance Review', 'Other'];
const EVIDENCE_TYPES = ['Marriage Certificate', 'Birth Certificate', 'Court Affidavit', 'Government ID', 'Employee Declaration Form', 'HR Verified Declaration', 'Other Supporting Document'];
const BENEFIT_CATEGORIES = ['Death Benefit', 'Insurance Benefit', 'Gratuity', 'Pension Support Record', 'Welfare Benefit', 'Other HR Benefit'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

const emptyDraft = (): Draft => ({
  fullName: '',
  relationship: 'Spouse',
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

const emptyEvidenceDraft = (): EvidenceDraft => ({
  evidenceType: 'Employee Declaration Form',
  fileName: '',
  mimeType: 'application/pdf',
  sizeBytes: '240000',
  markVerified: false,
  notes: '',
});

const emptyBeneficiaryDraft = (): BeneficiaryDraft => ({
  isBeneficiary: true,
  beneficiaryPercentage: '50',
  benefitCategory: 'Death Benefit',
  notes: '',
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);

const formatDate = (value?: string | null) => {
  if (!value) return '--';
  const s = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '--';
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '--';
  return `${formatDate(value)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
};

const validatePhone = (value: string) => /^[+]?[\d\s()-]{7,20}$/.test(value.trim());
const validateEmail = (value: string) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const apiHeaders = (role: Role, viewerEmployeeId?: string) => ({
  'content-type': 'application/json',
  'x-hris-role': role,
  ...(viewerEmployeeId ? { 'x-hris-employee-id': viewerEmployeeId } : {}),
});

async function apiJson<T>(url: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...apiHeaders(init.role, init.viewerEmployeeId),
      ...(init.headers || {}),
    },
  });
  const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
  if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Request failed');
  return json.data as T;
}

const employeeApi = <T,>(employeeId: string, resource: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) =>
  apiJson<T>(`/api/hris/employees/${encodeURIComponent(employeeId)}/${resource}`, init);

const moduleApi = <T,>(resource: string, init: RequestInit & { role: Role; viewerEmployeeId?: string }) => apiJson<T>(resource, init);

const mapDirectoryEmployee = (employee: EmployeeOption): EmployeeOption => ({
  employeeId: employee.employeeId || employee.employeeCode || '',
  employeeCode: employee.employeeCode,
  fullName: employee.fullName || employee.employeeId || employee.employeeCode || 'Unnamed employee',
  department: employee.department || '',
  jobTitle: employee.jobTitle || '',
  status: employee.status || '',
  currentManager: employee.currentManager || employee.managerName || '',
  managerName: employee.managerName || employee.currentManager || '',
  location: employee.location || employee.workLocation || '',
  workLocation: employee.workLocation || employee.location || '',
  businessUnit: employee.businessUnit || '',
});

const styleForStatus = (status: string) => {
  const v = status.toLowerCase();
  if (v.includes('verified') || v.includes('approved') || v.includes('ready')) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (v.includes('pending') || v.includes('uploaded') || v.includes('required') || v.includes('draft')) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (v.includes('rejected') || v.includes('expired') || v.includes('missing') || v.includes('not ready')) return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
};

const styleForSeverity = (severity: Severity) => {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
};

const readinessFor = (records: NextOfKinRecord[]) => {
  const lastVerifiedAt = records
    .map((record) => record.lastVerifiedAt)
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const hasRecentVerification = Boolean(lastVerifiedAt && Date.now() - lastVerifiedAt < 365 * 24 * 60 * 60 * 1000);
  const checks = [
    { label: 'At least one next of kin', done: records.length > 0 },
    { label: 'Primary record selected', done: records.some((record) => record.isPrimary) },
    { label: 'Verified contact', done: records.some((record) => record.verificationStatus === 'Verified') },
    { label: 'Relationship evidence captured', done: records.some((record) => ['Uploaded', 'Verified'].includes(record.evidenceStatus)) },
    { label: 'Address available', done: records.some((record) => Boolean(record.residentialAddress || record.city || record.state || record.country)) },
    { label: 'Verification within 12 months', done: hasRecentVerification },
  ];
  const score = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);
  const state = score >= 85 ? 'Ready' : score >= 55 ? 'Partially Ready' : score >= 35 ? 'Requires Update' : 'Not Ready';
  return { checks, score, state };
};

const recordToDraft = (record: NextOfKinRecord): Draft => ({
  id: record.id,
  fullName: record.fullName || '',
  relationship: record.relationship || 'Other',
  gender: record.gender || '',
  dateOfBirth: record.dateOfBirth || '',
  primaryPhone: record.primaryPhone || '',
  alternatePhone: record.alternatePhone || '',
  email: record.email || '',
  residentialAddress: record.residentialAddress || '',
  city: record.city || '',
  state: record.state || '',
  country: record.country || '',
  nearestLandmark: record.nearestLandmark || '',
  preferredContactMethod: record.preferredContactMethod || 'Phone Confirmation',
  isPrimary: Boolean(record.isPrimary),
  isEmergencyContact: Boolean(record.isEmergencyContact),
  isBeneficiary: Boolean(record.beneficiary?.isBeneficiary),
  beneficiaryPercentage: typeof record.beneficiary?.beneficiaryPercentage === 'number' ? String(record.beneficiary.beneficiaryPercentage) : '',
  benefitCategory: record.beneficiary?.benefitCategory || 'Death Benefit',
  relationshipEvidenceType: record.relationshipEvidenceType || '',
  notes: record.notes || '',
});

const compactAddress = (record: NextOfKinRecord) => [record.residentialAddress, record.city, record.state, record.country].filter(Boolean).join(', ') || '--';

const IconButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone = 'secondary',
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger' | 'dark';
}) => {
  const toneClass =
    tone === 'primary'
      ? 'border-dle-blue bg-dle-blue text-white hover:bg-dle-blue/90'
      : tone === 'danger'
        ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
        : tone === 'dark'
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold transition-colors disabled:pointer-events-none disabled:opacity-50 ${toneClass}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
};

const StatusPill = ({ value }: { value: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${styleForStatus(value)}`}>{value}</span>
);

const Modal = ({ title, children, onClose, width = 'max-w-3xl' }: { title: string; children: React.ReactNode; onClose: () => void; width?: string }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/35 px-4 py-8">
    <div className={`w-full ${width} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function NextOfKinClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState('');
  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [recordQuery, setRecordQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  const [employeesState, setEmployeesState] = useState<ApiState<EmployeeOption[]>>({ loading: false, data: [], error: null });
  const [recordsState, setRecordsState] = useState<ApiState<NextOfKinRecord[]>>({ loading: true, data: [], error: null });
  const [insightsState, setInsightsState] = useState<ApiState<AIInsight[]>>({ loading: false, data: [], error: null });
  const [auditState, setAuditState] = useState<ApiState<AuditRow[]>>({ loading: false, data: [], error: null });

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [evidenceTarget, setEvidenceTarget] = useState<NextOfKinRecord | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>(() => emptyEvidenceDraft());
  const [beneficiaryTarget, setBeneficiaryTarget] = useState<NextOfKinRecord | null>(null);
  const [beneficiaryDraft, setBeneficiaryDraft] = useState<BeneficiaryDraft>(() => emptyBeneficiaryDraft());
  const [auditOpen, setAuditOpen] = useState(false);

  const canEdit = !['Employee', 'Auditor', 'Executive Management'].includes(role);
  const effectiveViewerEmployeeId = role === 'Employee' ? viewerEmployeeId || activeEmployeeId : viewerEmployeeId || undefined;

  useEffect(() => {
    setActiveEmployeeId(employeeId);
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;
    const loadEmployees = async () => {
      if (role === 'Employee') {
        setEmployeesState({ loading: false, data: [], error: null });
        return;
      }
      setEmployeesState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await moduleApi<EmployeeDirectoryPayload>('/api/hris/employees', {
          method: 'GET',
          role,
          viewerEmployeeId: effectiveViewerEmployeeId,
        });
        if (!cancelled) {
          const employees = (data.employees || []).map(mapDirectoryEmployee).filter((employee) => employee.employeeId);
          setEmployeesState({ loading: false, data: employees, error: null });
        }
      } catch (error) {
        if (!cancelled) setEmployeesState({ loading: false, data: [], error: error instanceof Error ? error.message : 'Unable to load employees from DLE_Enterprise HRIS' });
      }
    };
    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [role, effectiveViewerEmployeeId]);

  useEffect(() => {
    let cancelled = false;
    const loadRecords = async () => {
      setRecordsState((prev) => ({ ...prev, loading: true, error: null }));
      setInsightsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const [records, insights] = await Promise.all([
          employeeApi<NextOfKinRecord[]>(activeEmployeeId, 'next-of-kin', { method: 'GET', role, viewerEmployeeId: effectiveViewerEmployeeId }),
          moduleApi<AIInsight[]>(`/api/hris/next-of-kin/ai-insights?employeeId=${encodeURIComponent(activeEmployeeId)}`, { method: 'GET', role, viewerEmployeeId: effectiveViewerEmployeeId }).catch(() => []),
        ]);
        if (!cancelled) {
          setRecordsState({ loading: false, data: records || [], error: null });
          setInsightsState({ loading: false, data: insights || [], error: null });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load next of kin records';
        if (!cancelled) {
          setRecordsState({ loading: false, data: [], error: message });
          setInsightsState({ loading: false, data: [], error: message });
        }
      }
    };
    void loadRecords();
    return () => {
      cancelled = true;
    };
  }, [activeEmployeeId, refreshKey, role, effectiveViewerEmployeeId]);

  const employees = employeesState.data;
  const records = recordsState.data;
  const readiness = useMemo(() => readinessFor(records), [records]);
  const activeEmployee = employees.find((employee) => employee.employeeId === activeEmployeeId);
  const primaryRecord = records.find((record) => record.isPrimary) || null;
  const verifiedCount = records.filter((record) => record.verificationStatus === 'Verified').length;
  const evidenceCount = records.filter((record) => ['Uploaded', 'Verified'].includes(record.evidenceStatus)).length;
  const beneficiaryCount = records.filter((record) => record.beneficiary?.isBeneficiary).length;
  const beneficiaryTotal = records.reduce((sum, record) => sum + (record.beneficiary?.isBeneficiary && typeof record.beneficiary.beneficiaryPercentage === 'number' ? record.beneficiary.beneficiaryPercentage : 0), 0);
  const lastUpdated = records
    .map((record) => record.updatedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  useEffect(() => {
    if (role === 'Employee') return;
    if (employeesState.loading || employeesState.error || employees.length === 0) return;
    const activeExists = employees.some((employee) => employee.employeeId === activeEmployeeId);
    if (!activeExists && activeEmployeeId === 'DLE-EMP-00001') {
      const firstEmployeeId = employees[0].employeeId;
      setActiveEmployeeId(firstEmployeeId);
      router.replace(`/hris/employees/next-of-kin?employeeId=${encodeURIComponent(firstEmployeeId)}`);
    }
  }, [activeEmployeeId, employees, employeesState.error, employeesState.loading, role, router]);

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 60);
    return employees
      .filter((employee) => [employee.employeeId, employee.employeeCode, employee.fullName, employee.department, employee.jobTitle, employee.status, employee.location, employee.workLocation, employee.businessUnit].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)))
      .slice(0, 80);
  }, [employeeQuery, employees]);

  const filteredRecords = useMemo(() => {
    const q = recordQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) =>
      [record.fullName, record.relationship, record.primaryPhone, record.email, record.verificationStatus, record.evidenceStatus, record.beneficiary?.benefitCategory]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [recordQuery, records]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const showToast = (message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  };

  const selectEmployee = (id: string) => {
    setActiveEmployeeId(id);
    router.replace(`/hris/employees/next-of-kin?employeeId=${encodeURIComponent(id)}`);
  };

  const openAdd = () => {
    setDraft({ ...emptyDraft(), isPrimary: records.length === 0 });
    setEditorOpen(true);
  };

  const openEdit = (record: NextOfKinRecord) => {
    setDraft(recordToDraft(record));
    setEditorOpen(true);
  };

  const saveRecord = async () => {
    const payload = {
      fullName: draft.fullName.trim(),
      relationship: draft.relationship.trim(),
      gender: draft.gender.trim() || null,
      dateOfBirth: draft.dateOfBirth || null,
      primaryPhone: draft.primaryPhone.trim(),
      alternatePhone: draft.alternatePhone.trim() || null,
      email: draft.email.trim() || null,
      residentialAddress: draft.residentialAddress.trim() || null,
      city: draft.city.trim() || null,
      state: draft.state.trim() || null,
      country: draft.country.trim() || null,
      nearestLandmark: draft.nearestLandmark.trim() || null,
      preferredContactMethod: draft.preferredContactMethod,
      isPrimary: draft.isPrimary,
      isEmergencyContact: draft.isEmergencyContact,
      isBeneficiary: draft.isBeneficiary,
      beneficiaryPercentage: draft.isBeneficiary && draft.beneficiaryPercentage ? Number(draft.beneficiaryPercentage) : null,
      benefitCategory: draft.benefitCategory.trim() || 'Death Benefit',
      relationshipEvidenceType: draft.relationshipEvidenceType.trim() || null,
      notes: draft.notes.trim() || null,
    };

    if (!payload.fullName) return showToast('Full name is required', 'error');
    if (!payload.relationship) return showToast('Relationship is required', 'error');
    if (!validatePhone(payload.primaryPhone)) return showToast('Enter a valid primary phone number', 'error');
    if (!validateEmail(payload.email || '')) return showToast('Enter a valid email address', 'error');
    if (payload.isBeneficiary && (typeof payload.beneficiaryPercentage !== 'number' || !Number.isFinite(payload.beneficiaryPercentage) || payload.beneficiaryPercentage <= 0 || payload.beneficiaryPercentage > 100)) {
      return showToast('Beneficiary percentage must be between 1 and 100', 'error');
    }

    setBusy(true);
    try {
      if (draft.id) {
        await employeeApi<NextOfKinRecord[]>(activeEmployeeId, `next-of-kin/${encodeURIComponent(draft.id)}`, {
          method: 'PUT',
          role,
          viewerEmployeeId: effectiveViewerEmployeeId,
          body: JSON.stringify(payload),
        });
      } else {
        await employeeApi<NextOfKinRecord>(activeEmployeeId, 'next-of-kin', {
          method: 'POST',
          role,
          viewerEmployeeId: effectiveViewerEmployeeId,
          body: JSON.stringify(payload),
        });
      }
      setEditorOpen(false);
      showToast(draft.id ? 'Next of kin updated' : 'Next of kin added');
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save record', 'error');
    } finally {
      setBusy(false);
    }
  };

  const actionRecord = async (record: NextOfKinRecord, action: 'set-primary' | 'verify' | 'delete') => {
    setBusy(true);
    try {
      if (action === 'delete') {
        await employeeApi<{ deleted: boolean }>(activeEmployeeId, `next-of-kin/${encodeURIComponent(record.id)}`, {
          method: 'DELETE',
          role,
          viewerEmployeeId: effectiveViewerEmployeeId,
        });
        showToast('Next of kin deleted');
      } else {
        await employeeApi<NextOfKinRecord | NextOfKinRecord[]>(activeEmployeeId, `next-of-kin/${encodeURIComponent(record.id)}/${action}`, {
          method: 'POST',
          role,
          viewerEmployeeId: effectiveViewerEmployeeId,
          body: JSON.stringify(action === 'verify' ? { method: 'HR Manual Verification', verificationStatus: 'Verified' } : {}),
        });
        showToast(action === 'verify' ? 'Record verified' : 'Primary next of kin updated');
      }
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openEvidence = (record: NextOfKinRecord) => {
    setEvidenceTarget(record);
    setEvidenceDraft({
      ...emptyEvidenceDraft(),
      evidenceType: record.relationshipEvidenceType || 'Employee Declaration Form',
      fileName: record.evidence?.[0]?.fileName || '',
    });
  };

  const uploadEvidence = async () => {
    if (!evidenceTarget) return;
    const sizeBytes = Number(evidenceDraft.sizeBytes);
    if (!evidenceDraft.fileName.trim()) return showToast('File name is required', 'error');
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return showToast('File size is required', 'error');

    setBusy(true);
    try {
      await employeeApi<NextOfKinRecord>(activeEmployeeId, `next-of-kin/${encodeURIComponent(evidenceTarget.id)}/upload-evidence`, {
        method: 'POST',
        role,
        viewerEmployeeId: effectiveViewerEmployeeId,
        body: JSON.stringify({
          evidenceType: evidenceDraft.evidenceType,
          fileName: evidenceDraft.fileName.trim(),
          mimeType: evidenceDraft.mimeType,
          sizeBytes,
          markVerified: evidenceDraft.markVerified,
          notes: evidenceDraft.notes.trim() || null,
        }),
      });
      setEvidenceTarget(null);
      showToast('Relationship evidence uploaded');
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openBeneficiary = (record: NextOfKinRecord) => {
    setBeneficiaryTarget(record);
    setBeneficiaryDraft({
      isBeneficiary: Boolean(record.beneficiary?.isBeneficiary),
      beneficiaryPercentage: typeof record.beneficiary?.beneficiaryPercentage === 'number' ? String(record.beneficiary.beneficiaryPercentage) : '50',
      benefitCategory: record.beneficiary?.benefitCategory || 'Death Benefit',
      notes: record.beneficiary?.notes || '',
    });
  };

  const saveBeneficiary = async () => {
    if (!beneficiaryTarget) return;
    const pct = Number(beneficiaryDraft.beneficiaryPercentage);
    if (beneficiaryDraft.isBeneficiary && (!Number.isFinite(pct) || pct <= 0 || pct > 100)) return showToast('Beneficiary percentage must be between 1 and 100', 'error');

    setBusy(true);
    try {
      await employeeApi<NextOfKinRecord>(activeEmployeeId, `next-of-kin/${encodeURIComponent(beneficiaryTarget.id)}/link-beneficiary`, {
        method: 'POST',
        role,
        viewerEmployeeId: effectiveViewerEmployeeId,
        body: JSON.stringify({
          isBeneficiary: beneficiaryDraft.isBeneficiary,
          beneficiaryPercentage: beneficiaryDraft.isBeneficiary ? pct : null,
          benefitCategory: beneficiaryDraft.benefitCategory,
          notes: beneficiaryDraft.notes.trim() || null,
        }),
      });
      setBeneficiaryTarget(null);
      showToast('Beneficiary linkage updated');
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Beneficiary update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await employeeApi<AuditRow[]>(activeEmployeeId, 'audit-trail', { method: 'GET', role, viewerEmployeeId: effectiveViewerEmployeeId });
      setAuditState({ loading: false, data: rows || [], error: null });
    } catch (error) {
      setAuditState({ loading: false, data: [], error: error instanceof Error ? error.message : 'Unable to load audit trail' });
    }
  };

  const requestEmployeeUpdate = async () => {
    setBusy(true);
    try {
      await employeeApi(activeEmployeeId, 'next-of-kin/request-update', {
        method: 'POST',
        role,
        viewerEmployeeId: effectiveViewerEmployeeId,
        body: JSON.stringify({ reason: 'Please review and update next of kin information.' }),
      });
      showToast('Employee update request created');
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to request update', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 bg-white pb-8">
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-500">
        <span>HRIS</span>
        <span>/</span>
        <span>Employees</span>
        <span>/</span>
        <span className="text-slate-900">Next of Kin</span>
      </div>

      <section className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Emergency dependency record
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">Next of Kin Management</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Maintain verified next-of-kin contacts, primary NOK status, relationship evidence, beneficiary nomination, and HR audit history for each employee.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700">
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {role === 'Employee' ? (
              <input value={viewerEmployeeId} onChange={(event) => setViewerEmployeeId(event.target.value)} placeholder="Viewer employee ID" className="h-9 w-44 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-700" />
            ) : null}
            <IconButton label="Refresh" icon={RefreshCcw} onClick={refresh} disabled={busy || recordsState.loading} />
            <a
              href={`/api/hris/next-of-kin/export?format=csv&employeeId=${encodeURIComponent(activeEmployeeId)}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
            <IconButton label="Audit" icon={Eye} onClick={openAudit} disabled={busy} />
            <IconButton label="Add NOK" icon={Plus} onClick={openAdd} disabled={!canEdit || busy} tone="primary" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase text-slate-500">Employee</div>
                <div className="mt-1 text-sm font-extrabold text-slate-950">{activeEmployee?.fullName || activeEmployeeId}</div>
              </div>
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            {role !== 'Employee' ? (
              <>
                <div className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Search employees" className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400" />
                </div>
                <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {employeesState.loading ? <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-500">Loading employees...</div> : null}
                  {employeesState.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{employeesState.error}</div> : null}
                  {filteredEmployees.map((employee) => (
                    <button
                      key={employee.employeeId}
                      type="button"
                      onClick={() => selectEmployee(employee.employeeId)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${employee.employeeId === activeEmployeeId ? 'border-dle-blue bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="text-xs font-extrabold text-slate-950">{employee.fullName}</div>
                      <div className="mt-1 truncate text-[11px] font-bold text-slate-500">
                        {employee.employeeId} · {employee.department || 'Unassigned'} · {employee.jobTitle || 'No job title'}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs font-bold leading-5 text-slate-600">Employee role is restricted to the viewer employee record.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold uppercase text-slate-500">Readiness</div>
                <div className="mt-1 text-3xl font-extrabold text-slate-950">{readiness.score}%</div>
              </div>
              <StatusPill value={readiness.state} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness.score}%` }} />
            </div>
            <div className="mt-4 space-y-2">
              {readiness.checks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${check.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                    {check.done ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  {check.label}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Records', formatNumber(records.length)],
              ['Verified', formatNumber(verifiedCount)],
              ['Evidence', formatNumber(evidenceCount)],
              ['Beneficiaries', formatNumber(beneficiaryCount)],
              ['Allocation', `${beneficiaryTotal}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-950">{value}</div>
              </div>
            ))}
          </div>

          {recordsState.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{recordsState.error}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase text-slate-500">Primary Next of Kin</div>
                  <div className="mt-2 text-lg font-extrabold text-slate-950">{primaryRecord?.fullName || 'No primary NOK selected'}</div>
                </div>
                <Star className={`h-5 w-5 ${primaryRecord ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </div>
              {primaryRecord ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Detail label="Relationship" value={primaryRecord.relationship} />
                  <Detail label="Verification" value={primaryRecord.verificationStatus} pill />
                  <Detail label="Phone" value={primaryRecord.primaryPhone} />
                  <Detail label="Email" value={primaryRecord.email || '--'} />
                  <Detail label="Address" value={compactAddress(primaryRecord)} wide />
                  <Detail label="Last Verified" value={formatDate(primaryRecord.lastVerifiedAt)} />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-600">Add a next of kin record or mark an existing record as primary.</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold uppercase text-slate-500">HR Intelligence</div>
                  <div className="mt-1 text-sm font-bold text-slate-600">Risk checks generated from NOK completeness and compliance rules.</div>
                </div>
                <ShieldCheck className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 space-y-3">
                {insightsState.loading ? <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-500">Loading insights...</div> : null}
                {!insightsState.loading && insightsState.data.length === 0 ? <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-500">No active NOK risks detected.</div> : null}
                {insightsState.data.slice(0, 4).map((insight) => (
                  <div key={insight.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-950">{insight.title}</div>
                        <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{insight.recommendation}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${styleForSeverity(insight.severity)}`}>{insight.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-extrabold text-slate-950">Next of Kin Records</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {activeEmployeeId} · Last updated {lastUpdated ? formatDateTime(new Date(lastUpdated).toISOString()) : '--'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={recordQuery} onChange={(event) => setRecordQuery(event.target.value)} placeholder="Search NOK records" className="w-44 bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400" />
                </div>
                <IconButton label="Request Update" icon={UserRoundCheck} onClick={requestEmployeeUpdate} disabled={busy} />
              </div>
            </div>

            {recordsState.loading ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-50" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Users className="h-6 w-6" />
                </div>
                <div className="mt-4 text-sm font-extrabold text-slate-950">No next of kin records found</div>
                <div className="mt-2 text-xs font-semibold text-slate-500">Create the first record for this employee to start readiness tracking.</div>
                <button type="button" onClick={openAdd} disabled={!canEdit} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-dle-blue px-3 text-xs font-extrabold text-white disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                  Add NOK
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full text-left">
                  <thead className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Verification</th>
                      <th className="px-4 py-3">Evidence</th>
                      <th className="px-4 py-3">Beneficiary</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Users className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-slate-950">{record.fullName}</span>
                                {record.isPrimary ? <StatusPill value="Primary" /> : null}
                              </div>
                              <div className="mt-1 text-xs font-bold text-slate-500">{record.relationship}</div>
                              <div className="mt-1 max-w-[280px] truncate text-xs font-semibold text-slate-500">{compactAddress(record)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {record.primaryPhone}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-slate-500">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {record.email || '--'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill value={record.verificationStatus} />
                          <div className="mt-2 text-[11px] font-bold text-slate-500">{formatDate(record.lastVerifiedAt)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill value={record.evidenceStatus} />
                          <div className="mt-2 text-[11px] font-bold text-slate-500">{record.relationshipEvidenceType || 'No evidence type'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill value={record.beneficiary?.isBeneficiary ? record.beneficiary.nominationStatus : 'Not linked'} />
                          <div className="mt-2 text-[11px] font-bold text-slate-500">
                            {record.beneficiary?.isBeneficiary ? `${record.beneficiary.beneficiaryPercentage || 0}% · ${record.beneficiary.benefitCategory || 'Benefit'}` : '--'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-bold text-slate-600">{formatDate(record.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <IconButton label="Edit" icon={Pencil} onClick={() => openEdit(record)} disabled={!canEdit || busy} />
                            <IconButton label="Primary" icon={Star} onClick={() => void actionRecord(record, 'set-primary')} disabled={!canEdit || busy || record.isPrimary} />
                            <IconButton label="Verify" icon={BadgeCheck} onClick={() => void actionRecord(record, 'verify')} disabled={!canEdit || busy || record.verificationStatus === 'Verified'} />
                            <IconButton label="Evidence" icon={FileUp} onClick={() => openEvidence(record)} disabled={!canEdit || busy} />
                            <IconButton label="Beneficiary" icon={ShieldCheck} onClick={() => openBeneficiary(record)} disabled={!canEdit || busy} />
                            <IconButton label="Delete" icon={Trash2} onClick={() => void actionRecord(record, 'delete')} disabled={!canEdit || busy} tone="danger" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </section>

      {editorOpen ? (
        <Modal title={draft.id ? 'Edit Next of Kin' : 'Add Next of Kin'} onClose={() => setEditorOpen(false)} width="max-w-5xl">
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <Field label="Full Name" value={draft.fullName} onChange={(value) => setDraft((prev) => ({ ...prev, fullName: value }))} required />
            <SelectField label="Relationship" value={draft.relationship} values={RELATIONSHIPS} onChange={(value) => setDraft((prev) => ({ ...prev, relationship: value }))} />
            <SelectField label="Gender" value={draft.gender} values={['', 'Female', 'Male', 'Other', 'Prefer not to say']} onChange={(value) => setDraft((prev) => ({ ...prev, gender: value }))} />
            <Field label="Date of Birth" type="date" value={draft.dateOfBirth} onChange={(value) => setDraft((prev) => ({ ...prev, dateOfBirth: value }))} />
            <Field label="Primary Phone" value={draft.primaryPhone} onChange={(value) => setDraft((prev) => ({ ...prev, primaryPhone: value }))} required />
            <Field label="Alternate Phone" value={draft.alternatePhone} onChange={(value) => setDraft((prev) => ({ ...prev, alternatePhone: value }))} />
            <Field label="Email" value={draft.email} onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))} />
            <SelectField label="Preferred Contact Method" value={draft.preferredContactMethod} values={CONTACT_METHODS} onChange={(value) => setDraft((prev) => ({ ...prev, preferredContactMethod: value as PreferredContactMethod }))} />
            <SelectField label="Relationship Evidence Type" value={draft.relationshipEvidenceType} values={['', ...EVIDENCE_TYPES]} onChange={(value) => setDraft((prev) => ({ ...prev, relationshipEvidenceType: value }))} />
            <Field label="Residential Address" value={draft.residentialAddress} onChange={(value) => setDraft((prev) => ({ ...prev, residentialAddress: value }))} wide />
            <Field label="City" value={draft.city} onChange={(value) => setDraft((prev) => ({ ...prev, city: value }))} />
            <Field label="State" value={draft.state} onChange={(value) => setDraft((prev) => ({ ...prev, state: value }))} />
            <Field label="Country" value={draft.country} onChange={(value) => setDraft((prev) => ({ ...prev, country: value }))} />
            <Field label="Nearest Landmark" value={draft.nearestLandmark} onChange={(value) => setDraft((prev) => ({ ...prev, nearestLandmark: value }))} />
            <Field label="Notes" value={draft.notes} onChange={(value) => setDraft((prev) => ({ ...prev, notes: value }))} wide />
            <div className="rounded-lg border border-slate-200 p-4 lg:col-span-3">
              <div className="grid gap-4 lg:grid-cols-4">
                <Toggle label="Primary NOK" checked={draft.isPrimary} onChange={(checked) => setDraft((prev) => ({ ...prev, isPrimary: checked }))} />
                <Toggle label="Emergency Contact" checked={draft.isEmergencyContact} onChange={(checked) => setDraft((prev) => ({ ...prev, isEmergencyContact: checked }))} />
                <Toggle label="Beneficiary" checked={draft.isBeneficiary} onChange={(checked) => setDraft((prev) => ({ ...prev, isBeneficiary: checked }))} />
                <Field label="Beneficiary %" value={draft.beneficiaryPercentage} onChange={(value) => setDraft((prev) => ({ ...prev, beneficiaryPercentage: value }))} disabled={!draft.isBeneficiary} />
                <SelectField label="Benefit Category" value={draft.benefitCategory} values={BENEFIT_CATEGORIES} onChange={(value) => setDraft((prev) => ({ ...prev, benefitCategory: value }))} disabled={!draft.isBeneficiary} />
              </div>
            </div>
          </div>
          <ModalActions onCancel={() => setEditorOpen(false)} onSave={saveRecord} busy={busy} label="Save Record" />
        </Modal>
      ) : null}

      {evidenceTarget ? (
        <Modal title={`Upload Evidence: ${evidenceTarget.fullName}`} onClose={() => setEvidenceTarget(null)}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <SelectField label="Evidence Type" value={evidenceDraft.evidenceType} values={EVIDENCE_TYPES} onChange={(value) => setEvidenceDraft((prev) => ({ ...prev, evidenceType: value }))} />
            <SelectField label="MIME Type" value={evidenceDraft.mimeType} values={['application/pdf', 'image/png', 'image/jpeg']} onChange={(value) => setEvidenceDraft((prev) => ({ ...prev, mimeType: value }))} />
            <Field label="File Name" value={evidenceDraft.fileName} onChange={(value) => setEvidenceDraft((prev) => ({ ...prev, fileName: value }))} required />
            <Field label="Size (bytes)" value={evidenceDraft.sizeBytes} onChange={(value) => setEvidenceDraft((prev) => ({ ...prev, sizeBytes: value }))} required />
            <Field label="Notes" value={evidenceDraft.notes} onChange={(value) => setEvidenceDraft((prev) => ({ ...prev, notes: value }))} wide />
            <Toggle label="Mark verified on upload" checked={evidenceDraft.markVerified} onChange={(checked) => setEvidenceDraft((prev) => ({ ...prev, markVerified: checked }))} />
          </div>
          <ModalActions onCancel={() => setEvidenceTarget(null)} onSave={uploadEvidence} busy={busy} label="Upload Evidence" />
        </Modal>
      ) : null}

      {beneficiaryTarget ? (
        <Modal title={`Beneficiary Linkage: ${beneficiaryTarget.fullName}`} onClose={() => setBeneficiaryTarget(null)}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Toggle label="Is Beneficiary" checked={beneficiaryDraft.isBeneficiary} onChange={(checked) => setBeneficiaryDraft((prev) => ({ ...prev, isBeneficiary: checked }))} />
            <Field label="Beneficiary %" value={beneficiaryDraft.beneficiaryPercentage} onChange={(value) => setBeneficiaryDraft((prev) => ({ ...prev, beneficiaryPercentage: value }))} disabled={!beneficiaryDraft.isBeneficiary} />
            <SelectField label="Benefit Category" value={beneficiaryDraft.benefitCategory} values={BENEFIT_CATEGORIES} onChange={(value) => setBeneficiaryDraft((prev) => ({ ...prev, benefitCategory: value }))} disabled={!beneficiaryDraft.isBeneficiary} />
            <Field label="Notes" value={beneficiaryDraft.notes} onChange={(value) => setBeneficiaryDraft((prev) => ({ ...prev, notes: value }))} wide />
          </div>
          <ModalActions onCancel={() => setBeneficiaryTarget(null)} onSave={saveBeneficiary} busy={busy} label="Save Beneficiary" />
        </Modal>
      ) : null}

      {auditOpen ? (
        <Modal title="Next of Kin Audit Trail" onClose={() => setAuditOpen(false)} width="max-w-4xl">
          <div className="max-h-[70vh] overflow-y-auto p-5">
            {auditState.loading ? <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">Loading audit trail...</div> : null}
            {auditState.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{auditState.error}</div> : null}
            {!auditState.loading && !auditState.error ? (
              <div className="space-y-3">
                {auditState.data
                  .filter((row) => row.action.toLowerCase().includes('kin') || row.action.toLowerCase().includes('evidence') || row.action.toLowerCase().includes('beneficiary'))
                  .slice(0, 80)
                  .map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-slate-950">{row.action}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {row.reason ? `${row.reason} · ` : ''}By {row.performedBy}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-slate-500">{formatDateTime(row.at)}</div>
                      </div>
                    </div>
                  ))}
                {auditState.data.length === 0 ? <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-600">No audit rows found.</div> : null}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border bg-white p-4 shadow-lg">
          <div className={`text-sm font-extrabold ${toast.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{toast.message}</div>
        </div>
      ) : null}
    </div>
  );
}

const Detail = ({ label, value, pill, wide }: { label: string; value: string; pill?: boolean; wide?: boolean }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-bold text-slate-900">{pill ? <StatusPill value={value} /> : value}</div>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  wide,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  wide?: boolean;
  disabled?: boolean;
}) => (
  <label className={`block ${wide ? 'lg:col-span-3' : ''}`}>
    <span className="text-[11px] font-extrabold uppercase text-slate-500">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-dle-blue disabled:bg-slate-50 disabled:text-slate-400"
    />
  </label>
);

const SelectField = ({
  label,
  value,
  values,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <label className="block">
    <span className="text-[11px] font-extrabold uppercase text-slate-500">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-dle-blue disabled:bg-slate-50 disabled:text-slate-400">
      {values.map((item) => (
        <option key={item || 'blank'} value={item}>
          {item || '--'}
        </option>
      ))}
    </select>
  </label>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-extrabold text-slate-800">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
    {label}
  </label>
);

const ModalActions = ({ onCancel, onSave, busy, label }: { onCancel: () => void; onSave: () => void | Promise<void>; busy: boolean; label: string }) => (
  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
    <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
      Cancel
    </button>
    <button type="button" onClick={() => void onSave()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-50">
      <BadgeCheck className="h-4 w-4" />
      {busy ? 'Saving...' : label}
    </button>
  </div>
);
