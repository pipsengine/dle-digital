import sql from 'mssql';
import { getDleEnterpriseDbPool, type DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import type { EnhancedOrgNode, HealthStatus, NodeKind, OrgNode, StructureInsight } from '@/lib/organization-data';
import { buildEnhancedNodes } from '@/lib/organization-data';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';

type CompanyStructurePayload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  dataSource: ReturnType<typeof payrollDataSourceInfo> & {
    structureSource: 'Sage Payroll Migration' | 'DLE Enterprise HRIS' | 'Local HRIS payroll cache';
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
  nodes: EnhancedOrgNode[];
  insights: StructureInsight[];
};

type NodeGroup = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  kind: NodeKind;
  rows: DleEmployeeDirectoryRow[];
};

const SOURCE_SYSTEM = 'Sage Payroll Migration';
const dbReady = { value: false };

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const round1 = (value: number) => Math.round(value * 10) / 10;
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unassigned';
const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const isInactive = (employee: DleEmployeeDirectoryRow) => {
  const status = clean(employee.status).toLowerCase();
  return Boolean(employee.contractEndDate && new Date(employee.contractEndDate).getTime() < Date.now()) ||
    ['terminated', 'resigned', 'retired', 'inactive', 'exited'].some((word) => status.includes(word));
};

const displayValue = (value: unknown, fallback: string) => {
  const v = clean(value);
  if (!v || v === '-' || v.toLowerCase() === 'null') return fallback;
  return v;
};

const codeFrom = (value: string, max = 80) =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'UNASSIGNED';

const mostCommon = (values: Array<string | null | undefined>, fallback: string) => {
  const counts = new Map<string, number>();
  for (const value of values.map(clean).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || fallback;
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

const employeeLocation = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.projectSite, '') ||
  displayValue(employee.workLocation, '') ||
  displayValue(employee.officeLocation, '') ||
  displayValue(employee.location, 'Unassigned Location');

const employeeDivision = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.division, displayValue(employee.businessUnit, 'Unassigned Division'));

const employeeBusinessUnit = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.businessUnit, employeeDivision(employee));

const employeeDepartment = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.department, 'Unassigned Department');

const employeeTeam = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.costCenter, displayValue(employeeLocation(employee), 'Unassigned Team'));

const healthFrom = (headcount: number, rows: DleEmployeeDirectoryRow[], childCount: number): HealthStatus => {
  if (!headcount) return 'Critical';
  const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
  const missingPayrollCount = rows.filter((employee) => monthlyPayroll(employee) <= 0).length;
  if (missingManagerCount / headcount >= 0.35 || missingPayrollCount / headcount >= 0.2) return 'Critical';
  if (missingManagerCount > 0 || missingPayrollCount > 0 || childCount > 12) return 'Needs Attention';
  return 'Healthy';
};

const buildNode = (group: NodeGroup, childCount: number): OrgNode => {
  const rows = group.rows;
  const headcount = rows.length;
  const payrollNgn = Math.round(rows.reduce((sum, employee) => sum + monthlyPayroll(employee), 0));
  const managers = uniqueSorted(rows.map((employee) => clean(employee.managerName) || clean(employee.functionalManager)).filter(Boolean));
  const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
  const leader = mostCommon(rows.map((employee) => employee.departmentHead || employee.managerName || employee.functionalManager), group.kind === 'Company' ? 'Managing Director / CEO' : 'Unassigned Leader');
  const location = mostCommon(rows.map(employeeLocation), 'Unassigned Location');
  const costCenter = mostCommon(rows.map((employee) => employee.costCenter), group.code);
  const span = managers.length ? round1(headcount / managers.length) : headcount;
  const succession = round1(((headcount - missingManagerCount) / Math.max(headcount, 1)) * 100);
  const attrition = round1((missingManagerCount / Math.max(headcount, 1)) * 100);

  return {
    id: group.id,
    parentId: group.parentId,
    name: group.name,
    code: group.code,
    kind: group.kind,
    leader,
    location,
    headcount,
    openRoles: 0,
    budgetNgn: payrollNgn,
    payrollNgn,
    spanOfControl: span,
    successionCoveragePct: succession,
    attritionRiskPct: attrition,
    healthStatus: healthFrom(headcount, rows, childCount),
    costCenter,
    description: `${group.kind} entity migrated from Sage payroll employee assignments with ${headcount} active employee${headcount === 1 ? '' : 's'} and ${childCount} direct child node${childCount === 1 ? '' : 's'}.`,
  };
};

