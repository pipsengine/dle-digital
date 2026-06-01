'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Download,
  MapPinned,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  TimerReset,
  Wifi,
} from 'lucide-react';
import type { StructureInsight } from '@/lib/organization-data';

type PolicyStatus = 'Active' | 'Restricted' | 'Suspended';
type GeofenceHealth = 'Healthy' | 'Warning' | 'Breached';
type RiskLevel = 'Low' | 'Medium' | 'High';

type MobileSiteSummary = {
  id: string;
  location: string;
  site: string;
  policyStatus: PolicyStatus;
  geofenceHealth: GeofenceHealth;
  expectedMobileUsers: number;
  actualMobilePunches: number;
  activeSessions: number;
  riskyPunches: number;
  complianceRatePct: number;
  lastComplianceReviewAt: string;
  incidentNote: string | null;
  allowedRadiusMeters: number;
  gpsAccuracyThresholdMeters: number;
  offlineSyncWindowMinutes: number;
};

type MobilePunchRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  businessUnit: string;
  department: string;
  jobTitle: string;
  location: string;
  site: string;
  shift: string;
  attendanceStatus: string;
  clockingMode: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  lastActionAt: string | null;
  supervisor: string;
  source: string;
  gpsConfidence: 'High' | 'Medium' | 'Low';
  geofenceResult: 'Inside Fence' | 'Near Edge' | 'Outside Fence';
  deviceTrust: 'Managed' | 'Known' | 'Unverified';
  riskLevel: RiskLevel;
  note: string;
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
    activePolicies: number;
    mobilePunches: number;
    activeSessions: number;
    riskyPunches: number;
    breachedSites: number;
    complianceRatePct: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    policyStatuses: PolicyStatus[];
    geofenceHealths: GeofenceHealth[];
    riskLevels: RiskLevel[];
  };
  siteSummaries: MobileSiteSummary[];
  mobilePunches: MobilePunchRecord[];
  insights: StructureInsight[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-NG');

const policyTone = (status: PolicyStatus) => {
  if (status === 'Suspended') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Restricted') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const geofenceTone = (status: GeofenceHealth) => {
  if (status === 'Breached') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Warning') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const riskTone = (status: RiskLevel) => {
  if (status === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function MobileAttendanceClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [siteFilter, setSiteFilter] = useState<'All' | string>('All');
  const [policyFilter, setPolicyFilter] = useState<'All' | PolicyStatus>('All');
  const [geofenceFilter, setGeofenceFilter] = useState<'All' | GeofenceHealth>('All');
  const [riskFilter, setRiskFilter] = useState<'All' | RiskLevel>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus>('Active');
  const [geofenceHealth, setGeofenceHealth] = useState<GeofenceHealth>('Healthy');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState('150');
  const [gpsAccuracyThresholdMeters, setGpsAccuracyThresholdMeters] = useState('35');
  const [offlineSyncWindowMinutes, setOfflineSyncWindowMinutes] = useState('20');
  const [incidentNote, setIncidentNote] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/attendance/mobile-attendance', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load mobile attendance');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.siteSummaries[0]?.id || null);

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
      setError(e instanceof Error ? e.message : 'Unable to load mobile attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.siteSummaries || []).filter((site) => {
      if (locationFilter !== 'All' && site.location !== locationFilter) return false;
      if (siteFilter !== 'All' && site.site !== siteFilter) return false;
      if (policyFilter !== 'All' && site.policyStatus !== policyFilter) return false;
      if (geofenceFilter !== 'All' && site.geofenceHealth !== geofenceFilter) return false;
      if (!q) return true;
      return [site.location, site.site, site.incidentNote || ''].join(' ').toLowerCase().includes(q);
    });
  }, [payload?.siteSummaries, query, locationFilter, siteFilter, policyFilter, geofenceFilter]);

  const selectedSite = useMemo(
    () => visibleSites.find((site) => site.id === selectedId) || visibleSites[0] || null,
    [visibleSites, selectedId],
  );

  const visiblePunches = useMemo(() => {
    return (payload?.mobilePunches || []).filter((punch) => {
      if (selectedSite && (punch.location !== selectedSite.location || punch.site !== selectedSite.site)) return false;
      if (riskFilter !== 'All' && punch.riskLevel !== riskFilter) return false;
      return true;
    });
  }, [payload?.mobilePunches, selectedSite, riskFilter]);

  useEffect(() => {
    if (!selectedSite && visibleSites.length) setSelectedId(visibleSites[0].id);
  }, [selectedSite, visibleSites]);

  useEffect(() => {
    if (!selectedSite) return;
    setPolicyStatus(selectedSite.policyStatus);
    setGeofenceHealth(selectedSite.geofenceHealth);
    setAllowedRadiusMeters(String(selectedSite.allowedRadiusMeters));
    setGpsAccuracyThresholdMeters(String(selectedSite.gpsAccuracyThresholdMeters));
    setOfflineSyncWindowMinutes(String(selectedSite.offlineSyncWindowMinutes));
    setIncidentNote(selectedSite.incidentNote || '');
    setSubmitError(null);
  }, [selectedSite?.id]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      ['Employee ID', 'Employee Name', 'Location', 'Site', 'Attendance Status', 'Clocking Mode', 'GPS Confidence', 'Geofence Result', 'Device Trust', 'Risk Level'],
      ...visiblePunches.map((punch) => [
        punch.employeeId,
        punch.employeeName,
        punch.location,
        punch.site,
        punch.attendanceStatus,
        punch.clockingMode,
        punch.gpsConfidence,
        punch.geofenceResult,
        punch.deviceTrust,
        punch.riskLevel,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mobile-attendance.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const savePolicy = async () => {
    if (!selectedSite) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/hris/attendance/mobile-attendance', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Attendance Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          sitePolicyId: selectedSite.id,
          policyStatus,
          geofenceHealth,
          allowedRadiusMeters: Number(allowedRadiusMeters),
          gpsAccuracyThresholdMeters: Number(gpsAccuracyThresholdMeters),
          offlineSyncWindowMinutes: Number(offlineSyncWindowMinutes),
          incidentNote: incidentNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to update mobile attendance policy');
      await load();
      setSelectedId(selectedSite.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to update mobile attendance policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTemplate
      title="Mobile Attendance"
      description="Monitor mobile attendance usage, geofence compliance, risky mobile punches, and site mobile-attendance policy posture."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Attendance', href: '/hris/attendance' },
        { label: 'Mobile Attendance' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Mobile Attendance Control</div>
          <div className="text-xs text-slate-500 mt-1">Control mobile punch acceptance, geofence compliance, and risky attendance activity across operational sites.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Actor: {payload?.permissions.actor || '—'}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Role: {payload?.permissions.role || '—'}</span>
          <span className={`px-2.5 py-1 rounded-full border font-semibold ${payload?.permissions.canEdit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {payload?.permissions.canEdit ? 'Policy Updates Enabled' : 'Read Only'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={Smartphone} label="Sites" value={payload ? formatNumber(payload.summary.sites) : '—'} detail="Configured mobile attendance sites" />
        <MetricCard icon={ShieldCheck} label="Active Policies" value={payload ? formatNumber(payload.summary.activePolicies) : '—'} detail="Sites actively allowing mobile punches" />
        <MetricCard icon={MapPinned} label="Mobile Punches" value={payload ? formatNumber(payload.summary.mobilePunches) : '—'} detail="Attendance captured by mobile channel" />
        <MetricCard icon={TimerReset} label="Active Sessions" value={payload ? formatNumber(payload.summary.activeSessions) : '—'} detail="Open mobile punch sessions" />
        <MetricCard icon={AlertTriangle} label="Risky Punches" value={payload ? formatNumber(payload.summary.riskyPunches) : '—'} detail="Mobile punches needing follow-up" />
        <MetricCard icon={Wifi} label="Compliance" value={payload ? `${payload.summary.complianceRatePct}%` : '—'} detail="Average mobile compliance rate" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search site, location, or incident..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={siteFilter} onChange={(value) => setSiteFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.sites || [])]} labels={{ All: 'All Sites' }} />
        <Select value={policyFilter} onChange={(value) => setPolicyFilter(value as 'All' | PolicyStatus)} options={['All', ...(payload?.filterOptions.policyStatuses || [])]} labels={{ All: 'All Policy States' }} />
        <Select value={geofenceFilter} onChange={(value) => setGeofenceFilter(value as 'All' | GeofenceHealth)} options={['All', ...(payload?.filterOptions.geofenceHealths || [])]} labels={{ All: 'All Geofence Health' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[220px] gap-3">
          <Select value={riskFilter} onChange={(value) => setRiskFilter(value as 'All' | RiskLevel)} options={['All', ...(payload?.filterOptions.riskLevels || [])]} labels={{ All: 'All Risk Levels' }} />
        </div>
        <div className="text-xs text-slate-500">
          Breached sites: <span className="font-semibold text-slate-700">{payload ? formatNumber(payload.summary.breachedSites) : '—'}</span>
          {' '}<span className="mx-2">•</span>
          Generated: <span className="font-semibold text-slate-700">{payload ? formatDate(payload.generatedAt) : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Site Policy Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Review mobile attendance enablement, geofence posture, and site-level compliance pressure.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">Showing: {formatNumber(visibleSites.length)}</span>
          </div>
          <div className="p-4 space-y-3 min-h-[560px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading mobile attendance...</div>
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
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${policyTone(site.policyStatus)}`}>{site.policyStatus}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${geofenceTone(site.geofenceHealth)}`}>{site.geofenceHealth}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Expected: {formatNumber(site.expectedMobileUsers)}</span>
                      <span>Punches: {formatNumber(site.actualMobilePunches)}</span>
                      <span>Risky: {formatNumber(site.riskyPunches)}</span>
                      <span>Compliance: {site.complianceRatePct}%</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No mobile attendance sites match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Site Detail</div>
              <div className="text-xs text-slate-500 mt-1">Inspect mobile attendance controls, geofence settings, and risky mobile punch activity for the selected site.</div>
            </div>
            <div className="p-5">
              {selectedSite ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${policyTone(selectedSite.policyStatus)}`}>{selectedSite.policyStatus}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${geofenceTone(selectedSite.geofenceHealth)}`}>{selectedSite.geofenceHealth}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedSite.site}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedSite.location}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Expected Mobile Users" value={formatNumber(selectedSite.expectedMobileUsers)} />
                    <DetailStat label="Actual Mobile Punches" value={formatNumber(selectedSite.actualMobilePunches)} />
                    <DetailStat label="Active Sessions" value={formatNumber(selectedSite.activeSessions)} />
                    <DetailStat label="Risky Punches" value={formatNumber(selectedSite.riskyPunches)} />
                    <DetailStat label="Compliance Rate" value={`${selectedSite.complianceRatePct}%`} />
                    <DetailStat label="Allowed Radius" value={`${selectedSite.allowedRadiusMeters}m`} />
                    <DetailStat label="GPS Threshold" value={`${selectedSite.gpsAccuracyThresholdMeters}m`} />
                    <DetailStat label="Offline Sync Window" value={`${selectedSite.offlineSyncWindowMinutes} min`} />
                    <DetailStat label="Last Review" value={formatDate(selectedSite.lastComplianceReviewAt)} />
                    <DetailStat label="Policy Status" value={selectedSite.policyStatus} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Incident Note</div>
                    <div className="text-sm text-slate-600 mt-2">{selectedSite.incidentNote || 'No open incident note recorded for this site policy.'}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Policy Controls</div>
                      <div className="text-xs text-slate-500 mt-1">Update site mobile-attendance posture, geofence health, and compliance thresholds.</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SelectField label="Policy Status" value={policyStatus} onChange={(value) => setPolicyStatus(value as PolicyStatus)} options={['Active', 'Restricted', 'Suspended']} />
                      <SelectField label="Geofence Health" value={geofenceHealth} onChange={(value) => setGeofenceHealth(value as GeofenceHealth)} options={['Healthy', 'Warning', 'Breached']} />
                      <Field label="Allowed Radius (m)" value={allowedRadiusMeters} onChange={setAllowedRadiusMeters} type="number" />
                      <Field label="GPS Threshold (m)" value={gpsAccuracyThresholdMeters} onChange={setGpsAccuracyThresholdMeters} type="number" />
                      <Field label="Offline Sync Window (min)" value={offlineSyncWindowMinutes} onChange={setOfflineSyncWindowMinutes} type="number" />
                    </div>

                    <TextAreaField label="Incident Note" value={incidentNote} onChange={setIncidentNote} placeholder="Describe the current mobile attendance risk or control action for this site." />

                    {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={submitting || !payload?.permissions.canEdit}
                        onClick={() => void savePolicy()}
                        className="px-4 py-2 bg-dle-blue text-white rounded-lg text-sm font-medium hover:bg-dle-blue-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Saving...' : payload?.permissions.canEdit ? 'Save Policy' : 'Read Only Access'}
                      </button>
                      <span className="text-xs text-slate-500">Updates are permissioned and written into the attendance audit log.</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-900">Mobile Punch Queue</div>
                      <div className="text-xs text-slate-500 mt-1">Mobile punch activity linked to the selected site with geofence and device-trust context.</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {visiblePunches.length ? (
                        visiblePunches.map((punch) => (
                          <div key={punch.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{punch.employeeName}</div>
                              <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${riskTone(punch.riskLevel)}`}>{punch.riskLevel}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {punch.employeeId} <span className="mx-2">•</span> {punch.geofenceResult} <span className="mx-2">•</span> {punch.deviceTrust}
                            </div>
                            <div className="text-sm text-slate-600 mt-2">{punch.note}</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-sm text-slate-600">No mobile punch records match the selected site and risk filters.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a mobile attendance site to inspect its policy and punch activity.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Mobile Attendance Insights</div>
              <div className="text-xs text-slate-500 mt-1">Priority observations on geofence risk, risky mobile punch concentration, and compliance posture.</div>
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
              <div className="text-xs text-slate-500 mt-1">Recent attendance audit events for mobile attendance policy and punch-control traceability.</div>
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
                  <div className="text-sm text-slate-600">No mobile attendance audit events are available yet.</div>
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
          <div className="text-sm font-bold text-slate-900">Mobile Punch Register</div>
          <div className="text-xs text-slate-500 mt-1">Searchable register of mobile punches with geofence, device trust, and risk posture.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Site', 'Status', 'Clocking', 'GPS', 'Geofence', 'Device Trust', 'Risk', 'Supervisor'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePunches.map((punch) => (
                <tr key={punch.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{punch.employeeName}</div>
                    <div className="text-xs text-slate-500">{punch.employeeId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div>{punch.site}</div>
                    <div className="text-xs text-slate-500">{punch.location}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.attendanceStatus}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.clockingMode}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.gpsConfidence}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.geofenceResult}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.deviceTrust}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${riskTone(punch.riskLevel)}`}>{punch.riskLevel}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{punch.supervisor}</td>
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
