import sql from 'mssql';
import { getDleEnterpriseDbPool, type DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import type { EnhancedOrgNode, HealthStatus, NodeKind, StructureInsight, UnitSectionRecord } from '@/lib/organization-data';
import { buildEnhancedNodes } from '@/lib/organization-data';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';

type UnitsSectionsPayload = {
  generatedAt: string;
  permissions: {
    canEdit: boolean;
    canExport: boolean;
    canViewCosts: boolean;
  };
  dataSource: ReturnType<typeof payrollDataSourceInfo> & {
    structureSource: 'Sage Payroll Migration' | 'Local HRIS payroll cache';
    migratedEntityCount: number;
    migrationWarning: string | null;
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

type EntityGroup = {
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

const isInactive = (employee: DleEmployeeDirectoryRow) => {
  const status = clean(employee.status).toLowerCase();
  return Boolean(employee.contractEndDate && new Date(employee.contractEndDate).getTime() < Date.now()) ||
    ['terminated', 'resigned', 'retired', 'inactive', 'exited'].some((word) => status.includes(word));
};

const employeeDivision = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.division, displayValue(employee.businessUnit, 'Unassigned Division'));

const employeeUnit = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.businessUnit, displayValue(employee.department, 'Unassigned Unit'));

const employeeDepartment = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.department, 'Unassigned Department');

const employeeLocation = (employee: DleEmployeeDirectoryRow) =>
  displayValue(employee.projectSite, '') ||
  displayValue(employee.workLocation, '') ||
  displayValue(employee.officeLocation, '') ||
  displayValue(employee.location, 'Unassigned Location');

const employeeSection = (employee: DleEmployeeDirectoryRow) => {
  const costCenter = clean(employee.costCenter);
  if (costCenter) return costCenter;
  const job = clean(employee.jobTitle);
  if (job) return job;
  return employeeLocation(employee);
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

const addGroupRow = (groups: Map<string, EntityGroup>, group: Omit<EntityGroup, 'rows'>, employee: DleEmployeeDirectoryRow) => {
  const existing = groups.get(group.id) || { ...group, rows: [] };
  existing.rows.push(employee);
  groups.set(group.id, existing);
};

const healthFrom = (rows: DleEmployeeDirectoryRow[], childCount: number): HealthStatus => {
  const headcount = rows.length;
  if (!headcount) return 'Critical';
  const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
  const missingPayrollCount = rows.filter((employee) => monthlyPayroll(employee) <= 0).length;
  if (missingManagerCount / headcount >= 0.35 || missingPayrollCount / headcount >= 0.2) return 'Critical';
  if (missingManagerCount > 0 || missingPayrollCount > 0 || childCount > 10) return 'Needs Attention';
  return 'Healthy';
};

const buildNode = (group: EntityGroup, childCount: number): EnhancedOrgNode => {
  const rows = group.rows;
  const headcount = rows.length;
  const managers = uniqueSorted(rows.map((employee) => clean(employee.managerName) || clean(employee.functionalManager)).filter(Boolean));
  const missingManagerCount = rows.filter((employee) => !clean(employee.managerName) && !clean(employee.functionalManager) && !clean(employee.departmentHead)).length;
  const payrollNgn = Math.round(rows.reduce((sum, employee) => sum + monthlyPayroll(employee), 0));
  return {
    id: group.id,
    parentId: group.parentId,
    name: group.name,
    code: group.code,
    kind: group.kind,
    leader: mostCommon(rows.map((employee) => employee.departmentHead || employee.managerName || employee.functionalManager), 'Unassigned Leader'),
    location: mostCommon(rows.map(employeeLocation), 'Unassigned Location'),
    headcount,
    openRoles: 0,
    budgetNgn: payrollNgn,
    payrollNgn,
    spanOfControl: managers.length ? round1(headcount / managers.length) : headcount,
    successionCoveragePct: round1(((headcount - missingManagerCount) / Math.max(headcount, 1)) * 100),
    attritionRiskPct: round1((missingManagerCount / Math.max(headcount, 1)) * 100),
    healthStatus: healthFrom(rows, childCount),
    costCenter: mostCommon(rows.map((employee) => employee.costCenter), group.code),
    description: `${group.kind} migrated from Sage-backed employee assignments with ${headcount} active employee${headcount === 1 ? '' : 's'}.`,
    childCount,
    descendantCount: 0,
  };
};

const buildUnitSectionRecords = (employees: DleEmployeeDirectoryRow[]) => {
  const activeEmployees = employees.filter((employee) => !isInactive(employee));
  const groups = new Map<string, EntityGroup>();

  for (const employee of activeEmployees) {
    const division = employeeDivision(employee);
    const unit = employeeUnit(employee);
    const department = employeeDepartment(employee);
    const section = employeeSection(employee);
    const unitId = `unit-${slug(division)}-${slug(unit)}`;
    const departmentId = `dept-${slug(division)}-${slug(unit)}-${slug(department)}`;
    const sectionId = `section-${slug(division)}-${slug(unit)}-${slug(department)}-${slug(section)}`;

    addGroupRow(groups, { id: unitId, parentId: null, name: unit, code: codeFrom(unit), kind: 'Business Unit' }, employee);
    addGroupRow(groups, { id: departmentId, parentId: unitId, name: department, code: codeFrom(department), kind: 'Department' }, employee);
    addGroupRow(groups, { id: sectionId, parentId: departmentId, name: section, code: codeFrom(section), kind: 'Team' }, employee);
  }

  const childCounts = new Map<string, number>();
  for (const group of groups.values()) {
    if (!group.parentId) continue;
    childCounts.set(group.parentId, (childCounts.get(group.parentId) || 0) + 1);
  }

  const nodes = buildEnhancedNodes([...groups.values()].map((group) => buildNode(group, childCounts.get(group.id) || 0)));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childByParent = new Map<string, EnhancedOrgNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    childByParent.set(node.parentId, [...(childByParent.get(node.parentId) || []), node]);
  }

  const parentChain = (node: EnhancedOrgNode) => {
    const chain: string[] = [];
    let current = node.parentId ? nodeById.get(node.parentId) : undefined;
    while (current) {
      chain.unshift(current.name);
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }
    return chain;
  };

  const descendants = (node: EnhancedOrgNode): EnhancedOrgNode[] => {
    const children = childByParent.get(node.id) || [];
    return children.flatMap((child) => [child, ...descendants(child)]);
  };

  const units: UnitSectionRecord[] = nodes.filter((node) => node.kind === 'Business Unit').map((node) => {
    const related = descendants(node);
    const parentName = mostCommon(groups.get(node.id)?.rows.map(employeeDivision) || [], 'DLE');
    return {
      ...node,
      recordType: 'Unit',
      parentName,
      parentKind: 'Division',
      parentChain: [parentName],
      relatedDepartmentCount: related.filter((item) => item.kind === 'Department').length,
      relatedTeamCount: related.filter((item) => item.kind === 'Team').length,
      relatedHeadcount: related.filter((item) => item.kind === 'Team').reduce((sum, item) => sum + item.headcount, 0),
      relatedItems: related.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        leader: item.leader,
        headcount: item.headcount,
        openRoles: item.openRoles,
        healthStatus: item.healthStatus,
      })),
    };
  });

  const sections: UnitSectionRecord[] = nodes.filter((node) => node.kind === 'Team').map((node) => {
    const parent = node.parentId ? nodeById.get(node.parentId) || null : null;
    const unit = parent?.parentId ? nodeById.get(parent.parentId) || null : null;
    return {
      ...node,
      recordType: 'Section',
      parentName: parent?.name || null,
      parentKind: parent?.kind || null,
      parentChain: parentChain(node),
      relatedDepartmentCount: parent?.kind === 'Department' ? 1 : 0,
      relatedTeamCount: 0,
      relatedHeadcount: node.headcount,
      relatedItems: [
        ...(parent ? [{
          id: parent.id,
          name: parent.name,
          kind: parent.kind,
          leader: parent.leader,
          headcount: parent.headcount,
          openRoles: parent.openRoles,
          healthStatus: parent.healthStatus,
        }] : []),
        ...(unit ? [{
          id: unit.id,
          name: unit.name,
          kind: unit.kind,
          leader: unit.leader,
          headcount: unit.headcount,
          openRoles: unit.openRoles,
          healthStatus: unit.healthStatus,
        }] : []),
      ],
    };
  });

  return [...units, ...sections].sort((a, b) => a.recordType.localeCompare(b.recordType) || b.headcount - a.headcount || a.name.localeCompare(b.name));
};

