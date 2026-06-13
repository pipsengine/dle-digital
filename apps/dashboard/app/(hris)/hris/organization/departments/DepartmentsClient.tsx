'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Download,
  Layers3,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { DepartmentRecord, HealthStatus, StructureInsight } from '@/lib/organization-data';

type Payload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  summary: {
    totalDepartments: number;
    totalHeadcount: number;
    totalOpenRoles: number;
    totalTeams: number;
    avgSuccessionCoverage: number;
    avgAttritionRisk: number;
    criticalDepartments: number;
    needsAttentionDepartments: number;
  };
  filterOptions: {
    locations: string[];
    healthStatuses: HealthStatus[];
    parentUnits: string[];
  };
  departments: DepartmentRecord[];
  insights: StructureInsight[];
};

type DepartmentsClientProps = {
  initialPayload?: Payload | null;
  initialError?: string | null;
};

type DepartmentForm = {
  id?: string;
  name: string;
  code: string;
  parentName: string;
  leader: string;
  location: string;
  healthStatus: HealthStatus;
  openRoles: string;
  budgetNgn: string;
  spanOfControl: string;
  successionCoveragePct: string;
  attritionRiskPct: string;
  costCenter: string;
  description: string;
};

const emptyForm: DepartmentForm = {
  name: '',
  code: '',
  parentName: '',
  leader: '',
  location: '',
  healthStatus: 'Healthy',
  openRoles: '0',
  budgetNgn: '0',
  spanOfControl: '0',
  successionCoveragePct: '0',
  attritionRiskPct: '0',
  costCenter: '',
  description: '',
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

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

export default function DepartmentsClient({ initialPayload = null, initialError = null }: DepartmentsClientProps) {
  const [payload, setPayload] = useState<Payload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload && !initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | HealthStatus>('All');
  const [parentUnitFilter, setParentUnitFilter] = useState<'All' | string>('All');
  const [sortBy, setSortBy] = useState<'headcount' | 'openRoles' | 'successionCoveragePct' | 'attritionRiskPct'>('headcount');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/departments', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load departments');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.departments[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPayload || initialError) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [initialPayload, initialError]);

  const departments = payload?.departments || [];

  const visibleDepartments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = departments.filter((department) => {
      if (locationFilter !== 'All' && department.location !== locationFilter) return false;
      if (healthFilter !== 'All' && department.healthStatus !== healthFilter) return false;
      if (parentUnitFilter !== 'All' && department.parentName !== parentUnitFilter) return false;
      if (!q) return true;

      return [
        department.name,
        department.code,
        department.leader,
        department.location,
        department.description,
        department.costCenter,
        department.parentName,
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
  }, [departments, query, locationFilter, healthFilter, parentUnitFilter, sortBy]);

  const selectedDepartment = useMemo(() => {
    return visibleDepartments.find((department) => department.id === selectedId) || visibleDepartments[0] || null;
  }, [visibleDepartments, selectedId]);

  const openCreate = () => {
    setFormMode('create');
    setForm(emptyForm);
    setActionError(null);
    setModalOpen(true);
  };

  const openEdit = (department: DepartmentRecord) => {
    setSelectedId(department.id);
    setFormMode('edit');
    setForm({
      id: department.id,
      name: department.name,
      code: department.code,
      parentName: department.parentName || '',
      leader: department.leader,
      location: department.location,
      healthStatus: department.healthStatus,
      openRoles: String(department.openRoles),
      budgetNgn: String(department.budgetNgn),
      spanOfControl: String(department.spanOfControl),
      successionCoveragePct: String(department.successionCoveragePct),
      attritionRiskPct: String(department.attritionRiskPct),
      costCenter: department.costCenter,
      description: department.description,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const requestPayload = () => ({
    ...form,
    openRoles: Number(form.openRoles || 0),
    budgetNgn: Number(form.budgetNgn || 0),
    spanOfControl: Number(form.spanOfControl || 0),
    successionCoveragePct: Number(form.successionCoveragePct || 0),
    attritionRiskPct: Number(form.attritionRiskPct || 0),
  });

  const applyPayload = (data: Payload) => {
    setPayload(data);
    setSelectedId((prev) => (prev && data.departments.some((department) => department.id === prev) ? prev : data.departments[0]?.id || null));
  };

  const saveDepartment = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch('/api/hris/organization/departments', {
        method: formMode === 'create' ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestPayload()),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to save department');
      applyPayload(json.data as Payload);
      setModalOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to save department');
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async () => {
    if (!form.id || !window.confirm('Delete this department? Departments with assigned employees cannot be deleted.')) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/hris/organization/departments?id=${encodeURIComponent(form.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to delete department');
      applyPayload(json.data as Payload);
      setModalOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to delete department');
    } finally {
      setSaving(false);
    }
  };

  const syncFromEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/departments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'refresh-from-system' }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to sync departments');
      applyPayload(json.data as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sync departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDepartment || !visibleDepartments.length) return;
    const timer = window.setTimeout(() => setSelectedId(visibleDepartments[0].id), 0);
    return () => window.clearTimeout(timer);
  }, [selectedDepartment, visibleDepartments]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      [
        'Department',
        'Code',
        'Parent Unit',
        'Leader',
        'Location',
        'Health',
        'Headcount',
        'Open Roles',
        'Teams',
        'Team Headcount',
        'Succession Coverage %',
        'Attrition Risk %',
        'Budget NGN',
        'Payroll NGN',
        'Cost Center',
      ],
      ...visibleDepartments.map((department) => [
        department.name,
        department.code,
        department.parentName || '—',
        department.leader,
        department.location,
        department.healthStatus,
        String(department.headcount),
        String(department.openRoles),
        String(department.teamCount),
        String(department.teamHeadcount),
        String(department.successionCoveragePct),
        String(department.attritionRiskPct),
        String(department.budgetNgn),
        String(department.payrollNgn),
        department.costCenter,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'departments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTemplate
      title="Departments"
      description="Manage departmental structure, leadership accountability, workforce scale, succession coverage, and team composition from a department-centric operating view."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Organization', href: '/hris/organization' },
        { label: 'Departments' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={Building2} label="Departments" value={payload ? formatNumber(payload.summary.totalDepartments) : '—'} detail="Active department units" />
        <MetricCard icon={Users} label="Headcount" value={payload ? formatNumber(payload.summary.totalHeadcount) : '—'} detail="Department workforce base" />
        <MetricCard icon={BriefcaseBusiness} label="Open Roles" value={payload ? formatNumber(payload.summary.totalOpenRoles) : '—'} detail="Approved vacancies" />
        <MetricCard icon={Layers3} label="Teams" value={payload ? formatNumber(payload.summary.totalTeams) : '—'} detail="Teams under departments" />
        <MetricCard icon={ShieldCheck} label="Succession" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} detail="Average coverage strength" />
        <MetricCard icon={AlertTriangle} label="Attrition Risk" value={payload ? `${payload.summary.avgAttritionRisk}%` : '—'} detail="Average department risk" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search department, leader, location, cost center..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} />
        <Select value={healthFilter} onChange={(value) => setHealthFilter(value as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} />
        <Select value={parentUnitFilter} onChange={(value) => setParentUnitFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.parentUnits || [])]} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-slate-700">Sort by</span>
          <Select
            value={sortBy}
            onChange={(value) => setSortBy(value as typeof sortBy)}
            options={['headcount', 'openRoles', 'successionCoveragePct', 'attritionRiskPct']}
            labels={{
              headcount: 'Headcount',
              openRoles: 'Open Roles',
              successionCoveragePct: 'Succession Coverage',
              attritionRiskPct: 'Attrition Risk',
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dle-blue text-white text-xs font-semibold hover:bg-dle-blue/90"
          >
            <Plus className="w-4 h-4" />
            New Department
          </button>
          <button
            type="button"
            onClick={() => void syncFromEmployees()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className="w-4 h-4" />
            Sync
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setLocationFilter('All');
              setHealthFilter('All');
              setParentUnitFilter('All');
              setSortBy('headcount');
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Department Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Filtered operational view of all departments and their health posture.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
              Showing: {formatNumber(visibleDepartments.length)}
            </span>
          </div>
          <div className="p-4 space-y-3 min-h-[520px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading departments...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : visibleDepartments.length ? (
              visibleDepartments.map((department) => {
                const active = selectedDepartment?.id === department.id;
                return (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() => setSelectedId(department.id)}
                    onDoubleClick={() => openEdit(department)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-dle-blue/30 bg-dle-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{department.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {department.parentName || '—'} <span className="mx-2">•</span> {department.leader}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(department.healthStatus)}`}>
                        {department.healthStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Headcount: {formatNumber(department.headcount)}</span>
                      <span>Open Roles: {formatNumber(department.openRoles)}</span>
                      <span>Teams: {formatNumber(department.teamCount)}</span>
                      <span>Succession: {department.successionCoveragePct}%</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No departments match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Department Detail</div>
              <div className="text-xs text-slate-500 mt-1">Leadership, structure, workforce, and governance indicators for the selected department.</div>
            </div>
            <div className="p-5">
              {selectedDepartment ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{selectedDepartment.code}</span>
                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedDepartment.healthStatus)}`}>
                          {selectedDepartment.healthStatus}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(selectedDepartment)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedDepartment.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedDepartment.description}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      {selectedDepartment.parentChain.join(' / ')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Leader" value={selectedDepartment.leader} />
                    <DetailStat label="Parent Unit" value={selectedDepartment.parentName || '—'} />
                    <DetailStat label="Location" value={selectedDepartment.location} />
                    <DetailStat label="Cost Center" value={selectedDepartment.costCenter} />
                    <DetailStat label="Headcount" value={formatNumber(selectedDepartment.headcount)} />
                    <DetailStat label="Open Roles" value={formatNumber(selectedDepartment.openRoles)} />
                    <DetailStat label="Budget" value={formatCurrency(selectedDepartment.budgetNgn)} />
                    <DetailStat label="Payroll" value={formatCurrency(selectedDepartment.payrollNgn)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ProgressCard label="Succession Coverage" value={selectedDepartment.successionCoveragePct} tone="emerald" />
                    <ProgressCard label="Attrition Risk" value={selectedDepartment.attritionRiskPct} tone="amber" />
                    <ProgressCard label="Span Of Control" value={Math.min(selectedDepartment.spanOfControl * 10, 100)} tone="blue" display={`${selectedDepartment.spanOfControl}`} />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Team Composition</div>
                      <span className="text-xs text-slate-500">
                        {formatNumber(selectedDepartment.teamCount)} teams • {formatNumber(selectedDepartment.teamHeadcount)} team headcount
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedDepartment.teams.length ? (
                        selectedDepartment.teams.map((team) => (
                          <div key={team.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{team.name}</div>
                                <div className="text-xs text-slate-500 mt-1">{team.leader}</div>
                              </div>
                              <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(team.healthStatus)}`}>{team.healthStatus}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                              <span>Headcount: {formatNumber(team.headcount)}</span>
                              <span>Open Roles: {formatNumber(team.openRoles)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-600">No child teams registered under this department.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a department to inspect its operating detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-slate-900">Department Insights</div>
                <div className="text-xs text-slate-500 mt-1">Priority observations for departmental structure, hiring pressure, and continuity readiness.</div>
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
          <div className="text-sm font-bold text-slate-900">Department Registry</div>
          <div className="text-xs text-slate-500 mt-1">Searchable audit view of all visible departments and their workforce posture.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Department', 'Parent', 'Location', 'Leader', 'Headcount', 'Open Roles', 'Teams', 'Health', 'Succession', 'Attrition'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDepartments.map((department) => (
                <tr
                  key={department.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedId(department.id)}
                  onDoubleClick={() => openEdit(department)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{department.name}</div>
                    <div className="text-xs text-slate-500">{department.code}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{department.parentName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{department.location}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{department.leader}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(department.headcount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(department.openRoles)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(department.teamCount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(department.healthStatus)}`}>{department.healthStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{department.successionCoveragePct}%</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{department.attritionRiskPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{formMode === 'create' ? 'New Department' : 'Edit Department'}</div>
                <div className="text-xs text-slate-500 mt-1">Maintain department ownership, location, controls, and operating indicators.</div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
                aria-label="Close department editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(92vh-145px)]">
              {actionError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{actionError}</div> : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Department Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
                <FormField
                  label="Department Code"
                  value={form.code}
                  onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))}
                  disabled={formMode === 'edit'}
                  required
                />
                <FormField label="Parent Unit" value={form.parentName} onChange={(value) => setForm((prev) => ({ ...prev, parentName: value }))} />
                <FormField label="Leader" value={form.leader} onChange={(value) => setForm((prev) => ({ ...prev, leader: value }))} />
                <FormField label="Location" value={form.location} onChange={(value) => setForm((prev) => ({ ...prev, location: value }))} />
                <FormField label="Cost Center" value={form.costCenter} onChange={(value) => setForm((prev) => ({ ...prev, costCenter: value }))} />
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-600">Health Status</span>
                  <Select
                    value={form.healthStatus}
                    onChange={(value) => setForm((prev) => ({ ...prev, healthStatus: value as HealthStatus }))}
                    options={['Healthy', 'Needs Attention', 'Critical']}
                  />
                </label>
                <NumberField label="Open Roles" value={form.openRoles} onChange={(value) => setForm((prev) => ({ ...prev, openRoles: value }))} />
                <NumberField label="Budget NGN" value={form.budgetNgn} onChange={(value) => setForm((prev) => ({ ...prev, budgetNgn: value }))} />
                <NumberField label="Span Of Control" value={form.spanOfControl} onChange={(value) => setForm((prev) => ({ ...prev, spanOfControl: value }))} />
                <NumberField label="Succession Coverage %" value={form.successionCoveragePct} onChange={(value) => setForm((prev) => ({ ...prev, successionCoveragePct: value }))} min={0} max={100} />
                <NumberField label="Attrition Risk %" value={form.attritionRiskPct} onChange={(value) => setForm((prev) => ({ ...prev, attritionRiskPct: value }))} min={0} max={100} />
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
                  />
                </label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50">
              <div>
                {formMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => void deleteDepartment()}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveDepartment()}
                  disabled={saving || !form.name.trim() || !form.code.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-dle-blue text-xs font-semibold text-white hover:bg-dle-blue/90 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageTemplate>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  detail: string;
  tone?: 'blue' | 'cyan' | 'indigo' | 'slate' | 'emerald' | 'amber';
}) {
  const inferredTone =
    tone ||
    ({
      Departments: 'blue',
      Headcount: 'cyan',
      'Open Roles': 'indigo',
      Teams: 'slate',
      Succession: 'emerald',
      'Attrition Risk': 'amber',
    }[label] as NonNullable<typeof tone>) ||
    'blue';
  const styles = {
    blue: 'from-sky-50 to-white border-sky-100 text-sky-700 bg-sky-100',
    cyan: 'from-cyan-50 to-white border-cyan-100 text-cyan-700 bg-cyan-100',
    indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-700 bg-indigo-100',
    slate: 'from-slate-50 to-white border-slate-200 text-slate-700 bg-slate-100',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700 bg-emerald-100',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-700 bg-amber-100',
  }[inferredTone];
  const [gradientFrom, gradientTo, border, text, iconBg] = styles.split(' ');

  return (
    <div className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-2xl shadow-sm border ${border} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
          <div className="text-xs text-slate-500 mt-2">{detail}</div>
        </div>
        <span className={`w-10 h-10 rounded-2xl ${iconBg} ${text} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
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
  const cardBg =
    tone === 'emerald'
      ? 'from-emerald-50 to-white border-emerald-100'
      : tone === 'amber'
        ? 'from-amber-50 to-white border-amber-100'
        : 'from-blue-50 to-white border-blue-100';

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${cardBg} p-4`}>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{display || `${value}%`}</div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${styles}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-dle-blue/20 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
      />
    </label>
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