const addGroupRow = (groups: Map<string, NodeGroup>, group: Omit<NodeGroup, 'rows'>, employee: DleEmployeeDirectoryRow) => {
  const existing = groups.get(group.id) || { ...group, rows: [] };
  existing.rows.push(employee);
  groups.set(group.id, existing);
};

const buildNodesFromEmployees = (employees: DleEmployeeDirectoryRow[]) => {
  const activeEmployees = employees.filter((employee) => !isInactive(employee));
  const groups = new Map<string, NodeGroup>();
  const companyId = 'company-dle';
  const companyName = 'Dorman Long Engineering Limited';

  for (const employee of activeEmployees) {
    const division = employeeDivision(employee);
    const businessUnit = employeeBusinessUnit(employee);
    const department = employeeDepartment(employee);
    const team = employeeTeam(employee);
    const divisionId = `division-${slug(division)}`;
    const businessUnitId = `bu-${slug(division)}-${slug(businessUnit)}`;
    const departmentId = `dept-${slug(division)}-${slug(businessUnit)}-${slug(department)}`;
    const teamId = `team-${slug(division)}-${slug(businessUnit)}-${slug(department)}-${slug(team)}`;

    addGroupRow(groups, { id: companyId, parentId: null, name: companyName, code: 'DLE', kind: 'Company' }, employee);
    addGroupRow(groups, { id: divisionId, parentId: companyId, name: division, code: codeFrom(division), kind: 'Division' }, employee);
    addGroupRow(groups, { id: businessUnitId, parentId: divisionId, name: businessUnit, code: codeFrom(businessUnit), kind: 'Business Unit' }, employee);
    addGroupRow(groups, { id: departmentId, parentId: businessUnitId, name: department, code: codeFrom(department), kind: 'Department' }, employee);
    addGroupRow(groups, { id: teamId, parentId: departmentId, name: team, code: codeFrom(team), kind: 'Team' }, employee);
  }

  if (!groups.size) {
    groups.set(companyId, { id: companyId, parentId: null, name: companyName, code: 'DLE', kind: 'Company', rows: [] });
  }

  const childCounts = new Map<string, number>();
  for (const group of groups.values()) {
    if (!group.parentId) continue;
    childCounts.set(group.parentId, (childCounts.get(group.parentId) || 0) + 1);
  }

  const nodes = [...groups.values()].map((group) => buildNode(group, childCounts.get(group.id) || 0));
  return buildEnhancedNodes(nodes);
};

const buildInsights = (nodes: EnhancedOrgNode[], sourceWarning: string | null): StructureInsight[] => {
  const insights: StructureInsight[] = [];
  if (sourceWarning) {
    insights.push({
      id: 'source-warning',
      severity: 'high',
      title: 'Live Sage/HRIS source requires attention',
      recommendation: sourceWarning,
    });
  }

  const critical = nodes.filter((node) => node.healthStatus === 'Critical' && node.kind !== 'Team').sort((a, b) => b.headcount - a.headcount)[0];
  if (critical) {
    insights.push({
      id: 'critical-structure',
      severity: 'high',
      title: `${critical.name} has incomplete structure controls`,
      recommendation: 'Review manager assignment, payroll setup, and reporting ownership for this entity before using it for approval routing.',
    });
  }

  const noPayroll = nodes.filter((node) => node.kind === 'Department' && node.headcount > 0 && node.payrollNgn <= 0).sort((a, b) => b.headcount - a.headcount)[0];
  if (noPayroll) {
    insights.push({
      id: 'missing-payroll',
      severity: 'medium',
      title: `${noPayroll.name} has employees without usable payroll values`,
      recommendation: 'Confirm Sage salary setup and HRIS payroll migration fields for employees in this department.',
    });
  }

  insights.push({
    id: 'vacancy-source',
    severity: 'low',
    title: 'Vacancies are not inferred from employee headcount',
    recommendation: 'Open roles remain zero until approved vacancy records are connected to this structure registry.',
  });

  return insights.slice(0, 4);
};