const buildInsights = (records: UnitSectionRecord[], warning: string | null): StructureInsight[] => {
  const units = records.filter((record) => record.recordType === 'Unit');
  const sections = records.filter((record) => record.recordType === 'Section');
  const highestRisk = [...sections].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct || b.headcount - a.headcount)[0];
  const weakestCoverage = [...units].sort((a, b) => a.successionCoveragePct - b.successionCoveragePct || b.headcount - a.headcount)[0];
  const largestUnit = [...units].sort((a, b) => b.headcount - a.headcount)[0];
  return [
    warning ? { id: 'source-warning', severity: 'high' as const, title: 'Live Sage/HRIS source requires attention', recommendation: warning } : null,
    highestRisk ? { id: 'highest-risk-section', severity: highestRisk.healthStatus === 'Critical' ? 'high' as const : 'medium' as const, title: `${highestRisk.name} has the highest section risk`, recommendation: 'Review manager assignment, payroll setup, and frontline continuity for this section.' } : null,
    weakestCoverage ? { id: 'weakest-unit-coverage', severity: weakestCoverage.successionCoveragePct < 75 ? 'high' as const : 'medium' as const, title: `${weakestCoverage.name} has the weakest unit coverage`, recommendation: 'Confirm reporting lines and delegation coverage for critical roles within this unit.' } : null,
    largestUnit ? { id: 'largest-unit', severity: largestUnit.headcount > 150 ? 'medium' as const : 'low' as const, title: `${largestUnit.name} carries the largest workforce footprint`, recommendation: 'Monitor approval span, project allocation, payroll readiness, and workload distribution for this unit.' } : null,
  ].filter((item): item is StructureInsight => Boolean(item)).slice(0, 4);
};

