'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Download,
  Fingerprint,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  TimerReset,
  Users,
} from 'lucide-react';
import type { StructureInsight } from '@/lib/organization-data';

type SiteHealth = 'Healthy' | 'Needs Attention' | 'Critical';
type SiteEscalationStatus = 'Normal Monitoring' | 'Supervisor Follow-Up' | 'HR Escalation' | 'Critical Response';

type SiteAttendanceRecord = {
  id: string;
  location: string;
  site: string;
  headcount: number;
  present: number;
  late: number;
  absent: number;
  remote: number;
  excused: number;
  attendanceRatePct: number;
  punctualityPct: number;
  overtimeHours: number;
  activeClockedIn: number;
  clockExceptions: number;
  biometricStatus: string;
  biometricSync: string;
  mobilePolicy: string;
  mobilePunches: number;
  riskyMobilePunches: number;
  escalationStatus: SiteEscalationStatus;
  actionOwner: string;
  transportRisk: 'Low' | 'Medium' | 'High';
  nextReviewAt: string;
  controlNote: string | null;
  health: SiteHealth;
  shiftCoverage: Array<{ shift: string; planned: number; present: number }>;
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
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canViewAudit: boolean;
  };
  summary: {
    sites: number;
    healthySites: number;
    attentionSites: number;
    criticalSites: number;
    attendanceRatePct: number;
    activeClockedIn: number;
    exceptions: number;
    riskyMobilePunches: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    healths: SiteHealth[];
    escalationStatuses: SiteEscalationStatus[];
  };
  sites: SiteAttendanceRecord[];
  insights: StructureInsight[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-NG');

const healthTone = (status: SiteHealth) => {
  if (status === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Needs Attention') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const escalationTone = (status: SiteEscalationStatus) => {
  if (status === 'Critical Response') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'HR Escalation' || status === 'Supervisor Follow-Up') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function SiteAttendanceClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [siteFilter, setSiteFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | SiteHealth>('All');
  const [escalationFilter, setEscalationFilter] = useState<'All' | SiteEscalationStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [escalationStatus, setEscalationStatus] = useState<SiteEscalationStatus>('Normal Monitoring');
  const [actionOwner, setActionOwner] = useState('');
  const [transportRisk, setTransportRisk] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [nextReviewAt, setNextReviewAt] = useState('');
  const [controlNote, setControlNote] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/attendance/site-attendance', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load site attendance');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.sites[0]?.id || null);

      if (data.permissions.canViewAudit) {
        const auditRes = await fetch('/api/hris/organization/audit-log?module=attendance&limit=10', {
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
      setError(e instanceof Error ? e.message : 'Unable to load site attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.sites || []).filter((site) => {
      if (locationFilter !== 'All' && site.location !== locationFilter) return false;
      if (siteFilter !== 'All' && site.site !== siteFilter) return false;
      if (healthFilter !== 'All' && site.health !== healthFilter) return false;
      if (escalationFilter !== 'All' && site.escalationStatus !== escalationFilter) return false;
      if (!q) return true;
      return [site.location, site.site, site.actionOwner, site.controlNote || ''].join(' ').toLowerCase().includes(q);
    });
  }, [payload?.sites, query, locationFilter, siteFilter, healthFilter, escalationFilter]);

  const selectedSite = useMemo(
    () => visibleSites.find((site) => site.id === selectedId) || visibleSites[0] || null,
    [visibleSites, selectedId],
  );

  useEffect(() => {
    if (!selectedSite && visibleSites.length) setSelectedId(visibleSites[0].id);
  }, [selectedSite, visibleSites]);

  useEffect(() => {
    if (!selectedSite) return;
    setEscalationStatus(selectedSite.escalationStatus);
    setActionOwner(selectedSite.actionOwner);
    setTransportRisk(selectedSite.transportRisk);
    setNextReviewAt(selectedSite.nextReviewAt.slice(0, 16));
    setControlNote(selectedSite.controlNote || '');
    setSubmitError(null);
  }, [selectedSite?.id]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      ['Location', 'Site', 'Headcount', 'Present', 'Late', 'Absent', 'Attendance Rate', 'Punctuality', 'Active Clocked In', 'Exceptions', 'Biometric', 'Mobile Policy', 'Escalation'],
      ...visibleSites.map((site) => [
        site.location,
        site.site,
        String(site.headcount),
        String(site.present),
        String(site.late),
        String(site.absent),
        String(site.attendanceRatePct),
        String(site.punctualityPct),
        String(site.activeClockedIn),
        String(site.clockExceptions),
        site.biometricStatus,
        site.mobilePolicy,
        site.escalationStatus,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-attendance.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveControl = async () => {
    if (!selectedSite) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/hris/attendance/site-attendance', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Attendance Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          siteControlId: selectedSite.id,
          escalationStatus,
          actionOwner,
          transportRisk,
          nextReviewAt: new Date(nextReviewAt).toISOString(),
          controlNote: controlNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to update site attendance control');
      await load();
      setSelectedId(selectedSite.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to update site attendance control');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTemplate
      title="Site Attendance"
      description="Monitor attendance turnout, shift coverage, open clocking sessions, exceptions, and control posture at each operational site."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Attendance', href: '/hris/attendance' },
        { label: 'Site Attendance' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Site Attendance Control Room</div>
          <div className="text-xs text-slate-500 mt-1">One operational view for attendance turnout, exceptions, device status, and site-level escalation ownership.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Actor: {payload?.permissions.actor || '—'}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Role: {payload?.permissions.role || '—'}</span>
          <span className={`px-2.5 py-1 rounded-full border font-semibold ${payload?.permissions.canEdit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {payload?.permissions.canEdit ? 'Controls Enabled' : 'Read Only'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={MapPin} label="Sites" value={payload ? formatNumber(payload.summary.sites) : '—'} detail="Attendance sites in scope" />
        <MetricCard icon={ShieldCheck} label="Healthy" value={payload ? formatNumber(payload.summary.healthySites) : '—'} detail="Sites within expected control range" />
        <MetricCard icon={AlertTriangle} label="Attention" value={payload ? formatNumber(payload.summary.attentionSites) : '—'} detail="Sites needing follow-up" />
        <MetricCard icon={AlertTriangle} label="Critical" value={payload ? formatNumber(payload.summary.criticalSites) : '—'} detail="Sites requiring escalation" />
        <MetricCard icon={Users} label="Active Clocked In" value={payload ? formatNumber(payload.summary.activeClockedIn) : '—'} detail="Open clocked-in sessions" />
        <MetricCard icon={TimerReset} label="Exceptions" value={payload ? formatNumber(payload.summary.exceptions) : '—'} detail="Clocking exceptions under review" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search site, location, owner, or note..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={siteFilter} onChange={(value) => setSiteFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.sites || [])]} labels={{ All: 'All Sites' }} />
        <Select value={healthFilter} onChange={(value) => setHealthFilter(value as 'All' | SiteHealth)} options={['All', ...(payload?.filterOptions.healths || [])]} labels={{ All: 'All Health Status' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[260px] gap-3">
          <Select value={escalationFilter} onChange={(value) => setEscalationFilter(value as 'All' | SiteEscalationStatus)} options={['All', ...(payload?.filterOptions.escalationStatuses || [])]} labels={{ All: 'All Escalation States' }} />
        </div>
        <div className="text-xs text-slate-500">
          Attendance rate: <span className="font-semibold text-slate-700">{payload ? `${payload.summary.attendanceRatePct}%` : '—'}</span>
          {' '}<span className="mx-2">•</span>
          Risky mobile punches: <span className="font-semibold text-slate-700">{payload ? formatNumber(payload.summary.riskyMobilePunches) : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Site Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Review turnout, exceptions, mobile activity, and escalation posture by site.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">Showing: {formatNumber(visibleSites.length)}</span>
          </div>
          <div className="p-4 space-y-3 min-h-[560px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading site attendance...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : visibleSites.length ? (
              visibleSites.map((site) => {
                const active = selectedSite?.id === site.id;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setSelectedId(site.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-dle-blue/30 bg-dle-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{site.site}</div>
                        <div className="text-xs text-slate-500 mt-1">{site.location}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(site.health)}`}>{site.health}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${escalationTone(site.escalationStatus)}`}>{site.escalationStatus}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Attendance: {site.attendanceRatePct}%</span>
                      <span>Punctuality: {site.punctualityPct}%</span>
                      <span>Exceptions: {formatNumber(site.clockExceptions)}</span>
                      <span>Mobile Risk: {formatNumber(site.riskyMobilePunches)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No sites match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Site Detail</div>
              <div className="text-xs text-slate-500 mt-1">Inspect attendance turnout, device posture, shift coverage, and site control ownership.</div>
            </div>
            <div className="p-5">
              {selectedSite ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedSite.health)}`}>{selectedSite.health}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${escalationTone(selectedSite.escalationStatus)}`}>{selectedSite.escalationStatus}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedSite.site}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedSite.location}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Headcount" value={formatNumber(selectedSite.headcount)} />
                    <DetailStat label="Present" value={formatNumber(selectedSite.present)} />
                    <DetailStat label="Late" value={formatNumber(selectedSite.late)} />
                    <DetailStat label="Absent" value={formatNumber(selectedSite.absent)} />
                    <DetailStat label="Remote" value={formatNumber(selectedSite.remote)} />
                    <DetailStat label="Excused" value={formatNumber(selectedSite.excused)} />
                    <DetailStat label="Attendance Rate" value={`${selectedSite.attendanceRatePct}%`} />
                    <DetailStat label="Punctuality" value={`${selectedSite.punctualityPct}%`} />
                    <DetailStat label="Open Sessions" value={formatNumber(selectedSite.activeClockedIn)} />
                    <DetailStat label="Exceptions" value={formatNumber(selectedSite.clockExceptions)} />
                    <DetailStat label="Biometric" value={`${selectedSite.biometricStatus} / ${selectedSite.biometricSync}`} />
                    <DetailStat label="Mobile Policy" value={selectedSite.mobilePolicy} />
                    <DetailStat label="Action Owner" value={selectedSite.actionOwner} />
                    <DetailStat label="Transport Risk" value={selectedSite.transportRisk} />
                    <DetailStat label="Next Review" value={formatDate(selectedSite.nextReviewAt)} />
                    <DetailStat label="Overtime Hours" value={`${selectedSite.overtimeHours}h`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Control Note</div>
                    <div className="text-sm text-slate-600 mt-2">{selectedSite.controlNote || 'No active control note recorded for this site.'}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-900">Shift Coverage</div>
                      <div className="text-xs text-slate-500 mt-1">Planned versus effectively present attendance by shift for the selected site.</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
                      {selectedSite.shiftCoverage.map((item) => (
                        <div key={item.shift} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-slate-900">{item.shift}</div>
                          <div className="text-xs text-slate-500 mt-1">Planned: {formatNumber(item.planned)}</div>
                          <div className="text-xs text-slate-500 mt-1">Present: {formatNumber(item.present)}</div>
                          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-dle-blue" style={{ width: `${item.planned ? Math.min(100, (item.present / item.planned) * 100) : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Site Control Actions</div>
                      <div className="text-xs text-slate-500 mt-1">Maintain site escalation ownership, transport risk, review timing, and control note.</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SelectField label="Escalation Status" value={escalationStatus} onChange={(value) => setEscalationStatus(value as SiteEscalationStatus)} options={['Normal Monitoring', 'Supervisor Follow-Up', 'HR Escalation', 'Critical Response']} />
                      <SelectField label="Transport Risk" value={transportRisk} onChange={(value) => setTransportRisk(value as 'Low' | 'Medium' | 'High')} options={['Low', 'Medium', 'High']} />
                      <Field label="Action Owner" value={actionOwner} onChange={setActionOwner} />
                      <Field label="Next Review" value={nextReviewAt} onChange={setNextReviewAt} type="datetime-local" />
                    </div>

                    <TextAreaField label="Control Note" value={controlNote} onChange={setControlNote} placeholder="Describe the current site attendance issue, response, or follow-up action." />

                    {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={submitting || !payload?.permissions.canEdit}
                        onClick={() => void saveControl()}
                        className="px-4 py-2 bg-dle-blue text-white rounded-lg text-sm font-medium hover:bg-dle-blue-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Saving...' : payload?.permissions.canEdit ? 'Save Site Control' : 'Read Only Access'}
                      </button>
                      <span className="text-xs text-slate-500">Updates are permissioned and written into the attendance audit log.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a site to inspect attendance detail and control actions.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Site Attendance Insights</div>
              <div className="text-xs text-slate-500 mt-1">Priority observations on turnout, device risk, and control exceptions across sites.</div>
            </div>
            <div className="p-4 space-y-3">
              {(payload?.insights || []).map((insight) => (
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
              <div className="text-xs text-slate-500 mt-1">Recent attendance audit events for site control, clocking, and attendance operations.</div>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Site Attendance Register</div>
          <div className="text-xs text-slate-500 mt-1">Searchable site register of turnout, device posture, mobile activity, and control ownership.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Site', 'Headcount', 'Present', 'Late', 'Absent', 'Attendance', 'Exceptions', 'Biometric', 'Mobile', 'Escalation'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSites.map((site) => (
                <tr key={site.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(site.id)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{site.site}</div>
                    <div className="text-xs text-slate-500">{site.location}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(site.headcount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(site.present)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(site.late)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(site.absent)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{site.attendanceRatePct}%</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(site.clockExceptions)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{site.biometricStatus}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{site.mobilePolicy}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${escalationTone(site.escalationStatus)}`}>{site.escalationStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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