const ensureDb = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) return null;

  if (!dbReady.value) {
    await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[OrganizationCompanyStructure]', N'U') IS NULL
CREATE TABLE [hris].[OrganizationCompanyStructure] (
  [Id] NVARCHAR(160) NOT NULL CONSTRAINT [PK_OrganizationCompanyStructure] PRIMARY KEY,
  [SourceSystem] NVARCHAR(80) NOT NULL,
  [SourceCode] NVARCHAR(100) NOT NULL,
  [ParentId] NVARCHAR(160) NULL,
  [Name] NVARCHAR(220) NOT NULL,
  [NodeKind] NVARCHAR(40) NOT NULL,
  [Leader] NVARCHAR(220) NOT NULL,
  [Location] NVARCHAR(180) NOT NULL,
  [Headcount] INT NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_Headcount] DEFAULT 0,
  [OpenRoles] INT NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_OpenRoles] DEFAULT 0,
  [BudgetNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_BudgetNgn] DEFAULT 0,
  [PayrollNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_PayrollNgn] DEFAULT 0,
  [SpanOfControl] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_SpanOfControl] DEFAULT 0,
  [SuccessionCoveragePct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_SuccessionCoveragePct] DEFAULT 0,
  [AttritionRiskPct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_AttritionRiskPct] DEFAULT 0,
  [HealthStatus] NVARCHAR(40) NOT NULL,
  [CostCenter] NVARCHAR(100) NOT NULL,
  [Description] NVARCHAR(700) NOT NULL,
  [ChildCount] INT NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_ChildCount] DEFAULT 0,
  [DescendantCount] INT NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_DescendantCount] DEFAULT 0,
  [SourceSnapshotJson] NVARCHAR(MAX) NOT NULL,
  [LastSyncedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_OrganizationCompanyStructure_LastSyncedAt] DEFAULT SYSUTCDATETIME(),
  CONSTRAINT [CK_OrganizationCompanyStructure_SourceSnapshotJson] CHECK (ISJSON([SourceSnapshotJson]) = 1)
);
IF OBJECT_ID(N'[hris].[UQ_OrganizationCompanyStructure_Source]', N'UQ') IS NOT NULL
  ALTER TABLE [hris].[OrganizationCompanyStructure] DROP CONSTRAINT [UQ_OrganizationCompanyStructure_Source];`);
    dbReady.value = true;
  }

  return pool;
};

const persistNodes = async (nodes: EnhancedOrgNode[]) => {
  const pool = await ensureDb();
  if (!pool) return 'DLE Enterprise database is not configured, so the live structure was generated but not persisted to organization entities.';

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const activeIds = new Set(nodes.map((node) => node.id));
    const existing = await new sql.Request(tx).query(`SELECT [Id] FROM [hris].[OrganizationCompanyStructure] WHERE [SourceSystem]=N'${SOURCE_SYSTEM}'`);
    for (const row of existing.recordset || []) {
      if (activeIds.has(String(row.Id))) continue;
      await new sql.Request(tx)
        .input('Id', sql.NVarChar(160), String(row.Id))
        .query(`DELETE FROM [hris].[OrganizationCompanyStructure] WHERE [SourceSystem]=N'${SOURCE_SYSTEM}' AND [Id]=@Id`);
    }

    for (const node of nodes) {
      await new sql.Request(tx)
        .input('Id', sql.NVarChar(160), node.id)
        .input('SourceSystem', sql.NVarChar(80), SOURCE_SYSTEM)
        .input('SourceCode', sql.NVarChar(100), node.code)
        .input('ParentId', sql.NVarChar(160), node.parentId)
        .input('Name', sql.NVarChar(220), node.name)
        .input('NodeKind', sql.NVarChar(40), node.kind)
        .input('Leader', sql.NVarChar(220), node.leader)
        .input('Location', sql.NVarChar(180), node.location)
        .input('Headcount', sql.Int, node.headcount)
        .input('OpenRoles', sql.Int, node.openRoles)
        .input('BudgetNgn', sql.Decimal(19, 2), node.budgetNgn)
        .input('PayrollNgn', sql.Decimal(19, 2), node.payrollNgn)
        .input('SpanOfControl', sql.Decimal(9, 2), node.spanOfControl)
        .input('SuccessionCoveragePct', sql.Decimal(9, 2), node.successionCoveragePct)
        .input('AttritionRiskPct', sql.Decimal(9, 2), node.attritionRiskPct)
        .input('HealthStatus', sql.NVarChar(40), node.healthStatus)
        .input('CostCenter', sql.NVarChar(100), node.costCenter)
        .input('Description', sql.NVarChar(700), node.description)
        .input('ChildCount', sql.Int, node.childCount)
        .input('DescendantCount', sql.Int, node.descendantCount)
        .input('SourceSnapshotJson', sql.NVarChar(sql.MAX), JSON.stringify({ migratedAt: new Date().toISOString(), source: SOURCE_SYSTEM }))
        .query(`