const ensureDb = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) return null;
  if (!dbReady.value) {
    await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[OrganizationUnitsSections]', N'U') IS NULL
CREATE TABLE [hris].[OrganizationUnitsSections] (
  [Id] NVARCHAR(180) NOT NULL CONSTRAINT [PK_OrganizationUnitsSections] PRIMARY KEY,
  [SourceSystem] NVARCHAR(80) NOT NULL,
  [RecordType] NVARCHAR(20) NOT NULL,
  [SourceCode] NVARCHAR(100) NOT NULL,
  [ParentName] NVARCHAR(220) NULL,
  [ParentKind] NVARCHAR(40) NULL,
  [Name] NVARCHAR(220) NOT NULL,
  [Leader] NVARCHAR(220) NOT NULL,
  [Location] NVARCHAR(180) NOT NULL,
  [Headcount] INT NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_Headcount] DEFAULT 0,
  [OpenRoles] INT NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_OpenRoles] DEFAULT 0,
  [BudgetNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_BudgetNgn] DEFAULT 0,
  [PayrollNgn] DECIMAL(19,2) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_PayrollNgn] DEFAULT 0,
  [SpanOfControl] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_SpanOfControl] DEFAULT 0,
  [SuccessionCoveragePct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_SuccessionCoveragePct] DEFAULT 0,
  [AttritionRiskPct] DECIMAL(9,2) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_AttritionRiskPct] DEFAULT 0,
  [HealthStatus] NVARCHAR(40) NOT NULL,
  [CostCenter] NVARCHAR(100) NOT NULL,
  [Description] NVARCHAR(700) NOT NULL,
  [RelatedDepartmentCount] INT NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_RelatedDepartmentCount] DEFAULT 0,
  [RelatedTeamCount] INT NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_RelatedTeamCount] DEFAULT 0,
  [RelatedHeadcount] INT NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_RelatedHeadcount] DEFAULT 0,
  [ParentChainJson] NVARCHAR(MAX) NOT NULL,
  [RelatedItemsJson] NVARCHAR(MAX) NOT NULL,
  [SourceSnapshotJson] NVARCHAR(MAX) NOT NULL,
  [LastSyncedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_OrganizationUnitsSections_LastSyncedAt] DEFAULT SYSUTCDATETIME(),
  CONSTRAINT [CK_OrganizationUnitsSections_ParentChainJson] CHECK (ISJSON([ParentChainJson]) = 1),
  CONSTRAINT [CK_OrganizationUnitsSections_RelatedItemsJson] CHECK (ISJSON([RelatedItemsJson]) = 1),
  CONSTRAINT [CK_OrganizationUnitsSections_SourceSnapshotJson] CHECK (ISJSON([SourceSnapshotJson]) = 1)
);`);
    dbReady.value = true;
  }
  return pool;
};

const persistRecords = async (records: UnitSectionRecord[]) => {
  const pool = await ensureDb();
  if (!pool) return 'DLE Enterprise database is not configured, so units and sections were generated but not persisted.';
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const activeIds = new Set(records.map((record) => record.id));
    const existing = await new sql.Request(tx).query(`SELECT [Id] FROM [hris].[OrganizationUnitsSections] WHERE [SourceSystem]=N'${SOURCE_SYSTEM}'`);
    for (const row of existing.recordset || []) {
      if (activeIds.has(String(row.Id))) continue;
      await new sql.Request(tx)
        .input('Id', sql.NVarChar(180), String(row.Id))
        .query(`DELETE FROM [hris].[OrganizationUnitsSections] WHERE [SourceSystem]=N'${SOURCE_SYSTEM}' AND [Id]=@Id`);
    }
    for (const record of records) {
      await new sql.Request(tx)
        .input('Id', sql.NVarChar(180), record.id)
        .input('SourceSystem', sql.NVarChar(80), SOURCE_SYSTEM)
        .input('RecordType', sql.NVarChar(20), record.recordType)
        .input('SourceCode', sql.NVarChar(100), record.code)
        .input('ParentName', sql.NVarChar(220), record.parentName)
        .input('ParentKind', sql.NVarChar(40), record.parentKind)
        .input('Name', sql.NVarChar(220), record.name)
        .input('Leader', sql.NVarChar(220), record.leader)
        .input('Location', sql.NVarChar(180), record.location)
        .input('Headcount', sql.Int, record.headcount)
        .input('OpenRoles', sql.Int, record.openRoles)
        .input('BudgetNgn', sql.Decimal(19, 2), record.budgetNgn)
        .input('PayrollNgn', sql.Decimal(19, 2), record.payrollNgn)
        .input('SpanOfControl', sql.Decimal(9, 2), record.spanOfControl)
        .input('SuccessionCoveragePct', sql.Decimal(9, 2), record.successionCoveragePct)
        .input('AttritionRiskPct', sql.Decimal(9, 2), record.attritionRiskPct)
        .input('HealthStatus', sql.NVarChar(40), record.healthStatus)
        .input('CostCenter', sql.NVarChar(100), record.costCenter)
        .input('Description', sql.NVarChar(700), record.description)
        .input('RelatedDepartmentCount', sql.Int, record.relatedDepartmentCount)
        .input('RelatedTeamCount', sql.Int, record.relatedTeamCount)
        .input('RelatedHeadcount', sql.Int, record.relatedHeadcount)
        .input('ParentChainJson', sql.NVarChar(sql.MAX), JSON.stringify(record.parentChain))
        .input('RelatedItemsJson', sql.NVarChar(sql.MAX), JSON.stringify(record.relatedItems))
        .input('SourceSnapshotJson', sql.NVarChar(sql.MAX), JSON.stringify({ migratedAt: new Date().toISOString(), source: SOURCE_SYSTEM }))
        .query(`
