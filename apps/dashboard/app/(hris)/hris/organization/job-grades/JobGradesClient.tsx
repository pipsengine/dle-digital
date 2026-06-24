'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BriefcaseBusiness,
  ChevronRight,
  Database,
  Download,
  GitBranch,
  Layers3,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { HealthStatus, JobGradeRecord, StructureInsight } from '@/lib/organization-data';

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
    migratedGradeCount: number;
    migrationWarning: string | null;
    independence: string;
  };
  summary: {
    totalGrades: number;
    totalEmployees: number;
    totalOpenPositions: number;
    avgSuccessionCoverage: number;
    avgAttritionRisk: number;
    avgInternalMobility: number;
    criticalGrades: number;
    needsAttentionGrades: number;
  };
  filterOptions: {
    families: string[];
    levels: string[];
    healthStatuses: HealthStatus[];
  };
  grades: JobGradeRecord[];
  insights: StructureInsight[];
};

type TabId = 'overview' | 'explorer' | 'analytics' | 'succession' | 'compensation';

const tabs: Array<{ id?: TabId; label: string; href?: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'explorer', label: 'Grade Explorer' },
  { id: 'analytics', label: 'Grade Analytics' },
  { id: 'succession', label: 'Succession Planning' },
  { id: 'compensation', label: 'Compensation Bands' },
  { label: 'Workforce Planning', href: '/hris/organization/workforce-planning' },
];

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

const roleCoverageStatus = (pct: number) => {
  if (pct >= 70) return { label: 'Covered', tone: 'emerald' as const };
  if (pct >= 40) return { label: 'At Risk', tone: 'amber' as const };
  return { label: 'Critical', tone: 'red' as const };
};

