export type NodeKind = 'Company' | 'Division' | 'Business Unit' | 'Department' | 'Team';
export type HealthStatus = 'Healthy' | 'Needs Attention' | 'Critical';

export type OrgNode = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  kind: NodeKind;
  leader: string;
  location: string;
  headcount: number;
  openRoles: number;
  budgetUsd: number;
  payrollUsd: number;
  spanOfControl: number;
  successionCoveragePct: number;
  attritionRiskPct: number;
  healthStatus: HealthStatus;
  costCenter: string;
  description: string;
};

export type EnhancedOrgNode = OrgNode & {
  childCount: number;
  descendantCount: number;
};

export type StructureInsight = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  recommendation: string;
};

export type DepartmentRecord = EnhancedOrgNode & {
  parentName: string | null;
  parentKind: NodeKind | null;
  parentChain: string[];
  teamCount: number;
  teamHeadcount: number;
  teams: Array<{
    id: string;
    name: string;
    leader: string;
    headcount: number;
    openRoles: number;
    healthStatus: HealthStatus;
  }>;
};

export type UnitSectionRecord = EnhancedOrgNode & {
  recordType: 'Unit' | 'Section';
  parentName: string | null;
  parentKind: NodeKind | null;
  parentChain: string[];
  relatedDepartmentCount: number;
  relatedTeamCount: number;
  relatedHeadcount: number;
  relatedItems: Array<{
    id: string;
    name: string;
    kind: NodeKind;
    leader: string;
    headcount: number;
    openRoles: number;
    healthStatus: HealthStatus;
  }>;
};

export type LocationSiteRecord = {
  id: string;
  name: string;
  recordType: 'Location' | 'Site';
  parentName: string | null;
  parentChain: string[];
  region: string;
  country: string;
  siteCategory: 'State' | 'Head Office' | 'Operational Hub' | 'Yard' | 'Field Site';
  leader: string;
  location: string;
  headcount: number;
  openRoles: number;
  budgetUsd: number;
  payrollUsd: number;
  spanOfControl: number;
  successionCoveragePct: number;
  attritionRiskPct: number;
  healthStatus: HealthStatus;
  costCenter: string;
  description: string;
  nodeCount: number;
  divisionCount: number;
  businessUnitCount: number;
  departmentCount: number;
  teamCount: number;
  relatedItems: Array<{
    id: string;
    name: string;
    kind: NodeKind | 'Site';
    leader: string;
    headcount: number;
    openRoles: number;
    healthStatus: HealthStatus;
  }>;
};

export type JobGradeRecord = {
  id: string;
  code: string;
  name: string;
  family: 'Executive' | 'Management' | 'Professional' | 'Technical' | 'Operations Support';
  level: 'Strategic' | 'Senior' | 'Mid' | 'Entry';
  minSalaryUsd: number;
  midpointSalaryUsd: number;
  maxSalaryUsd: number;
  employeeCount: number;
  openPositions: number;
  successionCoveragePct: number;
  attritionRiskPct: number;
  internalMobilityPct: number;
  averageTenureYears: number;
  femaleRepresentationPct: number;
  healthStatus: HealthStatus;
  benchmarkPosition: string;
  nextGradeCode: string | null;
  keyRoles: string[];
  gradeMix: Array<{
    unit: string;
    headcount: number;
  }>;
  description: string;
};

