import sql from 'mssql';
import { getDleEnterpriseDbPool, loadWorkspaceEnv } from '@/lib/dle-enterprise-db';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';
import type { BenefitPlanType } from '@/lib/benefits-management-types';

loadWorkspaceEnv();

export const SAGE_BENEFITS_SOURCE = 'Sage 300 People Payroll';

export type SageBenefitsSyncOptions = {
  overwriteExisting?: boolean;
  dryRun?: boolean;
};

export type SageBenefitsSyncResult = {
  dryRun: boolean;
  payrollSetupUpdated: number;
  plansUpserted: number;
  providersUpserted: number;
  enrollmentsUpserted: number;
  rulesUpserted: number;
  warnings: string[];
  message: string;
};

const str = (value: unknown) => String(value || '').trim();
const slug = (value: string) => str(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

const sageConfig = () => ({
  server: process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8',
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    ...(process.env.SAGE_PAYROLL_DB_INSTANCE ? { instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE } : {}),
  },
  connectionTimeout: Number(process.env.SAGE_PAYROLL_DB_CONNECT_TIMEOUT || 15000),
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 120000),
});

const payrollPeriodSql = () => {
  const raw = str(process.env.HRIS_ACTIVE_PAYROLL_PERIOD || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [year, month] = raw.split('-').map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const start = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(safeYear, safeMonth, 1)).toISOString().slice(0, 10);
  return { start, end };
};

export const mapSageBenefitGroup = (hierarchyType: string, employeeCode: string) => {
  const code = str(employeeCode).toUpperCase().replace(/_/g, '');
  if (/^C/.test(code)) return 'Project';
  if (/^L/.test(code)) return 'Contractor';
  const type = str(hierarchyType).toLowerCase();
  if (/senior.?management|executive|^snm|^mgt/.test(type)) return 'Executive';
  if (/management|director/.test(type)) return 'Executive';
  if (/contract|project|site|daily|lumpsum|stipend/.test(type)) return 'Project';
  return 'Standard';
};

const jsonValue = (raw: string | null | undefined, keys: string[]) => {
  if (!raw) return '';
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    for (const key of keys) {
      const match = str(data[key]);
      if (match) return match;
    }
  } catch {
    return '';
  }
  return '';
};

const directoryEmployeeCodeSql = `
  CASE
    WHEN UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'C%' OR UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'L%'
      THEN REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '')
    WHEN UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'P%'
      THEN REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '')
    WHEN UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'IT%' OR UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'I%'
      OR UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'N%' OR UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'NYSC%'
      THEN REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '')
    ELSE CONCAT('P', REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', ''))
  END`;

const sageEmployeesQuery = () => `
SELECT
  e.EmployeeID AS sageEmployeeId,
  e.EmployeeCode AS sageEmployeeCode,
  ${directoryEmployeeCodeSql} AS directoryEmployeeCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.DisplayName)), ''), ge.DisplayName) AS fullName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameC)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameC)), '')) AS hierarchyEmployeeTypeName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS departmentName,
  CONVERT(varchar(10), ed.DateEngaged, 23) AS dateEngaged,
  (SELECT ed.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) AS sageEmployeeDetailJson
FROM Employee.Employee e
JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
JOIN Company.Company c ON c.CompanyID = e.CompanyID
LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
WHERE e.TerminationDate IS NULL
  AND ISNULL(es.Code, 'A') = 'A'
  AND ge.Status = 'A'
  AND c.Status = 'A'
ORDER BY e.EmployeeCode;
`;

