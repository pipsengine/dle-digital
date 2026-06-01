'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Download,
  Fingerprint,
  RefreshCcw,
  Router,
  Search,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { StructureInsight } from '@/lib/organization-data';

type DeviceOperationalStatus = 'Online' | 'Degraded' | 'Offline' | 'Maintenance';
type SyncHealth = 'Healthy' | 'Delayed' | 'Failed';
type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Remote' | 'Excused';

type DeviceRecord = {
  id: string;
  deviceCode: string;
  deviceName: string;
  location: string;
  site: string;
  deviceType: 'Facial Terminal' | 'Fingerprint Terminal' | 'Hybrid Terminal' | 'Mobile Gateway';
  operationalStatus: DeviceOperationalStatus;
  syncHealth: SyncHealth;
  lastSyncAt: string;
  lastPunchAt: string | null;
  enrolledEmployees: number;
  matchedPunches: number;
  unmatchedPunches: number;
  supervisorOverrides: number;
  batteryLevelPct: number | null;
  networkStrengthPct: number | null;
  incidentNote: string | null;
};

type BiometricException = {
  id: string;
  employeeId: string;
  employeeName: string;
  site: string;
  location: string;
  issueType: 'Missing Punch' | 'Supervisor Override' | 'Mobile Punch' | 'Unmatched Punch';
  severity: 'High' | 'Medium' | 'Low';
  attendanceStatus: AttendanceStatus;
  deviceName: string;
  note: string;
  lastActionAt: string | null;
  supervisor: string;
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
    totalDevices: number;
    onlineDevices: number;
    degradedDevices: number;
    offlineDevices: number;
    failedSyncDevices: number;
    exceptionCount: number;
    unmatchedPunches: number;
    overrideCount: number;
  };
  filterOptions: {
    locations: string[];
    sites: string[];
    statuses: DeviceOperationalStatus[];
    syncHealths: SyncHealth[];
    issueTypes: BiometricException['issueType'][];
  };
  devices: DeviceRecord[];
  exceptions: BiometricException[];
  insights: StructureInsight[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-NG');
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-NG');

const statusTone = (status: DeviceOperationalStatus) => {
  if (status === 'Offline') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Degraded' || status === 'Maintenance') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const syncTone = (status: SyncHealth) => {
  if (status === 'Failed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Delayed') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const severityTone = (severity: BiometricException['severity']) => {
  if (severity === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (severity === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function BiometricAttendanceClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [siteFilter, setSiteFilter] = useState<'All' | string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | DeviceOperationalStatus>('All');
  const [syncFilter, setSyncFilter] = useState<'All' | SyncHealth>('All');
  const [issueFilter, setIssueFilter] = useState<'All' | BiometricException['issueType']>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceOperationalStatus>('Online');
  const [syncHealth, setSyncHealth] = useState<SyncHealth>('Healthy');
  const [incidentNote, setIncidentNote] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/attendance/biometric-attendance', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load biometric attendance');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.devices[0]?.id || null);

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
      setError(e instanceof Error ? e.message : 'Unable to load biometric attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (payload?.devices || []).filter((device) => {
      if (locationFilter !== 'All' && device.location !== locationFilter) return false;
      if (siteFilter !== 'All' && device.site !== siteFilter) return false;
      if (statusFilter !== 'All' && device.operationalStatus !== statusFilter) return false;
      if (syncFilter !== 'All' && device.syncHealth !== syncFilter) return false;
      if (!q) return true;
      return [
        device.deviceCode,
        device.deviceName,
        device.location,
        device.site,
        device.deviceType,
        device.incidentNote || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [payload?.devices, query, locationFilter, siteFilter, statusFilter, syncFilter]);

  const selectedDevice = useMemo(
    () => visibleDevices.find((device) => device.id === selectedId) || visibleDevices[0] || null,
    [visibleDevices, selectedId],
  );

  const visibleExceptions = useMemo(() => {
    return (payload?.exceptions || []).filter((item) => {
      if (issueFilter !== 'All' && item.issueType !== issueFilter) return false;
      if (selectedDevice && item.site !== selectedDevice.site) return false;
      return true;
    });
  }, [payload?.exceptions, issueFilter, selectedDevice]);

  useEffect(() => {
    if (!selectedDevice && visibleDevices.length) setSelectedId(visibleDevices[0].id);
  }, [selectedDevice, visibleDevices]);

  useEffect(() => {
    if (!selectedDevice) return;
    setDeviceStatus(selectedDevice.operationalStatus);
    setSyncHealth(selectedDevice.syncHealth);
    setIncidentNote(selectedDevice.incidentNote || '');
    setSubmitError(null);
  }, [selectedDevice?.id]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      ['Device Code', 'Device Name', 'Location', 'Site', 'Type', 'Operational Status', 'Sync Health', 'Matched Punches', 'Unmatched Punches', 'Overrides', 'Last Sync'],
      ...visibleDevices.map((device) => [
        device.deviceCode,
        device.deviceName,
        device.location,
        device.site,
        device.deviceType,
        device.operationalStatus,
        device.syncHealth,
        String(device.matchedPunches),
        String(device.unmatchedPunches),
        String(device.supervisorOverrides),
        device.lastSyncAt,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'biometric-attendance.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveDevice = async () => {
    if (!selectedDevice) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/hris/attendance/biometric-attendance', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'Attendance Control Desk',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          operationalStatus: deviceStatus,
          syncHealth,
          incidentNote: incidentNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to update biometric device');
      await load();
      setSelectedId(selectedDevice.id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to update biometric device');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTemplate
      title="Biometric Attendance"
      description="Monitor biometric device operations, attendance-sync health, unmatched punches, and exception pressure across attendance sites."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Attendance', href: '/hris/attendance' },
        { label: 'Biometric Attendance' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Biometric Control Hub</div>
          <div className="text-xs text-slate-500 mt-1">Track device availability, sync posture, punch integrity, and exception exposure for attendance operations.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Actor: {payload?.permissions.actor || '—'}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Role: {payload?.permissions.role || '—'}</span>
          <span className={`px-2.5 py-1 rounded-full border font-semibold ${payload?.permissions.canEdit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {payload?.permissions.canEdit ? 'Operations Enabled' : 'Read Only'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={Fingerprint} label="Devices" value={payload ? formatNumber(payload.summary.totalDevices) : '—'} detail="Registered biometric endpoints" />
        <MetricCard icon={Wifi} label="Online" value={payload ? formatNumber(payload.summary.onlineDevices) : '—'} detail="Devices currently healthy" />
        <MetricCard icon={Router} label="Degraded" value={payload ? formatNumber(payload.summary.degradedDevices) : '—'} detail="Devices needing intervention" />
        <MetricCard icon={WifiOff} label="Offline" value={payload ? formatNumber(payload.summary.offlineDevices) : '—'} detail="Unavailable devices" />
        <MetricCard icon={AlertTriangle} label="Exceptions" value={payload ? formatNumber(payload.summary.exceptionCount) : '—'} detail="Punch issues under review" />
        <MetricCard icon={ShieldCheck} label="Failed Sync" value={payload ? formatNumber(payload.summary.failedSyncDevices) : '—'} detail="Devices with sync failure" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search device, site, type, or incident..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={siteFilter} onChange={(value) => setSiteFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.sites || [])]} labels={{ All: 'All Sites' }} />
        <Select value={statusFilter} onChange={(value) => setStatusFilter(value as 'All' | DeviceOperationalStatus)} options={['All', ...(payload?.filterOptions.statuses || [])]} labels={{ All: 'All Device States' }} />
        <Select value={syncFilter} onChange={(value) => setSyncFilter(value as 'All' | SyncHealth)} options={['All', ...(payload?.filterOptions.syncHealths || [])]} labels={{ All: 'All Sync Health' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[220px] gap-3">
          <Select value={issueFilter} onChange={(value) => setIssueFilter(value as 'All' | BiometricException['issueType'])} options={['All', ...(payload?.filterOptions.issueTypes || [])]} labels={{ All: 'All Exception Types' }} />
        </div>
        <div className="text-xs text-slate-500">
          Unmatched punches: <span className="font-semibold text-slate-700">{payload ? formatNumber(payload.summary.unmatchedPunches) : '—'}</span>
          {' '}<span className="mx-2">•</span>
          Overrides: <span className="font-semibold text-slate-700">{payload ? formatNumber(payload.summary.overrideCount) : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Device Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Review device posture across attendance sites, including sync reliability and punch integrity exposure.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">Showing: {formatNumber(visibleDevices.length)}</span>
          </div>
          <div className="p-4 space-y-3 min-h-[560px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading biometric operations...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : visibleDevices.length ? (
              visibleDevices.map((device) => {
                const active = selectedDevice?.id === device.id;
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => setSelectedId(device.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-dle-blue/30 bg-dle-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{device.deviceName}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {device.deviceCode} <span className="mx-2">•</span> {device.site} <span className="mx-2">•</span> {device.deviceType}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${statusTone(device.operationalStatus)}`}>{device.operationalStatus}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${syncTone(device.syncHealth)}`}>{device.syncHealth}</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{device.location}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Matched: {formatNumber(device.matchedPunches)}</span>
                      <span>Unmatched: {formatNumber(device.unmatchedPunches)}</span>
                      <span>Overrides: {formatNumber(device.supervisorOverrides)}</span>
                      <span>Last Sync: {formatDate(device.lastSyncAt)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No biometric devices match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Device Detail</div>
              <div className="text-xs text-slate-500 mt-1">Inspect device availability, sync state, network posture, and current incident management status.</div>
            </div>
            <div className="p-5">
              {selectedDevice ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusTone(selectedDevice.operationalStatus)}`}>{selectedDevice.operationalStatus}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${syncTone(selectedDevice.syncHealth)}`}>{selectedDevice.syncHealth}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedDevice.site}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedDevice.deviceName}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedDevice.deviceCode} • {selectedDevice.deviceType}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Location" value={selectedDevice.location} />
                    <DetailStat label="Site" value={selectedDevice.site} />
                    <DetailStat label="Enrolled Employees" value={formatNumber(selectedDevice.enrolledEmployees)} />
                    <DetailStat label="Matched Punches" value={formatNumber(selectedDevice.matchedPunches)} />
                    <DetailStat label="Unmatched Punches" value={formatNumber(selectedDevice.unmatchedPunches)} />
                    <DetailStat label="Overrides" value={formatNumber(selectedDevice.supervisorOverrides)} />
                    <DetailStat label="Last Sync" value={formatDateTime(selectedDevice.lastSyncAt)} />
                    <DetailStat label="Last Punch" value={selectedDevice.lastPunchAt ? selectedDevice.lastPunchAt : '—'} />
                    <DetailStat label="Battery Level" value={selectedDevice.batteryLevelPct === null ? 'N/A' : `${selectedDevice.batteryLevelPct}%`} />
                    <DetailStat label="Network Strength" value={selectedDevice.networkStrengthPct === null ? 'N/A' : `${selectedDevice.networkStrengthPct}%`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Incident Note</div>
                    <div className="text-sm text-slate-600 mt-2">{selectedDevice.incidentNote || 'No open incident note recorded for this device.'}</div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Device Controls</div>
                      <div className="text-xs text-slate-500 mt-1">Update operational status, sync health, and active incident note for the selected biometric device.</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SelectField label="Operational Status" value={deviceStatus} onChange={(value) => setDeviceStatus(value as DeviceOperationalStatus)} options={['Online', 'Degraded', 'Offline', 'Maintenance']} />
                      <SelectField label="Sync Health" value={syncHealth} onChange={(value) => setSyncHealth(value as SyncHealth)} options={['Healthy', 'Delayed', 'Failed']} />
                    </div>

                    <TextAreaField label="Incident Note" value={incidentNote} onChange={setIncidentNote} placeholder="Describe the current issue, mitigation, or recovery action for the device." />

                    {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={submitting || !payload?.permissions.canEdit}
                        onClick={() => void saveDevice()}
                        className="px-4 py-2 bg-dle-blue text-white rounded-lg text-sm font-medium hover:bg-dle-blue-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Saving...' : payload?.permissions.canEdit ? 'Save Device Status' : 'Read Only Access'}
                      </button>
                      <span className="text-xs text-slate-500">Updates are permissioned and written into the attendance audit log.</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-900">Exception Queue</div>
                      <div className="text-xs text-slate-500 mt-1">Attendance exceptions linked to the selected biometric site and its fallback processes.</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {visibleExceptions.length ? (
                        visibleExceptions.map((item) => (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{item.employeeName}</div>
                              <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${severityTone(item.severity)}`}>{item.severity}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {item.issueType} <span className="mx-2">•</span> {item.employeeId} <span className="mx-2">•</span> {item.supervisor}
                            </div>
                            <div className="text-sm text-slate-600 mt-2">{item.note}</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-sm text-slate-600">No biometric exceptions are currently linked to this device scope.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a biometric device to inspect its operational detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Biometric Insights</div>
              <div className="text-xs text-slate-500 mt-1">Priority observations on device availability, sync failure, and exception concentration.</div>
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
              <div className="text-xs text-slate-500 mt-1">Recent attendance device and clocking audit events where audit visibility is permitted.</div>
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
                  <div className="text-sm text-slate-600">No attendance audit events are available for this scope yet.</div>
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
          <div className="text-sm font-bold text-slate-900">Biometric Device Register</div>
          <div className="text-xs text-slate-500 mt-1">Searchable register of devices, device posture, sync state, and punch integrity metrics.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Device', 'Location', 'Type', 'Status', 'Sync', 'Matched', 'Unmatched', 'Overrides', 'Last Sync'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDevices.map((device) => (
                <tr key={device.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(device.id)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{device.deviceName}</div>
                    <div className="text-xs text-slate-500">{device.deviceCode}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div>{device.site}</div>
                    <div className="text-xs text-slate-500">{device.location}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{device.deviceType}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${statusTone(device.operationalStatus)}`}>{device.operationalStatus}</span></td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${syncTone(device.syncHealth)}`}>{device.syncHealth}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(device.matchedPunches)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(device.unmatchedPunches)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(device.supervisorOverrides)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(device.lastSyncAt)}</td>
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
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
