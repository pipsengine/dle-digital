'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Download,
  RefreshCcw,
  Search,
  ShieldCheck,
  TimerReset,
  Users,
} from 'lucide-react';
import type { HealthStatus, StructureInsight } from '@/lib/organization-data';

type VacancyPipeline = {
  sourced: number;
  screened: number;
  interviewed: number;
  finalists: number;
  offerExtended: number;
};

type VacancyRecord = {
  id: string;
  positionId: string;
  positionCode: string;
  title: string;
  department: string;
  businessUnit: string;
  location: string;
  gradeCode: string;
  positionType: 'Permanent' | 'Contract' | 'Project' | 'Temporary';
  positionStatus: 'Filled' | 'Vacant' | 'Frozen' | 'Under Review';
  criticality: 'Critical' | 'Core' | 'Support';
  replacementPriority: 'Immediate' | 'Planned' | 'Monitor';
  healthStatus: HealthStatus;
  requisitionStatus: 'Open' | 'On Hold' | 'Cancelled';
  recruitmentStage: 'Intake' | 'Sourcing' | 'Screening' | 'Interview' | 'Offer' | 'Background Check' | 'Ready to Hire';
  priority: 'Critical' | 'High' | 'Medium';
  approvalStatus: 'Approved' | 'Pending Review' | 'Escalated';
  sourceChannel: 'Internal Mobility' | 'External Hire' | 'Referral' | 'Contract Conversion' | 'Campus';
  recruiter: string;
  hiringManager: string;
  openedDate: string;
  targetFillDate: string;
  lastActivityDate: string;
  openDays: number;
  pipeline: VacancyPipeline;
  justification: string;
  riskNote: string;
  responsibilityScope: string;
  requiredCapabilities: string[];
  successionCoveragePct: number;
  attritionRiskPct: number;
  approvalCoveragePct: number;
  daysToTargetFill: number;
  isOverdue: boolean;
  pipelineTotal: number;
  conversionPct: number;
  riskLevel: HealthStatus;
};

type Payload = {
  generatedAt: string;
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalVacancies: number;
    closedVacancies: number;
    criticalVacancies: number;
    overdueVacancies: number;
    approvalBacklog: number;
    avgAgeDays: number;
    pipelineCandidates: number;
    offerStageVacancies: number;
    atRiskVacancies: number;
  };
  filterOptions: {
    businessUnits: string[];
    locations: string[];
    requisitionStatuses: Array<VacancyRecord['requisitionStatus']>;
    stages: Array<VacancyRecord['recruitmentStage']>;
    priorities: Array<VacancyRecord['priority']>;
    approvalStatuses: Array<VacancyRecord['approvalStatus']>;
    sourceChannels: Array<VacancyRecord['sourceChannel']>;
    healthStatuses: HealthStatus[];
  };
  vacancies: VacancyRecord[];
  insights: StructureInsight[];
};

