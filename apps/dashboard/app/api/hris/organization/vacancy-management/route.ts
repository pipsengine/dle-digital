import { NextResponse } from 'next/server';
import type { HealthStatus, StructureInsight } from '@/lib/organization-data';
import { appendOrganizationAuditEvent } from '@/lib/organization-audit-store';
import { getUiPermissions, hasPermission, resolveAccessContext } from '@/lib/hris-access';
import { syncPositionWithVacancy } from '@/lib/organization-sync';
import { readPositions, writePositions } from '@/lib/positions-store';
import {
  readVacancyManagement,
  writeVacancyManagement,
  type VacancyApprovalStatus,
  type VacancyManagementRecord,
  type VacancyPipeline,
  type VacancyPriority,
  type VacancyRequisitionStatus,
  type VacancySourceChannel,
  type VacancyStage,
} from '@/lib/vacancy-management-store';

type VacancyRecord = VacancyManagementRecord & {
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

type VacancyPayload = {
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
    requisitionStatuses: VacancyRequisitionStatus[];
    stages: VacancyStage[];
    priorities: VacancyPriority[];
    approvalStatuses: VacancyApprovalStatus[];
    sourceChannels: VacancySourceChannel[];
    healthStatuses: HealthStatus[];
  };
  vacancies: VacancyRecord[];
  insights: StructureInsight[];
};

type UpdateVacancyPayload = {
  id?: string;
  requisitionStatus?: VacancyRequisitionStatus;
  recruitmentStage?: VacancyStage;
  approvalStatus?: VacancyApprovalStatus;
  sourceChannel?: VacancySourceChannel;
  recruiter?: string;
  hiringManager?: string;
  targetFillDate?: string;
  pipeline?: VacancyPipeline;
  justification?: string;
  riskNote?: string;
};

const ok = <T,>(data: T, status = 200) => NextResponse.json({ status: 'success', data }, { status });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isWholeNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

const todayDate = () => new Date().toISOString().slice(0, 10);

