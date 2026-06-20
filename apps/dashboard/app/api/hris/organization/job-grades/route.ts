import { NextResponse } from 'next/server';
import type { HealthStatus, JobGradeRecord } from '@/lib/organization-data';
import { getPersistedJobGradesData, readJobGrades, writeJobGrades } from '@/lib/job-grades-store';

type CreateJobGradePayload = {
  code?: string;
  name?: string;
  family?: JobGradeRecord['family'];
  level?: JobGradeRecord['level'];
  minSalaryNgn?: number;
  midpointSalaryNgn?: number;
  maxSalaryNgn?: number;
  employeeCount?: number;
  openPositions?: number;
  successionCoveragePct?: number;
  attritionRiskPct?: number;
  internalMobilityPct?: number;
  averageTenureYears?: number;
  femaleRepresentationPct?: number;
  healthStatus?: HealthStatus;
  benchmarkPosition?: string;
  nextGradeCode?: string | null;
  keyRoles?: string[];
  gradeMix?: Array<{ unit: string; headcount: number }>;
  description?: string;
};

const ok = <T,>(data: T, status = 200) => NextResponse.json({ status: 'success', data }, { status });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const asInt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : Number.NaN);
const asNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);

const normalizeCode = (code: string) => code.trim().toUpperCase();

const validate = (payload: CreateJobGradePayload, existing: JobGradeRecord[]) => {
  const families: JobGradeRecord['family'][] = ['Executive', 'Management', 'Professional', 'Technical', 'Operations Support'];
  const levels: JobGradeRecord['level'][] = ['Strategic', 'Senior', 'Mid', 'Entry'];
  const healthStatuses: HealthStatus[] = ['Healthy', 'Needs Attention', 'Critical'];

  if (!isNonEmpty(payload.code)) return 'Grade code is required.';
  if (!isNonEmpty(payload.name)) return 'Grade name is required.';
  if (!payload.family || !families.includes(payload.family)) return 'A valid grade family is required.';
  if (!payload.level || !levels.includes(payload.level)) return 'A valid grade level is required.';
  if (!payload.healthStatus || !healthStatuses.includes(payload.healthStatus)) return 'A valid health status is required.';
  if (!isNonEmpty(payload.benchmarkPosition)) return 'Benchmark position is required.';
  if (!isNonEmpty(payload.description)) return 'Description is required.';

  const minSalaryNgn = asNumber(payload.minSalaryNgn);
  const midpointSalaryNgn = asNumber(payload.midpointSalaryNgn);
  const maxSalaryNgn = asNumber(payload.maxSalaryNgn);
  const employeeCount = asInt(payload.employeeCount);
  const openPositions = asInt(payload.openPositions);
  const successionCoveragePct = asNumber(payload.successionCoveragePct);
  const attritionRiskPct = asNumber(payload.attritionRiskPct);
  const internalMobilityPct = asNumber(payload.internalMobilityPct);
  const averageTenureYears = asNumber(payload.averageTenureYears);
  const femaleRepresentationPct = asNumber(payload.femaleRepresentationPct);

  if ([minSalaryNgn, midpointSalaryNgn, maxSalaryNgn, successionCoveragePct, attritionRiskPct, internalMobilityPct, averageTenureYears, femaleRepresentationPct].some(Number.isNaN)) {
    return 'Numeric grade fields must contain valid numbers.';
  }
  if ([employeeCount, openPositions].some(Number.isNaN)) return 'Employee count and open positions must be whole numbers.';
  if (minSalaryNgn < 0 || midpointSalaryNgn < 0 || maxSalaryNgn < 0) return 'Salary values cannot be negative.';
  if (!(minSalaryNgn <= midpointSalaryNgn && midpointSalaryNgn <= maxSalaryNgn)) return 'Salary band must follow min <= midpoint <= max.';
  if (employeeCount < 0 || openPositions < 0) return 'Employee count and open positions cannot be negative.';
  if (averageTenureYears < 0) return 'Average tenure cannot be negative.';

  for (const pct of [successionCoveragePct, attritionRiskPct, internalMobilityPct, femaleRepresentationPct]) {
    if (pct < 0 || pct > 100) return 'Percentage fields must be between 0 and 100.';
  }

  if (!Array.isArray(payload.keyRoles) || payload.keyRoles.length === 0 || payload.keyRoles.some((role) => !isNonEmpty(role))) {
    return 'At least one key role is required.';
  }
  if (!Array.isArray(payload.gradeMix) || payload.gradeMix.length === 0) return 'At least one grade mix entry is required.';
  if (payload.gradeMix.some((mix) => !isNonEmpty(mix.unit) || !Number.isInteger(mix.headcount) || mix.headcount < 0)) {
    return 'Grade mix entries must include a unit name and a non-negative whole-number headcount.';
  }
  const gradeMixHeadcount = payload.gradeMix.reduce((sum, mix) => sum + mix.headcount, 0);
  if (gradeMixHeadcount !== employeeCount) return 'The grade mix total must equal the employee count.';

  const code = normalizeCode(payload.code);
  if (existing.some((grade) => normalizeCode(grade.code) === code)) return `Grade code ${code} already exists.`;
  if (payload.nextGradeCode && normalizeCode(payload.nextGradeCode) === code) return 'Next grade code cannot be the same as the current grade code.';

  return null;
};

export async function GET() {
  try {
    return ok(await getPersistedJobGradesData());
  } catch (error) {
    console.error('Job grades load error:', error);
    return err(500, error instanceof Error ? error.message : 'Unable to load job grades');
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateJobGradePayload;
  const existing = await readJobGrades();
  const validationError = validate(payload, existing);
  if (validationError) return err(400, validationError);

  const code = normalizeCode(payload.code!);
  const nextGradeCode = payload.nextGradeCode && payload.nextGradeCode.trim() ? normalizeCode(payload.nextGradeCode) : null;
  const record: JobGradeRecord = {
    id: `jg-${code.toLowerCase()}`,
    code,
    name: payload.name!.trim(),
    family: payload.family!,
    level: payload.level!,
    minSalaryNgn: Number(payload.minSalaryNgn),
    midpointSalaryNgn: Number(payload.midpointSalaryNgn),
    maxSalaryNgn: Number(payload.maxSalaryNgn),
    employeeCount: Number(payload.employeeCount),
    openPositions: Number(payload.openPositions),
    successionCoveragePct: Number(payload.successionCoveragePct),
    attritionRiskPct: Number(payload.attritionRiskPct),
    internalMobilityPct: Number(payload.internalMobilityPct),
    averageTenureYears: Number(payload.averageTenureYears),
    femaleRepresentationPct: Number(payload.femaleRepresentationPct),
    healthStatus: payload.healthStatus!,
    benchmarkPosition: payload.benchmarkPosition!.trim(),
    nextGradeCode,
    keyRoles: payload.keyRoles!.map((role) => role.trim()).filter(Boolean),
    gradeMix: payload.gradeMix!.map((mix) => ({ unit: mix.unit.trim(), headcount: mix.headcount })),
    description: payload.description!.trim(),
  };

  const next = [...existing, record].sort((a, b) => a.code.localeCompare(b.code));
  await writeJobGrades(next);
  return ok(record, 201);
}