export default function JobGradesClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<'All' | string>('All');
  const [levelFilter, setLevelFilter] = useState<'All' | string>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | HealthStatus>('All');
  const [sortBy, setSortBy] = useState<'employeeCount' | 'openPositions' | 'successionCoveragePct' | 'attritionRiskPct'>('employeeCount');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [form, setForm] = useState({
    code: '',
    name: '',
    family: 'Professional',
    level: 'Mid',
    minSalaryNgn: '0',
    midpointSalaryNgn: '0',
    maxSalaryNgn: '0',
    employeeCount: '0',
    openPositions: '0',
    successionCoveragePct: '70',
    attritionRiskPct: '8',
    internalMobilityPct: '20',
    averageTenureYears: '4',
    femaleRepresentationPct: '30',
    healthStatus: 'Healthy',
    benchmarkPosition: '',
    nextGradeCode: '',
    keyRoles: '',
    gradeMix: '',
    description: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/job-grades', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load job grades');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.grades[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load job grades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grades = useMemo(() => payload?.grades || [], [payload]);

  const visibleGrades = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = grades.filter((grade) => {
      if (familyFilter !== 'All' && grade.family !== familyFilter) return false;
      if (levelFilter !== 'All' && grade.level !== levelFilter) return false;
      if (healthFilter !== 'All' && grade.healthStatus !== healthFilter) return false;
      if (!q) return true;

      return [grade.code, grade.name, grade.family, grade.level, grade.benchmarkPosition, grade.keyRoles.join(' '), grade.description]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'successionCoveragePct') return b.successionCoveragePct - a.successionCoveragePct;
      if (sortBy === 'attritionRiskPct') return b.attritionRiskPct - a.attritionRiskPct;
      if (sortBy === 'openPositions') return b.openPositions - a.openPositions;
      return b.employeeCount - a.employeeCount;
    });
    return sorted;
  }, [grades, query, familyFilter, levelFilter, healthFilter, sortBy]);

  const selectedGrade = useMemo(() => {
    return visibleGrades.find((grade) => grade.id === selectedId) || visibleGrades[0] || null;
  }, [visibleGrades, selectedId]);

  const healthyGrades = useMemo(() => {
    if (!payload) return 0;
    return Math.max(payload.summary.totalGrades - payload.summary.criticalGrades - payload.summary.needsAttentionGrades, 0);
  }, [payload]);

  const topGradesByHeadcount = useMemo(
    () => [...grades].sort((a, b) => b.employeeCount - a.employeeCount).slice(0, 5),
    [grades],
  );

  const criticalGrades = useMemo(
    () =>
      [...grades]
        .filter((grade) => grade.healthStatus === 'Critical' || grade.healthStatus === 'Needs Attention')
        .sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)
        .slice(0, 4),
    [grades],
  );

  const successionMobilityMetrics = useMemo(
    () => ({
      withoutSuccessors: grades.filter((grade) => grade.successionCoveragePct < 50).length,
      criticalGradeRoles: grades.filter((grade) => grade.healthStatus === 'Critical').length,
      highMobilityGrades: grades.filter((grade) => grade.internalMobilityPct >= 50).length,
      lowMobilityGrades: grades.filter((grade) => grade.internalMobilityPct < 25).length,
      readySuccessors: grades.filter((grade) => grade.successionCoveragePct >= 70).length,
    }),
    [grades],
  );

  const gradeInsightCards = useMemo(() => {
    if (!grades.length) return [];
    const largest = [...grades].sort((a, b) => b.employeeCount - a.employeeCount)[0];
    const highestAttrition = [...grades].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
    const strongestSuccession = [...grades].sort((a, b) => b.successionCoveragePct - a.successionCoveragePct)[0];
    const highestMobility = [...grades].sort((a, b) => b.internalMobilityPct - a.internalMobilityPct)[0];
    const mostStable = [...grades].filter((grade) => grade.healthStatus === 'Healthy').sort((a, b) => a.attritionRiskPct - b.attritionRiskPct)[0] || largest;
    const highestRisk = highestAttrition;

    return [
      { label: 'Largest Workforce Grade', name: largest.name, detail: `${formatNumber(largest.employeeCount)} employees` },
      { label: 'Highest Attrition Grade', name: highestAttrition.name, detail: `${highestAttrition.attritionRiskPct}% risk` },
      { label: 'Strongest Succession Grade', name: strongestSuccession.name, detail: `${strongestSuccession.successionCoveragePct}% coverage` },
      { label: 'Highest Mobility Grade', name: highestMobility.name, detail: `${highestMobility.internalMobilityPct}% mobility` },
      { label: 'Most Stable Grade', name: mostStable.name, detail: `${100 - mostStable.attritionRiskPct}% stability` },
      { label: 'Highest Risk Grade', name: highestRisk.name, detail: `${highestRisk.healthStatus} status` },
    ];
  }, [grades]);

  const roleCoverageCards = useMemo(() => {
    if (!selectedGrade) return [];
    return selectedGrade.keyRoles.map((role, index) => {
      const coverage = Math.max(15, Math.min(95, Math.round(selectedGrade.successionCoveragePct - index * 12 + (role.length % 9))));
      return { role, coverage, ...roleCoverageStatus(coverage) };
    });
  }, [selectedGrade]);

  useEffect(() => {
    if (!selectedGrade && visibleGrades.length) setSelectedId(visibleGrades[0].id);
  }, [selectedGrade, visibleGrades]);

  const resetFilters = () => {
    setQuery('');
    setFamilyFilter('All');
    setLevelFilter('All');
    setHealthFilter('All');
    setSortBy('employeeCount');
  };

  const reviewCriticalGrades = () => {
    setHealthFilter('Critical');
    setActiveTab('overview');
    const first = grades.find((grade) => grade.healthStatus === 'Critical' || grade.healthStatus === 'Needs Attention');
    if (first) setSelectedId(first.id);
  };

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      [
        'Code',
        'Name',
        'Family',
        'Level',
        'Benchmark Position',
        'Employee Count',
        'Open Positions',
        'Succession Coverage %',
        'Attrition Risk %',
        'Internal Mobility %',
        'Average Tenure Years',
        'Female Representation %',
        'Min Salary NGN',
        'Midpoint Salary NGN',
        'Max Salary NGN',
      ],
      ...visibleGrades.map((grade) => [
        grade.code,
        grade.name,
        grade.family,
        grade.level,
        grade.benchmarkPosition,
        String(grade.employeeCount),
        String(grade.openPositions),
        String(grade.successionCoveragePct),
        String(grade.attritionRiskPct),
        String(grade.internalMobilityPct),
        String(grade.averageTenureYears),
        String(grade.femaleRepresentationPct),
        String(grade.minSalaryNgn),
        String(grade.midpointSalaryNgn),
        String(grade.maxSalaryNgn),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'job-grades.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const submitCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const createPayload = {
      code: form.code,
      name: form.name,
      family: form.family as JobGradeRecord['family'],
      level: form.level as JobGradeRecord['level'],
      minSalaryNgn: Number(form.minSalaryNgn),
      midpointSalaryNgn: Number(form.midpointSalaryNgn),
      maxSalaryNgn: Number(form.maxSalaryNgn),
      employeeCount: Number(form.employeeCount),
      openPositions: Number(form.openPositions),
      successionCoveragePct: Number(form.successionCoveragePct),
      attritionRiskPct: Number(form.attritionRiskPct),
      internalMobilityPct: Number(form.internalMobilityPct),
      averageTenureYears: Number(form.averageTenureYears),
      femaleRepresentationPct: Number(form.femaleRepresentationPct),
      healthStatus: form.healthStatus as HealthStatus,
      benchmarkPosition: form.benchmarkPosition,
      nextGradeCode: form.nextGradeCode || null,
      keyRoles: form.keyRoles.split(',').map((v) => v.trim()).filter(Boolean),
      gradeMix: form.gradeMix
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [unit, count] = line.split(':');
          return { unit: unit?.trim() || '', headcount: Number((count || '').trim()) };
        }),
      description: form.description,
    };

    try {
      const res = await fetch('/api/hris/organization/job-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to create job grade');

      setShowCreateForm(false);
      setForm({
        code: '',
        name: '',
        family: 'Professional',
        level: 'Mid',
        minSalaryNgn: '0',
        midpointSalaryNgn: '0',
        maxSalaryNgn: '0',
        employeeCount: '0',
        openPositions: '0',
        successionCoveragePct: '70',
        attritionRiskPct: '8',
        internalMobilityPct: '20',
        averageTenureYears: '4',
        femaleRepresentationPct: '30',
        healthStatus: 'Healthy',
        benchmarkPosition: '',
        nextGradeCode: '',
        keyRoles: '',
        gradeMix: '',
        description: '',
      });
      await load();
      setSelectedId(json.data.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to create job grade');
    } finally {
      setSubmitting(false);
    }
  };

  const salarySpreadPct = selectedGrade
    ? Math.round((((selectedGrade.maxSalaryNgn - selectedGrade.minSalaryNgn) / Math.max(selectedGrade.midpointSalaryNgn, 1)) * 100) * 10) / 10
    : 0;

  const compaRatio = selectedGrade ? Math.round((selectedGrade.midpointSalaryNgn / Math.max(selectedGrade.midpointSalaryNgn, 1)) * 100) : 100;
  const marketPosition = selectedGrade
    ? selectedGrade.attritionRiskPct >= 50
      ? 'Below Market'
      : selectedGrade.successionCoveragePct >= 70
        ? 'At Market'
        : 'Review Required'
    : '—';

  const aiInsightGrade = useMemo(() => {
    return [...grades].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct || a.successionCoveragePct - b.successionCoveragePct)[0] || null;
  }, [grades]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="border-b border-[#E5E7EB] bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <h1 className="text-4xl font-bold tracking-tight">Job Grades</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[#64748B]">
              Manage grade structures, salary bands, workforce classification, succession readiness, and career progression frameworks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!payload?.permissions.canExport}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export Grades
            </button>
            <Link
              href="/hris/organization/job-titles"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Layers3 className="h-4 w-4" />
              View Grade Structure
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {payload?.permissions.canEdit ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Job Grade
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        {payload?.dataSource ? (
          <div className={`flex flex-col gap-3 rounded-xl border p-4 xl:flex-row xl:items-center xl:justify-between ${payload.dataSource.warning || payload.dataSource.migrationWarning ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${payload.dataSource.warning || payload.dataSource.migrationWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <Database className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Source: {payload.dataSource.structureSource || 'DLE Enterprise HRIS'}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Grades: {formatNumber(payload.summary.totalGrades)} · Employees: {formatNumber(payload.summary.totalEmployees)} · Last Updated:{' '}
                  {new Date(payload.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {payload.dataSource.warning || payload.dataSource.migrationWarning ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">{payload.dataSource.warning || payload.dataSource.migrationWarning}</p>
                ) : null}
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#10B981]">Data Source: Live</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={BriefcaseBusiness} label="Job Grades" value={payload ? formatNumber(payload.summary.totalGrades) : '—'} detail="Configured grade bands" />
          <MetricCard icon={Users} label="Employees" value={payload ? formatNumber(payload.summary.totalEmployees) : '—'} detail="Mapped workforce population" />
          <MetricCard icon={TrendingUp} label="Open Roles" value={payload ? formatNumber(payload.summary.totalOpenPositions) : '—'} detail="Approved vacancies by grade" />
          <MetricCard icon={ShieldCheck} label="Succession Coverage" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} detail="Average coverage strength" />
          <MetricCard icon={AlertTriangle} label="Attrition Risk" value={payload ? `${payload.summary.avgAttritionRisk}%` : '—'} detail="Average grade pressure" />
          <MetricCard icon={GitBranch} label="Internal Mobility" value={payload ? `${payload.summary.avgInternalMobility}%` : '—'} detail="Average internal movement" />
        </div>

        {payload ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Grade Health Overview</h2>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#10B981]">Data Status: Live</span>
                </div>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {[
                    { count: healthyGrades, color: '#10B981' },
                    { count: payload.summary.needsAttentionGrades, color: '#F59E0B' },
                    { count: payload.summary.criticalGrades, color: '#EF4444' },
                  ].map((segment) => (
                    <div
                      key={segment.color}
                      className="h-full"
                      style={{
                        width: `${Math.max((segment.count / Math.max(payload.summary.totalGrades, 1)) * 100, segment.count ? 4 : 0)}%`,
                        backgroundColor: segment.color,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="font-semibold text-[#10B981]">Healthy Grades: {formatNumber(healthyGrades)}</span>
                  <span className="font-semibold text-[#F59E0B]">Needs Attention: {formatNumber(payload.summary.needsAttentionGrades)}</span>
                  <span className="font-semibold text-[#EF4444]">Critical Grades: {formatNumber(payload.summary.criticalGrades)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={reviewCriticalGrades}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Review Critical Grades
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
          <div className="flex min-w-max flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-max gap-1">
              {tabs.map((tab) =>
                tab.href ? (
                  <Link key={tab.label} href={tab.href} className="rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-700 hover:bg-slate-100">
                    {tab.label}
                  </Link>
                ) : (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => tab.id && setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap ${activeTab === tab.id ? 'bg-[#2563EB] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    {tab.label}
                  </button>
                ),
              )}
            </div>
            <div className="flex min-w-max flex-wrap items-center gap-2 px-1 pb-1 xl:pb-0">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search grade, family, benchmark role..."
                  className="w-64 rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </label>
              <button type="button" onClick={resetFilters} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
          <Select value={familyFilter} onChange={(value) => setFamilyFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.families || [])]} labels={{ All: 'All Families' }} />
          <Select value={levelFilter} onChange={(value) => setLevelFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.levels || [])]} labels={{ All: 'All Levels' }} />
          <Select value={healthFilter} onChange={(value) => setHealthFilter(value as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} labels={{ All: 'All Health States' }} />
          <Select
            value={sortBy}
            onChange={(value) => setSortBy(value as typeof sortBy)}
            options={['employeeCount', 'openPositions', 'successionCoveragePct', 'attritionRiskPct']}
            labels={{ employeeCount: 'Workforce', openPositions: 'Open Roles', successionCoveragePct: 'Succession Status', attritionRiskPct: 'Attrition' }}
          />
          <div className="flex items-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#64748B]">
            Showing {formatNumber(visibleGrades.length)} grades
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}

        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,340px)]">
            <GradeExplorerList
              loading={loading}
              grades={visibleGrades.slice(0, 8)}
              selectedId={selectedGrade?.id || null}
              onSelect={setSelectedId}
              compact
              onViewAll={() => setActiveTab('explorer')}
            />

            <div className="space-y-4">
              <GradeSpotlightPanel
                selectedGrade={selectedGrade}
                salarySpreadPct={salarySpreadPct}
                compaRatio={compaRatio}
                marketPosition={marketPosition}
              />
              <SalaryBandGovernancePanel
                selectedGrade={selectedGrade}
                salarySpreadPct={salarySpreadPct}
                compaRatio={compaRatio}
                marketPosition={marketPosition}
              />
              <RoleCoveragePanel roles={roleCoverageCards} />
            </div>

            <div className="space-y-4">
              <TopGradesPanel grades={topGradesByHeadcount} onSelect={setSelectedId} />
              <SuccessionMobilityPanel metrics={successionMobilityMetrics} />
              <GradeInsightCards cards={gradeInsightCards.slice(0, 4)} />
              <CriticalGradesPanel grades={criticalGrades} onSelect={setSelectedId} />
              <QuickActionsPanel onExport={exportCsv} canExport={payload?.permissions.canExport ?? false} onCreate={() => setShowCreateForm(true)} canEdit={payload?.permissions.canEdit ?? false} />
            </div>
          </div>
        ) : null}

        {activeTab === 'explorer' ? (
          <GradeExplorerList loading={loading} grades={visibleGrades} selectedId={selectedGrade?.id || null} onSelect={setSelectedId} />
        ) : null}

        {activeTab === 'analytics' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TopGradesPanel grades={topGradesByHeadcount} onSelect={setSelectedId} expanded />
            <GradeInsightCards cards={gradeInsightCards} expanded />
            <SuccessionMobilityPanel metrics={successionMobilityMetrics} expanded />
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="text-lg font-semibold">Grade Analytics Summary</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <DetailStat label="Total Grades" value={payload ? formatNumber(payload.summary.totalGrades) : '—'} />
                <DetailStat label="Avg Succession" value={payload ? `${payload.summary.avgSuccessionCoverage}%` : '—'} />
                <DetailStat label="Avg Attrition" value={payload ? `${payload.summary.avgAttritionRisk}%` : '—'} />
                <DetailStat label="Avg Mobility" value={payload ? `${payload.summary.avgInternalMobility}%` : '—'} />
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'succession' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
            <SuccessionMobilityPanel metrics={successionMobilityMetrics} expanded />
            <div className="space-y-4">
              <GradeInsightCards cards={gradeInsightCards} />
              <CriticalGradesPanel grades={criticalGrades} onSelect={setSelectedId} />
            </div>
          </div>
        ) : null}

        {activeTab === 'compensation' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SalaryBandGovernancePanel
              selectedGrade={selectedGrade || grades[0] || null}
              salarySpreadPct={salarySpreadPct}
              compaRatio={compaRatio}
              marketPosition={marketPosition}
              expanded
            />
            <GradeExplorerList
              loading={loading}
              grades={visibleGrades.slice(0, 6)}
              selectedId={selectedGrade?.id || null}
              onSelect={setSelectedId}
              title="Grades by Compensation Band"
            />
          </div>
        ) : null}

        {aiInsightGrade && aiInsightGrade.attritionRiskPct >= 40 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
              <p className="text-sm font-medium text-[#0F172A]">
                AI Insight: {aiInsightGrade.name} has the highest attrition risk ({aiInsightGrade.attritionRiskPct}%) and{' '}
                {aiInsightGrade.successionCoveragePct < 50 ? 'low' : 'moderate'} succession coverage ({aiInsightGrade.successionCoveragePct}%). Consider review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(aiInsightGrade.id);
                setActiveTab('overview');
              }}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#2563EB] hover:text-blue-700"
            >
              View AI Recommendations
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {showCreateForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Add Job Grade</div>
                <div className="text-xs text-slate-500 mt-1">Create a grade band with compensation range, workforce metrics, and role coverage.</div>
              </div>
              <button type="button" onClick={() => setShowCreateForm(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitCreate} className="max-h-[calc(92vh-145px)] overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Grade Code" value={form.code} onChange={(value) => setForm((prev) => ({ ...prev, code: value.toUpperCase() }))} placeholder="G07" />
                <Field label="Grade Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Senior Technical Lead" />
                <SelectField label="Family" value={form.family} onChange={(value) => setForm((prev) => ({ ...prev, family: value }))} options={['Executive', 'Management', 'Professional', 'Technical', 'Operations Support']} />
                <SelectField label="Level" value={form.level} onChange={(value) => setForm((prev) => ({ ...prev, level: value }))} options={['Strategic', 'Senior', 'Mid', 'Entry']} />
                <Field label="Min Salary NGN" type="number" value={form.minSalaryNgn} onChange={(value) => setForm((prev) => ({ ...prev, minSalaryNgn: value }))} />
                <Field label="Midpoint Salary NGN" type="number" value={form.midpointSalaryNgn} onChange={(value) => setForm((prev) => ({ ...prev, midpointSalaryNgn: value }))} />
                <Field label="Max Salary NGN" type="number" value={form.maxSalaryNgn} onChange={(value) => setForm((prev) => ({ ...prev, maxSalaryNgn: value }))} />
                <Field label="Benchmark Position" value={form.benchmarkPosition} onChange={(value) => setForm((prev) => ({ ...prev, benchmarkPosition: value }))} />
                <Field label="Employee Count" type="number" value={form.employeeCount} onChange={(value) => setForm((prev) => ({ ...prev, employeeCount: value }))} />
                <Field label="Open Positions" type="number" value={form.openPositions} onChange={(value) => setForm((prev) => ({ ...prev, openPositions: value }))} />
                <Field label="Succession Coverage %" type="number" value={form.successionCoveragePct} onChange={(value) => setForm((prev) => ({ ...prev, successionCoveragePct: value }))} />
                <Field label="Attrition Risk %" type="number" value={form.attritionRiskPct} onChange={(value) => setForm((prev) => ({ ...prev, attritionRiskPct: value }))} />
                <Field label="Internal Mobility %" type="number" value={form.internalMobilityPct} onChange={(value) => setForm((prev) => ({ ...prev, internalMobilityPct: value }))} />
                <SelectField label="Health Status" value={form.healthStatus} onChange={(value) => setForm((prev) => ({ ...prev, healthStatus: value }))} options={['Healthy', 'Needs Attention', 'Critical']} />
              </div>
              <TextAreaField label="Key Roles" value={form.keyRoles} onChange={(value) => setForm((prev) => ({ ...prev, keyRoles: value }))} placeholder="Lead Project Engineer, Senior Planner" />
              <TextAreaField label="Description" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} placeholder="Describe the scope and governance role of this grade." />
              {submitError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={submitting} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {submitting ? 'Creating...' : 'Create Job Grade'}
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GradeExplorerList({
  title = 'Grade Explorer',
  loading,
  grades,
  selectedId,
  onSelect,
  compact = false,
  onViewAll,
}: {
  title?: string;
  loading: boolean;
  grades: JobGradeRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
  onViewAll?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-[#64748B]">Browse grade bands by population, risk, and progression readiness.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{formatNumber(grades.length)}</span>
      </div>
      <div className={`space-y-3 overflow-y-auto p-4 ${compact ? 'max-h-[720px]' : ''}`}>
        {loading ? (
          <div className="text-sm font-medium text-slate-600">Loading job grades...</div>
        ) : grades.length ? (
          grades.map((grade) => {
            const active = selectedId === grade.id;
            return (
              <div key={grade.id} className={`rounded-xl border p-4 ${active ? 'border-[#2563EB]/30 bg-blue-50/50' : 'border-[#E5E7EB] hover:bg-slate-50'}`}>
                <button type="button" onClick={() => onSelect(grade.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{grade.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {grade.family} • {grade.benchmarkPosition}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${healthTone(grade.healthStatus)}`}>{grade.healthStatus}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>Workforce: {formatNumber(grade.employeeCount)}</span>
                    <span>Open Roles: {formatNumber(grade.openPositions)}</span>
                    <span>Succession: {grade.successionCoveragePct}%</span>
                  </div>
                </button>
                <button type="button" onClick={() => onSelect(grade.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-blue-700">
                  Open Workspace
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-sm font-medium text-slate-600">No grades match the current filters.</div>
        )}
      </div>
      {compact && onViewAll ? (
        <div className="border-t border-[#E5E7EB] px-5 py-3">
          <button type="button" onClick={onViewAll} className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:text-blue-700">
            View All Grades
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GradeSpotlightPanel({
  selectedGrade,
  salarySpreadPct,
  compaRatio,
  marketPosition,
}: {
  selectedGrade: JobGradeRecord | null;
  salarySpreadPct: number;
  compaRatio: number;
  marketPosition: string;
}) {
  if (!selectedGrade) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Select a grade to view the spotlight.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Grade Spotlight</p>
          <h3 className="mt-1 text-xl font-semibold">{selectedGrade.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{selectedGrade.code}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{selectedGrade.family}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${healthTone(selectedGrade.healthStatus)}`}>{selectedGrade.healthStatus}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DetailStat label="Grade Family" value={selectedGrade.family} />
        <DetailStat label="Benchmark Role" value={selectedGrade.benchmarkPosition} />
        <DetailStat label="Employees" value={formatNumber(selectedGrade.employeeCount)} />
        <DetailStat label="Next Grade" value={selectedGrade.nextGradeCode || 'Top Grade'} />
        <DetailStat label="Minimum Salary" value={formatCurrency(selectedGrade.minSalaryNgn)} />
        <DetailStat label="Midpoint" value={formatCurrency(selectedGrade.midpointSalaryNgn)} />
        <DetailStat label="Maximum Salary" value={formatCurrency(selectedGrade.maxSalaryNgn)} />
        <DetailStat label="Salary Spread" value={`${salarySpreadPct}%`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ProgressCard label="Succession Coverage" value={selectedGrade.successionCoveragePct} tone="emerald" />
        <ProgressCard label="Attrition Risk" value={selectedGrade.attritionRiskPct} tone="amber" />
        <ProgressCard label="Internal Mobility" value={selectedGrade.internalMobilityPct} tone="blue" />
        <ProgressCard label="Female Representation" value={selectedGrade.femaleRepresentationPct} tone="purple" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <DetailStat label="Compa-Ratio" value={`${compaRatio}%`} />
        <DetailStat label="Market Position" value={marketPosition} />
      </div>
    </div>
  );
}

function SalaryBandGovernancePanel({
  selectedGrade,
  salarySpreadPct,
  compaRatio,
  marketPosition,
  expanded = false,
}: {
  selectedGrade: JobGradeRecord | null;
  salarySpreadPct: number;
  compaRatio: number;
  marketPosition: string;
  expanded?: boolean;
}) {
  if (!selectedGrade) return null;

  const items = [
    { label: 'Minimum Salary', value: formatCurrency(selectedGrade.minSalaryNgn) },
    { label: 'Midpoint', value: formatCurrency(selectedGrade.midpointSalaryNgn) },
    { label: 'Maximum Salary', value: formatCurrency(selectedGrade.maxSalaryNgn) },
    { label: 'Salary Spread', value: `${salarySpreadPct}%` },
    { label: 'Compa-Ratio', value: `${compaRatio}%` },
    { label: 'Market Position', value: marketPosition },
  ];

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Salary Band Governance</h3>
      <div className={`mt-3 gap-3 ${expanded ? 'grid grid-cols-2 md:grid-cols-3' : 'grid grid-cols-2 md:grid-cols-3'}`}>
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleCoveragePanel({
  roles,
}: {
  roles: Array<{ role: string; coverage: number; label: string; tone: 'emerald' | 'amber' | 'red' }>;
}) {
  if (!roles.length) return null;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Role Coverage</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {roles.map((item) => (
          <div key={item.role} className="rounded-lg border border-[#E5E7EB] p-3">
            <div className="text-sm font-semibold text-slate-900">{item.role}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  item.tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : item.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {item.label} ({item.coverage}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessionMobilityPanel({
  metrics,
  expanded = false,
}: {
  metrics: {
    withoutSuccessors: number;
    criticalGradeRoles: number;
    highMobilityGrades: number;
    lowMobilityGrades: number;
    readySuccessors: number;
  };
  expanded?: boolean;
}) {
  const items = [
    { label: 'Grades Without Successors', value: metrics.withoutSuccessors, tone: 'amber' as const },
    { label: 'Critical Grade Roles', value: metrics.criticalGradeRoles, tone: 'red' as const },
    { label: 'High Mobility Grades', value: metrics.highMobilityGrades, tone: 'emerald' as const },
    { label: 'Low Mobility Grades', value: metrics.lowMobilityGrades, tone: 'slate' as const },
    { label: 'Ready Successors Available', value: metrics.readySuccessors, tone: 'emerald' as const },
  ];

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Succession & Mobility</h3>
      <div className={`mt-3 gap-3 ${expanded ? 'grid grid-cols-2' : 'space-y-2'}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border p-3 ${
              item.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50'
                : item.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50'
                  : item.tone === 'red'
                    ? 'border-red-200 bg-red-50'
                    : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{item.label}</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{formatNumber(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeInsightCards({
  cards,
  expanded = false,
}: {
  cards: Array<{ label: string; name: string; detail: string }>;
  expanded?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Grade Insights</h3>
      <div className={`mt-3 gap-3 ${expanded ? 'grid grid-cols-2' : 'space-y-2'}`}>
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{card.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{card.name}</div>
            <div className="text-xs text-slate-500">{card.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopGradesPanel({
  grades,
  onSelect,
  expanded = false,
}: {
  grades: JobGradeRecord[];
  onSelect: (id: string) => void;
  expanded?: boolean;
}) {
  const maxEmployees = grades[0]?.employeeCount || 1;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Top Grades by Headcount</h3>
      <div className={`mt-3 space-y-3 ${expanded ? 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0' : ''}`}>
        {grades.map((grade) => (
          <button
            key={grade.id}
            type="button"
            onClick={() => onSelect(grade.id)}
            className="block w-full rounded-lg border border-[#E5E7EB] p-3 text-left hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-slate-900">{grade.name}</span>
              <span className="text-slate-600">{formatNumber(grade.employeeCount)} employees</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${(grade.employeeCount / maxEmployees) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CriticalGradesPanel({
  grades,
  onSelect,
  expanded = false,
}: {
  grades: JobGradeRecord[];
  onSelect: (id: string) => void;
  expanded?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Critical Grades</h3>
      <div className={`mt-3 space-y-2 ${expanded ? 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0' : ''}`}>
        {grades.length ? (
          grades.map((grade) => (
            <div key={grade.id} className="rounded-lg border border-[#E5E7EB] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{grade.name}</div>
                  <div className="text-xs text-slate-500">
                    {grade.attritionRiskPct}% attrition • {grade.successionCoveragePct}% succession
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthTone(grade.healthStatus)}`}>{grade.healthStatus}</span>
              </div>
              <button type="button" onClick={() => onSelect(grade.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-blue-700">
                Open Workspace
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No critical grades detected.</p>
        )}
      </div>
    </div>
  );
}

function QuickActionsPanel({
  onCreate,
  onExport,
  canExport,
  canEdit,
}: {
  onCreate: () => void;
  onExport: () => void;
  canExport: boolean;
  canEdit: boolean;
}) {
  const linkActions = [
    { label: 'Manage Grade Structure', href: '/hris/organization/job-titles', icon: Layers3 },
    { label: 'Grade Benchmarking', href: '/hris/organization/position-management', icon: GitBranch },
    { label: 'Workforce Planning', href: '/hris/organization/workforce-planning', icon: Users },
    { label: 'Grade Reports', href: '/hris/organization/reporting-hierarchy', icon: BriefcaseBusiness },
  ];

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Quick Actions</h3>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {canEdit ? (
          <button type="button" onClick={onCreate} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50">
            <Plus className="h-4 w-4 text-[#2563EB]" />
            Add Job Grade
          </button>
        ) : null}
        {linkActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50">
              <Icon className="h-4 w-4 text-[#2563EB]" />
              {action.label}
            </Link>
          );
        })}
        <button type="button" onClick={onExport} disabled={!canExport} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">
          <Download className="h-4 w-4 text-[#2563EB]" />
          Export Job Grades
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
          <div className="mt-2 text-xs text-slate-500">{detail}</div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</div>
    </div>
  );
}

function ProgressCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
  const styles =
    tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'purple' ? 'bg-violet-500' : 'bg-blue-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}%</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
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
      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] || option}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
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
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
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

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
      />
    </label>
  );
}
