'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  GitBranch,
  Layers3,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

type NodeKind = 'Company' | 'Division' | 'Business Unit' | 'Department' | 'Team';
type HealthStatus = 'Healthy' | 'Needs Attention' | 'Critical';

type OrgNode = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  kind: NodeKind;
  leader: string;
  location: string;
  headcount: number;
  openRoles: number;
  budgetNgn: number;
  payrollNgn: number;
  spanOfControl: number;
  successionCoveragePct: number;
  attritionRiskPct: number;
  healthStatus: HealthStatus;
  costCenter: string;
  description: string;
  childCount: number;
  descendantCount: number;
};

type StructureInsight = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  recommendation: string;
};

type Payload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  dataSource?: {
    source: string;
    databaseAvailable: boolean;
    warning: string | null;
    employeeCount: number;
    structureSource: string;
    migratedEntityCount: number;
    migrationWarning: string | null;
  };
  summary: {
    totalUnits: number;
    totalHeadcount: number;
    totalOpenRoles: number;
    avgSuccessionCoverage: number;
    avgSpanOfControl: number;
    criticalUnits: number;
    attentionUnits: number;
  };
  filterOptions: {
    kinds: NodeKind[];
    locations: string[];
    healthStatuses: HealthStatus[];
  };
  nodes: OrgNode[];
  insights: StructureInsight[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

const kindOrder: NodeKind[] = ['Company', 'Division', 'Business Unit', 'Department', 'Team'];

const healthTone = (status: HealthStatus) => {
  if (status === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Needs Attention') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const severityTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function CompanyStructureClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'All' | NodeKind>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | HealthStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/hris/organization/company-structure', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load company structure');

      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.nodes.find((node) => node.parentId === null)?.id || null);
      setExpandedIds(() => new Set(data.nodes.filter((node) => node.kind === 'Company' || node.kind === 'Division').map((node) => node.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load company structure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const nodes = useMemo(() => payload?.nodes || [], [payload]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrgNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>();
    nodes.forEach((node) => {
      const current = map.get(node.parentId) || [];
      current.push(node);
      map.set(node.parentId, current);
    });
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const kindCompare = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
        return kindCompare !== 0 ? kindCompare : a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [nodes]);

  const rootNode = useMemo(() => nodes.find((node) => node.parentId === null) || null, [nodes]);

  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    const directMatches = nodes.filter((node) => {
      if (kindFilter !== 'All' && node.kind !== kindFilter) return false;
      if (locationFilter !== 'All' && node.location !== locationFilter) return false;
      if (healthFilter !== 'All' && node.healthStatus !== healthFilter) return false;
      if (!q) return true;

      return [
        node.name,
        node.code,
        node.leader,
        node.location,
        node.description,
        node.costCenter,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    const visible = new Set<string>();
    directMatches.forEach((node) => {
      let current: OrgNode | undefined = node;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? nodeMap.get(current.parentId) : undefined;
      }
    });

    return visible;
  }, [nodes, query, kindFilter, locationFilter, healthFilter, nodeMap]);

  const visibleNodes = useMemo(() => {
    if (!query.trim() && kindFilter === 'All' && locationFilter === 'All' && healthFilter === 'All') return nodes;
    return nodes.filter((node) => filteredIds.has(node.id));
  }, [nodes, filteredIds, query, kindFilter, locationFilter, healthFilter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return rootNode;
    return nodeMap.get(selectedId) || rootNode;
  }, [selectedId, nodeMap, rootNode]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;

    const rows = [
      [
        'Name',
        'Code',
        'Type',
        'Leader',
        'Location',
        'Health',
        'Headcount',
        'Open Roles',
        'Budget NGN',
        'Payroll NGN',
        'Span Of Control',
        'Succession Coverage %',
        'Attrition Risk %',
        'Cost Center',
      ],
      ...visibleNodes.map((node) => [
        node.name,
        node.code,
        node.kind,
        node.leader,
        node.location,
        node.healthStatus,
        String(node.headcount),
        String(node.openRoles),
        String(node.budgetNgn),
        String(node.payrollNgn),
        String(node.spanOfControl),
        String(node.successionCoveragePct),
        String(node.attritionRiskPct),
        node.costCenter,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'company-structure.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const expandAll = () => setExpandedIds(new Set(nodes.map((node) => node.id)));
  const collapseAll = () => setExpandedIds(new Set(rootNode ? [rootNode.id] : []));

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = (childrenByParent.get(parentId) || []).filter((node) => visibleNodeIds.has(node.id));
    if (!children.length) return null;

    return children.map((node) => {
      const hasChildren = ((childrenByParent.get(node.id) || []).filter((child) => visibleNodeIds.has(child.id))).length > 0;
      const expanded = expandedIds.has(node.id);
      const active = selectedNode?.id === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => setSelectedId(node.id)}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-dle-blue/10 border border-dle-blue/20' : 'hover:bg-slate-50 border border-transparent'}`}
            style={{ paddingLeft: `${12 + depth * 18}px` }}
          >
            <span
              className="w-6 h-6 shrink-0 rounded-lg border border-slate-200 bg-white flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleExpanded(node.id);
              }}
            >
              {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />) : <span className="w-2 h-2 rounded-full bg-slate-300" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 truncate">{node.name}</span>
              <span className="block text-[11px] text-slate-500 font-medium">{node.kind} • {node.code}</span>
            </span>
            <span className={`shrink-0 px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(node.healthStatus)}`}>
              {node.healthStatus}
            </span>
          </button>
          {hasChildren && expanded ? renderTree(node.id, depth + 1) : null}
        </div>
      );
    });
  };

  return (
    <PageTemplate
      title="Company Structure"
      description="Explore the enterprise organization hierarchy, leadership coverage, unit health, and workforce structure with searchable, export-ready organization data."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Organization', href: '/hris/organization' },
        { label: 'Company Structure' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={Building2} label="Organization Units" value={payload ? formatNumber(payload.summary.totalUnits) : '—'} detail="All active nodes in structure" />
        <MetricCard icon={Users} label="Headcount" value={payload ? formatNumber(payload.summary.totalHeadcount) : '—'} detail="Structured workforce coverage" />
        <MetricCard icon={Network} label="Open Roles" value={payload ? formatNumber(payload.summary.totalOpenRoles) : '—'} detail="Open approved positions" />
        <MetricCard icon={ShieldCheck} label="Succession Coverage" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} detail="Average role coverage readiness" />
        <MetricCard icon={GitBranch} label="Avg Span Of Control" value={payload ? `${payload.summary.avgSpanOfControl}` : '—'} detail="Managerial distribution" />
      </div>

      {payload?.dataSource ? (
        <div className={`rounded-2xl border p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 ${payload.dataSource.warning || payload.dataSource.migrationWarning ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${payload.dataSource.warning || payload.dataSource.migrationWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <Database className="w-5 h-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">Live organization structure source</div>
              <div className="text-xs text-slate-600 mt-1">
                {payload.dataSource.structureSource} from {payload.dataSource.source}; {formatNumber(payload.dataSource.employeeCount)} employee records produced {formatNumber(payload.dataSource.migratedEntityCount)} organization entities.
              </div>
              {payload.dataSource.warning || payload.dataSource.migrationWarning ? (
                <div className="text-xs font-semibold text-amber-800 mt-2">{payload.dataSource.warning || payload.dataSource.migrationWarning}</div>
              ) : (
                <div className="text-xs font-semibold text-emerald-800 mt-2">No mock structure is being used. Current entities are generated from the Sage-backed employee/payroll source.</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-[11px] font-semibold text-slate-700">
              DB: {payload.dataSource.databaseAvailable ? 'Available' : 'Fallback'}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-[11px] font-semibold text-slate-700">
              Generated: {new Date(payload.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, leader, location, cost center..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
            />
          </label>
          <Select value={kindFilter} onChange={(v) => setKindFilter(v as 'All' | NodeKind)} options={['All', ...(payload?.filterOptions.kinds || [])]} />
          <Select value={locationFilter} onChange={(v) => setLocationFilter(v as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} />
          <Select value={healthFilter} onChange={(v) => setHealthFilter(v as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={expandAll} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Expand All
          </button>
          <button type="button" onClick={collapseAll} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Collapse All
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setKindFilter('All');
              setLocationFilter('All');
              setHealthFilter('All');
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Hierarchy Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Browse the company structure tree and inspect leadership layers.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
              Visible units: {formatNumber(visibleNodes.length)}
            </span>
          </div>
          <div className="p-4 min-h-[520px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading company structure...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : (
              <div className="space-y-1">{renderTree(null)}</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Unit Detail</div>
              <div className="text-xs text-slate-500 mt-1">Operational, workforce, and governance detail for the selected structure node.</div>
            </div>
            <div className="p-5">
              {selectedNode ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedNode.kind}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedNode.healthStatus)}`}>{selectedNode.healthStatus}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedNode.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedNode.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Leader" value={selectedNode.leader} />
                    <DetailStat label="Location" value={selectedNode.location} />
                    <DetailStat label="Cost Center" value={selectedNode.costCenter} />
                    <DetailStat label="Direct Children" value={formatNumber(selectedNode.childCount)} />
                    <DetailStat label="Headcount" value={formatNumber(selectedNode.headcount)} />
                    <DetailStat label="Open Roles" value={formatNumber(selectedNode.openRoles)} />
                    <DetailStat label="Budget" value={formatCurrency(selectedNode.budgetNgn)} />
                    <DetailStat label="Payroll" value={formatCurrency(selectedNode.payrollNgn)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ProgressCard label="Succession Coverage" value={selectedNode.successionCoveragePct} tone="emerald" />
                    <ProgressCard label="Attrition Risk" value={selectedNode.attritionRiskPct} tone="amber" />
                    <ProgressCard label="Span Of Control" value={Math.min(selectedNode.spanOfControl * 10, 100)} tone="blue" display={`${selectedNode.spanOfControl}`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-700">Structure Notes</div>
                    <div className="text-sm text-slate-600 mt-2">
                      This unit governs {formatNumber(selectedNode.descendantCount)} downstream nodes and carries {formatNumber(selectedNode.openRoles)} open roles.
                      {selectedNode.healthStatus === 'Critical'
                        ? ' Immediate structure and talent intervention is recommended.'
                        : selectedNode.healthStatus === 'Needs Attention'
                          ? ' Review leader coverage, capacity, and workforce continuity.'
                          : ' Structure health is within acceptable operating thresholds.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a unit to inspect its structure detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-slate-900">Structure Insights</div>
                <div className="text-xs text-slate-500 mt-1">Priority observations for organization design and governance review.</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {(payload?.insights || []).map((insight) => (
                <div key={insight.id} className={`rounded-2xl border p-4 ${severityTone(insight.severity)}`}>
                  <div className="text-sm font-semibold text-slate-900">{insight.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{insight.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900">Structure Registry</div>
            <div className="text-xs text-slate-500 mt-1">Searchable operational registry of visible organization units.</div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
            Rows: {formatNumber(visibleNodes.length)}
          </span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Unit', 'Type', 'Leader', 'Location', 'Headcount', 'Open Roles', 'Health', 'Succession', 'Attrition'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleNodes.map((node) => (
                <tr key={node.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(node.id)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{node.name}</div>
                    <div className="text-xs text-slate-500">{node.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{node.kind}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{node.leader}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{node.location}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(node.headcount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(node.openRoles)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(node.healthStatus)}`}>{node.healthStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{node.successionCoveragePct}%</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{node.attritionRiskPct}%</td>
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
  const styles =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-blue-500';

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
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
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
  );
}