export const organizationNodes: OrgNode[] = [
  {
    id: 'org-root',
    parentId: null,
    name: 'Dorman Long Engineering',
    code: 'DLE-HQ',
    kind: 'Company',
    leader: 'Group Managing Director',
    location: 'Lagos HQ',
    headcount: 1268,
    openRoles: 34,
    budgetUsd: 98000000,
    payrollUsd: 28400000,
    spanOfControl: 8,
    successionCoveragePct: 82,
    attritionRiskPct: 7,
    healthStatus: 'Healthy',
    costCenter: 'CORP-001',
    description: 'Enterprise parent structure covering operations, projects, and shared services.',
  },
  {
    id: 'div-ops',
    parentId: 'org-root',
    name: 'Operations Division',
    code: 'OPS',
    kind: 'Division',
    leader: 'Executive Director, Operations',
    location: 'Port Harcourt',
    headcount: 462,
    openRoles: 12,
    budgetUsd: 36000000,
    payrollUsd: 11100000,
    spanOfControl: 6,
    successionCoveragePct: 79,
    attritionRiskPct: 9,
    healthStatus: 'Healthy',
    costCenter: 'OPS-100',
    description: 'Operational delivery structure across fabrication, field execution, and maintenance.',
  },
  {
    id: 'div-projects',
    parentId: 'org-root',
    name: 'Projects Division',
    code: 'PRJ',
    kind: 'Division',
    leader: 'Executive Director, Projects',
    location: 'Lagos HQ',
    headcount: 351,
    openRoles: 15,
    budgetUsd: 28400000,
    payrollUsd: 8600000,
    spanOfControl: 7,
    successionCoveragePct: 74,
    attritionRiskPct: 11,
    healthStatus: 'Needs Attention',
    costCenter: 'PRJ-200',
    description: 'Project execution governance for engineering, controls, planning, and site delivery.',
  },
  {
    id: 'div-corp',
    parentId: 'org-root',
    name: 'Corporate Services',
    code: 'CSV',
    kind: 'Division',
    leader: 'Executive Director, Corporate Services',
    location: 'Lagos HQ',
    headcount: 214,
    openRoles: 7,
    budgetUsd: 14100000,
    payrollUsd: 4700000,
    spanOfControl: 5,
    successionCoveragePct: 86,
    attritionRiskPct: 6,
    healthStatus: 'Healthy',
    costCenter: 'CSV-300',
    description: 'Shared services structure covering HR, finance, procurement, legal, and IT.',
  },
  {
    id: 'bu-fabrication',
    parentId: 'div-ops',
    name: 'Fabrication & Yards',
    code: 'OPS-FAB',
    kind: 'Business Unit',
    leader: 'GM, Fabrication',
    location: 'Warri Yard',
    headcount: 178,
    openRoles: 4,
    budgetUsd: 11200000,
    payrollUsd: 3900000,
    spanOfControl: 7,
    successionCoveragePct: 77,
    attritionRiskPct: 8,
    healthStatus: 'Healthy',
    costCenter: 'OPS-110',
    description: 'Fabrication, yard operations, welding, fitting, and structural delivery.',
  },
  {
    id: 'bu-field',
    parentId: 'div-ops',
    name: 'Field Execution',
    code: 'OPS-FLD',
    kind: 'Business Unit',
    leader: 'GM, Field Execution',
    location: 'Bonny Island',
    headcount: 196,
    openRoles: 6,
    budgetUsd: 14900000,
    payrollUsd: 4700000,
    spanOfControl: 8,
    successionCoveragePct: 68,
    attritionRiskPct: 13,
    healthStatus: 'Needs Attention',
    costCenter: 'OPS-120',
    description: 'Site mobilization, project field execution, and commissioning support.',
  },
  {
    id: 'dept-maint',
    parentId: 'div-ops',
    name: 'Maintenance Services',
    code: 'OPS-MNT',
    kind: 'Department',
    leader: 'Head, Maintenance Services',
    location: 'Port Harcourt',
    headcount: 88,
    openRoles: 2,
    budgetUsd: 5900000,
    payrollUsd: 1600000,
    spanOfControl: 6,
    successionCoveragePct: 83,
    attritionRiskPct: 7,
    healthStatus: 'Healthy',
    costCenter: 'OPS-130',
    description: 'Planned maintenance, shutdown support, and plant integrity resources.',
  },
  {
    id: 'dept-engineering',
    parentId: 'div-projects',
    name: 'Engineering Delivery',
    code: 'PRJ-ENG',
    kind: 'Department',
    leader: 'Head, Engineering Delivery',
    location: 'Lagos HQ',
    headcount: 129,
    openRoles: 5,
    budgetUsd: 9500000,
    payrollUsd: 3200000,
    spanOfControl: 7,
    successionCoveragePct: 72,
    attritionRiskPct: 10,
    healthStatus: 'Needs Attention',
    costCenter: 'PRJ-210',
    description: 'Multidiscipline engineering resources across civil, mechanical, and E&I.',
  },
  {
    id: 'dept-controls',
    parentId: 'div-projects',
    name: 'Project Controls',
    code: 'PRJ-CTL',
    kind: 'Department',
    leader: 'Head, Project Controls',
    location: 'Lagos HQ',
    headcount: 74,
    openRoles: 3,
    budgetUsd: 4700000,
    payrollUsd: 1500000,
    spanOfControl: 5,
    successionCoveragePct: 66,
    attritionRiskPct: 15,
    healthStatus: 'Critical',
    costCenter: 'PRJ-220',
    description: 'Planning, cost control, risk governance, and project reporting.',
  },
  {
    id: 'dept-hse',
    parentId: 'div-projects',
    name: 'HSE & Quality Assurance',
    code: 'PRJ-HSEQ',
    kind: 'Department',
    leader: 'Head, HSEQ',
    location: 'Lagos HQ',
    headcount: 61,
    openRoles: 4,
    budgetUsd: 3300000,
    payrollUsd: 1100000,
    spanOfControl: 5,
    successionCoveragePct: 71,
    attritionRiskPct: 9,
    healthStatus: 'Needs Attention',
    costCenter: 'PRJ-230',
    description: 'HSE, QA/QC, audits, and compliance assurance across projects.',
  },
  {
    id: 'dept-hr',
    parentId: 'div-corp',
    name: 'Human Capital',
    code: 'CSV-HR',
    kind: 'Department',
    leader: 'Head, Human Capital',
    location: 'Lagos HQ',
    headcount: 42,
    openRoles: 2,
    budgetUsd: 2100000,
    payrollUsd: 840000,
    spanOfControl: 4,
    successionCoveragePct: 88,
    attritionRiskPct: 5,
    healthStatus: 'Healthy',
    costCenter: 'CSV-310',
    description: 'Talent, rewards, workforce planning, HR operations, and employee relations.',
  },
  {
    id: 'dept-fin',
    parentId: 'div-corp',
    name: 'Finance & Accounting',
    code: 'CSV-FIN',
    kind: 'Department',
    leader: 'Head, Finance',
    location: 'Lagos HQ',
    headcount: 37,
    openRoles: 1,
    budgetUsd: 1900000,
    payrollUsd: 760000,
    spanOfControl: 4,
    successionCoveragePct: 84,
    attritionRiskPct: 4,
    healthStatus: 'Healthy',
    costCenter: 'CSV-320',
    description: 'Financial control, treasury, tax, and management reporting.',
  },
  {
    id: 'dept-it',
    parentId: 'div-corp',
    name: 'IT & Enterprise Systems',
    code: 'CSV-IT',
    kind: 'Department',
    leader: 'Head, IT',
    location: 'Lagos HQ',
    headcount: 31,
    openRoles: 3,
    budgetUsd: 2700000,
    payrollUsd: 620000,
    spanOfControl: 4,
    successionCoveragePct: 69,
    attritionRiskPct: 12,
    healthStatus: 'Needs Attention',
    costCenter: 'CSV-330',
    description: 'Infrastructure, ERP, HRIS, analytics, cybersecurity, and service delivery.',
  },
  {
    id: 'team-talent',
    parentId: 'dept-hr',
    name: 'Talent & Organization Development',
    code: 'CSV-HR-TOD',
    kind: 'Team',
    leader: 'Manager, Talent & OD',
    location: 'Lagos HQ',
    headcount: 12,
    openRoles: 1,
    budgetUsd: 620000,
    payrollUsd: 240000,
    spanOfControl: 3,
    successionCoveragePct: 90,
    attritionRiskPct: 4,
    healthStatus: 'Healthy',
    costCenter: 'CSV-311',
    description: 'Talent review, succession planning, leadership development, and workforce design.',
  },
  {
    id: 'team-hr-ops',
    parentId: 'dept-hr',
    name: 'HR Operations',
    code: 'CSV-HR-OPS',
    kind: 'Team',
    leader: 'Manager, HR Operations',
    location: 'Lagos HQ',
    headcount: 14,
    openRoles: 1,
    budgetUsd: 590000,
    payrollUsd: 260000,
    spanOfControl: 4,
    successionCoveragePct: 85,
    attritionRiskPct: 5,
    healthStatus: 'Healthy',
    costCenter: 'CSV-312',
    description: 'Employee lifecycle operations, data quality, shared HR services, and compliance.',
  },
  {
    id: 'team-planning',
    parentId: 'dept-controls',
    name: 'Planning & Controls Office',
    code: 'PRJ-CTL-PLN',
    kind: 'Team',
    leader: 'Manager, Planning',
    location: 'Lagos HQ',
    headcount: 19,
    openRoles: 2,
    budgetUsd: 980000,
    payrollUsd: 410000,
    spanOfControl: 3,
    successionCoveragePct: 58,
    attritionRiskPct: 18,
    healthStatus: 'Critical',
    costCenter: 'PRJ-221',
    description: 'Integrated planning, scheduling, dashboards, and milestone control.',
  },
  {
    id: 'team-cost',
    parentId: 'dept-controls',
    name: 'Cost & Commercial Controls',
    code: 'PRJ-CTL-CST',
    kind: 'Team',
    leader: 'Manager, Cost Control',
    location: 'Lagos HQ',
    headcount: 15,
    openRoles: 1,
    budgetUsd: 830000,
    payrollUsd: 340000,
    spanOfControl: 3,
    successionCoveragePct: 63,
    attritionRiskPct: 16,
    healthStatus: 'Needs Attention',
    costCenter: 'PRJ-222',
    description: 'Commercial governance, earned value, forecasting, and margin protection.',
  },
];

