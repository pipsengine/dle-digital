'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Building2,
  Download,
  Layers3,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { HealthStatus, StructureInsight, UnitSectionRecord } from '@/lib/organization-data';

type Payload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  summary: {
    totalRecords: number;
    totalUnits: number;
    totalSections: number;
    totalHeadcount: number;
    totalOpenRoles: number;
    avgSuccessionCoverage: number;
    avgAttritionRisk: number;
  };
  filterOptions: {
    recordTypes: Array<'Unit' | 'Section'>;
    locations: string[];
    healthStatuses: HealthStatus[];
    parentUnits: string[];
  };
  records: UnitSectionRecord[];
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

export default function UnitsSectionsClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'All' | 'Unit' | 'Section'>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | HealthStatus>('All');
  const [parentFilter, setParentFilter] = useState<'All' | string>('All');
  const [sortBy, setSortBy] = useState<'headcount' | 'openRoles' | 'successionCoveragePct' | 'attritionRiskPct'>('headcount');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/units-sections', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load units and sections');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.records[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load units and sections');
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
      if (locationFilter !== 'All' && record.location !== locationFilter) return false;
      if (healthFilter !== 'All' && record.healthStatus !== healthFilter) return false;
      if (parentFilter !== 'All' && record.parentName !== parentFilter) return false;
      if (!q) return true;

      return [
        record.name,
        record.code,
        record.leader,
        record.location,
        record.description,
        record.costCenter,
        record.parentName,
        record.parentChain.join(' '),
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
  }, [records, query, recordTypeFilter, locationFilter, healthFilter, parentFilter, sortBy]);

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
        'Code',
        'Parent',
        'Leader',
        'Location',
        'Health',
        'Headcount',
        'Open Roles',
        'Related Departments',
        'Related Sections',
        'Succession Coverage %',
        'Attrition Risk %',
        'Budget USD',
        'Payroll USD',
        'Cost Center',
      ],
      ...visibleRecords.map((record) => [
        record.name,
        record.recordType,
        record.code,
        record.parentName || '—',
        record.leader,
        record.location,
        record.healthStatus,
        String(record.headcount),
        String(record.openRoles),
        String(record.relatedDepartmentCount),
        String(record.relatedTeamCount),
        String(record.successionCoveragePct),
        String(record.attritionRiskPct),
        String(record.budgetUsd),
        String(record.payrollUsd),
        record.costCenter,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'units-sections.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTemplate
      title="Units & Sections"
      description="Review organization units and execution sections through a shared operational lens covering leadership, workforce scale, coverage readiness, and structure health."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Organization', href: '/hris/organization' },
        { label: 'Units & Sections' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={Layers3} label="Total Records" value={payload ? formatNumber(payload.summary.totalRecords) : '—'} detail="Units and sections in view" />
        <MetricCard icon={Building2} label="Units" value={payload ? formatNumber(payload.summary.totalUnits) : '—'} detail="Business-unit operating nodes" />
        <MetricCard icon={Network} label="Sections" value={payload ? formatNumber(payload.summary.totalSections) : '—'} detail="Team and section execution nodes" />
        <MetricCard icon={Users} label="Headcount" value={payload ? formatNumber(payload.summary.totalHeadcount) : '—'} detail="Combined workforce footprint" />
        <MetricCard icon={ShieldCheck} label="Succession" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} detail="Average continuity coverage" />
        <MetricCard icon={AlertTriangle} label="Attrition Risk" value={payload ? `${payload.summary.avgAttritionRisk}%` : '—'} detail="Average structural risk" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search unit, section, leader, location, cost center..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={recordTypeFilter} onChange={(value) => setRecordTypeFilter(value as typeof recordTypeFilter)} options={['All', ...(payload?.filterOptions.recordTypes || [])]} labels={{ All: 'All Types' }} />
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={healthFilter} onChange={(value) => setHealthFilter(value as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} labels={{ All: 'All Health States' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[240px_240px] gap-3">
          <Select value={parentFilter} onChange={(value) => setParentFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.parentUnits || [])]} labels={{ All: 'All Parents' }} />
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
            setLocationFilter('All');
            setHealthFilter('All');
            setParentFilter('All');
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
              <div className="text-sm font-bold text-slate-900">Record Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Browse filtered units and sections by operational posture and leadership coverage.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
              Showing: {formatNumber(visibleRecords.length)}
            </span>
          </div>
          <div className="p-4 space-y-3 min-h-[520px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading units and sections...</div>
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
                          {record.recordType} <span className="mx-2">•</span> {record.parentName || 'No parent'} <span className="mx-2">•</span> {record.leader}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(record.healthStatus)}`}>
                        {record.healthStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Headcount: {formatNumber(record.headcount)}</span>
                      <span>Open Roles: {formatNumber(record.openRoles)}</span>
                      <span>Succession: {record.successionCoveragePct}%</span>
                      <span>Attrition: {record.attritionRiskPct}%</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No records match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Record Detail</div>
              <div className="text-xs text-slate-500 mt-1">Detailed structure, workforce, and governance view for the selected unit or section.</div>
            </div>
            <div className="p-5">
              {selectedRecord ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedRecord.recordType}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedRecord.code}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedRecord.healthStatus)}`}>
                        {selectedRecord.healthStatus}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedRecord.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedRecord.description}</p>
                    <div className="text-xs text-slate-500 mt-2">{selectedRecord.parentChain.join(' / ') || 'Top-level path not available'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Leader" value={selectedRecord.leader} />
                    <DetailStat label="Parent" value={selectedRecord.parentName || '—'} />
                    <DetailStat label="Location" value={selectedRecord.location} />
                    <DetailStat label="Cost Center" value={selectedRecord.costCenter} />
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
                      <div className="text-sm font-semibold text-slate-900">Related Structure</div>
                      <span className="text-xs text-slate-500">
                        Departments: {formatNumber(selectedRecord.relatedDepartmentCount)} • Sections: {formatNumber(selectedRecord.relatedTeamCount)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Related workforce footprint: {formatNumber(selectedRecord.relatedHeadcount)}
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedRecord.relatedItems.length ? (
                        selectedRecord.relatedItems.map((item) => (
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
                        ))
                      ) : (
                        <div className="text-sm text-slate-600">
                          {selectedRecord.recordType === 'Unit'
                            ? 'No downstream departments or sections are currently linked to this unit in the shared seed data.'
                            : 'This section is already the lowest recorded execution layer in the shared seed data.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a record to inspect its operating detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-slate-900">Operational Insights</div>
                <div className="text-xs text-slate-500 mt-1">Priority observations across units and sections for organization review.</div>
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
          <div className="text-sm font-bold text-slate-900">Units & Sections Registry</div>
          <div className="text-xs text-slate-500 mt-1">Searchable audit table of all visible unit and section records.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Name', 'Type', 'Parent', 'Location', 'Leader', 'Headcount', 'Open Roles', 'Health', 'Succession', 'Attrition'].map((header) => (
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
                    <div className="text-xs text-slate-500">{record.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.recordType}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.parentName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.location}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.leader}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(record.headcount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(record.openRoles)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(record.healthStatus)}`}>{record.healthStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.successionCoveragePct}%</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.attritionRiskPct}%</td>
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