const sagePensionFundsQuery = () => `
SELECT
  e.EmployeeID AS sageEmployeeId,
  e.EmployeeCode AS sageEmployeeCode,
  ${directoryEmployeeCodeSql} AS directoryEmployeeCode,
  COALESCE(NULLIF(LTRIM(RTRIM(rf.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(rf.LongDescription)), ''), NULLIF(LTRIM(RTRIM(fd.ShortDescription)), ''), 'Pension Fund') AS pfaName,
  NULLIF(LTRIM(RTRIM(CAST(erf.MembershipNumber AS nvarchar(120)))), '') AS membershipNumber,
  NULLIF(LTRIM(RTRIM(CAST(erf.AccountNumber AS nvarchar(120)))), '') AS accountNumber
FROM Payroll.EmployeeRetirementFund erf
JOIN Employee.Employee e ON e.EmployeeID = erf.EmployeeID
LEFT JOIN Payroll.RetirementFund rf ON rf.RetirementFundID = erf.RetirementFundID
LEFT JOIN Payroll.FundDefinition fd ON fd.FundDefinitionID = rf.FundDefinitionID
WHERE e.TerminationDate IS NULL;
`;

const sageBenefitEarningLinesQuery = () => {
  const { start, end } = payrollPeriodSql();
  return `
DECLARE @PayrollPeriodStart date = '${start}';
DECLARE @PayrollPeriodEnd date = '${end}';

WITH activeEmployees AS (
  SELECT e.EmployeeID, e.EmployeeCode, ge.DisplayName,
    ${directoryEmployeeCodeSql} AS directoryEmployeeCode,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS departmentName
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
  LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
  WHERE e.TerminationDate IS NULL
    AND ISNULL(es.Code, 'A') = 'A'
    AND ge.Status = 'A'
    AND c.Status = 'A'
),
latestPayslipPeriods AS (
  SELECT ae.EmployeeID, ae.directoryEmployeeCode, ae.DisplayName, ae.departmentName,
    epp.EmployeePayPeriodID, p.PayslipID,
    ROW_NUMBER() OVER (PARTITION BY ae.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM activeEmployees ae
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = ae.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  WHERE epp.LastCalcDate >= @PayrollPeriodStart
    AND epp.LastCalcDate < @PayrollPeriodEnd
)
SELECT
  lp.directoryEmployeeCode,
  lp.DisplayName AS fullName,
  lp.departmentName,
  edef.DefCode AS code,
  COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(edef.LongDescription)), ''), edef.DefCode) AS name,
  pel.Total AS amount,
  pel.YTDTotal AS ytdTotal
FROM latestPayslipPeriods lp
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = lp.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
WHERE lp.rn = 1
  AND ISNULL(pel.Total, 0) <> 0
  AND UPPER(edef.DefCode) NOT IN ('BASIC', 'BASICPAY', 'BASIC_PAY', 'SALARY', 'CONTRACTBASIC', 'JCWEEKDAY', 'JCWEEKDAY_NT')
  AND (
    UPPER(edef.DefCode) LIKE '%ALLOW%' OR UPPER(edef.DefCode) LIKE '%HOUSE%' OR UPPER(edef.DefCode) LIKE '%TRANS%'
    OR UPPER(edef.DefCode) LIKE '%HAZ%' OR UPPER(edef.DefCode) LIKE '%SITE%' OR UPPER(edef.DefCode) LIKE '%MEAL%'
    OR UPPER(edef.DefCode) LIKE '%MED%' OR UPPER(edef.DefCode) LIKE '%INS%' OR UPPER(edef.DefCode) LIKE '%LIFE%'
    OR UPPER(edef.DefCode) LIKE '%LEAVE%' OR UPPER(edef.DefCode) LIKE '%WELF%' OR UPPER(edef.DefCode) LIKE '%FURN%'
    OR UPPER(edef.DefCode) LIKE '%UTIL%' OR UPPER(edef.ShortDescription) LIKE '%allow%'
    OR UPPER(edef.ShortDescription) LIKE '%medical%' OR UPPER(edef.ShortDescription) LIKE '%housing%'
    OR UPPER(edef.ShortDescription) LIKE '%transport%' OR UPPER(edef.ShortDescription) LIKE '%leave%'
  )
ORDER BY lp.directoryEmployeeCode, edef.DefCode;
`;
};