export const structureInsights: StructureInsight[] = [
  {
    id: 'ins-1',
    severity: 'high',
    title: 'Project Controls has elevated attrition risk and low succession coverage',
    recommendation: 'Prioritize retention plans, backfill readiness, and cross-training for critical controls roles.',
  },
  {
    id: 'ins-2',
    severity: 'medium',
    title: 'Field Execution is carrying a high open-role load',
    recommendation: 'Accelerate hiring for site-critical supervisors and review temporary workforce conversion options.',
  },
  {
    id: 'ins-3',
    severity: 'low',
    title: 'Human Capital shows strong coverage and healthy managerial span',
    recommendation: 'Use HR as the pilot team for structure governance scorecards and review workflows.',
  },
];

export const buildChildrenMap = (nodes: OrgNode[]) =>
  nodes.reduce<Record<string, OrgNode[]>>((acc, node) => {
    const key = node.parentId || 'root';
    acc[key] = acc[key] || [];
    acc[key].push(node);
    return acc;
  }, {});

export const buildNodeMap = (nodes: OrgNode[]) => new Map(nodes.map((node) => [node.id, node]));

export const buildEnhancedNodes = (nodes: OrgNode[]): EnhancedOrgNode[] => {
  const childrenByParent = buildChildrenMap(nodes);

  const descendantCount = (id: string): number => {
    const children = childrenByParent[id] || [];
    return children.reduce((total, child) => total + 1 + descendantCount(child.id), 0);
  };

  return nodes.map((node) => ({
    ...node,
    childCount: (childrenByParent[node.id] || []).length,
    descendantCount: descendantCount(node.id),
  }));
};

