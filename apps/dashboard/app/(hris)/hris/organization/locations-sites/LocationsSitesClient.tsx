'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Building2,
  Download,
  MapPin,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { HealthStatus, LocationSiteRecord, StructureInsight } from '@/lib/organization-data';

type Payload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  summary: {
    totalRecords: number;
    totalLocations: number;
    totalSites: number;
    totalHeadcount: number;
    totalOpenRoles: number;
    avgSuccessionCoverage: number;
    avgAttritionRisk: number;
  };
  filterOptions: {
    recordTypes: Array<'Location' | 'Site'>;
    regions: string[];
    siteCategories: string[];
    healthStatuses: HealthStatus[];
  };
  records: LocationSiteRecord[];
  insights: StructureInsight[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const healthTone = (status: HealthStatus) => {
  if (status === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Needs Attention') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function LocationsSitesClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'All' | 'Location' | 'Site'>('All');
  const [regionFilter, setRegionFilter] = useState<'All' | string>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | HealthStatus>('All');
  const [sortBy, setSortBy] = useState<'headcount' | 'openRoles' | 'successionCoveragePct' | 'attritionRiskPct'>('headcount');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/locations-sites', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load locations and sites');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.records[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load locations and sites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const records = payload?.records || [];

  const visibleRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = records.filter((record) => {
      if (recordTypeFilter !== 'All' && record.recordType !== recordTypeFilter) return false;
      if (regionFilter !== 'All' && record.region !== regionFilter) return false;
      if (categoryFilter !== 'All' && record.siteCategory !== categoryFilter) return false;
      if (healthFilter !== 'All' && record.healthStatus !== healthFilter) return false;
      if (!q) return true;

      return [
        record.name,
        record.region,
        record.country,
        record.leader,
        record.location,
        record.description,
        record.costCenter,
        record.parentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'successionCoveragePct') return b.successionCoveragePct - a.successionCoveragePct;
      if (sortBy === 'attritionRiskPct') return b.attritionRiskPct - a.attritionRiskPct;
      if (sortBy === 'openRoles') return b.openRoles - a.openRoles;
      return b.headcount - a.headcount;
    });
    return sorted;
  }, [records, query, recordTypeFilter, regionFilter, categoryFilter, healthFilter, sortBy]);

  const selectedRecord = useMemo(() => {
    return visibleRecords.find((record) => record.id === selectedId) || visibleRecords[0] || null;
  }, [visibleRecords, selectedId]);

  useEffect(() => {
    if (!selectedRecord && visibleRecords.length) setSelectedId(visibleRecords[0].id);
  }, [selectedRecord, visibleRecords]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      [
        'Name',
        'Record Type',
        'Region',
        'Parent',
        'Category',
        'Leader',
        'Headcount',
        'Open Roles',
        'Divisions',
        'Business Units',
        'Departments',
        'Teams',
        'Succession Coverage %',
        'Attrition Risk %',
        'Budget USD',
        'Payroll USD',
      ],
      ...visibleRecords.map((record) => [
        record.name,
        record.recordType,
        record.region,
        record.parentName || '—',
        record.siteCategory,
        record.leader,
        String(record.headcount),
        String(record.openRoles),
        String(record.divisionCount),
        String(record.businessUnitCount),
        String(record.departmentCount),
        String(record.teamCount),
        String(record.successionCoveragePct),
        String(record.attritionRiskPct),
        String(record.budgetUsd),
        String(record.payrollUsd),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locations-sites.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTemplate
      title="Locations & Sites"
      description="Review the organization footprint by region and site, including workforce scale, leadership ownership, hiring load, structural density, and operating health."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Organization', href: '/hris/organization' },
        { label: 'Locations & Sites' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={MapPin} label="Total Records" value={payload ? formatNumber(payload.summary.totalRecords) : '—'} detail="Locations and sites in view" />
        <MetricCard icon={Building2} label="Locations" value={payload ? formatNumber(payload.summary.totalLocations) : '—'} detail="Regional roll-up records" />
        <MetricCard icon={Network} label="Sites" value={payload ? formatNumber(payload.summary.totalSites) : '—'} detail="Physical operating footprints" />
        <MetricCard icon={Users} label="Headcount" value={payload ? formatNumber(payload.summary.totalHeadcount) : '—'} detail="Combined workforce footprint" />
        <MetricCard icon={ShieldCheck} label="Succession" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} detail="Average location readiness" />
        <MetricCard icon={AlertTriangle} label="Attrition Risk" value={payload ? `${payload.summary.avgAttritionRisk}%` : '—'} detail="Average location pressure" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location, site, leader, region, cost center..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={recordTypeFilter} onChange={(value) => setRecordTypeFilter(value as typeof recordTypeFilter)} options={['All', ...(payload?.filterOptions.recordTypes || [])]} labels={{ All: 'All Types' }} />
        <Select value={regionFilter} onChange={(value) => setRegionFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.regions || [])]} labels={{ All: 'All Regions' }} />
        <Select value={categoryFilter} onChange={(value) => setCategoryFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.siteCategories || [])]} labels={{ All: 'All Categories' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[240px_240px] gap-3">
          <Select value={healthFilter} onChange={(value) => setHealthFilter(value as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} labels={{ All: 'All Health States' }} />
          <Select
            value={sortBy}
            onChange={(value) => setSortBy(value as typeof sortBy)}
            options={['headcount', 'openRoles', 'successionCoveragePct', 'attritionRiskPct']}
            labels={{
              headcount: 'Sort: Headcount',
              openRoles: 'Sort: Open Roles',
              successionCoveragePct: 'Sort: Succession',
              attritionRiskPct: 'Sort: Attrition',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setRecordTypeFilter('All');
            setRegionFilter('All');
            setCategoryFilter('All');
            setHealthFilter('All');
            setSortBy('headcount');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Footprint Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Browse regional location rollups and site-level operating footprints.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
              Showing: {formatNumber(visibleRecords.length)}
            </span>
          </div>
          <div className="p-4 space-y-3 min-h-[520px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading locations and sites...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : visibleRecords.length ? (
              visibleRecords.map((record) => {
                const active = selectedRecord?.id === record.id;
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-dle-blue/30 bg-dle-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {record.recordType} <span className="mx-2">•</span> {record.siteCategory} <span className="mx-2">•</span> {record.leader}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(record.healthStatus)}`}>
                        {record.healthStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Headcount: {formatNumber(record.headcount)}</span>
                      <span>Open Roles: {formatNumber(record.openRoles)}</span>
                      <span>Region: {record.region}</span>
                      <span>Nodes: {formatNumber(record.nodeCount)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No location or site records match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Location Detail</div>
              <div className="text-xs text-slate-500 mt-1">Detailed workforce, structure, and governance view for the selected location or site.</div>
            </div>
            <div className="p-5">
              {selectedRecord ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedRecord.recordType}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedRecord.siteCategory}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedRecord.healthStatus)}`}>
                        {selectedRecord.healthStatus}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedRecord.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedRecord.description}</p>
                    <div className="text-xs text-slate-500 mt-2">{selectedRecord.parentChain.join(' / ')}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Leader" value={selectedRecord.leader} />
                    <DetailStat label="Region" value={selectedRecord.region} />
                    <DetailStat label="Country" value={selectedRecord.country} />
                    <DetailStat label="Parent" value={selectedRecord.parentName || '—'} />
                    <DetailStat label="Headcount" value={formatNumber(selectedRecord.headcount)} />
                    <DetailStat label="Open Roles" value={formatNumber(selectedRecord.openRoles)} />
                    <DetailStat label="Budget" value={formatCurrency(selectedRecord.budgetUsd)} />
                    <DetailStat label="Payroll" value={formatCurrency(selectedRecord.payrollUsd)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ProgressCard label="Succession Coverage" value={selectedRecord.successionCoveragePct} tone="emerald" />
                    <ProgressCard label="Attrition Risk" value={selectedRecord.attritionRiskPct} tone="amber" />
                    <ProgressCard label="Span Of Control" value={Math.min(selectedRecord.spanOfControl * 10, 100)} tone="blue" display={`${selectedRecord.spanOfControl}`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Structural Density</div>
                      <span className="text-xs text-slate-500">Nodes: {formatNumber(selectedRecord.nodeCount)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <DetailStat label="Divisions" value={formatNumber(selectedRecord.divisionCount)} />
                      <DetailStat label="Business Units" value={formatNumber(selectedRecord.businessUnitCount)} />
                      <DetailStat label="Departments" value={formatNumber(selectedRecord.departmentCount)} />
                      <DetailStat label="Teams" value={formatNumber(selectedRecord.teamCount)} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {selectedRecord.relatedItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                              <div className="text-xs text-slate-500 mt-1">{item.kind} • {item.leader}</div>
                            </div>
                            <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(item.healthStatus)}`}>
                              {item.healthStatus}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                            <span>Headcount: {formatNumber(item.headcount)}</span>
                            <span>Open Roles: {formatNumber(item.openRoles)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a location or site to inspect its operating detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-slate-900">Footprint Insights</div>
                <div className="text-xs text-slate-500 mt-1">Priority observations for site concentration, hiring pressure, and location health.</div>
              </div>
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
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Locations & Sites Registry</div>
          <div className="text-xs text-slate-500 mt-1">Searchable audit table of all visible location and site records.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Name', 'Type', 'Region', 'Category', 'Leader', 'Headcount', 'Open Roles', 'Nodes', 'Health', 'Succession'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(record.id)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{record.name}</div>
                    <div className="text-xs text-slate-500">{record.location}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.recordType}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.region}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.siteCategory}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.leader}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(record.headcount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(record.openRoles)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(record.nodeCount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(record.healthStatus)}`}>{record.healthStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.successionCoveragePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageTemplate>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: any;
  label: string;
  value: string;
  detail: string;
}) {
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

function ProgressCard({
  label,
  value,
  tone,
  display,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'blue';
  display?: string;
}) {
  const styles = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{display || `${value}%`}</div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${styles}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
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