const inferPlanType = (code: string, name: string): BenefitPlanType => {
  const hay = `${code} ${name}`.toUpperCase();
  if (/MEDICAL|MED_|HMO|HEALTH/.test(hay)) return 'Medical';
  if (/INSUR|LIFE|GLI|ACCIDENT|TRAVEL/.test(hay)) return 'Insurance';
  if (/LEAVE|WELF/.test(hay)) return 'Welfare';
  if (/PENSION/.test(hay)) return 'Pension';
  return 'Allowance';
};

const BASIC_CODES = new Set(['BASIC', 'BASICPAY', 'BASIC_PAY', 'SALARY', 'CONTRACTBASIC']);

type SageEmployeeRow = {
  sageEmployeeId: number;
  sageEmployeeCode: string;
  directoryEmployeeCode: string;
  fullName: string;
  hierarchyEmployeeTypeName: string | null;
  departmentName: string | null;
  dateEngaged: string | null;
  sageEmployeeDetailJson: string | null;
};

type SagePensionRow = {
  directoryEmployeeCode: string;
  pfaName: string;
  membershipNumber: string | null;
  accountNumber: string | null;
};

type SageEarningRow = {
  directoryEmployeeCode: string;
  fullName: string;
  departmentName: string | null;
  code: string;
  name: string;
  amount: number;
  ytdTotal: number | null;
};