MERGE [hris].[OrganizationCompanyStructure] AS target
USING (SELECT @Id AS [Id]) AS source
ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET
  [SourceSystem]=@SourceSystem,[SourceCode]=@SourceCode,[ParentId]=@ParentId,[Name]=@Name,[NodeKind]=@NodeKind,
  [Leader]=@Leader,[Location]=@Location,[Headcount]=@Headcount,[OpenRoles]=@OpenRoles,[BudgetNgn]=@BudgetNgn,
  [PayrollNgn]=@PayrollNgn,[SpanOfControl]=@SpanOfControl,[SuccessionCoveragePct]=@SuccessionCoveragePct,
  [AttritionRiskPct]=@AttritionRiskPct,[HealthStatus]=@HealthStatus,[CostCenter]=@CostCenter,[Description]=@Description,
  [ChildCount]=@ChildCount,[DescendantCount]=@DescendantCount,[SourceSnapshotJson]=@SourceSnapshotJson,[LastSyncedAt]=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT
  ([Id],[SourceSystem],[SourceCode],[ParentId],[Name],[NodeKind],[Leader],[Location],[Headcount],[OpenRoles],[BudgetNgn],[PayrollNgn],[SpanOfControl],[SuccessionCoveragePct],[AttritionRiskPct],[HealthStatus],[CostCenter],[Description],[ChildCount],[DescendantCount],[SourceSnapshotJson])
VALUES
  (@Id,@SourceSystem,@SourceCode,@ParentId,@Name,@NodeKind,@Leader,@Location,@Headcount,@OpenRoles,@BudgetNgn,@PayrollNgn,@SpanOfControl,@SuccessionCoveragePct,@AttritionRiskPct,@HealthStatus,@CostCenter,@Description,@ChildCount,@DescendantCount,@SourceSnapshotJson);`);
    }

    await tx.commit();
    return null;
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
};

export const readLiveCompanyStructure = async (): Promise<CompanyStructurePayload> => {
  const source = await readPayrollEmployees();
  const nodes = buildNodesFromEmployees(source.employees);
  let migrationWarning: string | null = null;
  try {
    migrationWarning = await persistNodes(nodes);
  } catch (error) {
    migrationWarning = error instanceof Error ? error.message : 'Unable to persist migrated company structure entities.';
  }

  const totalHeadcount = nodes.find((node) => node.parentId === null)?.headcount || nodes.reduce((sum, node) => sum + (node.kind === 'Team' ? node.headcount : 0), 0);
  const totalOpenRoles = nodes.reduce((sum, node) => sum + node.openRoles, 0);
  const avgSuccessionCoverage = nodes.length ? round1(nodes.reduce((sum, node) => sum + node.successionCoveragePct, 0) / nodes.length) : 0;
  const avgSpan = nodes.length ? round1(nodes.reduce((sum, node) => sum + node.spanOfControl, 0) / nodes.length) : 0;

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      canEdit: true,
      canExport: true,
      canViewCosts: true,
    },
    dataSource: {
      ...payrollDataSourceInfo(source),
      structureSource: source.databaseAvailable ? SOURCE_SYSTEM : 'Local HRIS payroll cache',
      migratedEntityCount: nodes.length,
      migrationWarning,
    },
    summary: {
      totalUnits: nodes.length,
      totalHeadcount,
      totalOpenRoles,
      avgSuccessionCoverage,
      avgSpanOfControl: avgSpan,
      criticalUnits: nodes.filter((node) => node.healthStatus === 'Critical').length,
      attentionUnits: nodes.filter((node) => node.healthStatus === 'Needs Attention').length,
    },
    filterOptions: {
      kinds: uniqueSorted(nodes.map((node) => node.kind)) as NodeKind[],
      locations: uniqueSorted(nodes.map((node) => node.location)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'],
    },
    nodes,
    insights: buildInsights(nodes, source.warning || migrationWarning),
  };
};