type AuditEvent = {
  id: string;
  module: 'positions' | 'workforce-planning' | 'vacancy-management';
  entityType: 'position' | 'workforce-request' | 'vacancy';
  entityId: string;
  action: string;
  actor: string;
  summary: string;
  createdAt: string;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-NG');

const healthTone = (status: HealthStatus) => {
  if (status === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Needs Attention') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const requisitionTone = (status: VacancyRecord['requisitionStatus']) => {
  if (status === 'Cancelled') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'On Hold') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const approvalTone = (status: VacancyRecord['approvalStatus']) => {
  if (status === 'Escalated') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Pending Review') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const priorityTone = (priority: VacancyRecord['priority']) => {
  if (priority === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (priority === 'High') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

const insightTone = (severity: StructureInsight['severity']) => {
  if (severity === 'high') return 'border-red-200 bg-red-50';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50';
  return 'border-emerald-200 bg-emerald-50';
};

export default function VacancyManagementClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState('');
  const [businessUnitFilter, setBusinessUnitFilter] = useState<'All' | string>('All');
  const [locationFilter, setLocationFilter] = useState<'All' | string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | VacancyRecord['requisitionStatus']>('All');
  const [stageFilter, setStageFilter] = useState<'All' | VacancyRecord['recruitmentStage']>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | VacancyRecord['priority']>('All');
  const [riskFilter, setRiskFilter] = useState<'All' | HealthStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    requisitionStatus: 'Open' as VacancyRecord['requisitionStatus'],
    recruitmentStage: 'Intake' as VacancyRecord['recruitmentStage'],
    approvalStatus: 'Approved' as VacancyRecord['approvalStatus'],
    sourceChannel: 'Internal Mobility' as VacancyRecord['sourceChannel'],
    recruiter: '',
    hiringManager: '',
    targetFillDate: '',
    sourced: '0',
    screened: '0',
    interviewed: '0',
    finalists: '0',
    offerExtended: '0',
    justification: '',
    riskNote: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hris/organization/vacancy-management', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to load vacancy management');
      const data = json.data as Payload;
      setPayload(data);
      setSelectedId((prev) => prev || data.vacancies[0]?.id || null);

      if (data.permissions.canViewAudit) {
        const auditRes = await fetch('/api/hris/organization/audit-log?module=vacancy-management&limit=10', {
          cache: 'no-store',
          headers: {
            'x-hris-actor': data.permissions.actor,
            'x-hris-role': data.permissions.role,
          },
        });
        const auditJson = await auditRes.json();
        if (auditRes.ok && auditJson?.status === 'success') {
          setAuditEvents((auditJson.data?.events || []) as AuditEvent[]);
        }
      } else {
        setAuditEvents([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load vacancy management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const vacancies = payload?.vacancies || [];

  const visibleVacancies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vacancies.filter((vacancy) => {
      if (businessUnitFilter !== 'All' && vacancy.businessUnit !== businessUnitFilter) return false;
      if (locationFilter !== 'All' && vacancy.location !== locationFilter) return false;
      if (statusFilter !== 'All' && vacancy.requisitionStatus !== statusFilter) return false;
      if (stageFilter !== 'All' && vacancy.recruitmentStage !== stageFilter) return false;
      if (priorityFilter !== 'All' && vacancy.priority !== priorityFilter) return false;
      if (riskFilter !== 'All' && vacancy.riskLevel !== riskFilter) return false;
      if (!q) return true;

      return [
        vacancy.title,
        vacancy.positionCode,
        vacancy.department,
        vacancy.businessUnit,
        vacancy.location,
        vacancy.recruiter,
        vacancy.hiringManager,
        vacancy.justification,
        vacancy.riskNote,
        vacancy.requiredCapabilities.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [vacancies, query, businessUnitFilter, locationFilter, statusFilter, stageFilter, priorityFilter, riskFilter]);

  const selectedVacancy = useMemo(() => visibleVacancies.find((vacancy) => vacancy.id === selectedId) || visibleVacancies[0] || null, [visibleVacancies, selectedId]);

  useEffect(() => {
    if (!selectedVacancy && visibleVacancies.length) setSelectedId(visibleVacancies[0].id);
  }, [selectedVacancy, visibleVacancies]);

  useEffect(() => {
    if (!selectedVacancy) return;
    setForm({
      requisitionStatus: selectedVacancy.requisitionStatus,
      recruitmentStage: selectedVacancy.recruitmentStage,
      approvalStatus: selectedVacancy.approvalStatus,
      sourceChannel: selectedVacancy.sourceChannel,
      recruiter: selectedVacancy.recruiter,
      hiringManager: selectedVacancy.hiringManager,
      targetFillDate: selectedVacancy.targetFillDate,
      sourced: String(selectedVacancy.pipeline.sourced),
      screened: String(selectedVacancy.pipeline.screened),
      interviewed: String(selectedVacancy.pipeline.interviewed),
      finalists: String(selectedVacancy.pipeline.finalists),
      offerExtended: String(selectedVacancy.pipeline.offerExtended),
      justification: selectedVacancy.justification,
      riskNote: selectedVacancy.riskNote,
    });
    setSubmitError(null);
  }, [selectedVacancy?.id]);

  const exportCsv = () => {
    if (!payload?.permissions.canExport) return;
    const rows = [
      ['Position Code', 'Title', 'Business Unit', 'Department', 'Location', 'Requisition Status', 'Stage', 'Priority', 'Approval Status', 'Recruiter', 'Hiring Manager', 'Open Days', 'Target Fill Date', 'Pipeline Total', 'Conversion %', 'Risk'],
      ...visibleVacancies.map((vacancy) => [
        vacancy.positionCode,
        vacancy.title,
        vacancy.businessUnit,
        vacancy.department,
        vacancy.location,
        vacancy.requisitionStatus,
        vacancy.recruitmentStage,
        vacancy.priority,
        vacancy.approvalStatus,
        vacancy.recruiter,
        vacancy.hiringManager,
        String(vacancy.openDays),
        vacancy.targetFillDate,
        String(vacancy.pipelineTotal),
        String(vacancy.conversionPct),
        vacancy.riskLevel,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vacancy-management.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const submitUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVacancy) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/hris/organization/vacancy-management', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hris-actor': payload?.permissions.actor || 'HR Operations',
          'x-hris-role': payload?.permissions.role || 'OrganizationAdmin',
        },
        body: JSON.stringify({
          id: selectedVacancy.id,
          requisitionStatus: form.requisitionStatus,
          recruitmentStage: form.recruitmentStage,
          approvalStatus: form.approvalStatus,
          sourceChannel: form.sourceChannel,
          recruiter: form.recruiter,
          hiringManager: form.hiringManager,
          targetFillDate: form.targetFillDate,
          pipeline: {
            sourced: Number(form.sourced),
            screened: Number(form.screened),
            interviewed: Number(form.interviewed),
            finalists: Number(form.finalists),
            offerExtended: Number(form.offerExtended),
          },
          justification: form.justification,
          riskNote: form.riskNote,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== 'success') throw new Error(json?.error || 'Unable to update vacancy');
      await load();
      setSelectedId(selectedVacancy.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to update vacancy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTemplate
      title="Vacancy Management"
      description="Manage approved vacancies with operational recruitment controls, aging visibility, approval discipline, and stage-based execution tracking."
      breadcrumbs={[
        { label: 'HRIS', href: '/hris' },
        { label: 'Organization', href: '/hris/organization' },
        { label: 'Vacancy Management' },
      ]}
      primaryAction={{ label: 'Refresh', onClick: () => void load(), icon: RefreshCcw }}
      secondaryAction={{ label: 'Export CSV', onClick: exportCsv, icon: Download }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Operational Vacancy Control</div>
          <div className="text-xs text-slate-500 mt-1">This module manages live vacancy operations, including requisition posture, approvals, pipeline progression, and target-fill discipline.</div>
        </div>
        <div className="text-xs text-slate-500">
          Generated: <span className="font-semibold text-slate-700">{payload ? formatDate(payload.generatedAt) : '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={BriefcaseBusiness} label="Vacancies" value={payload ? formatNumber(payload.summary.totalVacancies) : '—'} detail="Active tracked requisitions" />
        <MetricCard icon={BriefcaseBusiness} label="Closed" value={payload ? formatNumber(payload.summary.closedVacancies) : '—'} detail="Historical closed requisitions" />
        <MetricCard icon={AlertTriangle} label="Critical" value={payload ? formatNumber(payload.summary.criticalVacancies) : '—'} detail="High-priority vacancies" />
        <MetricCard icon={TimerReset} label="Overdue" value={payload ? formatNumber(payload.summary.overdueVacancies) : '—'} detail="Past target fill date" />
        <MetricCard icon={ShieldCheck} label="Approval Backlog" value={payload ? formatNumber(payload.summary.approvalBacklog) : '—'} detail="Vacancies awaiting approval discipline" />
        <MetricCard icon={Users} label="Pipeline" value={payload ? formatNumber(payload.summary.pipelineCandidates) : '—'} detail="Candidates in active pipelines" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Governance Context</div>
          <div className="text-xs text-slate-500 mt-1">Current access posture for vacancy operations and audit visibility.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Actor: {payload?.permissions.actor || '—'}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Role: {payload?.permissions.role || '—'}</span>
          <span className={`px-2.5 py-1 rounded-full border font-semibold ${payload?.permissions.canEdit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {payload?.permissions.canEdit ? 'Edit Enabled' : 'Read Only'}
          </span>
          <span className={`px-2.5 py-1 rounded-full border font-semibold ${payload?.permissions.canViewAudit ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {payload?.permissions.canViewAudit ? 'Audit Visible' : 'Audit Restricted'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
        <label className="relative xl:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vacancy, recruiter, capability, or note..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
          />
        </label>
        <Select value={businessUnitFilter} onChange={(value) => setBusinessUnitFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.businessUnits || [])]} labels={{ All: 'All Business Units' }} />
        <Select value={locationFilter} onChange={(value) => setLocationFilter(value as 'All' | string)} options={['All', ...(payload?.filterOptions.locations || [])]} labels={{ All: 'All Locations' }} />
        <Select value={statusFilter} onChange={(value) => setStatusFilter(value as 'All' | VacancyRecord['requisitionStatus'])} options={['All', ...(payload?.filterOptions.requisitionStatuses || [])]} labels={{ All: 'All Statuses' }} />
        <Select value={stageFilter} onChange={(value) => setStageFilter(value as 'All' | VacancyRecord['recruitmentStage'])} options={['All', ...(payload?.filterOptions.stages || [])]} labels={{ All: 'All Stages' }} />
        <Select value={priorityFilter} onChange={(value) => setPriorityFilter(value as 'All' | VacancyRecord['priority'])} options={['All', ...(payload?.filterOptions.priorities || [])]} labels={{ All: 'All Priorities' }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-[220px] gap-3">
          <Select value={riskFilter} onChange={(value) => setRiskFilter(value as 'All' | HealthStatus)} options={['All', ...(payload?.filterOptions.healthStatuses || [])]} labels={{ All: 'All Risk Levels' }} />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setBusinessUnitFilter('All');
            setLocationFilter('All');
            setStatusFilter('All');
            setStageFilter('All');
            setPriorityFilter('All');
            setRiskFilter('All');
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Vacancy Explorer</div>
              <div className="text-xs text-slate-500 mt-1">Review requisitions by aging, priority, stage progression, and operational risk.</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">Showing: {formatNumber(visibleVacancies.length)}</span>
          </div>
          <div className="p-4 space-y-3 min-h-[560px]">
            {loading ? (
              <div className="text-sm text-slate-600 font-medium">Loading vacancy management...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>
            ) : visibleVacancies.length ? (
              visibleVacancies.map((vacancy) => {
                const active = selectedVacancy?.id === vacancy.id;
                return (
                  <button
                    key={vacancy.id}
                    type="button"
                    onClick={() => setSelectedId(vacancy.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-colors ${active ? 'border-dle-blue/30 bg-dle-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{vacancy.title}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {vacancy.positionCode} <span className="mx-2">•</span> {vacancy.businessUnit} <span className="mx-2">•</span> {vacancy.location}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${priorityTone(vacancy.priority)}`}>{vacancy.priority}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${requisitionTone(vacancy.requisitionStatus)}`}>{vacancy.requisitionStatus}</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">{vacancy.recruitmentStage}</span>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold ${healthTone(vacancy.riskLevel)}`}>{vacancy.riskLevel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                      <span>Age: {formatNumber(vacancy.openDays)}d</span>
                      <span>Target: {formatDate(vacancy.targetFillDate)}</span>
                      <span>Pipeline: {formatNumber(vacancy.pipelineTotal)}</span>
                      <span>Conversion: {vacancy.conversionPct}%</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-slate-600 font-medium">No vacancies match the current filters.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Vacancy Detail</div>
              <div className="text-xs text-slate-500 mt-1">Inspect vacancy controls, pipeline performance, approval posture, and operational execution detail.</div>
            </div>
            <div className="p-5">
              {selectedVacancy ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${priorityTone(selectedVacancy.priority)}`}>{selectedVacancy.priority}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${requisitionTone(selectedVacancy.requisitionStatus)}`}>{selectedVacancy.requisitionStatus}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${approvalTone(selectedVacancy.approvalStatus)}`}>{selectedVacancy.approvalStatus}</span>
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(selectedVacancy.riskLevel)}`}>{selectedVacancy.riskLevel}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-3">{selectedVacancy.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedVacancy.responsibilityScope}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Position Code" value={selectedVacancy.positionCode} />
                    <DetailStat label="Department" value={selectedVacancy.department} />
                    <DetailStat label="Business Unit" value={selectedVacancy.businessUnit} />
                    <DetailStat label="Location" value={selectedVacancy.location} />
                    <DetailStat label="Grade" value={selectedVacancy.gradeCode} />
                    <DetailStat label="Position Type" value={selectedVacancy.positionType} />
                    <DetailStat label="Recruiter" value={selectedVacancy.recruiter} />
                    <DetailStat label="Hiring Manager" value={selectedVacancy.hiringManager} />
                    <DetailStat label="Opened Date" value={formatDate(selectedVacancy.openedDate)} />
                    <DetailStat label="Target Fill Date" value={formatDate(selectedVacancy.targetFillDate)} />
                    <DetailStat label="Open Days" value={`${selectedVacancy.openDays}d`} />
                    <DetailStat label="Days To Target" value={`${selectedVacancy.daysToTargetFill}d`} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <ProgressCard label="Approval Coverage" value={selectedVacancy.approvalCoveragePct} tone="blue" />
                    <ProgressCard label="Succession Coverage" value={selectedVacancy.successionCoveragePct} tone="emerald" />
                    <ProgressCard label="Attrition Risk" value={selectedVacancy.attritionRiskPct} tone="amber" />
                    <ProgressCard label="Pipeline Conversion" value={selectedVacancy.conversionPct} tone="slate" />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-900">Candidate Pipeline</div>
                      <div className="text-xs text-slate-500 mt-1">Operational tracking of candidates through sourcing and selection stages.</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
                      <DetailStat label="Sourced" value={formatNumber(selectedVacancy.pipeline.sourced)} />
                      <DetailStat label="Screened" value={formatNumber(selectedVacancy.pipeline.screened)} />
                      <DetailStat label="Interviewed" value={formatNumber(selectedVacancy.pipeline.interviewed)} />
                      <DetailStat label="Finalists" value={formatNumber(selectedVacancy.pipeline.finalists)} />
                      <DetailStat label="Offers" value={formatNumber(selectedVacancy.pipeline.offerExtended)} />
                    </div>
                  </div>

                  <form onSubmit={submitUpdate} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Vacancy Controls</div>
                      <div className="text-xs text-slate-500 mt-1">Update operational vacancy settings, pipeline counts, and risk notes with validation.</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <SelectField label="Requisition Status" value={form.requisitionStatus} onChange={(value) => setForm((prev) => ({ ...prev, requisitionStatus: value as VacancyRecord['requisitionStatus'] }))} options={['Open', 'On Hold', 'Cancelled']} />
                      <SelectField label="Recruitment Stage" value={form.recruitmentStage} onChange={(value) => setForm((prev) => ({ ...prev, recruitmentStage: value as VacancyRecord['recruitmentStage'] }))} options={['Intake', 'Sourcing', 'Screening', 'Interview', 'Offer', 'Background Check', 'Ready to Hire']} />
                      <SelectField label="Approval Status" value={form.approvalStatus} onChange={(value) => setForm((prev) => ({ ...prev, approvalStatus: value as VacancyRecord['approvalStatus'] }))} options={['Approved', 'Pending Review', 'Escalated']} />
                      <SelectField label="Source Channel" value={form.sourceChannel} onChange={(value) => setForm((prev) => ({ ...prev, sourceChannel: value as VacancyRecord['sourceChannel'] }))} options={['Internal Mobility', 'External Hire', 'Referral', 'Contract Conversion', 'Campus']} />
                      <Field label="Recruiter" value={form.recruiter} onChange={(value) => setForm((prev) => ({ ...prev, recruiter: value }))} />
                      <Field label="Hiring Manager" value={form.hiringManager} onChange={(value) => setForm((prev) => ({ ...prev, hiringManager: value }))} />
                      <Field label="Target Fill Date" type="date" value={form.targetFillDate} onChange={(value) => setForm((prev) => ({ ...prev, targetFillDate: value }))} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <Field label="Sourced" type="number" value={form.sourced} onChange={(value) => setForm((prev) => ({ ...prev, sourced: value }))} />
                      <Field label="Screened" type="number" value={form.screened} onChange={(value) => setForm((prev) => ({ ...prev, screened: value }))} />
                      <Field label="Interviewed" type="number" value={form.interviewed} onChange={(value) => setForm((prev) => ({ ...prev, interviewed: value }))} />
                      <Field label="Finalists" type="number" value={form.finalists} onChange={(value) => setForm((prev) => ({ ...prev, finalists: value }))} />
                      <Field label="Offers" type="number" value={form.offerExtended} onChange={(value) => setForm((prev) => ({ ...prev, offerExtended: value }))} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TextAreaField label="Justification" value={form.justification} onChange={(value) => setForm((prev) => ({ ...prev, justification: value }))} placeholder="Explain the ongoing business need and why this requisition remains active." />
                      <TextAreaField label="Risk Note" value={form.riskNote} onChange={(value) => setForm((prev) => ({ ...prev, riskNote: value }))} placeholder="Capture the key vacancy risk or control action required." />
                    </div>

                    {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{submitError}</div> : null}

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting || !payload?.permissions.canEdit}
                        className="px-4 py-2 bg-dle-blue text-white rounded-lg text-sm font-medium hover:bg-dle-blue-deep transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {!payload?.permissions.canEdit ? 'Read Only Access' : submitting ? 'Saving...' : 'Save Vacancy Controls'}
                      </button>
                      <span className="text-xs text-slate-500">Validation enforces coherent pipeline counts, valid dates, consistent requisition operations, and role-based edit control.</span>
                    </div>
                  </form>

                  <InfoListCard title="Required Capabilities" items={selectedVacancy.requiredCapabilities.length ? selectedVacancy.requiredCapabilities : ['No capability list provided.']} />
                </div>
              ) : (
                <div className="text-sm text-slate-600">Select a vacancy to inspect its operational detail.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Vacancy Insights</div>
              <div className="text-xs text-slate-500 mt-1">Priority observations for aging exposure, overdue critical roles, and pipeline weakness.</div>
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
              <div className="text-xs text-slate-500 mt-1">Recent tracked vacancy-management events for accountability and operational traceability.</div>
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
                  <div className="text-sm text-slate-600">No audit events are available for the selected scope yet.</div>
                )
              ) : (
                <div className="text-sm text-slate-600">Your current role cannot view the organization audit log.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Vacancy Registry</div>
          <div className="text-xs text-slate-500 mt-1">Searchable operational table of requisitions, stages, approvals, aging, and pipeline strength.</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Code', 'Title', 'Business Unit', 'Location', 'Status', 'Stage', 'Priority', 'Open Days', 'Target Fill', 'Risk'].map((header) => (
                  <th key={header} className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleVacancies.map((vacancy) => (
                <tr key={vacancy.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedId(vacancy.id)}>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{vacancy.positionCode}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{vacancy.title}</div>
                    <div className="text-xs text-slate-500">{vacancy.department}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{vacancy.businessUnit}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{vacancy.location}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${requisitionTone(vacancy.requisitionStatus)}`}>{vacancy.requisitionStatus}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{vacancy.recruitmentStage}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${priorityTone(vacancy.priority)}`}>{vacancy.priority}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(vacancy.openDays)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(vacancy.targetFillDate)}</td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${healthTone(vacancy.riskLevel)}`}>{vacancy.riskLevel}</span></td>
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

function ProgressCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'blue' | 'slate';
}) {
  const styles = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'slate' ? 'bg-slate-500' : 'bg-blue-500';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}%</div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${styles}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function InfoListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700">{item}</span>
        ))}
      </div>
    </div>
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
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-dle-blue/20"
      />
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
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
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