const ensureBenefitsSchema = async (pool: sql.ConnectionPool) => {
  await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[BenefitManagementPlans]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementPlans] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_BenefitManagementPlans] PRIMARY KEY,
  [Name] NVARCHAR(220) NOT NULL,
  [PlanType] NVARCHAR(40) NOT NULL,
  [Provider] NVARCHAR(180) NOT NULL,
  [Eligibility] NVARCHAR(500) NOT NULL,
  [EmployerContribution] NVARCHAR(120) NOT NULL,
  [EmployeeContribution] NVARCHAR(120) NOT NULL,
  [EffectiveDate] DATE NULL,
  [RenewalDate] NVARCHAR(40) NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementPlans_CreatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[BenefitManagementEnrollments]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementEnrollments] (
  [Id] NVARCHAR(160) NOT NULL CONSTRAINT [PK_BenefitManagementEnrollments] PRIMARY KEY,
  [EmployeeId] NVARCHAR(80) NOT NULL,
  [EmployeeName] NVARCHAR(220) NOT NULL,
  [Department] NVARCHAR(180) NOT NULL,
  [PlanId] NVARCHAR(120) NOT NULL,
  [PlanName] NVARCHAR(220) NOT NULL,
  [PlanType] NVARCHAR(40) NOT NULL,
  [Dependents] INT NOT NULL,
  [EnrolledOn] DATE NOT NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementEnrollments_CreatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[BenefitManagementEligibilityRules]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementEligibilityRules] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_BenefitManagementEligibilityRules] PRIMARY KEY,
  [Name] NVARCHAR(220) NOT NULL,
  [PlanTypesJson] NVARCHAR(MAX) NOT NULL,
  [Criteria] NVARCHAR(800) NOT NULL,
  [AppliesTo] NVARCHAR(220) NOT NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementEligibilityRules_CreatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[BenefitManagementProviders]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementProviders] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_BenefitManagementProviders] PRIMARY KEY,
  [Name] NVARCHAR(220) NOT NULL,
  [ProviderType] NVARCHAR(120) NOT NULL,
  [ContactPerson] NVARCHAR(180) NOT NULL,
  [Email] NVARCHAR(220) NOT NULL,
  [Phone] NVARCHAR(60) NOT NULL,
  [Rating] DECIMAL(4,2) NOT NULL,
  [ContractEnd] NVARCHAR(40) NOT NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementProviders_CreatedAt] DEFAULT SYSUTCDATETIME()
);`);
};

const readSageEmployees = async (pool: sql.ConnectionPool) => {
  const rs = await pool.request().query(sageEmployeesQuery());
  return (rs.recordset || []) as SageEmployeeRow[];
};

const readSagePensionFunds = async (pool: sql.ConnectionPool) => {
  try {
    const rs = await pool.request().query(sagePensionFundsQuery());
    return (rs.recordset || []) as SagePensionRow[];
  } catch {
    return [] as SagePensionRow[];
  }
};

const readSageBenefitEarnings = async (pool: sql.ConnectionPool) => {
  const rs = await pool.request().query(sageBenefitEarningLinesQuery());
  return (rs.recordset || []) as SageEarningRow[];
};

const pensionFromDetail = (row: SageEmployeeRow) => {
  const json = row.sageEmployeeDetailJson;
  const provider = jsonValue(json, [
    'PensionFundAdministrator', 'PensionFundAdmin', 'PensionProvider', 'PFA', 'PFADescription', 'RetirementFundName', 'PensionAdministrator',
  ]);
  const pin = jsonValue(json, [
    'PensionNo', 'PensionNumber', 'PensionPIN', 'PFANumber', 'PfaNumber', 'RSAPIN', 'RsaPin', 'RetirementSavingsAccountNo',
  ]);
  return { provider, pin };
};

export async function syncSageBenefitsToHris(options: SageBenefitsSyncOptions = {}): Promise<SageBenefitsSyncResult> {
  const overwriteExisting = Boolean(options.overwriteExisting);
  const dryRun = Boolean(options.dryRun);
  const warnings: string[] = [];

  if (!str(process.env.SAGE_PAYROLL_DB_PASSWORD)) {
    throw new Error('SAGE_PAYROLL_DB_PASSWORD is required to sync benefits from DLE_JUNE.');
  }

  const dlePool = await getDleEnterpriseDbPool();
  if (!dlePool) throw new Error('DLE_Enterprise database is not configured.');

  const sagePool = await new sql.ConnectionPool(sageConfig()).connect();
  try {
    const [sageEmployees, sagePensionRows, sageEarnings] = await Promise.all([
      readSageEmployees(sagePool),
      readSagePensionFunds(sagePool),
      readSageBenefitEarnings(sagePool),
    ]);

    if (!sagePensionRows.length) {
      warnings.push('Payroll.EmployeeRetirementFund was unavailable or empty; pension PFA/PIN falls back to EmployeeDetail JSON fields.');
    }

    const pensionByCode = new Map<string, SagePensionRow>();
    for (const row of sagePensionRows) {
      const code = str(row.directoryEmployeeCode).toUpperCase();
      if (code) pensionByCode.set(code, row);
    }

    type PayrollUpdate = {
      employeeCode: string;
      benefitGroup: string;
      pensionProvider: string;
      pensionPin: string;
    };

    const payrollUpdates: PayrollUpdate[] = [];
    for (const row of sageEmployees) {
      const code = str(row.directoryEmployeeCode).toUpperCase();
      if (!code) continue;
      const benefitGroup = mapSageBenefitGroup(str(row.hierarchyEmployeeTypeName), code);
      const pensionRow = pensionByCode.get(code);
      const detailPension = pensionFromDetail(row);
      const pensionProvider = str(pensionRow?.pfaName) || detailPension.provider;
      const pensionPin = str(pensionRow?.membershipNumber || pensionRow?.accountNumber) || detailPension.pin;
      if (!benefitGroup && !pensionProvider && !pensionPin) continue;
      payrollUpdates.push({
        employeeCode: code,
        benefitGroup,
        pensionProvider,
        pensionPin,
      });
    }

    type PlanSeed = {
      id: string;
      name: string;
      type: BenefitPlanType;
      provider: string;
      eligibility: string;
      employerContribution: string;
      employeeContribution: string;
      enrolled: number;
    };

    const planMap = new Map<string, PlanSeed>();
    const groupPlanIds = new Map<string, string>();

    for (const update of payrollUpdates) {
      if (!update.benefitGroup) continue;
      const groupKey = update.benefitGroup.toLowerCase();
      if (groupPlanIds.has(groupKey)) continue;
      const id = `plan-group-${slug(update.benefitGroup)}`;
      groupPlanIds.set(groupKey, id);
      planMap.set(id, {
        id,
        name: `${update.benefitGroup} Benefit Group`,
        type: update.benefitGroup === 'Executive' ? 'Welfare' : 'Medical',
        provider: update.benefitGroup,
        eligibility: `Migrated from Sage salary grade → ${update.benefitGroup}`,
        employerContribution: 'Per HRIS benefit group policy',
        employeeContribution: 'Per policy',
        enrolled: 0,
      });
    }

    for (const row of sageEarnings) {
      const code = str(row.code).toUpperCase();
      const name = str(row.name) || code;
      if (!code || BASIC_CODES.has(code)) continue;
      const id = `plan-allowance-${slug(code)}`;
      if (!planMap.has(id)) {
        const type = inferPlanType(code, name);
        planMap.set(id, {
          id,
          name,
          type,
          provider: type === 'Medical' ? 'Payroll Medical Component' : type === 'Insurance' ? 'Payroll / Insurer' : 'Payroll',
          eligibility: `Employees with active Sage earning code ${code}`,
          employerContribution: 'Payroll component',
          employeeContribution: '—',
          enrolled: 0,
        });
      }
    }

    type EnrollmentSeed = {
      id: string;
      employeeId: string;
      employeeName: string;
      department: string;
      planId: string;
      planName: string;
      planType: BenefitPlanType;
      enrolledOn: string;
    };

    const enrollmentMap = new Map<string, EnrollmentSeed>();
    const employeeMeta = new Map(sageEmployees.map((row) => [str(row.directoryEmployeeCode).toUpperCase(), row]));

    for (const update of payrollUpdates) {
      const meta = employeeMeta.get(update.employeeCode);
      if (!meta || !update.benefitGroup) continue;
      const planId = groupPlanIds.get(update.benefitGroup.toLowerCase());
      if (!planId) continue;
      const plan = planMap.get(planId);
      if (!plan) continue;
      plan.enrolled += 1;
      enrollmentMap.set(`enr-${update.employeeCode}-${planId}`, {
        id: `enr-${update.employeeCode}-${planId}`,
        employeeId: update.employeeCode,
        employeeName: str(meta.fullName) || update.employeeCode,
        department: str(meta.departmentName) || 'Unassigned',
        planId,
        planName: plan.name,
        planType: plan.type,
        enrolledOn: str(meta.dateEngaged) || new Date().toISOString().slice(0, 10),
      });
    }

    for (const row of sageEarnings) {
      const employeeCode = str(row.directoryEmployeeCode).toUpperCase();
      const earningCode = str(row.code).toUpperCase();
      if (!employeeCode || !earningCode) continue;
      const planId = `plan-allowance-${slug(earningCode)}`;
      const plan = planMap.get(planId);
      if (!plan) continue;
      plan.enrolled += 1;
      const enrollmentId = `enr-${employeeCode}-${planId}-${slug(earningCode)}`;
      enrollmentMap.set(enrollmentId, {
        id: enrollmentId,
        employeeId: employeeCode,
        employeeName: str(row.fullName) || employeeCode,
        department: str(row.departmentName) || 'Unassigned',
        planId,
        planName: plan.name,
        planType: plan.type,
        enrolledOn: new Date().toISOString().slice(0, 10),
      });
    }

    const providerMap = new Map<string, { id: string; name: string; type: string }>();
    for (const update of payrollUpdates) {
      if (!update.pensionProvider) continue;
      const name = update.pensionProvider;
      const id = `provider-${slug(name)}`;
      if (!providerMap.has(id)) providerMap.set(id, { id, name, type: 'PFA' });
    }

    const ruleId = 'SAGE-EL-GRADE-MAP';
    const eligibilityRule = {
      id: ruleId,
      name: 'Sage Salary Grade Benefit Group Mapping',
      planTypesJson: JSON.stringify(['Medical', 'Welfare', 'Allowance', 'Pension']),
      criteria: 'Maps Sage HierarchyCodeC / employee type to HRIS benefit groups (Standard, Executive, Project, Contractor).',
      appliesTo: 'All active Sage payroll employees',
    };

    if (dryRun) {
      return {
        dryRun: true,
        payrollSetupUpdated: payrollUpdates.length,
        plansUpserted: planMap.size,
        providersUpserted: providerMap.size,
        enrollmentsUpserted: enrollmentMap.size,
        rulesUpserted: 1,
        warnings,
        message: `Dry run: would migrate ${payrollUpdates.length} payroll setups, ${planMap.size} plans, ${enrollmentMap.size} enrollments, ${providerMap.size} providers.`,
      };
    }

    await ensureBenefitsSchema(dlePool);

    let payrollSetupUpdated = 0;
    for (const update of payrollUpdates) {
      const rs = await dlePool.request()
        .input('employee_code', sql.NVarChar(50), update.employeeCode)
        .input('benefit_group', sql.NVarChar(120), update.benefitGroup || null)
        .input('pension_provider', sql.NVarChar(150), update.pensionProvider || null)
        .input('pension_pin', sql.NVarChar(80), update.pensionPin || null)
        .input('overwrite', sql.Bit, overwriteExisting ? 1 : 0)
        .query(`