export const getCompanyStructureData = () => {
  const nodes = buildEnhancedNodes(organizationNodes);
  const totalHeadcount = nodes.reduce((sum, node) => sum + node.headcount, 0);
  const totalOpenRoles = nodes.reduce((sum, node) => sum + node.openRoles, 0);
  const avgSuccessionCoverage =
    Math.round((nodes.reduce((sum, node) => sum + node.successionCoveragePct, 0) / nodes.length) * 10) / 10;
  const avgSpan = Math.round((nodes.reduce((sum, node) => sum + node.spanOfControl, 0) / nodes.length) * 10) / 10;
  const criticalUnits = nodes.filter((node) => node.healthStatus === 'Critical').length;
  const attentionUnits = nodes.filter((node) => node.healthStatus === 'Needs Attention').length;

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      canEdit: true,
      canExport: true,
      canViewCosts: true,
    },
    summary: {
      totalUnits: nodes.length,
      totalHeadcount,
      totalOpenRoles,
      avgSuccessionCoverage,
      avgSpanOfControl: avgSpan,
      criticalUnits,
      attentionUnits,
    },
    filterOptions: {
      kinds: Array.from(new Set(nodes.map((node) => node.kind))),
      locations: Array.from(new Set(nodes.map((node) => node.location))).sort((a, b) => a.localeCompare(b)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'] as HealthStatus[],
    },
    nodes,
    insights: structureInsights,
  };
};

