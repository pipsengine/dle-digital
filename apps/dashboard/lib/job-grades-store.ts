import sql from 'mssql';
import { getDleEnterpriseDbPool, type DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import type { HealthStatus, JobGradeRecord, StructureInsight } from '@/lib/organization-data';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';

type JobGradesPayload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  dataSource: ReturnType<typeof payrollDataSourceInfo> & {
    structureSource: 'Sage Payroll Migration' | 'Local HRIS payroll cache' | 'DLE Enterprise HRIS';
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

type DbGradeRow = {
  Id: string;
  Code: string;
  Name: string;
  Family: JobGradeRecord['family'];
  GradeLevel: JobGradeRecord['level'];
  MinSalaryNgn: number;
  MidpointSalaryNgn: number;
  MaxSalaryNgn: number;
  EmployeeCount: number;
  OpenPositions: number;
  SuccessionCoveragePct: number;
  AttritionRiskPct: number;
  InternalMobilityPct: number;
  AverageTenureYears: number;
  FemaleRepresentationPct: number;
  HealthStatus: HealthStatus;
  BenchmarkPosition: string;
  NextGradeCode: string | null;
  KeyRolesJson: string;
  GradeMixJson: string;
  Description: string;
};

const SOURCE_SYSTEM = 'Sage Payroll Migration';
const dbReady = { value: false };

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const round1 = (value: number) => Math.round(value * 10) / 10;
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unassigned';
const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const mostCommon = (values: Array<string | null | undefined>, fallback: string) => {
  const counts = new Map<string, number>();
  for (const value of values.map(clean).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || fallback;
};

const topN = (values: Array<string | null | undefined>, n: number, fallback: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values.map(clean).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([value]) => value);
  return rows.length ? rows : fallback;
};

const gradeCode = (employee: DleEmployeeDirectoryRow) => {
  const grade = clean(employee.salaryGrade) || clean(employee.jobGrade) || clean(employee.employeeCategory) || clean(employee.employmentType);
  return grade || 'UNASSIGNED';
};

const isInactive = (employee: DleEmployeeDirectoryRow) => {
  const status = clean(employee.status).toLowerCase();
  return ['terminated', 'resigned', 'retired', 'inactive', 'exited'].some((word) => status.includes(word));
};

const monthlyPayroll = (employee: DleEmployeeDirectoryRow) => {
  const sageGross = employee.sagePayrollEarnings?.reduce((sum, line) => sum + Number(line.amount || 0), 0) || 0;
  if (sageGross > 0) return sageGross;
  const period = Number(employee.periodSalary || 0);
  if (period > 0) return period;
  const annual = Number(employee.annualSalary || 0);
  if (annual > 0) return annual / 12;
  const ratePerDay = Number(employee.ratePerDay || 0);
  if (ratePerDay > 0) return ratePerDay * 22;
  const ratePerHour = Number(employee.ratePerHour || 0);
  if (ratePerHour > 0) return ratePerHour * Number(employee.hoursPerPeriod || 176);
  return 0;
};

const familyFor = (code: string, rows: DleEmployeeDirectoryRow[]): JobGradeRecord['family'] => {
  const text = `${code} ${rows.map((row) => `${row.jobTitle} ${row.designation} ${row.employmentType} ${row.employeeCategory}`).join(' ')}`.toLowerCase();
  if (/(ceo|chief|director|executive|smgt|snm|mgt7|mgt8|mgt9|mgt10)/i.test(text)) return 'Executive';
  if (/(manager|management|mgt|lead|supervisor|head)/i.test(text)) return 'Management';
  if (/(welder|fitter|operator|technician|driver|rigger|artisan|mechanic|painter|blaster|daily|lumpsum|contract)/i.test(text)) return 'Technical';
  if (/(assistant|clerk|support|admin|security|office|junior|jnr|snr)/i.test(text)) return 'Operations Support';
  return 'Professional';
};

const levelFor = (family: JobGradeRecord['family'], code: string, rows: DleEmployeeDirectoryRow[]): JobGradeRecord['level'] => {
  const text = `${code} ${rows.map((row) => `${row.jobTitle} ${row.designation}`).join(' ')}`.toLowerCase();
  if (family === 'Executive' || /(smgt|director|chief|ceo|mgt10|mgt9)/i.test(text)) return 'Strategic';
  if (/(senior|lead|manager|mgt|snr|supervisor|head)/i.test(text)) return 'Senior';
  if (/(junior|trainee|assistant|entry|jnr)/i.test(text)) return 'Entry';
  return 'Mid';
};

const healthFrom = (rows: DleEmployeeDirectoryRow[], salaryValues: number[]): HealthStatus => {
  const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
  const missingPayrollCount = rows.length - salaryValues.length;
  if (!rows.length || missingManagerCount / rows.length >= 0.35 || missingPayrollCount / rows.length >= 0.2) return 'Critical';
  if (missingManagerCount > 0 || missingPayrollCount > 0) return 'Needs Attention';
  return 'Healthy';
};

const buildGradesFromEmployees = (employees: DleEmployeeDirectoryRow[]): JobGradeRecord[] => {
  const groups = new Map<string, DleEmployeeDirectoryRow[]>();
  for (const employee of employees.filter((row) => !isInactive(row))) {
    const code = gradeCode(employee).toUpperCase();
    groups.set(code, [...(groups.get(code) || []), employee]);
  }

  const base = [...groups.entries()].map(([code, rows]) => {
    const salaryValues = rows.map(monthlyPayroll).filter((value) => value > 0).sort((a, b) => a - b);
    const minSalary = salaryValues[0] || 0;
    const maxSalary = salaryValues[salaryValues.length - 1] || minSalary;
    const midpoint = salaryValues.length ? salaryValues[Math.floor(salaryValues.length / 2)] : 0;
    const family = familyFor(code, rows);
    const level = levelFor(family, code, rows);
    const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
    const femaleCount = rows.filter((employee) => clean(employee.gender).toLowerCase().startsWith('f')).length;
    const tenureRows = rows.map((employee) => Number(employee.yearsOfService || 0)).filter((value) => value > 0);
    const unitCounts = new Map<string, number>();
    for (const row of rows) {
      const unit = clean(row.businessUnit) || clean(row.department) || 'Unassigned Unit';
      unitCounts.set(unit, (unitCounts.get(unit) || 0) + 1);
    }

    return {
      id: `jg-${slug(code)}`,
      code,
      name: mostCommon(rows.map((row) => row.salaryGrade || row.jobGrade), code),
      family,
      level,
      minSalaryNgn: roundMoney(minSalary),
      midpointSalaryNgn: roundMoney(midpoint),
      maxSalaryNgn: roundMoney(maxSalary),
      employeeCount: rows.length,
      openPositions: 0,
      successionCoveragePct: round1(((rows.length - missingManagerCount) / Math.max(rows.length, 1)) * 100),
      attritionRiskPct: round1((missingManagerCount / Math.max(rows.length, 1)) * 100),
      internalMobilityPct: round1(Math.min(100, rows.filter((row) => clean(row.dateJoined) && Number(row.yearsOfService || 0) >= 3).length / Math.max(rows.length, 1) * 100)),
      averageTenureYears: tenureRows.length ? round1(tenureRows.reduce((sum, value) => sum + value, 0) / tenureRows.length) : 0,
      femaleRepresentationPct: round1((femaleCount / Math.max(rows.length, 1)) * 100),
      healthStatus: healthFrom(rows, salaryValues),
      benchmarkPosition: mostCommon(rows.map((row) => row.jobTitle || row.designation), 'Not configured'),
      nextGradeCode: null,
      keyRoles: topN(rows.map((row) => row.jobTitle || row.designation), 5, ['Not configured']),
      gradeMix: [...unitCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([unit, headcount]) => ({ unit, headcount })),
      description: `Job grade migrated from Sage payroll/HRIS employee assignments with ${rows.length} active employee${rows.length === 1 ? '' : 's'} and ${salaryValues.length} payroll salary reference${salaryValues.length === 1 ? '' : 's'}.`,
    } satisfies JobGradeRecord;
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return base.map((grade, index) => ({
    ...grade,
    nextGradeCode: index > 0 ? base[index - 1].code : null,
  }));
};

const rowToGrade = (row: DbGradeRow): JobGradeRecord => ({
  id: row.Id,
  code: row.Code,
  name: row.Name,
  family: row.Family,
  level: row.GradeLevel,
  minSalaryNgn: Number(row.MinSalaryNgn || 0),
  midpointSalaryNgn: Number(row.MidpointSalaryNgn || 0),
  maxSalaryNgn: Number(row.MaxSalaryNgn || 0),
  employeeCount: Number(row.EmployeeCount || 0),
  openPositions: Number(row.OpenPositions || 0),
  successionCoveragePct: Number(row.SuccessionCoveragePct || 0),
  attritionRiskPct: Number(row.AttritionRiskPct || 0),
  internalMobilityPct: Number(row.InternalMobilityPct || 0),
  averageTenureYears: Number(row.AverageTenureYears || 0),
  femaleRepresentationPct: Number(row.FemaleRepresentationPct || 0),
  healthStatus: row.HealthStatus,
  benchmarkPosition: row.BenchmarkPosition,
  nextGradeCode: row.NextGradeCode || null,
  keyRoles: JSON.parse(row.KeyRolesJson || '[]'),
  gradeMix: JSON.parse(row.GradeMixJson || '[]'),
  description: row.Description,
});

const ensureDb = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) throw new Error('DLE Enterprise database is not configured. Job grades must be stored in the HRIS database for production use.');
  if (!dbReady.value) {
    await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[OrganizationJobGrades]', N'U') IS NULL
CREATE TABLE [hris].[OrganizationJobGrades] (
  [Id] NVARCHAR(140) NOT NULL CONSTRAINT [PK_OrganizationJobGrades] PRIMARY KEY,
  [SourceSystem] NVARCHAR(80) NOT NULL,
  [Code] NVARCHAR(80) NOT NULL CONSTRAINT [UQ_OrganizationJobGrades_Code] UNIQUE,
  [Name] NVARCHAR(180) NOT NULL,
  [Family] NVARCHAR(40) NOT NULL,
  [GradeLevel] NVARCHAR(40) NOT NULL,
  [MinSalaryNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_MinSalaryNgn] DEFAULT 0,
  [MidpointSalaryNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_MidpointSalaryNgn] DEFAULT 0,
  [MaxSalaryNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_MaxSalaryNgn] DEFAULT 0,
  [EmployeeCount] INT NOT NULL CONSTRAINT [DF_OrganizationJobGrades_EmployeeCount] DEFAULT 0,
  [OpenPositions] INT NOT NULL CONSTRAINT [DF_OrganizationJobGrades_OpenPositions] DEFAULT 0,
  [SuccessionCoveragePct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_SuccessionCoveragePct] DEFAULT 0,
  [AttritionRiskPct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_AttritionRiskPct] DEFAULT 0,
  [InternalMobilityPct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_InternalMobilityPct] DEFAULT 0,
  [AverageTenureYears] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_AverageTenureYears] DEFAULT 0,
  [FemaleRepresentationPct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_FemaleRepresentationPct] DEFAULT 0,
  [HealthStatus] NVARCHAR(40) NOT NULL,
  [BenchmarkPosition] NVARCHAR(180) NOT NULL,
  [NextGradeCode] NVARCHAR(80) NULL,
  [KeyRolesJson] NVARCHAR(MAX) NOT NULL,
  [GradeMixJson] NVARCHAR(MAX) NOT NULL,
  [Description] NVARCHAR(700) NOT NULL,
  [SourceSnapshotJson] NVARCHAR(MAX) NOT NULL,
  [LastSyncedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_OrganizationJobGrades_LastSyncedAt] DEFAULT SYSUTCDATETIME(),
  CONSTRAINT [CK_OrganizationJobGrades_KeyRolesJson] CHECK (ISJSON([KeyRolesJson]) = 1),
  CONSTRAINT [CK_OrganizationJobGrades_GradeMixJson] CHECK (ISJSON([GradeMixJson]) = 1),
  CONSTRAINT [CK_OrganizationJobGrades_SourceSnapshotJson] CHECK (ISJSON([SourceSnapshotJson]) = 1)
);`);
    dbReady.value = true;
  }
  return pool;
};

const upsertGrade = async (request: sql.Request, grade: JobGradeRecord, sourceSystem = SOURCE_SYSTEM) => {
  await request
    .input('Id', sql.NVarChar(140), grade.id)
    .input('SourceSystem', sql.NVarChar(80), sourceSystem)
    .input('Code', sql.NVarChar(80), grade.code)
    .input('Name', sql.NVarChar(180), grade.name)
    .input('Family', sql.NVarChar(40), grade.family)
    .input('GradeLevel', sql.NVarChar(40), grade.level)
    .input('MinSalaryNgn', sql.Decimal(19, 2), grade.minSalaryNgn)
    .input('MidpointSalaryNgn', sql.Decimal(19, 2), grade.midpointSalaryNgn)
    .input('MaxSalaryNgn', sql.Decimal(19, 2), grade.maxSalaryNgn)
    .input('EmployeeCount', sql.Int, grade.employeeCount)
    .input('OpenPositions', sql.Int, grade.openPositions)
    .input('SuccessionCoveragePct', sql.Decimal(9, 2), grade.successionCoveragePct)
    .input('AttritionRiskPct', sql.Decimal(9, 2), grade.attritionRiskPct)
    .input('InternalMobilityPct', sql.Decimal(9, 2), grade.internalMobilityPct)
    .input('AverageTenureYears', sql.Decimal(9, 2), grade.averageTenureYears)
    .input('FemaleRepresentationPct', sql.Decimal(9, 2), grade.femaleRepresentationPct)
    .input('HealthStatus', sql.NVarChar(40), grade.healthStatus)
    .input('BenchmarkPosition', sql.NVarChar(180), grade.benchmarkPosition)
    .input('NextGradeCode', sql.NVarChar(80), grade.nextGradeCode)
    .input('KeyRolesJson', sql.NVarChar(sql.MAX), JSON.stringify(grade.keyRoles))
    .input('GradeMixJson', sql.NVarChar(sql.MAX), JSON.stringify(grade.gradeMix))
    .input('Description', sql.NVarChar(700), grade.description)
    .input('SourceSnapshotJson', sql.NVarChar(sql.MAX), JSON.stringify({ migratedAt: new Date().toISOString(), source: sourceSystem }))
    .query(`
MERGE [hris].[OrganizationJobGrades] AS target
USING (SELECT @Code AS [Code]) AS source
ON target.[Code] = source.[Code]
WHEN MATCHED THEN UPDATE SET
  [Id]=@Id,[SourceSystem]=@SourceSystem,[Name]=@Name,[Family]=@Family,[GradeLevel]=@GradeLevel,
  [MinSalaryNgn]=@MinSalaryNgn,[MidpointSalaryNgn]=@MidpointSalaryNgn,[MaxSalaryNgn]=@MaxSalaryNgn,
  [EmployeeCount]=@EmployeeCount,[OpenPositions]=@OpenPositions,[SuccessionCoveragePct]=@SuccessionCoveragePct,
  [AttritionRiskPct]=@AttritionRiskPct,[InternalMobilityPct]=@InternalMobilityPct,[AverageTenureYears]=@AverageTenureYears,
  [FemaleRepresentationPct]=@FemaleRepresentationPct,[HealthStatus]=@HealthStatus,[BenchmarkPosition]=@BenchmarkPosition,
  [NextGradeCode]=@NextGradeCode,[KeyRolesJson]=@KeyRolesJson,[GradeMixJson]=@GradeMixJson,[Description]=@Description,
  [SourceSnapshotJson]=@SourceSnapshotJson,[LastSyncedAt]=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT
  ([Id],[SourceSystem],[Code],[Name],[Family],[GradeLevel],[MinSalaryNgn],[MidpointSalaryNgn],[MaxSalaryNgn],[EmployeeCount],[OpenPositions],[SuccessionCoveragePct],[AttritionRiskPct],[InternalMobilityPct],[AverageTenureYears],[FemaleRepresentationPct],[HealthStatus],[BenchmarkPosition],[NextGradeCode],[KeyRolesJson],[GradeMixJson],[Description],[SourceSnapshotJson])
VALUES
  (@Id,@SourceSystem,@Code,@Name,@Family,@GradeLevel,@MinSalaryNgn,@MidpointSalaryNgn,@MaxSalaryNgn,@EmployeeCount,@OpenPositions,@SuccessionCoveragePct,@AttritionRiskPct,@InternalMobilityPct,@AverageTenureYears,@FemaleRepresentationPct,@HealthStatus,@BenchmarkPosition,@NextGradeCode,@KeyRolesJson,@GradeMixJson,@Description,@SourceSnapshotJson);`);
};

export const readJobGrades = async (): Promise<JobGradeRecord[]> => {
  const pool = await ensureDb();
  const rows = await pool.request().query(`
SELECT [Id],[Code],[Name],[Family],[GradeLevel],[MinSalaryNgn],[MidpointSalaryNgn],[MaxSalaryNgn],[EmployeeCount],[OpenPositions],
  [SuccessionCoveragePct],[AttritionRiskPct],[InternalMobilityPct],[AverageTenureYears],[FemaleRepresentationPct],[HealthStatus],
  [BenchmarkPosition],[NextGradeCode],[KeyRolesJson],[GradeMixJson],[Description]
FROM [hris].[OrganizationJobGrades]
ORDER BY [Code];`);
  return (rows.recordset as DbGradeRow[]).map(rowToGrade);
};

export const writeJobGrades = async (grades: JobGradeRecord[]) => {
  const pool = await ensureDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const grade of grades) await upsertGrade(new sql.Request(tx), grade, clean(grade.description).includes('migrated') ? SOURCE_SYSTEM : 'DLE HRIS');
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
};

const syncSageJobGrades = async () => {
  const source = await readPayrollEmployees();
  const grades = buildGradesFromEmployees(source.employees);
  const pool = await ensureDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const grade of grades) await upsertGrade(new sql.Request(tx), grade, SOURCE_SYSTEM);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
  return { source, grades };
};

const buildPayload = (grades: JobGradeRecord[], dataSource: JobGradesPayload['dataSource']): JobGradesPayload => {
  const totalEmployees = grades.reduce((sum, grade) => sum + grade.employeeCount, 0);
  const totalOpenPositions = grades.reduce((sum, grade) => sum + grade.openPositions, 0);
  const avg = (values: number[]) => values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const mostPressuredGrade = [...grades].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
  const weakestCoverageGrade = [...grades].sort((a, b) => a.successionCoveragePct - b.successionCoveragePct)[0];
  const biggestPopulationGrade = [...grades].sort((a, b) => b.employeeCount - a.employeeCount)[0];
  const insights: StructureInsight[] = [
    dataSource.migrationWarning ? {
      id: 'grade-source-warning',
      severity: 'high',
      title: 'Job grade migration requires attention',
      recommendation: dataSource.migrationWarning,
    } : null,
    mostPressuredGrade ? {
      id: 'grade-ins-1',
      severity: mostPressuredGrade.attritionRiskPct >= 14 || mostPressuredGrade.healthStatus === 'Critical' ? 'high' : 'medium',
      title: `${mostPressuredGrade.code} is under the highest attrition pressure`,
      recommendation: 'Review manager assignment, payroll completeness, reward competitiveness, and targeted retention controls for the grade.',
    } : null,
    weakestCoverageGrade ? {
      id: 'grade-ins-2',
      severity: weakestCoverageGrade.successionCoveragePct <= 65 ? 'high' : 'medium',
      title: `${weakestCoverageGrade.code} has the weakest succession coverage`,
      recommendation: 'Strengthen reporting-line coverage, development plans, and internal mobility pathways for feeder roles.',
    } : null,
    biggestPopulationGrade ? {
      id: 'grade-ins-3',
      severity: biggestPopulationGrade.employeeCount >= 250 ? 'medium' : 'low',
      title: `${biggestPopulationGrade.code} carries the largest workforce concentration`,
      recommendation: 'Use this grade as a control point for payroll readiness, workforce planning, grade drift, and compensation governance.',
    } : null,
  ].filter((item): item is StructureInsight => Boolean(item));

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      canEdit: true,
      canExport: true,
      canViewCosts: true,
    },
    dataSource,
    summary: {
      totalGrades: grades.length,
      totalEmployees,
      totalOpenPositions,
      avgSuccessionCoverage: avg(grades.map((grade) => grade.successionCoveragePct)),
      avgAttritionRisk: avg(grades.map((grade) => grade.attritionRiskPct)),
      avgInternalMobility: avg(grades.map((grade) => grade.internalMobilityPct)),
      criticalGrades: grades.filter((grade) => grade.healthStatus === 'Critical').length,
      needsAttentionGrades: grades.filter((grade) => grade.healthStatus === 'Needs Attention').length,
    },
    filterOptions: {
      families: uniqueSorted(grades.map((grade) => grade.family)),
      levels: uniqueSorted(grades.map((grade) => grade.level)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'],
    },
    grades,
    insights,
  };
};

export const getPersistedJobGradesData = async () => {
  let migrationWarning: string | null = null;
  let sourceInfo: ReturnType<typeof payrollDataSourceInfo> | null = null;
  try {
    const synced = await syncSageJobGrades();
    sourceInfo = payrollDataSourceInfo(synced.source);
  } catch (error) {
    migrationWarning = error instanceof Error ? error.message : 'Unable to sync Sage-migrated job grades into HRIS.';
  }
  const grades = await readJobGrades();
  return buildPayload(grades, {
    ...(sourceInfo || { source: 'DLE_Enterprise HRIS', databaseAvailable: true, warning: null, employeeCount: grades.reduce((sum, grade) => sum + grade.employeeCount, 0) }),
    structureSource: sourceInfo?.databaseAvailable ? SOURCE_SYSTEM : 'DLE Enterprise HRIS',
    migratedGradeCount: grades.length,
    migrationWarning,
    independence: 'Job grades are stored in the DLE HRIS database after migration and do not depend on live Sage reads for normal page rendering.',
  });
};