UPDATE payroll
SET
  benefit_group = CASE
    WHEN @overwrite = 1 OR NULLIF(LTRIM(RTRIM(payroll.benefit_group)), '') IS NULL THEN COALESCE(@benefit_group, payroll.benefit_group)
    ELSE payroll.benefit_group END,
  pension_provider = CASE
    WHEN @overwrite = 1 OR NULLIF(LTRIM(RTRIM(payroll.pension_provider)), '') IS NULL THEN COALESCE(@pension_provider, payroll.pension_provider)
    ELSE payroll.pension_provider END,
  pension_pin = CASE
    WHEN @overwrite = 1 OR NULLIF(LTRIM(RTRIM(payroll.pension_pin)), '') IS NULL THEN COALESCE(@pension_pin, payroll.pension_pin)
    ELSE payroll.pension_pin END
FROM [hris].[EmployeePayrollSetup] payroll
INNER JOIN [hris].[EmployeeMasterView] v ON v.employee_id = payroll.employee_id
WHERE UPPER(v.employee_code) = @employee_code;`);
      payrollSetupUpdated += Number(rs.rowsAffected?.[0] || 0);
    }

    for (const plan of planMap.values()) {
      await dlePool.request()
        .input('Id', sql.NVarChar(120), plan.id)
        .input('Name', sql.NVarChar(220), plan.name)
        .input('PlanType', sql.NVarChar(40), plan.type)
        .input('Provider', sql.NVarChar(180), plan.provider)
        .input('Eligibility', sql.NVarChar(500), plan.eligibility)
        .input('EmployerContribution', sql.NVarChar(120), plan.employerContribution)
        .input('EmployeeContribution', sql.NVarChar(120), plan.employeeContribution)
        .input('StatusName', sql.NVarChar(40), 'Active')
        .query(`