MERGE [hris].[OrganizationUnitsSections] AS target
USING (SELECT @Id AS [Id]) AS source
ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET
  [SourceSystem]=@SourceSystem,[RecordType]=@RecordType,[SourceCode]=@SourceCode,[ParentName]=@ParentName,[ParentKind]=@ParentKind,
  [Name]=@Name,[Leader]=@Leader,[Location]=@Location,[Headcount]=@Headcount,[OpenRoles]=@OpenRoles,[BudgetNgn]=@BudgetNgn,
  [PayrollNgn]=@PayrollNgn,[SpanOfControl]=@SpanOfControl,[SuccessionCoveragePct]=@SuccessionCoveragePct,[AttritionRiskPct]=@AttritionRiskPct,
  [HealthStatus]=@HealthStatus,[CostCenter]=@CostCenter,[Description]=@Description,[RelatedDepartmentCount]=@RelatedDepartmentCount,
  [RelatedTeamCount]=@RelatedTeamCount,[RelatedHeadcount]=@RelatedHeadcount,[ParentChainJson]=@ParentChainJson,[RelatedItemsJson]=@RelatedItemsJson,
  [SourceSnapshotJson]=@SourceSnapshotJson,[LastSyncedAt]=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT
  ([Id],[SourceSystem],[RecordType],[SourceCode],[ParentName],[ParentKind],[Name],[Leader],[Location],[Headcount],[OpenRoles],[BudgetNgn],[PayrollNgn],[SpanOfControl],[SuccessionCoveragePct],[AttritionRiskPct],[HealthStatus],[CostCenter],[Description],[RelatedDepartmentCount],[RelatedTeamCount],[RelatedHeadcount],[ParentChainJson],[RelatedItemsJson],[SourceSnapshotJson])
