'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileClock,
  FileDown,
  FilePlus2,
  Filter,
  Flame,
  Info,
  Layers,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Department Head'
  | 'Line Manager'
  | 'Payroll Officer'
  | 'HSE Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management'
  | 'IT Administrator'
  | 'Legal Officer';

type Severity = 'high' | 'medium' | 'low';

type Visibility = 'HR Only' | 'Manager Visible' | 'Employee Visible' | 'Audit Only' | 'Executive Visible';

type EventCategory =
  | 'Employment'
  | 'Job Information'
  | 'Department Assignment'
  | 'Reporting Line'
  | 'Contract'
  | 'Status Change'
  | 'Emergency Contact'
  | 'Next of Kin'
  | 'Documents'
  | 'Leave'
  | 'Attendance'
  | 'Payroll'
  | 'Performance'
  | 'Training'
  | 'Assets'
  | 'Disciplinary'
  | 'Medical / HSE'
  | 'Compliance'
  | 'System Access'
  | 'Audit';

type ApprovalStatus = 'Not Applicable' | 'Pending' | 'Approved' | 'Rejected';

type TimelineEvent = {
  id: string;
  employeeId: string;
  eventReferenceNo: string;
  eventCategory: EventCategory;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  eventDate: string;
  effectiveDate?: string | null;
  sourceModule: string;
  sourceRecordId?: string | null;
  relatedWorkflowId?: string | null;
  relatedDocumentId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  severity: Severity;
  visibility: Visibility;
  isSystemGenerated: boolean;
  approvalStatus: ApprovalStatus;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimelineSummary = {
  total: number;
  byCategory: Record<string, number>;
  lastActivityAt: string | null;
  lastUpdatedAt: string;
};

type TimelineAnalytics = {
  byCategory: Array<{ category: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  approvalDelays: Array<{ bucket: string; count: number }>;
  highRisk: Array<{ severity: Severity; count: number }>;
  lastUpdatedAt: string;
};

type AIInsight = {
  id: string;
  severity: Severity;
  confidence: number;
  title: string;
  recommendation: string;
  eventId?: string | null;
  actionLabel: string;
  action: string;
};

type TimelineEventComment = {
  id: string;
  eventId: string;
  at: string;
  by: string;
  comment: string;
};

type EventDetailsResponse = { event: TimelineEvent; comments: TimelineEventComment[] };

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

const severityStyle = (s: Severity) => {
  if (s === 'high') return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800', icon: Flame };
  if (s === 'medium') return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800', icon: AlertTriangle };
  return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800', icon: Info };
};

const statusPill = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v.includes('approved') || v.includes('verified') || v.includes('compliant')) return { border: 'border-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-800' };
  if (v.includes('pending') || v.includes('draft') || v.includes('in review')) return { border: 'border-amber-200', bg: 'bg-amber-50', fg: 'text-amber-800' };
  if (v.includes('rejected') || v.includes('expired') || v.includes('failed') || v.includes('denied')) return { border: 'border-red-200', bg: 'bg-red-50', fg: 'text-red-800' };
  return { border: 'border-slate-200', bg: 'bg-slate-100', fg: 'text-slate-700' };
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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json().catch(() => null)) as { status?: string; data?: T; error?: string } | null;
    if (!res.ok || !json || json.status !== 'success') throw new Error(json?.error || 'Request failed');
    return json.data as T;
  }
  if (!res.ok) throw new Error('Request failed');
  return (null as unknown) as T;
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

const DrawerShell = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-slate-900/40" onClick={onClose} />
    <motion.div
      initial={{ x: 420 }}
      animate={{ x: 0 }}
      exit={{ x: 420 }}
      className="fixed z-[95] top-0 right-0 h-full w-[520px] max-w-[100vw] bg-white border-l border-slate-200 shadow-2xl"
      role="dialog"
      aria-modal="true"
    >
      <div className="p-5 border-b border-slate-200/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs font-semibold text-slate-600 mt-1">{subtitle}</div> : null}
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
          <X className="w-4 h-4 text-slate-800" />
        </button>
      </div>
      <div className="p-5 overflow-auto h-[calc(100vh-74px)]">{children}</div>
    </motion.div>
  </AnimatePresence>
);

const categoryIcon = (c: EventCategory) => {
  if (c === 'Employment' || c === 'Job Information' || c === 'Department Assignment' || c === 'Reporting Line') return BriefcaseBusiness;
  if (c === 'Documents') return FileClock;
  if (c === 'Compliance' || c === 'Audit') return ShieldCheck;
  if (c === 'Training') return Layers;
  if (c === 'Payroll') return BadgeCheck;
  if (c === 'Attendance' || c === 'Leave') return CalendarClock;
  return Activity;
};