MERGE [hris].[BenefitManagementPlans] AS target
USING (SELECT @Id AS [Id]) AS source ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET
  [Name]=@Name,[PlanType]=@PlanType,[Provider]=@Provider,[Eligibility]=@Eligibility,
  [EmployerContribution]=@EmployerContribution,[EmployeeContribution]=@EmployeeContribution,[StatusName]=@StatusName
WHEN NOT MATCHED THEN INSERT
  ([Id],[Name],[PlanType],[Provider],[Eligibility],[EmployerContribution],[EmployeeContribution],[RenewalDate],[StatusName])
VALUES (@Id,@Name,@PlanType,@Provider,@Eligibility,@EmployerContribution,@EmployeeContribution,N'—',@StatusName);`);
    }

    for (const provider of providerMap.values()) {
      await dlePool.request()
        .input('Id', sql.NVarChar(120), provider.id)
        .input('Name', sql.NVarChar(220), provider.name)
        .input('ProviderType', sql.NVarChar(120), provider.type)
        .query(`
MERGE [hris].[BenefitManagementProviders] AS target
USING (SELECT @Id AS [Id]) AS source ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET [Name]=@Name,[ProviderType]=@ProviderType,[StatusName]=N'Active'
WHEN NOT MATCHED THEN INSERT
  ([Id],[Name],[ProviderType],[ContactPerson],[Email],[Phone],[Rating],[ContractEnd],[StatusName])
