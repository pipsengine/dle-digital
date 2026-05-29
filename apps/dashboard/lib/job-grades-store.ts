import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getJobGradesData, type HealthStatus, type JobGradeRecord, type StructureInsight } from '@/lib/organization-data';

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'hris');
const FILE_PATH = path.join(DATA_DIR, 'job-grades.json');

const buildPayload = (grades: JobGradeRecord[]) => {
  const totalEmployees = grades.reduce((sum, grade) => sum + grade.employeeCount, 0);
  const totalOpenPositions = grades.reduce((sum, grade) => sum + grade.openPositions, 0);
  const avgSuccessionCoverage = Math.round((grades.reduce((sum, grade) => sum + grade.successionCoveragePct, 0) / grades.length) * 10) / 10;
  const avgAttritionRisk = Math.round((grades.reduce((sum, grade) => sum + grade.attritionRiskPct, 0) / grades.length) * 10) / 10;
  const avgMobility = Math.round((grades.reduce((sum, grade) => sum + grade.internalMobilityPct, 0) / grades.length) * 10) / 10;

  const mostPressuredGrade = [...grades].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
  const weakestCoverageGrade = [...grades].sort((a, b) => a.successionCoveragePct - b.successionCoveragePct)[0];
  const biggestPopulationGrade = [...grades].sort((a, b) => b.employeeCount - a.employeeCount)[0];

  const insights: StructureInsight[] = [
    {
      id: 'grade-ins-1',
      severity: mostPressuredGrade && mostPressuredGrade.attritionRiskPct >= 14 ? 'high' : 'medium',
      title: `${mostPressuredGrade?.code || 'A grade'} is under the highest attrition pressure`,
      recommendation: 'Review reward competitiveness, supervisory capacity, and targeted retention controls for the grade.',
    },
    {
      id: 'grade-ins-2',
      severity: weakestCoverageGrade && weakestCoverageGrade.successionCoveragePct <= 65 ? 'high' : 'medium',
      title: `${weakestCoverageGrade?.code || 'A grade'} has the weakest succession coverage`,
      recommendation: 'Strengthen pipeline readiness, development plans, and internal mobility pathways for feeder roles.',
    },
    {
      id: 'grade-ins-3',
      severity: biggestPopulationGrade && biggestPopulationGrade.employeeCount >= 250 ? 'medium' : 'low',
      title: `${biggestPopulationGrade?.code || 'A grade'} carries the largest workforce concentration`,
      recommendation: 'Use this grade as a control point for workforce planning, grade drift monitoring, and compensation governance.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      canEdit: true,
      canExport: true,
      canViewCosts: true,
    },
    summary: {
      totalGrades: grades.length,
      totalEmployees,
      totalOpenPositions,
      avgSuccessionCoverage,
      avgAttritionRisk,
      avgInternalMobility: avgMobility,
      criticalGrades: grades.filter((grade) => grade.healthStatus === 'Critical').length,
      needsAttentionGrades: grades.filter((grade) => grade.healthStatus === 'Needs Attention').length,
    },
    filterOptions: {
      families: Array.from(new Set(grades.map((grade) => grade.family))),
      levels: Array.from(new Set(grades.map((grade) => grade.level))),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'] as HealthStatus[],
    },
    grades,
    insights,
  };
};

const ensureStore = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(FILE_PATH);
  } catch {
    await writeFile(FILE_PATH, JSON.stringify(getJobGradesData().grades, null, 2), 'utf8');
  }
};

export const readJobGrades = async (): Promise<JobGradeRecord[]> => {
  await ensureStore();
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as JobGradeRecord[];
  } catch {
    // Fall back to seeded records if the file is missing or malformed.
  }

  const seeded = getJobGradesData().grades;
  await writeFile(FILE_PATH, JSON.stringify(seeded, null, 2), 'utf8');
  return seeded;
};

export const writeJobGrades = async (grades: JobGradeRecord[]) => {
  await ensureStore();
  await writeFile(FILE_PATH, JSON.stringify(grades, null, 2), 'utf8');
};

export const getPersistedJobGradesData = async () => buildPayload(await readJobGrades());