const bucketLabel = (eventIso: string, baseNowIso: string) => {
  const ms = new Date(eventIso).getTime();
  const nowMs = new Date(baseNowIso).getTime();
  if (!Number.isFinite(ms) || !Number.isFinite(nowMs)) return 'Older';
  const e = new Date(ms);
  const n = new Date(nowMs);
  const sameDay = e.getUTCFullYear() === n.getUTCFullYear() && e.getUTCMonth() === n.getUTCMonth() && e.getUTCDate() === n.getUTCDate();
  if (sameDay) return 'Today';
  const diffDays = Math.floor((nowMs - ms) / (24 * 3600 * 1000));
  if (diffDays >= 0 && diffDays <= 7) return 'This Week';
  const sameMonth = e.getUTCFullYear() === n.getUTCFullYear() && e.getUTCMonth() === n.getUTCMonth();
  if (sameMonth) return 'This Month';
  const q = Math.floor(e.getUTCMonth() / 3);
  const qNow = Math.floor(n.getUTCMonth() / 3);
  if (e.getUTCFullYear() === n.getUTCFullYear() && q === qNow) return 'This Quarter';
  if (e.getUTCFullYear() === n.getUTCFullYear()) return 'This Year';
  return 'Older';
};

export default function EmployeeTimelineClient({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('HR Manager');
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | undefined>(undefined);

  const [activeEmployeeId, setActiveEmployeeId] = useState(employeeId);
  const [refreshToken, setRefreshToken] = useState(0);

  const [employeesState, setEmployeesState] = useState<ApiState<ReportingLineFormOptions>>({ status: 'loading' });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [eventsState, setEventsState] = useState<ApiState<TimelineEvent[]>>({ status: 'loading' });
  const [summaryState, setSummaryState] = useState<ApiState<TimelineSummary>>({ status: 'loading' });
  const [analyticsState, setAnalyticsState] = useState<ApiState<TimelineAnalytics>>({ status: 'loading' });
  const [insightsState, setInsightsState] = useState<ApiState<AIInsight[]>>({ status: 'loading' });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [severityFilter, setSeverityFilter] = useState<string>('All Severities');
  const [moduleFilter, setModuleFilter] = useState<string>('All Modules');
  const [approvalFilter, setApprovalFilter] = useState<string>('All Approval');
  const [createdByFilter, setCreatedByFilter] = useState<string>('All Creators');
  const [systemFilter, setSystemFilter] = useState<'all' | 'system' | 'user'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expandedAll, setExpandedAll] = useState(false);

  const [drawerEvent, setDrawerEvent] = useState<TimelineEvent | null>(null);
  const [eventDetailsState, setEventDetailsState] = useState<ApiState<EventDetailsResponse>>({ status: 'idle' });
  const [newComment, setNewComment] = useState('');

  const [manualOpen, setManualOpen] = useState(false);
  const [manualCategory, setManualCategory] = useState<EventCategory>('Audit');
  const [manualType, setManualType] = useState<string>('Manual Note');
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualSeverity, setManualSeverity] = useState<Severity>('low');
  const [manualVisibility, setManualVisibility] = useState<Visibility>('HR Only');
  const [manualEventDate, setManualEventDate] = useState<string>(initialNow.slice(0, 10));
  const [manualEffectiveDate, setManualEffectiveDate] = useState<string>('');
  const [manualAttachment, setManualAttachment] = useState<File | null>(null);
  const manualAttachmentRef = useRef<HTMLInputElement | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xls' | 'pdf'>('csv');
  const [exportMode, setExportMode] = useState<'all' | 'filtered'>('filtered');

  const nowStamp = useMemo(() => formatDateTimeUtc(initialNow), [initialNow]);
  const viewer = useMemo(() => (role === 'Employee' ? activeEmployeeId : viewerEmployeeId), [role, activeEmployeeId, viewerEmployeeId]);

  const beginEmployeesFetch = () => setEmployeesState({ status: 'loading' });
  const beginTimelineFetch = () => {
    setEventsState({ status: 'loading' });
    setSummaryState({ status: 'loading' });
    setAnalyticsState({ status: 'loading' });
    setInsightsState({ status: 'loading' });
  };
  const refreshAll = () => {
    beginTimelineFetch();
    setRefreshToken((n) => n + 1);
  };

  useEffect(() => {
    apiFetchModule<ReportingLineFormOptions>(`/api/hris/reporting-line/form-options?includeEmployees=1`, { method: 'GET', role, viewerEmployeeId: viewer })
      .then((data) => setEmployeesState({ status: 'ready', data }))
      .catch((e) => setEmployeesState({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load employees' }));
  }, [role, viewer]);

  useEffect(() => {
    void Promise.all([
      apiFetchEmployee<TimelineEvent[]>(activeEmployeeId, 'timeline', { method: 'GET', role, viewerEmployeeId: viewer }),
      apiFetchEmployee<TimelineSummary>(activeEmployeeId, 'timeline/summary', { method: 'GET', role, viewerEmployeeId: viewer }),
      apiFetchEmployee<TimelineAnalytics>(activeEmployeeId, 'timeline/analytics', { method: 'GET', role, viewerEmployeeId: viewer }),
      apiFetchEmployee<AIInsight[]>(activeEmployeeId, 'timeline/ai-insights', { method: 'GET', role, viewerEmployeeId: viewer }).catch(() => [] as AIInsight[]),
    ])
      .then(([events, summary, analytics, insights]) => {
        setEventsState({ status: 'ready', data: events });
        setSummaryState({ status: 'ready', data: summary });
        setAnalyticsState({ status: 'ready', data: analytics });
        setInsightsState({ status: 'ready', data: insights });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Failed to load timeline';
        setEventsState({ status: 'error', error: msg });
        setSummaryState({ status: 'error', error: msg });
        setAnalyticsState({ status: 'error', error: msg });
        setInsightsState({ status: 'ready', data: [] });
      });
  }, [activeEmployeeId, refreshToken, role, viewer]);

  const employees = useMemo(() => employeesState.data?.employees || [], [employeesState.data]);
  const activeEmployee = useMemo(() => employees.find((e) => e.employeeId === activeEmployeeId) || null, [employees, activeEmployeeId]);

  const allEvents = useMemo(() => eventsState.data || [], [eventsState.data]);
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) if (e.eventType) set.add(e.eventType);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).slice(0, 200);
  }, [allEvents]);
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) if (e.sourceModule) set.add(e.sourceModule);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).slice(0, 100);
  }, [allEvents]);
  const availableCreators = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) if (e.createdBy) set.add(e.createdBy);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).slice(0, 120);
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : NaN;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : NaN;
    const match = (e: TimelineEvent) => {
      if (categoryFilter !== 'All Categories' && e.eventCategory !== categoryFilter) return false;
      if (typeFilter !== 'All Types' && e.eventType !== typeFilter) return false;
      if (severityFilter !== 'All Severities' && e.severity !== severityFilter) return false;
      if (moduleFilter !== 'All Modules' && e.sourceModule !== moduleFilter) return false;
      if (approvalFilter !== 'All Approval' && e.approvalStatus !== approvalFilter) return false;
      if (createdByFilter !== 'All Creators' && e.createdBy !== createdByFilter) return false;
      if (systemFilter === 'system' && !e.isSystemGenerated) return false;
      if (systemFilter === 'user' && e.isSystemGenerated) return false;
      const ms = new Date(e.eventDate).getTime();
      if (Number.isFinite(fromMs) && Number.isFinite(ms) && ms < fromMs) return false;
      if (Number.isFinite(toMs) && Number.isFinite(ms) && ms > toMs) return false;
      return true;
    };
    const out = allEvents.filter(match);
    out.sort((a, b) => (a.eventDate < b.eventDate ? (sortDir === 'desc' ? 1 : -1) : a.eventDate > b.eventDate ? (sortDir === 'desc' ? -1 : 1) : 0));
    return out;
  }, [allEvents, categoryFilter, typeFilter, severityFilter, moduleFilter, approvalFilter, createdByFilter, systemFilter, dateFrom, dateTo, sortDir]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filteredEvents) {
      const b = bucketLabel(e.eventDate, initialNow);
      const cur = map.get(b) || [];
      cur.push(e);
      map.set(b, cur);
    }
    const order = ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'Older'];
    return order.map((k) => ({ bucket: k, events: (map.get(k) || []).slice(0, 800) })).filter((x) => x.events.length);
  }, [filteredEvents, initialNow]);

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="text-slate-700 font-extrabold">HRIS</span>
      <ChevronRight className="w-4 h-4" />
      <span className="text-slate-700 font-extrabold">Employees</span>
      <ChevronRight className="w-4 h-4" />
      <span>Employee Timeline</span>
    </div>
  );

  const openEmployee = (id: string) => {
    const next = id.toUpperCase();
    beginTimelineFetch();
    setActiveEmployeeId(next);
    setSelectorOpen(false);
    setDrawerEvent(null);
    router.push(`/hris/employees/employee-timeline/${encodeURIComponent(next)}`);
  };

  const openDrawer = (e: TimelineEvent) => {
    setDrawerEvent(e);
    setEventDetailsState({ status: 'loading' });
    setNewComment('');
    apiFetchModule<EventDetailsResponse>(`/api/hris/timeline/${encodeURIComponent(e.id)}`, { method: 'GET', role, viewerEmployeeId: viewer })
      .then((data) => setEventDetailsState({ status: 'ready', data }))
      .catch((err) => setEventDetailsState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load event details' }));
  };

  const addComment = async () => {
    if (!drawerEvent) return;
    const c = newComment.trim();
    if (!c) return;
    try {
      await apiFetchModule(`/api/hris/timeline/${encodeURIComponent(drawerEvent.id)}/comment`, {
        method: 'POST',
        role,
        viewerEmployeeId: viewer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment: c }),
      });
      setNewComment('');
      const updated = await apiFetchModule<EventDetailsResponse>(`/api/hris/timeline/${encodeURIComponent(drawerEvent.id)}`, { method: 'GET', role, viewerEmployeeId: viewer });
      setEventDetailsState({ status: 'ready', data: updated });
    } catch (e) {
      setEventDetailsState({ status: 'error', error: e instanceof Error ? e.message : 'Comment failed' });
    }
  };

  const submitManualEvent = async () => {
    const title = manualTitle.trim();
    const desc = manualDescription.trim();
    if (!title) return;
    if (!manualEventDate) return;
    const attachment = manualAttachment
      ? { fileName: manualAttachment.name, mimeType: manualAttachment.type || 'application/octet-stream', sizeBytes: manualAttachment.size }
      : null;
    await apiFetchEmployee<TimelineEvent>(activeEmployeeId, 'timeline/manual-event', {
      method: 'POST',
      role,
      viewerEmployeeId: viewer,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventCategory: manualCategory,
        eventType: manualType,
        eventTitle: title,
        eventDescription: desc,
        eventDate: manualEventDate,
        effectiveDate: manualEffectiveDate || null,
        severity: manualSeverity,
        visibility: manualVisibility,
        relatedModule: 'Manual',
        attachment,
      }),
    });
    setManualOpen(false);
    setManualTitle('');
    setManualDescription('');
    setManualType('Manual Note');
    setManualSeverity('low');
    setManualVisibility('HR Only');
    setManualEventDate(initialNow.slice(0, 10));
    setManualEffectiveDate('');
    setManualAttachment(null);
    if (manualAttachmentRef.current) manualAttachmentRef.current.value = '';
    refreshAll();
  };

  const exportTimeline = () => {
    const url = new URL(`/api/hris/employees/${encodeURIComponent(activeEmployeeId)}/timeline/export`, window.location.origin);
    url.searchParams.set('format', exportFormat);
    if (exportMode === 'filtered') {
      if (categoryFilter !== 'All Categories') url.searchParams.set('category', categoryFilter);
      if (typeFilter !== 'All Types') url.searchParams.set('type', typeFilter);
      if (severityFilter !== 'All Severities') url.searchParams.set('severity', severityFilter);
      if (moduleFilter !== 'All Modules') url.searchParams.set('module', moduleFilter);
      if (approvalFilter !== 'All Approval') url.searchParams.set('approval', approvalFilter);
      if (createdByFilter !== 'All Creators') url.searchParams.set('createdBy', createdByFilter);
      if (systemFilter !== 'all') url.searchParams.set('system', systemFilter);
      if (dateFrom) url.searchParams.set('from', dateFrom);
      if (dateTo) url.searchParams.set('to', dateTo);
      url.searchParams.set('sort', sortDir);
    }
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const selectorMatches = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 80);
    return employees
      .filter((e) => {
        const hay = `${e.employeeId} ${e.fullName} ${e.department || ''} ${e.jobTitle || ''} ${e.currentManager || ''} ${e.location || ''} ${e.businessUnit || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 140);
  }, [employees, selectorQuery]);

  const summaryCards = useMemo(() => {
    const s = summaryState.data;
    const fallbackBy = (key: string) => (s?.byCategory && typeof s.byCategory[key] === 'number' ? s.byCategory[key] : 0);
    const total = s?.total ?? filteredEvents.length;
    const lastActivityAt = s?.lastActivityAt ?? (filteredEvents[0]?.eventDate || null);
    return [
      { label: 'Total Timeline Events', value: total, detail: 'All visible events', icon: Activity, tone: total > 0 ? ('ok' as const) : ('warn' as const) },
      { label: 'Employment Events', value: fallbackBy('Employment'), detail: 'Lifecycle & job-related', icon: BriefcaseBusiness, tone: 'default' as const },
      { label: 'Document Events', value: fallbackBy('Documents'), detail: 'Upload/verify/expiry', icon: FileClock, tone: 'default' as const },
      { label: 'Leave Events', value: fallbackBy('Leave'), detail: 'Requests & approvals', icon: CalendarClock, tone: 'default' as const },
      { label: 'Attendance Events', value: fallbackBy('Attendance'), detail: 'Exceptions & logs', icon: Clock, tone: 'default' as const },
      { label: 'Payroll Events', value: fallbackBy('Payroll'), detail: 'Payroll-impacting', icon: BadgeCheck, tone: 'default' as const },
      { label: 'Performance Events', value: fallbackBy('Performance'), detail: 'Reviews & ratings', icon: BadgeCheck, tone: 'default' as const },
      { label: 'Training Events', value: fallbackBy('Training'), detail: 'Training/certification', icon: Layers, tone: 'default' as const },
      { label: 'Asset Events', value: fallbackBy('Assets'), detail: 'Assignments & returns', icon: Layers, tone: 'default' as const },
      { label: 'Compliance Events', value: fallbackBy('Compliance') + fallbackBy('Audit'), detail: 'Checks & audit flags', icon: ShieldCheck, tone: 'default' as const },
      { label: 'Last Activity Date', value: lastActivityAt ? formatDateUtc(lastActivityAt) : '—', detail: 'Most recent event', icon: CalendarClock, tone: lastActivityAt ? ('ok' as const) : ('warn' as const) },
    ];
  }, [summaryState.data, filteredEvents]);

  const header = (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-11 h-11 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
              <Activity className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-slate-900">Employee Timeline</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">
                View the complete chronological record of employee lifecycle events, HR activities, approvals, documents, attendance, payroll, performance, and compliance milestones.
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Pill label={`Employee: ${activeEmployeeId}`} />
            <Pill label={`Loaded: ${nowStamp}`} />
            {activeEmployee?.fullName ? <Pill label={`Name: ${activeEmployee.fullName}`} /> : null}
            {activeEmployee?.department ? <Pill label={`Dept: ${activeEmployee.department}`} /> : null}
            {activeEmployee?.jobTitle ? <Pill label={`Role: ${activeEmployee.jobTitle}`} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <HeaderButton label="Add Timeline Event" tone="primary" icon={FilePlus2} onClick={() => setManualOpen(true)} />
          <HeaderButton label="Export Timeline" tone="dark" icon={Download} onClick={() => setExportOpen(true)} disabled={eventsState.status !== 'ready'} />
          <HeaderButton label="Print Timeline" tone="secondary" icon={Printer} onClick={() => window.print()} disabled={eventsState.status !== 'ready'} />
          <HeaderButton label="Generate Employee History Report" tone="secondary" icon={FileDown} onClick={() => window.open(`/api/hris/employees/${encodeURIComponent(activeEmployeeId)}/timeline/export?format=pdf`, '_blank', 'noopener,noreferrer')} />
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
                setDrawerEvent(null);
                beginEmployeesFetch();
                beginTimelineFetch();
                setRole(e.target.value as Role);
              }}
              className="text-xs font-extrabold text-slate-900 bg-transparent outline-none"
            >
              {[
                'HR Manager',
                'HR Officer',
                'HR Director',
                'Department Head',
                'Line Manager',
                'Payroll Officer',
                'HSE Officer',
                'Compliance Officer',
                'Auditor',
                'Executive Management',
                'Employee',
                'Super Admin',
                'Admin Officer',
                'IT Administrator',
                'Legal Officer',
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
                setDrawerEvent(null);
                beginEmployeesFetch();
                beginTimelineFetch();
                setViewerEmployeeId(e.target.value.trim() || undefined);
              }}
              placeholder="Optional"
              className="w-[180px] max-w-[60vw] text-xs font-extrabold text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {sortDir === 'desc' ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpWideNarrow className="w-4 h-4" />}
            {sortDir === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
          <button
            type="button"
            onClick={() => setExpandedAll((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <Layers className="w-4 h-4" />
            {expandedAll ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('All Categories');
              setTypeFilter('All Types');
              setSeverityFilter('All Severities');
              setModuleFilter('All Modules');
              setApprovalFilter('All Approval');
              setCreatedByFilter('All Creators');
              setSystemFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Pill label={`Visible events: ${formatNumber(filteredEvents.length)}`} />
        {categoryFilter !== 'All Categories' ? <Pill label={`Category: ${categoryFilter}`} /> : null}
        {typeFilter !== 'All Types' ? <Pill label={`Type: ${typeFilter}`} /> : null}
        {moduleFilter !== 'All Modules' ? <Pill label={`Module: ${moduleFilter}`} /> : null}
        {severityFilter !== 'All Severities' ? <Pill label={`Severity: ${severityFilter}`} /> : null}
      </div>
    </Card>
  );

  const aiPanel = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">AI Timeline Intelligence</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Detects gaps and inconsistencies across modules and approvals.</div>
          </div>
        </div>
        <button type="button" onClick={refreshAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insightsState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading insights…</div>
        ) : (insightsState.data || []).length ? (
          (insightsState.data || []).slice(0, 10).map((ins) => {
            const st = severityStyle(ins.severity);
            const Icon = st.icon;
            return (
              <div key={ins.id} className={`rounded-2xl border ${st.border} ${st.bg} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-xs font-extrabold ${st.fg}`}>
                      {ins.severity.toUpperCase()} • {Math.round(ins.confidence * 100)}% confidence
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">{ins.title}</div>
                    <div className="text-xs font-semibold text-slate-700 mt-2">{ins.recommendation}</div>
                    {ins.eventId ? (
                      <div className="mt-2 text-[11px] font-extrabold text-slate-700">
                        Event ref: <span className="text-slate-900">{ins.eventId}</span>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (ins.eventId) {
                        const ev = allEvents.find((e) => e.id === ins.eventId) || null;
                        if (ev) openDrawer(ev);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    <Icon className="w-4 h-4" />
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

  const timelineView = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <Activity className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Chronological Timeline</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Grouped by time bucket; sorted {sortDir === 'desc' ? 'newest' : 'oldest'} first.</div>
          </div>
        </div>
        <button type="button" onClick={() => setExportOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
          <FileDown className="w-4 h-4" />
          Export Current View
        </button>
      </div>
      <div className="mt-4">
        {eventsState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading timeline…</div>
        ) : eventsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">{eventsState.error || 'Failed to load timeline'}</div>
        ) : !filteredEvents.length ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">No timeline events match the selected filters.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.bucket}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-extrabold text-slate-700">{g.bucket}</div>
                  <div className="text-[11px] font-extrabold text-slate-500">{formatNumber(g.events.length)} event(s)</div>
                </div>
                <div className="mt-3 space-y-3">
                  {g.events.slice(0, 250).map((e) => {
                    const st = severityStyle(e.severity);
                    const Icon = categoryIcon(e.eventCategory);
                    const SevIcon = st.icon;
                    const ap = statusPill(e.approvalStatus);
                    const cat = statusPill(e.eventCategory);
                    const expanded = expandedAll;
                    return (
                      <div key={e.id} className={`rounded-2xl border ${st.border} bg-white`}>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-dle-blue">
                                  <Icon className="w-5 h-5" />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-slate-900 break-words">{e.eventTitle}</div>
                                  <div className="text-xs font-semibold text-slate-600 mt-1">
                                    {e.eventType} • {formatDateTimeUtc(e.eventDate)} • Module: <span className="font-extrabold text-slate-800">{e.sourceModule}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold ${cat.border} ${cat.bg} ${cat.fg}`}>
                                  <Layers className="w-4 h-4" />
                                  {e.eventCategory}
                                </span>
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>
                                  <SevIcon className="w-4 h-4" />
                                  {e.severity.toUpperCase()}
                                </span>
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold ${ap.border} ${ap.bg} ${ap.fg}`}>
                                  <BadgeCheck className="w-4 h-4" />
                                  {e.approvalStatus}
                                </span>
                                <Pill label={e.isSystemGenerated ? 'System Generated' : 'User Generated'} />
                                {e.relatedDocumentId ? <Pill label={`Doc: ${e.relatedDocumentId}`} /> : null}
                                {e.relatedWorkflowId ? <Pill label={`WF: ${e.relatedWorkflowId}`} /> : null}
                              </div>
                              <div className="mt-3 text-xs font-semibold text-slate-700">{expanded ? e.eventDescription : `${e.eventDescription.slice(0, 160)}${e.eventDescription.length > 160 ? '…' : ''}`}</div>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Created By</div>
                                  <div className="text-xs font-extrabold text-slate-900 mt-1">{e.createdBy}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Approved By</div>
                                  <div className="text-xs font-extrabold text-slate-900 mt-1">{e.approvedBy || '—'}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Effective Date</div>
                                  <div className="text-xs font-extrabold text-slate-900 mt-1">{formatDateUtc(e.effectiveDate || null)}</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button type="button" onClick={() => openDrawer(e)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                                <ExternalLink className="w-4 h-4" />
                                View Details
                              </button>
                              {e.relatedDocumentId ? (
                                <a
                                  href={`/api/hris/documents/${encodeURIComponent(e.relatedDocumentId)}/download`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                                >
                                  <Download className="w-4 h-4" />
                                  Download Document
                                </a>
                              ) : null}
                              {e.sourceModule === 'Documents' && e.sourceRecordId ? (
                                <a
                                  href={`/api/hris/documents/${encodeURIComponent(e.sourceRecordId)}/preview`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                                >
                                  <FileClock className="w-4 h-4" />
                                  Open Record
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  const analyticsPanel = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-slate-900">Timeline Analytics</div>
            <div className="text-xs font-semibold text-slate-600 mt-1">Distribution, trends, and high-risk signals (lightweight analytics).</div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        {analyticsState.status === 'loading' ? (
          <div className="text-xs font-semibold text-slate-600">Loading analytics…</div>
        ) : analyticsState.status === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">{analyticsState.error}</div>
        ) : analyticsState.data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold text-slate-900">Events by Category</div>
              <div className="mt-3 space-y-2">
                {analyticsState.data.byCategory.slice(0, 12).map((r) => (
                  <div key={r.category} className="flex items-center gap-3">
                    <div className="w-36 text-[11px] font-extrabold text-slate-700 truncate">{r.category}</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-dle-blue" style={{ width: `${Math.min(100, Math.round((r.count / Math.max(1, analyticsState.data!.byCategory[0]?.count || r.count)) * 100))}%` }} />
                    </div>
                    <div className="w-12 text-[11px] font-extrabold text-slate-700 text-right">{formatNumber(r.count)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold text-slate-900">Events by Month</div>
              <div className="mt-3 space-y-2">
                {analyticsState.data.byMonth.slice(0, 12).map((r) => (
                  <div key={r.month} className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-extrabold text-slate-700">{r.month}</div>
                    <div className="text-[11px] font-extrabold text-slate-900">{formatNumber(r.count)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">High-Risk Events</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {analyticsState.data.highRisk.map((r) => (
                    <Pill key={r.severity} label={`${r.severity.toUpperCase()}: ${formatNumber(r.count)}`} tone={r.severity === 'high' ? 'err' : r.severity === 'medium' ? 'warn' : 'ok'} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    <div className="bg-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {breadcrumbs}
        {header}
        {toolbar}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">{c.label}</div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{typeof c.value === 'number' ? formatNumber(c.value) : c.value}</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">{c.detail}</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Pill label={`Updated: ${formatDateUtc(initialNow)}`} />
                      <Pill label={c.tone === 'ok' ? 'Healthy' : c.tone === 'warn' ? 'Watch' : 'Info'} tone={c.tone} />
                    </div>
                  </div>
                  <span className="w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-dle-blue">
                    <Icon className="w-5 h-5" />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {timelineView}
          </div>
          <div className="space-y-4">
            {aiPanel}
            {analyticsPanel}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-dle-blue/10 border border-slate-200/60 flex items-center justify-center text-dle-blue">
                    <FileClock className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Export / Print</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">CSV, Excel, PDF, and printable timeline view.</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setExportOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <FileDown className="w-4 h-4" />
                  Export
                </button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {selectorOpen ? (
        <ModalShell title="Employee Selector" subtitle="Search by ID, name, department, job title, manager, location, employment status." onClose={() => setSelectorOpen(false)} widthClass="w-[980px]">
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

      {filtersOpen ? (
        <ModalShell title="Timeline Filters" subtitle="Filter by category, type, date range, approval status, creator, module, severity, and system flag." onClose={() => setFiltersOpen(false)} widthClass="w-[980px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Category</div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Categories">All Categories</option>
                {(
                  [
                    'Employment',
                    'Job Information',
                    'Department Assignment',
                    'Reporting Line',
                    'Contract',
                    'Status Change',
                    'Emergency Contact',
                    'Next of Kin',
                    'Documents',
                    'Leave',
                    'Attendance',
                    'Payroll',
                    'Performance',
                    'Training',
                    'Assets',
                    'Disciplinary',
                    'Medical / HSE',
                    'Compliance',
                    'System Access',
                    'Audit',
                  ] as EventCategory[]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Type</div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Types">All Types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Date Range</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Source Module</div>
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Modules">All Modules</option>
                {availableModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Approval Status</div>
              <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Approval">All Approval</option>
                {(['Not Applicable', 'Pending', 'Approved', 'Rejected'] as ApprovalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Created By</div>
              <select value={createdByFilter} onChange={(e) => setCreatedByFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Creators">All Creators</option>
                {availableCreators.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Severity</div>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="All Severities">All Severities</option>
                {(['high', 'medium', 'low'] as Severity[]).map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">System/User</div>
              <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value as any)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="all">All</option>
                <option value="system">System Generated</option>
                <option value="user">User Generated</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                <Filter className="w-4 h-4" />
                Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('All Categories');
                  setTypeFilter('All Types');
                  setSeverityFilter('All Severities');
                  setModuleFilter('All Modules');
                  setApprovalFilter('All Approval');
                  setCreatedByFilter('All Creators');
                  setSystemFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
            <div className="text-xs font-semibold text-slate-600">Filtered events: {formatNumber(filteredEvents.length)}</div>
          </div>
        </ModalShell>
      ) : null}

      {manualOpen ? (
        <ModalShell title="Add Manual Timeline Event" subtitle="Manual events are clearly marked and audited. Sensitive visibility is permission controlled." onClose={() => setManualOpen(false)} widthClass="w-[980px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Category</div>
              <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value as EventCategory)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                {(
                  [
                    'Employment',
                    'Job Information',
                    'Department Assignment',
                    'Reporting Line',
                    'Contract',
                    'Status Change',
                    'Emergency Contact',
                    'Next of Kin',
                    'Documents',
                    'Leave',
                    'Attendance',
                    'Payroll',
                    'Performance',
                    'Training',
                    'Assets',
                    'Disciplinary',
                    'Medical / HSE',
                    'Compliance',
                    'System Access',
                    'Audit',
                  ] as EventCategory[]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Type</div>
              <input value={manualType} onChange={(e) => setManualType(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Title</div>
              <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Manual timeline note title" className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900 placeholder:text-slate-400" />
            </div>
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Description</div>
              <textarea value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} rows={4} placeholder="Describe the event, context, and any supporting notes." className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Date</div>
              <input type="date" value={manualEventDate} onChange={(e) => setManualEventDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Effective Date</div>
              <input type="date" value={manualEffectiveDate} onChange={(e) => setManualEffectiveDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Severity</div>
              <select value={manualSeverity} onChange={(e) => setManualSeverity(e.target.value as Severity)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                {(['high', 'medium', 'low'] as Severity[]).map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Visibility</div>
              <select value={manualVisibility} onChange={(e) => setManualVisibility(e.target.value as Visibility)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                {(['HR Only', 'Manager Visible', 'Employee Visible', 'Audit Only', 'Executive Visible'] as Visibility[]).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Attachment (metadata only)</div>
              <input ref={manualAttachmentRef} type="file" onChange={(e) => setManualAttachment(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs font-semibold text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:text-xs file:font-extrabold file:text-slate-700 hover:file:bg-slate-50" />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-semibold text-slate-600">Employee: {activeEmployeeId}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setManualOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button type="button" onClick={() => void submitManualEvent()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dle-blue bg-dle-blue text-white text-xs font-extrabold hover:bg-dle-blue/90">
                <UserPlus className="w-4 h-4" />
                Add Event
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {exportOpen ? (
        <ModalShell title="Export Timeline" subtitle="Export as CSV, Excel, or PDF. Choose all events or current filtered view." onClose={() => setExportOpen(false)} widthClass="w-[760px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Format</div>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="csv">CSV</option>
                <option value="xls">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Scope</div>
              <select value={exportMode} onChange={(e) => setExportMode(e.target.value as any)} className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900">
                <option value="filtered">Current View (Filtered)</option>
                <option value="all">All Visible Events</option>
              </select>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700">
            Export restrictions apply based on role and event visibility. Sensitive events may be excluded from exports.
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-semibold text-slate-600">Events: {formatNumber(exportMode === 'filtered' ? filteredEvents.length : allEvents.length)}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setExportOpen(false)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                <X className="w-4 h-4" />
                Close
              </button>
              <button type="button" onClick={exportTimeline} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-900 bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
                <FileDown className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {drawerEvent ? (
        <DrawerShell title="Event Details" subtitle={`${drawerEvent.eventCategory} • ${drawerEvent.eventType}`} onClose={() => setDrawerEvent(null)}>
          <div className="space-y-3">
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Reference</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{drawerEvent.eventReferenceNo}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Event Date</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">{formatDateTimeUtc(drawerEvent.eventDate)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Effective Date</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">{formatDateUtc(drawerEvent.effectiveDate || null)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Created By</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">{drawerEvent.createdBy}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Approved By</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">{drawerEvent.approvedBy || '—'}</div>
                </div>
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-700">{drawerEvent.eventDescription}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(() => {
                  const st = severityStyle(drawerEvent.severity);
                  const Icon = st.icon;
                  return (
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-extrabold ${st.border} ${st.bg} ${st.fg}`}>
                      <Icon className="w-4 h-4" />
                      {drawerEvent.severity.toUpperCase()}
                    </span>
                  );
                })()}
                {(() => {
                  const ap = statusPill(drawerEvent.approvalStatus);
                  return <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold ${ap.border} ${ap.bg} ${ap.fg}`}>{drawerEvent.approvalStatus}</span>;
                })()}
                <Pill label={`Module: ${drawerEvent.sourceModule}`} />
                <Pill label={drawerEvent.isSystemGenerated ? 'System' : 'Manual'} />
                <Pill label={`Visibility: ${drawerEvent.visibility}`} />
              </div>
            </Card>

            <div className="flex items-center gap-2 flex-wrap">
              {drawerEvent.relatedDocumentId ? (
                <a href={`/api/hris/documents/${encodeURIComponent(drawerEvent.relatedDocumentId)}/download`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                  <Download className="w-4 h-4" />
                  Download Document
                </a>
              ) : null}
              <button type="button" onClick={() => setExportOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                <FileDown className="w-4 h-4" />
                Export Timeline
              </button>
            </div>

            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide font-extrabold text-slate-500">Comments</div>
              <div className="mt-3 space-y-2">
                {eventDetailsState.status === 'loading' ? (
                  <div className="text-xs font-semibold text-slate-600">Loading comments…</div>
                ) : eventDetailsState.status === 'error' ? (
                  <div className="text-xs font-semibold text-red-800">{eventDetailsState.error}</div>
                ) : (eventDetailsState.data?.comments || []).length ? (
                  eventDetailsState.data!.comments.slice(0, 100).map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] font-extrabold text-slate-900">{c.by}</div>
                      <div className="text-[11px] font-semibold text-slate-500 mt-1">{formatDateTimeUtc(c.at)}</div>
                      <div className="text-xs font-semibold text-slate-700 mt-2">{c.comment}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs font-semibold text-slate-600">No comments yet.</div>
                )}
              </div>
              <div className="mt-3">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} placeholder="Add a comment/note…" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400" />
                <div className="mt-2 flex items-center justify-end">
                  <button type="button" onClick={() => void addComment()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-900 bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800">
                    <FilePlus2 className="w-4 h-4" />
                    Add Comment
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </DrawerShell>
      ) : null}
    </div>
  );
}