const parseDateValue = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (from: string, to: string) => {
  const start = parseDateValue(from);
  const end = parseDateValue(to);
  if (!start || !end) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const resolveRiskLevel = (record: VacancyManagementRecord, daysToTargetFill: number, conversionPct: number): HealthStatus => {
  if (
    record.criticality === 'Critical' && record.requisitionStatus === 'Open' && daysToTargetFill < 0
    || record.healthStatus === 'Critical'
    || (record.openDays >= 45 && conversionPct < 20)
  ) {
    return 'Critical';
  }
  if (
    daysToTargetFill <= 7
    || record.approvalStatus !== 'Approved'
    || (record.requisitionStatus === 'Open' && conversionPct < 35)
    || record.healthStatus === 'Needs Attention'
  ) {
    return 'Needs Attention';
  }
  return 'Healthy';
};

const enrichVacancy = (record: VacancyManagementRecord, position: Awaited<ReturnType<typeof readPositions>>[number]): VacancyRecord => {
  const pipelineTotal = record.pipeline.sourced;
  const conversionPct = pipelineTotal ? Math.round((record.pipeline.finalists / pipelineTotal) * 100) : 0;
  const daysToTargetFill = daysBetween(todayDate(), record.targetFillDate);
  const isOverdue = record.requisitionStatus === 'Open' && daysToTargetFill < 0;
  const riskLevel = resolveRiskLevel(record, daysToTargetFill, conversionPct);

  return {
    ...record,
    responsibilityScope: position.responsibilityScope,
    requiredCapabilities: position.requiredCapabilities,
    successionCoveragePct: position.successionCoveragePct,
    attritionRiskPct: position.attritionRiskPct,
    approvalCoveragePct: position.approvalCoveragePct,
    daysToTargetFill,
    isOverdue,
    pipelineTotal,
    conversionPct,
    riskLevel,
  };
};

const buildPayload = async (request: Request): Promise<VacancyPayload> => {
  const access = resolveAccessContext(request);
  const uiPermissions = getUiPermissions(access);
  const positions = await readPositions();
  const vacancies = await readVacancyManagement(positions);
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const activeVacancies = vacancies.filter((record) => record.lifecycleStatus === 'Active');
  const records = activeVacancies
    .map((record) => {
      const position = positionsById.get(record.positionId);
      return position ? enrichVacancy(record, position) : null;
    })
    .filter((record): record is VacancyRecord => Boolean(record))
    .sort((a, b) => {
      const priorityOrder: VacancyPriority[] = ['Critical', 'High', 'Medium'];
      const priorityCompare = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      if (priorityCompare !== 0) return priorityCompare;
      if (b.openDays !== a.openDays) return b.openDays - a.openDays;
      return a.title.localeCompare(b.title);
    });

  const longestOpenVacancy = [...records].sort((a, b) => b.openDays - a.openDays)[0];
  const criticalOverdueVacancy = [...records]
    .filter((record) => record.priority === 'Critical' && record.isOverdue)
    .sort((a, b) => b.openDays - a.openDays)[0];
  const weakestPipelineVacancy = [...records]
    .filter((record) => record.requisitionStatus === 'Open')
    .sort((a, b) => a.conversionPct - b.conversionPct || b.openDays - a.openDays)[0];

  const insights: StructureInsight[] = [
    {
      id: 'vac-ins-1',
      severity: longestOpenVacancy && longestOpenVacancy.openDays >= 45 ? 'high' : 'medium',
      title: `${longestOpenVacancy?.title || 'A vacancy'} has the longest aging exposure`,
      recommendation: 'Escalate sourcing coverage, tighten shortlist review cadence, and validate the role design if the vacancy remains difficult to fill.',
    },
    {
      id: 'vac-ins-2',
      severity: criticalOverdueVacancy ? 'high' : 'medium',
      title: `${criticalOverdueVacancy?.title || 'A critical vacancy'} is overdue against target fill`,
      recommendation: 'Move the vacancy into executive review, confirm fast-track approvals, and align interim cover until the role is resolved.',
    },
    {
      id: 'vac-ins-3',
      severity: weakestPipelineVacancy && weakestPipelineVacancy.conversionPct < 20 ? 'high' : 'low',
      title: `${weakestPipelineVacancy?.title || 'A vacancy'} has weak pipeline conversion`,
      recommendation: 'Review sourcing channels, screening criteria, and recruiter capacity to improve candidate quality and stage progression.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      actor: uiPermissions.actor,
      role: uiPermissions.role,
      canEdit: uiPermissions.canEditVacancies,
      canExport: true,
      canViewCosts: false,
      canViewAudit: uiPermissions.canViewAudit,
    },
    summary: {
      totalVacancies: records.length,
      closedVacancies: vacancies.filter((record) => record.lifecycleStatus === 'Closed').length,
      criticalVacancies: records.filter((record) => record.priority === 'Critical').length,
      overdueVacancies: records.filter((record) => record.isOverdue).length,
      approvalBacklog: records.filter((record) => record.approvalStatus !== 'Approved').length,
      avgAgeDays: average(records.map((record) => record.openDays)),
      pipelineCandidates: records.reduce((sum, record) => sum + record.pipelineTotal, 0),
      offerStageVacancies: records.filter((record) => ['Offer', 'Background Check', 'Ready to Hire'].includes(record.recruitmentStage)).length,
      atRiskVacancies: records.filter((record) => record.riskLevel !== 'Healthy').length,
    },
    filterOptions: {
      businessUnits: Array.from(new Set(records.map((record) => record.businessUnit))).sort((a, b) => a.localeCompare(b)),
      locations: Array.from(new Set(records.map((record) => record.location))).sort((a, b) => a.localeCompare(b)),
      requisitionStatuses: ['Open', 'On Hold', 'Cancelled'],
      stages: ['Intake', 'Sourcing', 'Screening', 'Interview', 'Offer', 'Background Check', 'Ready to Hire'],
      priorities: ['Critical', 'High', 'Medium'],
      approvalStatuses: ['Approved', 'Pending Review', 'Escalated'],
      sourceChannels: ['Internal Mobility', 'External Hire', 'Referral', 'Contract Conversion', 'Campus'],
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'],
    },
    vacancies: records,
    insights,
  };
};

const validatePipeline = (pipeline: VacancyPipeline) => {
  if (![pipeline.sourced, pipeline.screened, pipeline.interviewed, pipeline.finalists, pipeline.offerExtended].every(isWholeNumber)) {
    return 'Pipeline counts must be non-negative whole numbers.';
  }
  if (pipeline.sourced < pipeline.screened) return 'Screened candidates cannot exceed sourced candidates.';
  if (pipeline.screened < pipeline.interviewed) return 'Interviewed candidates cannot exceed screened candidates.';
  if (pipeline.interviewed < pipeline.finalists) return 'Finalists cannot exceed interviewed candidates.';
  if (pipeline.finalists < pipeline.offerExtended) return 'Offers extended cannot exceed finalists.';
  return null;
};

const validateUpdate = (payload: UpdateVacancyPayload, records: VacancyManagementRecord[]) => {
  const requisitionStatuses: VacancyRequisitionStatus[] = ['Open', 'On Hold', 'Cancelled'];
  const stages: VacancyStage[] = ['Intake', 'Sourcing', 'Screening', 'Interview', 'Offer', 'Background Check', 'Ready to Hire'];
  const priorities: VacancyPriority[] = ['Critical', 'High', 'Medium'];
  const approvalStatuses: VacancyApprovalStatus[] = ['Approved', 'Pending Review', 'Escalated'];
  const sourceChannels: VacancySourceChannel[] = ['Internal Mobility', 'External Hire', 'Referral', 'Contract Conversion', 'Campus'];

  if (!isNonEmpty(payload.id)) return 'A vacancy record is required.';
  const existing = records.find((record) => record.id === payload.id);
  if (!existing) return 'The selected vacancy could not be found.';
  if (payload.requisitionStatus && !requisitionStatuses.includes(payload.requisitionStatus)) return 'A valid requisition status is required.';
  if (payload.recruitmentStage && !stages.includes(payload.recruitmentStage)) return 'A valid recruitment stage is required.';
  if (payload.approvalStatus && !approvalStatuses.includes(payload.approvalStatus)) return 'A valid approval status is required.';
  if (payload.sourceChannel && !sourceChannels.includes(payload.sourceChannel)) return 'A valid source channel is required.';
  if (payload.recruiter !== undefined && !isNonEmpty(payload.recruiter)) return 'Recruiter is required.';
  if (payload.hiringManager !== undefined && !isNonEmpty(payload.hiringManager)) return 'Hiring manager is required.';
  if (payload.justification !== undefined && !isNonEmpty(payload.justification)) return 'Justification is required.';
  if (payload.riskNote !== undefined && !isNonEmpty(payload.riskNote)) return 'Risk note is required.';
  if (payload.targetFillDate !== undefined && !parseDateValue(payload.targetFillDate)) return 'Target fill date must be a valid date.';
  if (payload.pipeline) {
    const pipelineError = validatePipeline(payload.pipeline);
    if (pipelineError) return pipelineError;
  }

  const nextStage = payload.recruitmentStage ?? existing.recruitmentStage;
  const nextPipeline = payload.pipeline ?? existing.pipeline;
  const nextStatus = payload.requisitionStatus ?? existing.requisitionStatus;

  if (['Offer', 'Background Check', 'Ready to Hire'].includes(nextStage) && nextPipeline.interviewed === 0) {
    return 'Offer-stage vacancies must have at least one interviewed candidate.';
  }
  if (nextStatus !== 'Open' && nextPipeline.offerExtended > 0) {
    return 'Vacancies that are on hold or cancelled cannot keep active offers extended.';
  }

  return null;
};

export async function GET(request: Request) {
  return ok(await buildPayload(request));
}

export async function PATCH(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'vacancy.manage')) return err(403, 'You do not have permission to update vacancy controls.');

  const payload = (await request.json()) as UpdateVacancyPayload;
  const actor = access.actor;
  const positions = await readPositions();
  const records = await readVacancyManagement(positions);
  const validationError = validateUpdate(payload, records);
  if (validationError) return err(400, validationError);

  const before = records.find((record) => record.id === payload.id)!;
  const next = records.map((record) =>
    record.id === payload.id
      ? {
          ...record,
          requisitionStatus: payload.requisitionStatus ?? record.requisitionStatus,
          recruitmentStage: payload.recruitmentStage ?? record.recruitmentStage,
          approvalStatus: payload.approvalStatus ?? record.approvalStatus,
          sourceChannel: payload.sourceChannel ?? record.sourceChannel,
          recruiter: payload.recruiter?.trim() || record.recruiter,
          hiringManager: payload.hiringManager?.trim() || record.hiringManager,
          targetFillDate: payload.targetFillDate || record.targetFillDate,
          pipeline: payload.pipeline ?? record.pipeline,
          justification: payload.justification?.trim() || record.justification,
          riskNote: payload.riskNote?.trim() || record.riskNote,
          lastActivityDate: todayDate(),
        }
      : record,
  );

  const updated = next.find((record) => record.id === payload.id)!;
  const nextPositions = positions.map((position) =>
    position.id === updated.positionId
      ? syncPositionWithVacancy({
          position,
          requisitionStatus: updated.requisitionStatus,
          approvalStatus: updated.approvalStatus,
        })
      : position,
  );

  const nextPosition = nextPositions.find((position) => position.id === updated.positionId) || null;
  await writeVacancyManagement(next);
  await writePositions(nextPositions);
  await appendOrganizationAuditEvent({
    module: 'vacancy-management',
    entityType: 'vacancy',
    entityId: updated.id,
    action: 'VACANCY_UPDATED',
    actor,
    summary: `${actor} updated vacancy ${updated.positionCode} to ${updated.requisitionStatus} / ${updated.recruitmentStage}.`,
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });
  if (nextPosition) {
    const previousPosition = positions.find((position) => position.id === nextPosition.id) || null;
    if (previousPosition && previousPosition.positionStatus !== nextPosition.positionStatus) {
      await appendOrganizationAuditEvent({
        module: 'positions',
        entityType: 'position',
        entityId: nextPosition.id,
        action: 'POSITION_STATUS_SYNCED_FROM_VACANCY',
        actor,
        summary: `${actor} synchronized position ${nextPosition.code} to ${nextPosition.positionStatus} from vacancy operations.`,
        before: previousPosition as unknown as Record<string, unknown>,
        after: nextPosition as unknown as Record<string, unknown>,
      });
    }
  }
  return ok(updated);
}