VALUES (@Id,@Name,@ProviderType,N'HR Benefits Desk',N'',N'',0,N'—',N'Active');`);
    }

    for (const enrollment of enrollmentMap.values()) {
      await dlePool.request()
        .input('Id', sql.NVarChar(160), enrollment.id)
        .input('EmployeeId', sql.NVarChar(80), enrollment.employeeId)
        .input('EmployeeName', sql.NVarChar(220), enrollment.employeeName)
        .input('Department', sql.NVarChar(180), enrollment.department)
        .input('PlanId', sql.NVarChar(120), enrollment.planId)
        .input('PlanName', sql.NVarChar(220), enrollment.planName)
        .input('PlanType', sql.NVarChar(40), enrollment.planType)
        .input('Dependents', sql.Int, 0)
        .input('EnrolledOn', sql.Date, enrollment.enrolledOn)
        .input('StatusName', sql.NVarChar(40), 'Active')
        .query(`
MERGE [hris].[BenefitManagementEnrollments] AS target
USING (SELECT @Id AS [Id]) AS source ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET
  [EmployeeId]=@EmployeeId,[EmployeeName]=@EmployeeName,[Department]=@Department,
  [PlanId]=@PlanId,[PlanName]=@PlanName,[PlanType]=@PlanType,[EnrolledOn]=@EnrolledOn,[StatusName]=@StatusName
WHEN NOT MATCHED THEN INSERT
  ([Id],[EmployeeId],[EmployeeName],[Department],[PlanId],[PlanName],[PlanType],[Dependents],[EnrolledOn],[StatusName])
VALUES
  (@Id,@EmployeeId,@EmployeeName,@Department,@PlanId,@PlanName,@PlanType,@Dependents,@EnrolledOn,@StatusName);`);
    }

    await dlePool.request()
      .input('Id', sql.NVarChar(120), eligibilityRule.id)
      .input('Name', sql.NVarChar(220), eligibilityRule.name)
      .input('PlanTypesJson', sql.NVarChar(sql.MAX), eligibilityRule.planTypesJson)
      .input('Criteria', sql.NVarChar(800), eligibilityRule.criteria)
      .input('AppliesTo', sql.NVarChar(220), eligibilityRule.appliesTo)
      .query(`
MERGE [hris].[BenefitManagementEligibilityRules] AS target
USING (SELECT @Id AS [Id]) AS source ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET [Name]=@Name,[PlanTypesJson]=@PlanTypesJson,[Criteria]=@Criteria,[AppliesTo]=@AppliesTo,[StatusName]=N'Active'
WHEN NOT MATCHED THEN INSERT ([Id],[Name],[PlanTypesJson],[Criteria],[AppliesTo],[StatusName])
VALUES (@Id,@Name,@PlanTypesJson,@Criteria,@AppliesTo,N'Active');`);

    const message = `Sage benefits sync complete: ${payrollSetupUpdated} payroll setups, ${planMap.size} plans, ${enrollmentMap.size} enrollments, ${providerMap.size} providers.`;
    return {
      dryRun: false,
      payrollSetupUpdated,
      plansUpserted: planMap.size,
      providersUpserted: providerMap.size,
      enrollmentsUpserted: enrollmentMap.size,
      rulesUpserted: 1,
      warnings,
      message,
    };
  } finally {
    await sagePool.close();
  }
}

export const sageBenefitsEmployeeKeys = (employeeCode: string) => {
  const key = normalizePayrollMatchKey(employeeCode);
  return key ? [key] : [];
};