export const getDepartmentData = () => {
  const nodes = buildEnhancedNodes(organizationNodes);
  const nodeMap = buildNodeMap(organizationNodes);
  const departments = nodes
    .filter((node) => node.kind === 'Department')
    .map((department) => {
      const teams = nodes
        .filter((node) => node.parentId === department.id && node.kind === 'Team')
        .map((team) => ({
          id: team.id,
          name: team.name,
          leader: team.leader,
          headcount: team.headcount,
          openRoles: team.openRoles,
          healthStatus: team.healthStatus,
        }));

      const parent = department.parentId ? nodeMap.get(department.parentId) || null : null;
      const parentChain: string[] = [];
      let current = parent;
      while (current) {
        parentChain.unshift(current.name);
        current = current.parentId ? nodeMap.get(current.parentId) || null : null;
      }

      return {
        ...department,
        parentName: parent?.name || null,
        parentKind: parent?.kind || null,
        parentChain,
        teamCount: teams.length,
        teamHeadcount: teams.reduce((sum, team) => sum + team.headcount, 0),
        teams,
      } satisfies DepartmentRecord;
    });

  const totalHeadcount = departments.reduce((sum, department) => sum + department.headcount, 0);
  const totalOpenRoles = departments.reduce((sum, department) => sum + department.openRoles, 0);
  const totalTeams = departments.reduce((sum, department) => sum + department.teamCount, 0);
  const avgSuccessionCoverage =
    Math.round((departments.reduce((sum, department) => sum + department.successionCoveragePct, 0) / departments.length) * 10) / 10;
  const avgAttritionRisk =
    Math.round((departments.reduce((sum, department) => sum + department.attritionRiskPct, 0) / departments.length) * 10) / 10;
  const criticalDepartments = departments.filter((department) => department.healthStatus === 'Critical').length;
  const needsAttentionDepartments = departments.filter((department) => department.healthStatus === 'Needs Attention').length;

  const highestAttrition = [...departments].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
  const weakestCoverage = [...departments].sort((a, b) => a.successionCoveragePct - b.successionCoveragePct)[0];
  const biggestHiringLoad = [...departments].sort((a, b) => b.openRoles - a.openRoles)[0];

  const insights: StructureInsight[] = [
    {
      id: 'dept-ins-1',
      severity: highestAttrition && highestAttrition.attritionRiskPct >= 14 ? 'high' : 'medium',
      title: `${highestAttrition?.name || 'Department'} has the highest attrition risk`,
      recommendation: 'Review leadership capacity, retention levers, and continuity coverage for critical roles.',
    },
    {
      id: 'dept-ins-2',
      severity: weakestCoverage && weakestCoverage.successionCoveragePct <= 70 ? 'high' : 'medium',
      title: `${weakestCoverage?.name || 'Department'} has the weakest succession coverage`,
      recommendation: 'Strengthen successor readiness, internal mobility plans, and capability depth.',
    },
    {
      id: 'dept-ins-3',
      severity: biggestHiringLoad && biggestHiringLoad.openRoles >= 4 ? 'medium' : 'low',
      title: `${biggestHiringLoad?.name || 'Department'} is carrying the largest hiring load`,
      recommendation: 'Prioritize approved recruitment and monitor delivery risk from vacant roles.',
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
      totalDepartments: departments.length,
      totalHeadcount,
      totalOpenRoles,
      totalTeams,
      avgSuccessionCoverage,
      avgAttritionRisk,
      criticalDepartments,
      needsAttentionDepartments,
    },
    filterOptions: {
      locations: Array.from(new Set(departments.map((department) => department.location))).sort((a, b) => a.localeCompare(b)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'] as HealthStatus[],
      parentUnits: Array.from(new Set(departments.map((department) => department.parentName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    },
    departments,
    insights,
  };
};

export const getUnitsSectionsData = () => {
  const nodes = buildEnhancedNodes(organizationNodes);
  const nodeMap = buildNodeMap(organizationNodes);
  const childrenByParent = buildChildrenMap(organizationNodes);

  const getParentChain = (parentId: string | null) => {
    const chain: string[] = [];
    let current = parentId ? nodeMap.get(parentId) || null : null;
    while (current) {
      chain.unshift(current.name);
      current = current.parentId ? nodeMap.get(current.parentId) || null : null;
    }
    return chain;
  };

  const getDescendants = (id: string): OrgNode[] => {
    const children = childrenByParent[id] || [];
    return children.flatMap((child) => [child, ...getDescendants(child.id)]);
  };

  const units: UnitSectionRecord[] = nodes
    .filter((node) => node.kind === 'Business Unit')
    .map((unit) => {
      const descendants = getDescendants(unit.id);
      const departments = descendants.filter((node) => node.kind === 'Department');
      const teams = descendants.filter((node) => node.kind === 'Team');
      const parent = unit.parentId ? nodeMap.get(unit.parentId) || null : null;

      return {
        ...unit,
        recordType: 'Unit',
        parentName: parent?.name || null,
        parentKind: parent?.kind || null,
        parentChain: getParentChain(unit.parentId),
        relatedDepartmentCount: departments.length,
        relatedTeamCount: teams.length,
        relatedHeadcount: descendants.reduce((sum, item) => sum + item.headcount, 0),
        relatedItems: descendants.map((item) => ({
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

  const sections: UnitSectionRecord[] = nodes
    .filter((node) => node.kind === 'Team')
    .map((section) => {
      const parent = section.parentId ? nodeMap.get(section.parentId) || null : null;

      return {
        ...section,
        recordType: 'Section',
        parentName: parent?.name || null,
        parentKind: parent?.kind || null,
        parentChain: getParentChain(section.parentId),
        relatedDepartmentCount: parent?.kind === 'Department' ? 1 : 0,
        relatedTeamCount: 0,
        relatedHeadcount: 0,
        relatedItems: [],
      };
    });

  const records = [...units, ...sections];
  const totalHeadcount = records.reduce((sum, record) => sum + record.headcount, 0);
  const totalOpenRoles = records.reduce((sum, record) => sum + record.openRoles, 0);
  const avgSuccessionCoverage =
    Math.round((records.reduce((sum, record) => sum + record.successionCoveragePct, 0) / records.length) * 10) / 10;
  const avgAttritionRisk =
    Math.round((records.reduce((sum, record) => sum + record.attritionRiskPct, 0) / records.length) * 10) / 10;

  const highestRiskSection = [...sections].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
  const weakestUnitCoverage = [...units].sort((a, b) => a.successionCoveragePct - b.successionCoveragePct)[0];
  const biggestHeadcountUnit = [...units].sort((a, b) => b.headcount - a.headcount)[0];

  const insights: StructureInsight[] = [
    {
      id: 'unit-sec-ins-1',
      severity: highestRiskSection && highestRiskSection.attritionRiskPct >= 16 ? 'high' : 'medium',
      title: `${highestRiskSection?.name || 'A section'} shows the highest attrition risk`,
      recommendation: 'Review frontline leadership continuity, coverage depth, and section-level retention actions.',
    },
    {
      id: 'unit-sec-ins-2',
      severity: weakestUnitCoverage && weakestUnitCoverage.successionCoveragePct <= 70 ? 'high' : 'medium',
      title: `${weakestUnitCoverage?.name || 'A unit'} has the weakest succession coverage among units`,
      recommendation: 'Strengthen pipeline depth for unit leadership and critical specialist roles.',
    },
    {
      id: 'unit-sec-ins-3',
      severity: biggestHeadcountUnit && biggestHeadcountUnit.headcount >= 180 ? 'medium' : 'low',
      title: `${biggestHeadcountUnit?.name || 'A unit'} carries the largest workforce footprint`,
      recommendation: 'Monitor governance span, workload balancing, and workforce planning for the largest unit.',
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
      totalRecords: records.length,
      totalUnits: units.length,
      totalSections: sections.length,
      totalHeadcount,
      totalOpenRoles,
      avgSuccessionCoverage,
      avgAttritionRisk,
    },
    filterOptions: {
      recordTypes: ['Unit', 'Section'] as Array<'Unit' | 'Section'>,
      locations: Array.from(new Set(records.map((record) => record.location))).sort((a, b) => a.localeCompare(b)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'] as HealthStatus[],
      parentUnits: Array.from(new Set(records.map((record) => record.parentName).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    },
    records,
    insights,
  };
};

export const getLocationsSitesData = () => {
  const nodes = buildEnhancedNodes(organizationNodes);
  const kindRank: Record<NodeKind, number> = {
    Company: 0,
    Division: 1,
    'Business Unit': 2,
    Department: 3,
    Team: 4,
  };
  const locationMeta: Record<
    string,
    { region: string; siteCategory: 'Head Office' | 'Operational Hub' | 'Yard' | 'Field Site'; description: string }
  > = {
    'Lagos HQ': {
      region: 'Lagos State',
      siteCategory: 'Head Office',
      description: 'Corporate headquarters and shared-services hub supporting enterprise leadership and control functions.',
    },
    'Port Harcourt': {
      region: 'Rivers State',
      siteCategory: 'Operational Hub',
      description: 'Operational coordination hub for maintenance, field support, and regional execution oversight.',
    },
    'Warri Yard': {
      region: 'Delta State',
      siteCategory: 'Yard',
      description: 'Fabrication and yard operations footprint supporting structural and production delivery.',
    },
    'Bonny Island': {
      region: 'Rivers State',
      siteCategory: 'Field Site',
      description: 'Field execution footprint for site mobilization, project delivery, and commissioning support.',
    },
  };

  const average = (values: number[]) => Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  const resolveHealth = (statuses: HealthStatus[]): HealthStatus =>
    statuses.includes('Critical') ? 'Critical' : statuses.includes('Needs Attention') ? 'Needs Attention' : 'Healthy';

  const siteRecords: LocationSiteRecord[] = Object.entries(locationMeta).map(([siteName, meta]) => {
    const siteNodes = nodes.filter((node) => node.location === siteName);
    const leaderNode = [...siteNodes].sort((a, b) => kindRank[a.kind] - kindRank[b.kind])[0];

    return {
      id: `site-${siteName.toLowerCase().replace(/\s+/g, '-')}`,
      name: siteName,
      recordType: 'Site',
      parentName: meta.region,
      parentChain: [meta.region],
      region: meta.region,
      country: 'Nigeria',
      siteCategory: meta.siteCategory,
      leader: leaderNode?.leader || 'Unassigned',
      location: siteName,
      headcount: siteNodes.reduce((sum, node) => sum + node.headcount, 0),
      openRoles: siteNodes.reduce((sum, node) => sum + node.openRoles, 0),
      budgetUsd: siteNodes.reduce((sum, node) => sum + node.budgetUsd, 0),
      payrollUsd: siteNodes.reduce((sum, node) => sum + node.payrollUsd, 0),
      spanOfControl: siteNodes.length ? average(siteNodes.map((node) => node.spanOfControl)) : 0,
      successionCoveragePct: siteNodes.length ? average(siteNodes.map((node) => node.successionCoveragePct)) : 0,
      attritionRiskPct: siteNodes.length ? average(siteNodes.map((node) => node.attritionRiskPct)) : 0,
      healthStatus: resolveHealth(siteNodes.map((node) => node.healthStatus)),
      costCenter: leaderNode?.costCenter || 'N/A',
      description: meta.description,
      nodeCount: siteNodes.length,
      divisionCount: siteNodes.filter((node) => node.kind === 'Division').length,
      businessUnitCount: siteNodes.filter((node) => node.kind === 'Business Unit').length,
      departmentCount: siteNodes.filter((node) => node.kind === 'Department').length,
      teamCount: siteNodes.filter((node) => node.kind === 'Team').length,
      relatedItems: siteNodes.map((node) => ({
        id: node.id,
        name: node.name,
        kind: node.kind,
        leader: node.leader,
        headcount: node.headcount,
        openRoles: node.openRoles,
        healthStatus: node.healthStatus,
      })),
    };
  });

  const locationGroups = Array.from(new Set(siteRecords.map((site) => site.region)));
  const locationRecords: LocationSiteRecord[] = locationGroups.map((region) => {
    const regionSites = siteRecords.filter((site) => site.region === region);
    const totalHeadcount = regionSites.reduce((sum, site) => sum + site.headcount, 0);
    const totalOpenRoles = regionSites.reduce((sum, site) => sum + site.openRoles, 0);

    return {
      id: `location-${region.toLowerCase().replace(/\s+/g, '-')}`,
      name: region,
      recordType: 'Location',
      parentName: 'Nigeria',
      parentChain: ['Nigeria'],
      region,
      country: 'Nigeria',
      siteCategory: 'State',
      leader: regionSites.sort((a, b) => b.headcount - a.headcount)[0]?.leader || 'Unassigned',
      location: region,
      headcount: totalHeadcount,
      openRoles: totalOpenRoles,
      budgetUsd: regionSites.reduce((sum, site) => sum + site.budgetUsd, 0),
      payrollUsd: regionSites.reduce((sum, site) => sum + site.payrollUsd, 0),
      spanOfControl: regionSites.length ? average(regionSites.map((site) => site.spanOfControl)) : 0,
      successionCoveragePct: regionSites.length ? average(regionSites.map((site) => site.successionCoveragePct)) : 0,
      attritionRiskPct: regionSites.length ? average(regionSites.map((site) => site.attritionRiskPct)) : 0,
      healthStatus: resolveHealth(regionSites.map((site) => site.healthStatus)),
      costCenter: 'MULTI-SITE',
      description: `Regional location roll-up covering ${regionSites.length} operating site${regionSites.length === 1 ? '' : 's'}.`,
      nodeCount: regionSites.reduce((sum, site) => sum + site.nodeCount, 0),
      divisionCount: regionSites.reduce((sum, site) => sum + site.divisionCount, 0),
      businessUnitCount: regionSites.reduce((sum, site) => sum + site.businessUnitCount, 0),
      departmentCount: regionSites.reduce((sum, site) => sum + site.departmentCount, 0),
      teamCount: regionSites.reduce((sum, site) => sum + site.teamCount, 0),
      relatedItems: regionSites.map((site) => ({
        id: site.id,
        name: site.name,
        kind: 'Site',
        leader: site.leader,
        headcount: site.headcount,
        openRoles: site.openRoles,
        healthStatus: site.healthStatus,
      })),
    };
  });

  const records = [...locationRecords, ...siteRecords];
  const highestHiringSite = [...siteRecords].sort((a, b) => b.openRoles - a.openRoles)[0];
  const highestRiskSite = [...siteRecords].sort((a, b) => b.attritionRiskPct - a.attritionRiskPct)[0];
  const largestLocation = [...locationRecords].sort((a, b) => b.headcount - a.headcount)[0];

  const insights: StructureInsight[] = [
    {
      id: 'loc-site-ins-1',
      severity: highestHiringSite && highestHiringSite.openRoles >= 10 ? 'high' : 'medium',
      title: `${highestHiringSite?.name || 'A site'} is carrying the largest hiring load`,
      recommendation: 'Prioritize location-based recruitment planning and assess delivery risk from open site-critical roles.',
    },
    {
      id: 'loc-site-ins-2',
      severity: highestRiskSite && highestRiskSite.attritionRiskPct >= 12 ? 'high' : 'medium',
      title: `${highestRiskSite?.name || 'A site'} shows the highest attrition pressure`,
      recommendation: 'Review site leadership resilience, workforce conditions, and retention actions for critical teams.',
    },
    {
      id: 'loc-site-ins-3',
      severity: largestLocation && largestLocation.headcount >= 1000 ? 'medium' : 'low',
      title: `${largestLocation?.name || 'A location'} carries the largest workforce footprint`,
      recommendation: 'Strengthen governance controls, succession oversight, and resource planning for the largest location cluster.',
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
      totalRecords: records.length,
      totalLocations: locationRecords.length,
      totalSites: siteRecords.length,
      totalHeadcount: records.reduce((sum, record) => sum + record.headcount, 0),
      totalOpenRoles: records.reduce((sum, record) => sum + record.openRoles, 0),
      avgSuccessionCoverage: average(records.map((record) => record.successionCoveragePct)),
      avgAttritionRisk: average(records.map((record) => record.attritionRiskPct)),
    },
    filterOptions: {
      recordTypes: ['Location', 'Site'] as Array<'Location' | 'Site'>,
      regions: locationGroups.sort((a, b) => a.localeCompare(b)),
      siteCategories: Array.from(new Set(records.map((record) => record.siteCategory))).sort((a, b) => a.localeCompare(b)),
      healthStatuses: ['Healthy', 'Needs Attention', 'Critical'] as HealthStatus[],
    },
    records,
    insights,
  };
};

export const getJobGradesData = () => {
  const grades: JobGradeRecord[] = [
    {
      id: 'jg-01',
      code: 'G01',
      name: 'Executive Leadership',
      family: 'Executive',
      level: 'Strategic',
      minSalaryUsd: 180000,
      midpointSalaryUsd: 235000,
      maxSalaryUsd: 310000,
      employeeCount: 6,
      openPositions: 1,
      successionCoveragePct: 78,
      attritionRiskPct: 6,
      internalMobilityPct: 12,
      averageTenureYears: 9.4,
      femaleRepresentationPct: 33,
      healthStatus: 'Healthy',
      benchmarkPosition: 'Executive Director',
      nextGradeCode: null,
      keyRoles: ['Executive Director, Operations', 'Executive Director, Projects', 'Executive Director, Corporate Services'],
      gradeMix: [
        { unit: 'Corporate Services', headcount: 2 },
        { unit: 'Projects Division', headcount: 2 },
        { unit: 'Operations Division', headcount: 2 },
      ],
      description: 'Top strategic leadership grade for enterprise direction, governance, and P&L accountability.',
    },
    {
      id: 'jg-02',
      code: 'G02',
      name: 'General Management',
      family: 'Management',
      level: 'Senior',
      minSalaryUsd: 105000,
      midpointSalaryUsd: 138000,
      maxSalaryUsd: 172000,
      employeeCount: 18,
      openPositions: 2,
      successionCoveragePct: 72,
      attritionRiskPct: 8,
      internalMobilityPct: 18,
      averageTenureYears: 7.8,
      femaleRepresentationPct: 28,
      healthStatus: 'Needs Attention',
      benchmarkPosition: 'General Manager / Head of Function',
      nextGradeCode: 'G01',
      keyRoles: ['GM, Fabrication', 'GM, Field Execution', 'Head, Human Capital'],
      gradeMix: [
        { unit: 'Operations Division', headcount: 8 },
        { unit: 'Projects Division', headcount: 5 },
        { unit: 'Corporate Services', headcount: 5 },
      ],
      description: 'Senior leadership grade for business-unit heads and enterprise functional leads.',
    },
    {
      id: 'jg-03',
      code: 'G03',
      name: 'Functional Leadership',
      family: 'Management',
      level: 'Senior',
      minSalaryUsd: 72000,
      midpointSalaryUsd: 91000,
      maxSalaryUsd: 118000,
      employeeCount: 41,
      openPositions: 5,
      successionCoveragePct: 69,
      attritionRiskPct: 11,
      internalMobilityPct: 22,
      averageTenureYears: 6.1,
      femaleRepresentationPct: 31,
      healthStatus: 'Needs Attention',
      benchmarkPosition: 'Manager / Lead Specialist',
      nextGradeCode: 'G02',
      keyRoles: ['Manager, HR Operations', 'Manager, Planning', 'Lead Project Engineer'],
      gradeMix: [
        { unit: 'Projects Division', headcount: 17 },
        { unit: 'Operations Division', headcount: 12 },
        { unit: 'Corporate Services', headcount: 12 },
      ],
      description: 'Functional leadership grade for managers and senior specialists running teams or critical disciplines.',
    },
    {
      id: 'jg-04',
      code: 'G04',
      name: 'Professional Core',
      family: 'Professional',
      level: 'Mid',
      minSalaryUsd: 36000,
      midpointSalaryUsd: 47000,
      maxSalaryUsd: 62000,
      employeeCount: 146,
      openPositions: 9,
      successionCoveragePct: 74,
      attritionRiskPct: 10,
      internalMobilityPct: 26,
      averageTenureYears: 4.8,
      femaleRepresentationPct: 36,
      healthStatus: 'Healthy',
      benchmarkPosition: 'Engineer / Analyst / Officer',
      nextGradeCode: 'G03',
      keyRoles: ['Project Engineer', 'HR Analyst', 'Cost Controller'],
      gradeMix: [
        { unit: 'Projects Division', headcount: 61 },
        { unit: 'Operations Division', headcount: 47 },
        { unit: 'Corporate Services', headcount: 38 },
      ],
      description: 'Core professional grade for engineers, analysts, commercial specialists, and experienced officers.',
    },
    {
      id: 'jg-05',
      code: 'G05',
      name: 'Technical Specialists',
      family: 'Technical',
      level: 'Mid',
      minSalaryUsd: 28000,
      midpointSalaryUsd: 36500,
      maxSalaryUsd: 45500,
      employeeCount: 212,
      openPositions: 14,
      successionCoveragePct: 63,
      attritionRiskPct: 14,
      internalMobilityPct: 19,
      averageTenureYears: 4.1,
      femaleRepresentationPct: 18,
      healthStatus: 'Critical',
      benchmarkPosition: 'Supervisor / Specialist Technician',
      nextGradeCode: 'G04',
      keyRoles: ['Site Supervisor', 'Instrument Specialist', 'QA Specialist'],
      gradeMix: [
        { unit: 'Operations Division', headcount: 118 },
        { unit: 'Projects Division', headcount: 66 },
        { unit: 'Corporate Services', headcount: 28 },
      ],
      description: 'High-demand specialist and supervisory grade supporting field execution, maintenance, and technical delivery.',
    },
    {
      id: 'jg-06',
      code: 'G06',
      name: 'Operations Support',
      family: 'Operations Support',
      level: 'Entry',
      minSalaryUsd: 14000,
      midpointSalaryUsd: 18800,
      maxSalaryUsd: 24500,
      employeeCount: 327,
      openPositions: 11,
      successionCoveragePct: 71,
      attritionRiskPct: 9,
      internalMobilityPct: 24,
      averageTenureYears: 3.6,
      femaleRepresentationPct: 29,
      healthStatus: 'Healthy',
      benchmarkPosition: 'Coordinator / Assistant / Technician',
      nextGradeCode: 'G05',
      keyRoles: ['Technician', 'Project Coordinator', 'Administrative Officer'],
      gradeMix: [
        { unit: 'Operations Division', headcount: 149 },
        { unit: 'Projects Division', headcount: 96 },
        { unit: 'Corporate Services', headcount: 82 },
      ],
      description: 'Entry and support grade covering coordinators, assistants, technicians, and junior operational staff.',
    },
  ];

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