VALUES
  (@Id,@SourceSystem,@RecordType,@SourceCode,@ParentName,@ParentKind,@Name,@Leader,@Location,@Headcount,@OpenRoles,@BudgetNgn,@PayrollNgn,@SpanOfControl,@SuccessionCoveragePct,@AttritionRiskPct,@HealthStatus,@CostCenter,@Description,@RelatedDepartmentCount,@RelatedTeamCount,@RelatedHeadcount,@ParentChainJson,@RelatedItemsJson,@SourceSnapshotJson);`);
    }
    await tx.commit();
    return null;
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
};

export const readLiveUnitsSections = async (): Promise<UnitsSectionsPayload> => {
  const source = await readPayrollEmployees();
  const records = buildUnitSectionRecords(source.employees);
  let migrationWarning: string | null = null;
  try {
    migrationWarning = await persistRecords(records);
  } catch (error) {
    migrationWarning = error instanceof Error ? error.message : 'Unable to persist migrated unit and section records.';
  }
  const totalHeadcount = records.filter((record) => record.recordType === 'Section').reduce((sum, record) => sum + record.headcount, 0);
  const avgSuccessionCoverage = records.length ? round1(records.reduce((sum, record) => sum + record.successionCoveragePct, 0) / records.length) : 0;
  const avgAttritionRisk = records.length ? round1(records.reduce((sum, record) => sum + record.attritionRiskPct, 0) / records.length) : 0;
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
      migratedEntityCount: records.length,
      migrationWarning,
    },
    summary: {
      totalRecords: records.length,
      totalUnits: records.filter((record) => record.recordType === 'Unit').length,
      totalSections: records.filter((record) => record.recordType === 'Section').length,
      totalHeadcount,
      totalOpenRoles: records.reduce((sum, record) => sum + record.openRoles, 0),
      avgSuccessionCoverage,
      avgAttritionRisk,
    },
    filterOptions: {
      recordTypes: ['Unit', 'Section'],
      locations: uniqueSorted(records.map((record) => record.location)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'],
      parentUnits: uniqueSorted(records.map((record) => record.parentName || '').filter(Boolean)),
    },
    records,
    insights: buildInsights(records, source.warning || migrationWarning),
  };
};
