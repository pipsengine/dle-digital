import sql from 'mssql';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { getDleEnterpriseDbPool, readEmployeeContractsFromDb } from '@/lib/dle-enterprise-db';
import { calculatePayrollForPeriod } from '@/lib/payroll-calculation-service';
import { getActivePayrollPeriod } from '@/lib/payroll-period-store';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';
import { syncSageBenefitsToHris } from '@/lib/sage-benefits-sync';
import type {
  ApprovalPriority,
  ApprovalRequest,
  BenefitClaim,
  BenefitPlan,
  BenefitPlanType,
  BenefitProvider,
  BenefitStatus,
  BenefitsPayload,
  BenefitsRole,
  ClaimStatus,
  ComplianceItem,
  EligibilityRule,
  EmployeeBenefitProfile,
  EnrollmentRecord,
} from '@/lib/benefits-management-types';

export type {
  ApprovalRequest,
  BenefitClaim,
  BenefitPlan,
  BenefitPlanType,
  BenefitProvider,
  BenefitStatus,
  BenefitsPayload,
  BenefitsRole,
  ClaimStatus,
  ComplianceItem,
  EligibilityRule,
  EmployeeBenefitProfile,
  EnrollmentRecord,
} from '@/lib/benefits-management-types';

export { formatBenefitMoney } from '@/lib/benefits-management-types';

const SOURCE_SYSTEM = 'DLE_Enterprise HRIS';
const INACTIVE_STATUS = /terminated|resigned|retired|inactive|deceased|suspend/i;
const BASIC_CODES = new Set(['BASIC', 'BASICPAY', 'BASIC_PAY', 'SALARY', 'CONTRACTBASIC']);
const INSURANCE_PATTERN = /life|gli|group.?life|insurance|accident|travel/i;
const ALLOWANCE_PATTERN = /allow|housing|transport|hazard|site|meal|shift|remote|fuel|car|rent/i;

const dbReady = { value: false };
const str = (value: unknown) => String(value || '').trim();
const slug = (value: string) => str(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const isoDate = (value: unknown) => {
  const raw = str(value);
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : date.toISOString().slice(0, 10);
};
const monthsInYearSoFar = () => new Date().getMonth() + 1;
const isActiveEmployee = (employee: DleEmployeeDirectoryRow) => !INACTIVE_STATUS.test(str(employee.status));
const employeeCode = (employee: DleEmployeeDirectoryRow) => str(employee.employeeCode || employee.employeeId);
const isBasicLine = (code: string, name: string) => {
  const key = `${code} ${name}`.toUpperCase();
  return BASIC_CODES.has(code.toUpperCase()) || /\bBASIC\b/.test(key);
};

type EmergencyContactRow = {
  employeeCode: string;
  fullName: string;
  relationship: string;
  isNextOfKin: boolean;
  isBeneficiary: boolean;
};

type PersistedSettings = BenefitsPayload['settings'];

const defaultSettings = (): PersistedSettings => ({
  benefitYear: String(new Date().getFullYear()),
  currency: 'NGN (₦)',
  autoAssign: true,
  selfEnrollment: false,
  requireApproval: true,
  notifyRenewals: true,
  contributionType: 'Employer + Employee Split',
  approvalWorkflow: 'Employee → HR Benefits → Finance → Approved',
});

const ensureDb = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) return null;
  if (!dbReady.value) {
    await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[BenefitManagementSettings]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementSettings] (
  [Id] NVARCHAR(40) NOT NULL CONSTRAINT [PK_BenefitManagementSettings] PRIMARY KEY,
  [SettingsJson] NVARCHAR(MAX) NOT NULL,
  [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementSettings_UpdatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[BenefitManagementClaims]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementClaims] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_BenefitManagementClaims] PRIMARY KEY,
  [EmployeeId] NVARCHAR(80) NOT NULL,
  [EmployeeName] NVARCHAR(220) NOT NULL,
  [Department] NVARCHAR(180) NOT NULL,
  [PlanName] NVARCHAR(220) NOT NULL,
  [ClaimType] NVARCHAR(120) NOT NULL,
  [Amount] DECIMAL(19,2) NOT NULL,
  [Currency] NVARCHAR(10) NOT NULL,
  [SubmittedOn] DATE NOT NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [Description] NVARCHAR(MAX) NOT NULL,
  [DocumentsJson] NVARCHAR(MAX) NOT NULL,
  [WorkflowJson] NVARCHAR(MAX) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementClaims_CreatedAt] DEFAULT SYSUTCDATETIME(),
  [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementClaims_UpdatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[BenefitManagementApprovals]', N'U') IS NULL
CREATE TABLE [hris].[BenefitManagementApprovals] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_BenefitManagementApprovals] PRIMARY KEY,
  [TypeName] NVARCHAR(120) NOT NULL,
  [EmployeeId] NVARCHAR(80) NOT NULL,
  [EmployeeName] NVARCHAR(220) NOT NULL,
  [PlanName] NVARCHAR(220) NOT NULL,
  [Amount] DECIMAL(19,2) NOT NULL,
  [SubmittedOn] DATE NOT NULL,
  [PriorityName] NVARCHAR(20) NOT NULL,
  [StatusName] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementApprovals_CreatedAt] DEFAULT SYSUTCDATETIME(),
  [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_BenefitManagementApprovals_UpdatedAt] DEFAULT SYSUTCDATETIME()
);
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
    dbReady.value = true;
  }
  return pool;
};

const requireDb = async () => {
  const pool = await ensureDb();
  if (!pool) throw new Error('DLE_Enterprise database is not configured. Benefits Management write operations require HRIS database persistence.');
  return pool;
};

const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

const readSettingsFromDb = async (): Promise<PersistedSettings> => {
  const pool = await ensureDb();
  if (!pool) return defaultSettings();
  const rs = await pool.request().query(`
SELECT TOP (1) [SettingsJson]
FROM [hris].[BenefitManagementSettings]
WHERE [Id] = 'default';`);
  const raw = rs.recordset?.[0]?.SettingsJson;
  if (!raw) return defaultSettings();
  try {
    return { ...defaultSettings(), ...(JSON.parse(String(raw)) as PersistedSettings) };
  } catch {
    return defaultSettings();
  }
};

const writeSettingsToDb = async (settings: PersistedSettings) => {
  const pool = await requireDb();
  await pool.request()
    .input('SettingsJson', sql.NVarChar(sql.MAX), JSON.stringify(settings))
    .query(`
MERGE [hris].[BenefitManagementSettings] AS target
USING (SELECT 'default' AS [Id]) AS source
ON target.[Id] = source.[Id]
WHEN MATCHED THEN UPDATE SET [SettingsJson] = @SettingsJson, [UpdatedAt] = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT ([Id], [SettingsJson]) VALUES ('default', @SettingsJson);`);
};

const readClaimsFromDb = async (): Promise<BenefitClaim[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [EmployeeId], [EmployeeName], [Department], [PlanName], [ClaimType], [Amount], [Currency],
       CONVERT(varchar(10), [SubmittedOn], 23) AS [SubmittedOn], [StatusName], [Description], [DocumentsJson], [WorkflowJson]
FROM [hris].[BenefitManagementClaims]
ORDER BY [SubmittedOn] DESC, [Id] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    employeeId: str(row.EmployeeId),
    employeeName: str(row.EmployeeName),
    department: str(row.Department),
    planName: str(row.PlanName),
    claimType: str(row.ClaimType),
    amount: Number(row.Amount || 0),
    currency: str(row.Currency) || 'NGN',
    submittedOn: str(row.SubmittedOn),
    status: str(row.StatusName) as ClaimStatus,
    description: str(row.Description),
    documents: JSON.parse(str(row.DocumentsJson) || '[]'),
    workflow: JSON.parse(str(row.WorkflowJson) || '[]'),
  }));
};

const readApprovalsFromDb = async (): Promise<ApprovalRequest[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [TypeName], [EmployeeId], [EmployeeName], [PlanName], [Amount],
       CONVERT(varchar(10), [SubmittedOn], 23) AS [SubmittedOn], [PriorityName], [StatusName]
FROM [hris].[BenefitManagementApprovals]
ORDER BY [SubmittedOn] DESC, [Id] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    type: str(row.TypeName),
    employeeId: str(row.EmployeeId),
    employeeName: str(row.EmployeeName),
    planName: str(row.PlanName),
    amount: Number(row.Amount || 0),
    submittedOn: str(row.SubmittedOn),
    priority: str(row.PriorityName) as ApprovalPriority,
    status: str(row.StatusName) as ApprovalRequest['status'],
  }));
};

const updateApprovalStatus = async (id: string, status: ApprovalRequest['status']) => {
  const pool = await requireDb();
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('StatusName', sql.NVarChar(40), status)
    .query(`UPDATE [hris].[BenefitManagementApprovals] SET [StatusName] = @StatusName, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id;`);
};

const updateClaimStatus = async (id: string, status: ClaimStatus) => {
  const pool = await requireDb();
  const rs = await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .query(`SELECT [WorkflowJson] FROM [hris].[BenefitManagementClaims] WHERE [Id] = @Id;`);
  if (!rs.recordset?.length) return;
  const workflow = JSON.parse(str(rs.recordset[0]?.WorkflowJson) || '[]') as BenefitClaim['workflow'];
  const nextWorkflow = workflow.map((step, index) => {
    if (status === 'Approved' && index === workflow.length - 1) return { ...step, status: 'Completed' as const, actedAt: new Date().toISOString().slice(0, 10) };
    if (status === 'Rejected' && index === 1) return { ...step, status: 'Completed' as const, actedAt: new Date().toISOString().slice(0, 10) };
    return step;
  });
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('StatusName', sql.NVarChar(40), status)
    .input('WorkflowJson', sql.NVarChar(sql.MAX), JSON.stringify(nextWorkflow))
    .query(`UPDATE [hris].[BenefitManagementClaims] SET [StatusName] = @StatusName, [WorkflowJson] = @WorkflowJson, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @Id;`);
};

const readCustomPlansFromDb = async (): Promise<BenefitPlan[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [Name], [PlanType], [Provider], [Eligibility], [EmployerContribution], [EmployeeContribution],
       CONVERT(varchar(10), [EffectiveDate], 23) AS [EffectiveDate], [RenewalDate], [StatusName]
FROM [hris].[BenefitManagementPlans]
ORDER BY [CreatedAt] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    name: str(row.Name),
    type: str(row.PlanType) as BenefitPlanType,
    provider: str(row.Provider),
    eligibility: str(row.Eligibility),
    enrolled: 0,
    employerContribution: str(row.EmployerContribution),
    employeeContribution: str(row.EmployeeContribution),
    effectiveDate: str(row.EffectiveDate),
    renewalDate: str(row.RenewalDate) || '—',
    status: str(row.StatusName) as BenefitStatus,
  }));
};

const readCustomEnrollmentsFromDb = async (): Promise<EnrollmentRecord[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [EmployeeId], [EmployeeName], [Department], [PlanId], [PlanName], [PlanType], [Dependents],
       CONVERT(varchar(10), [EnrolledOn], 23) AS [EnrolledOn], [StatusName]
FROM [hris].[BenefitManagementEnrollments]
ORDER BY [EnrolledOn] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    employeeId: str(row.EmployeeId),
    employeeName: str(row.EmployeeName),
    department: str(row.Department),
    planId: str(row.PlanId),
    planName: str(row.PlanName),
    planType: str(row.PlanType) as BenefitPlanType,
    dependents: Number(row.Dependents || 0),
    enrolledOn: str(row.EnrolledOn),
    status: str(row.StatusName) as EnrollmentRecord['status'],
  }));
};

const readCustomRulesFromDb = async (): Promise<EligibilityRule[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [Name], [PlanTypesJson], [Criteria], [AppliesTo], [StatusName]
FROM [hris].[BenefitManagementEligibilityRules]
ORDER BY [CreatedAt] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    name: str(row.Name),
    planTypes: JSON.parse(str(row.PlanTypesJson) || '[]') as BenefitPlanType[],
    criteria: str(row.Criteria),
    appliesTo: str(row.AppliesTo),
    status: str(row.StatusName) as BenefitStatus,
  }));
};

const readCustomProvidersFromDb = async (): Promise<BenefitProvider[]> => {
  const pool = await ensureDb();
  if (!pool) return [];
  const rs = await pool.request().query(`
SELECT [Id], [Name], [ProviderType], [ContactPerson], [Email], [Phone], [Rating], [ContractEnd], [StatusName]
FROM [hris].[BenefitManagementProviders]
ORDER BY [CreatedAt] DESC;`);
  return (rs.recordset || []).map((row: any) => ({
    id: str(row.Id),
    name: str(row.Name),
    type: str(row.ProviderType),
    contactPerson: str(row.ContactPerson),
    email: str(row.Email),
    phone: str(row.Phone),
    rating: Number(row.Rating || 0),
    contractEnd: str(row.ContractEnd),
    status: str(row.StatusName) as BenefitStatus,
  }));
};

const insertPlan = async (input: Record<string, unknown>) => {
  const pool = await requireDb();
  const id = nextId('BP');
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('Name', sql.NVarChar(220), str(input.name))
    .input('PlanType', sql.NVarChar(40), str(input.type) || 'Medical')
    .input('Provider', sql.NVarChar(180), str(input.provider))
    .input('Eligibility', sql.NVarChar(500), str(input.eligibility))
    .input('EmployerContribution', sql.NVarChar(120), 'Per policy')
    .input('EmployeeContribution', sql.NVarChar(120), 'Per policy')
    .input('EffectiveDate', sql.Date, new Date())
    .input('RenewalDate', sql.NVarChar(40), '—')
    .input('StatusName', sql.NVarChar(40), 'Active')
    .query(`
INSERT INTO [hris].[BenefitManagementPlans]
  ([Id],[Name],[PlanType],[Provider],[Eligibility],[EmployerContribution],[EmployeeContribution],[EffectiveDate],[RenewalDate],[StatusName])
VALUES
  (@Id,@Name,@PlanType,@Provider,@Eligibility,@EmployerContribution,@EmployeeContribution,@EffectiveDate,@RenewalDate,@StatusName);`);
  return id;
};

const insertEnrollment = async (employees: DleEmployeeDirectoryRow[], input: Record<string, unknown>) => {
  const pool = await requireDb();
  const employeeId = str(input.employeeId).toUpperCase();
  const employee = employees.find((item) => employeeCode(item).toUpperCase() === employeeId);
  if (!employee) throw new Error(`Employee ${employeeId} was not found in HRIS.`);
  const planType = str(input.planType) as BenefitPlanType;
  const planName = str(input.planName);
  const id = nextId('ENR');
  await pool.request()
    .input('Id', sql.NVarChar(160), id)
    .input('EmployeeId', sql.NVarChar(80), employeeId)
    .input('EmployeeName', sql.NVarChar(220), employee.fullName)
    .input('Department', sql.NVarChar(180), str(employee.department) || 'Unassigned')
    .input('PlanId', sql.NVarChar(120), `plan-custom-${slug(planName)}`)
    .input('PlanName', sql.NVarChar(220), planName)
    .input('PlanType', sql.NVarChar(40), planType)
    .input('Dependents', sql.Int, Number(employee.emergencyContactCount || 0))
    .input('EnrolledOn', sql.Date, new Date())
    .input('StatusName', sql.NVarChar(40), 'Active')
    .query(`
INSERT INTO [hris].[BenefitManagementEnrollments]
  ([Id],[EmployeeId],[EmployeeName],[Department],[PlanId],[PlanName],[PlanType],[Dependents],[EnrolledOn],[StatusName])
VALUES
  (@Id,@EmployeeId,@EmployeeName,@Department,@PlanId,@PlanName,@PlanType,@Dependents,@EnrolledOn,@StatusName);`);

  if (planType === 'Medical' || planType === 'Welfare') {
    const benefitGroup = planName.replace(/ Benefit Group$/i, '').trim() || planName;
    await pool.request()
      .input('employee_code', sql.NVarChar(50), employeeId)
      .input('benefit_group', sql.NVarChar(120), benefitGroup)
      .query(`
UPDATE payroll
SET benefit_group = @benefit_group
FROM [hris].[EmployeePayrollSetup] payroll
INNER JOIN [hris].[EmployeeMasterView] v ON v.employee_id = payroll.employee_id
WHERE UPPER(v.employee_code) = @employee_code;`);
  }
  if (planType === 'Pension' && str(input.provider)) {
    await pool.request()
      .input('employee_code', sql.NVarChar(50), employeeId)
      .input('pension_provider', sql.NVarChar(150), str(input.provider))
      .query(`
UPDATE payroll
SET pension_provider = @pension_provider
FROM [hris].[EmployeePayrollSetup] payroll
INNER JOIN [hris].[EmployeeMasterView] v ON v.employee_id = payroll.employee_id
WHERE UPPER(v.employee_code) = @employee_code;`);
  }
  return id;
};

const insertClaim = async (employees: DleEmployeeDirectoryRow[], input: Record<string, unknown>) => {
  const pool = await requireDb();
  const employeeId = str(input.employeeId).toUpperCase();
  const employee = employees.find((item) => employeeCode(item).toUpperCase() === employeeId);
  if (!employee) throw new Error(`Employee ${employeeId} was not found in HRIS.`);
  const id = nextId('CLM');
  const amount = roundMoney(Number(input.amount || 0));
  const workflow = [
    { stage: 'Submitted', owner: 'Employee', status: 'Completed' as const, actedAt: new Date().toISOString().slice(0, 10) },
    { stage: 'HR Review', owner: 'HR Benefits', status: 'Waiting' as const },
    { stage: 'Finance Review', owner: 'Finance', status: 'Pending' as const },
    { stage: 'Approved', owner: 'Benefits Admin', status: 'Pending' as const },
  ];
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('EmployeeId', sql.NVarChar(80), employeeId)
    .input('EmployeeName', sql.NVarChar(220), employee.fullName)
    .input('Department', sql.NVarChar(180), str(employee.department) || 'Unassigned')
    .input('PlanName', sql.NVarChar(220), str(input.planName))
    .input('ClaimType', sql.NVarChar(120), str(input.claimType))
    .input('Amount', sql.Decimal(19, 2), amount)
    .input('Currency', sql.NVarChar(10), 'NGN')
    .input('SubmittedOn', sql.Date, new Date())
    .input('StatusName', sql.NVarChar(40), 'Pending Approval')
    .input('Description', sql.NVarChar(sql.MAX), str(input.description))
    .input('DocumentsJson', sql.NVarChar(sql.MAX), '[]')
    .input('WorkflowJson', sql.NVarChar(sql.MAX), JSON.stringify(workflow))
    .query(`
INSERT INTO [hris].[BenefitManagementClaims]
  ([Id],[EmployeeId],[EmployeeName],[Department],[PlanName],[ClaimType],[Amount],[Currency],[SubmittedOn],[StatusName],[Description],[DocumentsJson],[WorkflowJson])
VALUES
  (@Id,@EmployeeId,@EmployeeName,@Department,@PlanName,@ClaimType,@Amount,@Currency,@SubmittedOn,@StatusName,@Description,@DocumentsJson,@WorkflowJson);`);

  const approvalId = id;
  await pool.request()
    .input('Id', sql.NVarChar(120), approvalId)
    .input('TypeName', sql.NVarChar(120), 'Medical Claim')
    .input('EmployeeId', sql.NVarChar(80), employeeId)
    .input('EmployeeName', sql.NVarChar(220), employee.fullName)
    .input('PlanName', sql.NVarChar(220), str(input.planName))
    .input('Amount', sql.Decimal(19, 2), amount)
    .input('SubmittedOn', sql.Date, new Date())
    .input('PriorityName', sql.NVarChar(20), amount >= 100000 ? 'High' : 'Medium')
    .input('StatusName', sql.NVarChar(40), 'Pending')
    .query(`
INSERT INTO [hris].[BenefitManagementApprovals]
  ([Id],[TypeName],[EmployeeId],[EmployeeName],[PlanName],[Amount],[SubmittedOn],[PriorityName],[StatusName])
VALUES
  (@Id,@TypeName,@EmployeeId,@EmployeeName,@PlanName,@Amount,@SubmittedOn,@PriorityName,@StatusName);`);
  return id;
};

const insertRule = async (input: Record<string, unknown>) => {
  const pool = await requireDb();
  const id = nextId('EL');
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('Name', sql.NVarChar(220), str(input.name))
    .input('PlanTypesJson', sql.NVarChar(sql.MAX), JSON.stringify(['Medical', 'Allowance', 'Pension']))
    .input('Criteria', sql.NVarChar(800), str(input.criteria))
    .input('AppliesTo', sql.NVarChar(220), str(input.appliesTo))
    .input('StatusName', sql.NVarChar(40), 'Active')
    .query(`
INSERT INTO [hris].[BenefitManagementEligibilityRules]
  ([Id],[Name],[PlanTypesJson],[Criteria],[AppliesTo],[StatusName])
VALUES
  (@Id,@Name,@PlanTypesJson,@Criteria,@AppliesTo,@StatusName);`);
  return id;
};

const insertProvider = async (input: Record<string, unknown>) => {
  const pool = await requireDb();
  const id = nextId('PV');
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('Name', sql.NVarChar(220), str(input.name))
    .input('ProviderType', sql.NVarChar(120), str(input.type) || 'Vendor')
    .input('ContactPerson', sql.NVarChar(180), str(input.contactPerson))
    .input('Email', sql.NVarChar(220), str(input.email))
    .input('Phone', sql.NVarChar(60), str(input.phone))
    .input('Rating', sql.Decimal(4, 2), 0)
    .input('ContractEnd', sql.NVarChar(40), '—')
    .input('StatusName', sql.NVarChar(40), 'Active')
    .query(`
INSERT INTO [hris].[BenefitManagementProviders]
  ([Id],[Name],[ProviderType],[ContactPerson],[Email],[Phone],[Rating],[ContractEnd],[StatusName])
VALUES
  (@Id,@Name,@ProviderType,@ContactPerson,@Email,@Phone,@Rating,@ContractEnd,@StatusName);`);
  return id;
};

const mergePlans = (derived: BenefitPlan[], custom: BenefitPlan[]) => {
  const map = new Map<string, BenefitPlan>();
  for (const plan of derived) map.set(plan.id, plan);
  for (const plan of custom) map.set(plan.id, plan);
  return Array.from(map.values());
};

const applyPlanEnrollmentCounts = (plans: BenefitPlan[], enrollments: EnrollmentRecord[]) => {
  const counts = enrollments.reduce<Map<string, number>>((acc, item) => {
    acc.set(item.planId, (acc.get(item.planId) || 0) + 1);
    return acc;
  }, new Map());
  return plans.map((plan) => ({ ...plan, enrolled: counts.get(plan.id) ?? plan.enrolled }));
};

const mergeEnrollments = (derived: EnrollmentRecord[], custom: EnrollmentRecord[]) => {
  const key = (item: EnrollmentRecord) => `${item.employeeId}|${item.planId}`.toUpperCase();
  const map = new Map<string, EnrollmentRecord>();
  if (custom.length) {
    for (const item of custom) map.set(key(item), item);
    for (const item of derived) {
      if (!map.has(key(item))) map.set(key(item), item);
    }
  } else {
    for (const item of derived) map.set(key(item), item);
  }
  return Array.from(map.values());
};

const BENEFIT_PLAN_TYPES: BenefitPlanType[] = ['Medical', 'Insurance', 'Pension', 'Welfare', 'Allowance'];

const activeEmployeeIdSet = (employees: DleEmployeeDirectoryRow[]) =>
  new Set(employees.filter(isActiveEmployee).map((employee) => employeeCode(employee).toUpperCase()));

const enrollmentsForActiveEmployees = (enrollments: EnrollmentRecord[], employees: DleEmployeeDirectoryRow[]) => {
  const activeIds = activeEmployeeIdSet(employees);
  return enrollments.filter((item) => activeIds.has(item.employeeId.toUpperCase()));
};

const buildEnrollmentByType = (enrollments: EnrollmentRecord[]) => {
  const active = enrollments.filter((item) => item.status === 'Active');
  return BENEFIT_PLAN_TYPES.map((type) => ({
    label: type,
    value: new Set(active.filter((item) => item.planType === type).map((item) => item.employeeId.toUpperCase())).size,
  }));
};

const computeBenefitCosts = (employees: DleEmployeeDirectoryRow[], payrollRecords: Awaited<ReturnType<typeof calculatePayrollForPeriod>>['records']) => {
  let allowanceTotal = 0;
  let pensionEmployerTotal = 0;
  let pensionEmployeeTotal = 0;
  let medicalTotal = 0;
  let insuranceTotal = 0;
  let welfareTotal = 0;

  for (const record of payrollRecords) {
    allowanceTotal += Number(record.allowances || 0);
    pensionEmployerTotal += Number(record.pensionEmployer || 0);
    pensionEmployeeTotal += Number(record.pensionEmployee || 0);
  }

  for (const employee of employees.filter(isActiveEmployee)) {
    for (const line of employee.sagePayrollEarnings || []) {
      const amount = Number(line.amount || 0);
      if (!amount) continue;
      const hay = `${line.code} ${line.name}`.toUpperCase();
      if (isBasicLine(str(line.code), str(line.name))) continue;
      if (/MEDICAL|MED_|HMO|HEALTH/.test(hay)) medicalTotal += amount;
      else if (INSURANCE_PATTERN.test(hay)) insuranceTotal += amount;
      else if (/LEAVE|WELF/.test(hay)) welfareTotal += amount;
    }
  }

  const costs: Record<BenefitPlanType, number> = {
    Medical: roundMoney(medicalTotal),
    Insurance: roundMoney(insuranceTotal),
    Pension: roundMoney(pensionEmployerTotal + pensionEmployeeTotal),
    Welfare: roundMoney(welfareTotal),
    Allowance: roundMoney(allowanceTotal),
  };

  return costs;
};

const computeYtdBenefitCost = (employees: DleEmployeeDirectoryRow[], monthlyEmployerCost: number) => {
  let ytdFromLines = 0;
  for (const employee of employees.filter(isActiveEmployee)) {
    for (const line of employee.sagePayrollEarnings || []) {
      if (isBasicLine(str(line.code), str(line.name))) continue;
      ytdFromLines += Number(line.ytdTotal || 0);
    }
    for (const line of employee.sagePayrollContributions?.lines || []) {
      ytdFromLines += Number(line.ytdTotal || 0);
    }
    for (const line of employee.sagePayrollDeductions?.lines || []) {
      const hay = `${line.code} ${line.name}`.toUpperCase();
      if (/PENSION|NHF/.test(hay)) ytdFromLines += Number(line.ytdTotal || 0);
    }
  }
  if (ytdFromLines > 0) return roundMoney(ytdFromLines);
  return roundMoney(monthlyEmployerCost * monthsInYearSoFar());
};

const mergeRules = (derived: EligibilityRule[], custom: EligibilityRule[]) => [...custom, ...derived.filter((rule) => !custom.some((item) => item.id === rule.id))];

const mergeProviders = (derived: BenefitProvider[], custom: BenefitProvider[]) => {
  const map = new Map<string, BenefitProvider>();
  for (const item of [...derived, ...custom]) map.set(item.id, item);
  return Array.from(map.values());
};

const readEmergencyContactsFromDb = async (): Promise<EmergencyContactRow[]> => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) return [];
  try {
    const rs = await pool.request().query(`
SELECT v.employee_code, ec.full_name, ec.relationship, ec.is_next_of_kin, ec.is_beneficiary
FROM [hris].[EmployeeEmergencyContacts] ec
INNER JOIN [hris].[EmployeeMasterView] v ON v.employee_id = ec.employee_id;`);
    return (rs.recordset || []).map((row: any) => ({
      employeeCode: str(row.employee_code).toUpperCase(),
      fullName: str(row.full_name),
      relationship: str(row.relationship),
      isNextOfKin: Boolean(row.is_next_of_kin),
      isBeneficiary: Boolean(row.is_beneficiary),
    }));
  } catch {
    return [];
  }
};

const inferBenefitGroupPlanType = (groupName: string): BenefitPlanType => {
  const value = groupName.toLowerCase();
  if (/executive|management|director/.test(value)) return 'Welfare';
  if (/contract|project|site/.test(value)) return 'Medical';
  return 'Medical';
};

const collectAllowanceLines = (employee: DleEmployeeDirectoryRow) => {
  const lines = employee.sagePayrollEarnings || [];
  return lines.filter((line) => {
    const code = str(line.code);
    const name = str(line.name);
    if (!code && !name) return false;
    if (isBasicLine(code, name)) return false;
    return ALLOWANCE_PATTERN.test(`${code} ${name}`) || line.amount > 0;
  });
};

const collectInsuranceLines = (employee: DleEmployeeDirectoryRow) => {
  const earnings = employee.sagePayrollEarnings || [];
  const deductions = employee.sagePayrollDeductions?.lines || [];
  return [...earnings, ...deductions].filter((line) => INSURANCE_PATTERN.test(`${line.code} ${line.name}`));
};

const buildBenefitGroupPlans = (employees: DleEmployeeDirectoryRow[]): BenefitPlan[] => {
  const grouped = new Map<string, DleEmployeeDirectoryRow[]>();
  for (const employee of employees.filter(isActiveEmployee)) {
    const group = str(employee.benefitGroup) || 'Unassigned Benefit Group';
    grouped.set(group, [...(grouped.get(group) || []), employee]);
  }
  return Array.from(grouped.entries()).map(([group, members]) => ({
    id: `plan-group-${slug(group)}`,
    name: `${group} Benefit Group`,
    type: inferBenefitGroupPlanType(group),
    provider: group,
    eligibility: `HRIS benefit group = ${group}`,
    enrolled: members.length,
    employerContribution: 'Per HRIS benefit group policy',
    employeeContribution: group === 'Unassigned Benefit Group' ? '—' : 'Per policy',
    effectiveDate: members.map((item) => isoDate(item.dateJoined)).filter(Boolean).sort()[0] || '',
    renewalDate: '—',
    status: (group === 'Unassigned Benefit Group' ? 'Draft' : 'Active') as BenefitStatus,
  }));
};

const buildPensionPlans = (employees: DleEmployeeDirectoryRow[]): BenefitPlan[] => {
  const grouped = new Map<string, DleEmployeeDirectoryRow[]>();
  for (const employee of employees.filter(isActiveEmployee)) {
    const provider = str(employee.pensionProvider);
    if (!provider) continue;
    grouped.set(provider, [...(grouped.get(provider) || []), employee]);
  }
  return Array.from(grouped.entries()).map(([provider, members]) => ({
    id: `plan-pension-${slug(provider)}`,
    name: `${provider} RSA`,
    type: 'Pension' as BenefitPlanType,
    provider,
    eligibility: 'Employees with HRIS pension provider assignment',
    enrolled: members.length,
    employerContribution: 'Per payroll pension engine',
    employeeContribution: 'Per payroll pension engine',
    effectiveDate: members.map((item) => isoDate(item.dateJoined)).filter(Boolean).sort()[0] || '',
    renewalDate: '—',
    status: 'Active' as BenefitStatus,
  }));
};

const buildAllowancePlans = (employees: DleEmployeeDirectoryRow[]): BenefitPlan[] => {
  const grouped = new Map<string, { name: string; members: Set<string> }>();
  for (const employee of employees.filter(isActiveEmployee)) {
    for (const line of collectAllowanceLines(employee)) {
      const code = str(line.code) || slug(str(line.name));
      const name = str(line.name) || str(line.code);
      const key = code.toUpperCase();
      const current = grouped.get(key) || { name, members: new Set<string>() };
      current.members.add(employeeCode(employee));
      grouped.set(key, current);
    }
  }
  return Array.from(grouped.entries()).map(([code, item]) => ({
    id: `plan-allowance-${slug(code)}`,
    name: item.name,
    type: 'Allowance' as BenefitPlanType,
    provider: 'Payroll',
    eligibility: 'Employees with active payroll allowance component',
    enrolled: item.members.size,
    employerContribution: 'Payroll allowance component',
    employeeContribution: '—',
    effectiveDate: '',
    renewalDate: '—',
    status: 'Active' as BenefitStatus,
  }));
};

const buildInsurancePlans = (employees: DleEmployeeDirectoryRow[]): BenefitPlan[] => {
  const grouped = new Map<string, Set<string>>();
  for (const employee of employees.filter(isActiveEmployee)) {
    for (const line of collectInsuranceLines(employee)) {
      const name = str(line.name) || str(line.code);
      const key = name.toUpperCase();
      grouped.set(key, new Set([...(grouped.get(key) || []), employeeCode(employee)]));
    }
  }
  return Array.from(grouped.entries()).map(([name, members]) => ({
    id: `plan-insurance-${slug(name)}`,
    name,
    type: 'Insurance' as BenefitPlanType,
    provider: 'Payroll / Insurer',
    eligibility: 'Employees with insurance payroll component',
    enrolled: members.size,
    employerContribution: 'Per payroll setup',
    employeeContribution: '—',
    effectiveDate: '',
    renewalDate: '—',
    status: 'Active' as BenefitStatus,
  }));
};

const buildEnrollments = (employees: DleEmployeeDirectoryRow[], plans: BenefitPlan[]): EnrollmentRecord[] => {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const records: EnrollmentRecord[] = [];

  for (const employee of employees.filter(isActiveEmployee)) {
    const code = employeeCode(employee);
    const group = str(employee.benefitGroup);
    if (group) {
      const plan = planById.get(`plan-group-${slug(group)}`);
      if (plan) {
        records.push({
          id: `enr-${code}-${plan.id}`,
          employeeId: code,
          employeeName: employee.fullName,
          department: str(employee.department) || 'Unassigned',
          planId: plan.id,
          planName: plan.name,
          planType: plan.type,
          dependents: Number(employee.emergencyContactCount || 0),
          enrolledOn: isoDate(employee.dateJoined) || isoDate(employee.contractStartDate),
          status: group === 'Unassigned Benefit Group' ? 'Pending' : 'Active',
        });
      }
    }

    const pensionProvider = str(employee.pensionProvider);
    if (pensionProvider) {
      const plan = planById.get(`plan-pension-${slug(pensionProvider)}`);
      if (plan) {
        records.push({
          id: `enr-${code}-${plan.id}`,
          employeeId: code,
          employeeName: employee.fullName,
          department: str(employee.department) || 'Unassigned',
          planId: plan.id,
          planName: plan.name,
          planType: plan.type,
          dependents: 0,
          enrolledOn: isoDate(employee.dateJoined) || isoDate(employee.contractStartDate),
          status: str(employee.pensionPin) ? 'Active' : 'Pending',
        });
      }
    }

    for (const line of collectAllowanceLines(employee)) {
      const plan = planById.get(`plan-allowance-${slug(str(line.code) || slug(str(line.name)))}`);
      if (!plan) continue;
      records.push({
        id: `enr-${code}-${plan.id}-${slug(line.code)}`,
        employeeId: code,
        employeeName: employee.fullName,
        department: str(employee.department) || 'Unassigned',
        planId: plan.id,
        planName: plan.name,
        planType: plan.type,
        dependents: 0,
        enrolledOn: isoDate(employee.dateJoined) || isoDate(employee.contractStartDate),
        status: 'Active',
      });
    }
  }

  return records;
};

const buildProviders = (plans: BenefitPlan[]): BenefitProvider[] => {
  const map = plans
    .filter((plan) => plan.provider && plan.provider !== 'Payroll' && plan.provider !== 'Payroll / Insurer')
    .reduce<Map<string, BenefitProvider>>((acc, plan) => {
      const key = plan.provider.toLowerCase();
      if (acc.has(key)) return acc;
      acc.set(key, {
        id: `provider-${slug(plan.provider)}`,
        name: plan.provider,
        type: plan.type === 'Pension' ? 'PFA' : plan.type === 'Medical' ? 'HMO / Benefit Group' : plan.type,
        contactPerson: 'HR Benefits Desk',
        email: '',
        phone: '',
        rating: 0,
        contractEnd: plan.renewalDate === '—' ? '—' : plan.renewalDate,
        status: plan.status,
      });
      return acc;
    }, new Map());
  return Array.from(map.values());
};

const buildEligibilityRules = (employees: DleEmployeeDirectoryRow[], contracts: Awaited<ReturnType<typeof readEmployeeContractsFromDb>>): EligibilityRule[] => {
  const rules: EligibilityRule[] = [];
  const active = employees.filter(isActiveEmployee);

  const groups = new Map<string, number>();
  for (const employee of active) {
    const group = str(employee.benefitGroup) || 'Unassigned Benefit Group';
    groups.set(group, (groups.get(group) || 0) + 1);
  }
  for (const [group, count] of groups.entries()) {
    if (count === 0) continue;
    rules.push({
      id: `el-group-${slug(group)}`,
      name: `${group} Benefit Group Assignment`,
      planTypes: [inferBenefitGroupPlanType(group)],
      criteria: `benefitGroup = ${group}`,
      appliesTo: `${count.toLocaleString()} active employees`,
      status: group === 'Unassigned Benefit Group' ? 'Draft' : 'Active',
    });
  }

  const permanentCount = active.filter((employee) => /permanent/i.test(str(employee.employmentType))).length;
  if (permanentCount) {
    rules.push({
      id: 'el-permanent-pension',
      name: 'Permanent Employees — Pension',
      planTypes: ['Pension'],
      criteria: 'employmentType = Permanent',
      appliesTo: `${permanentCount.toLocaleString()} employees`,
      status: 'Active',
    });
  }

  const probationCount = active.filter((employee) => {
    const end = isoDate(employee.probationEndDate);
    return end && new Date(end).getTime() >= Date.now();
  }).length;
  if (probationCount) {
    rules.push({
      id: 'el-probation-hold',
      name: 'Probation Exclusion',
      planTypes: ['Medical', 'Insurance'],
      criteria: 'probationEndDate in future',
      appliesTo: `${probationCount.toLocaleString()} employees on probation`,
      status: 'Active',
    });
  }

  const contractEligibility = new Map<string, string>();
  for (const contract of contracts || []) {
    const value = str((contract.terms as { benefitsEligibility?: string })?.benefitsEligibility || contract.contractCategory);
    if (!value) continue;
    const key = slug(value);
    if (!contractEligibility.has(key)) contractEligibility.set(key, value);
  }
  for (const [key, value] of contractEligibility.entries()) {
    rules.push({
      id: `el-contract-${key}`,
      name: `Contract Eligibility — ${value}`,
      planTypes: ['Medical', 'Allowance', 'Pension'],
      criteria: `contract benefitsEligibility = ${value}`,
      appliesTo: 'Contract-linked employees',
      status: 'Active',
    });
  }

  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
};

const buildCompliance = (
  employees: DleEmployeeDirectoryRow[],
  payrollRecords: Awaited<ReturnType<typeof calculatePayrollForPeriod>>['records'],
): { items: ComplianceItem[]; score: number } => {
  const active = employees.filter(isActiveEmployee);
  const total = active.length || 1;
  const withPensionProvider = active.filter((employee) => str(employee.pensionProvider)).length;
  const withPensionPin = active.filter((employee) => str(employee.pensionProvider) && str(employee.pensionPin)).length;
  const withBenefitGroup = active.filter((employee) => str(employee.benefitGroup)).length;
  const withEmergencyContacts = active.filter((employee) => Number(employee.emergencyContactCount || 0) > 0).length;
  const pensionEmployerTotal = payrollRecords.reduce((sum, record) => sum + Number(record.pensionEmployer || 0), 0);
  const statutoryEmployerTotal = payrollRecords.reduce((sum, record) => sum + Number(record.statutoryEmployer || 0), 0);
  const today = new Date();
  const due = (day: number) => {
    const next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next.getTime() < today.getTime()) next.setMonth(next.getMonth() + 1);
    return next.toISOString().slice(0, 10);
  };

  const pensionCoveragePct = Math.round((withPensionPin / total) * 100);
  const benefitGroupPct = Math.round((withBenefitGroup / total) * 100);
  const emergencyPct = Math.round((withEmergencyContacts / total) * 100);

  const items: ComplianceItem[] = [
    {
      id: 'cp-pencom',
      regulator: 'PenCom',
      requirement: 'Pension provider and RSA PIN on employee payroll records',
      dueDate: due(7),
      status: pensionCoveragePct >= 95 ? 'Compliant' : pensionCoveragePct >= 80 ? 'At Risk' : 'Overdue',
      lastAudit: today.toISOString().slice(0, 10),
    },
    {
      id: 'cp-nsitf',
      regulator: 'NSITF',
      requirement: 'Employer statutory fund remittance from payroll',
      dueDate: due(15),
      status: statutoryEmployerTotal > 0 ? 'Compliant' : 'At Risk',
      lastAudit: today.toISOString().slice(0, 10),
    },
    {
      id: 'cp-benefit-group',
      regulator: 'HRIS Benefits',
      requirement: 'Benefit group assignment for active employees',
      dueDate: due(30),
      status: benefitGroupPct >= 90 ? 'Compliant' : benefitGroupPct >= 70 ? 'At Risk' : 'Overdue',
      lastAudit: today.toISOString().slice(0, 10),
    },
    {
      id: 'cp-emergency',
      regulator: 'HRIS Records',
      requirement: 'Emergency contacts / beneficiary records',
      dueDate: due(30),
      status: emergencyPct >= 85 ? 'Compliant' : emergencyPct >= 60 ? 'At Risk' : 'Overdue',
      lastAudit: today.toISOString().slice(0, 10),
    },
    {
      id: 'cp-pension-provider',
      regulator: 'Pension Setup',
      requirement: 'Pension administrator configured',
      dueDate: due(21),
      status: withPensionProvider >= total * 0.9 ? 'Compliant' : withPensionProvider >= total * 0.7 ? 'At Risk' : 'Overdue',
      lastAudit: today.toISOString().slice(0, 10),
    },
  ];

  const score = Math.round(
    items.reduce((sum, item) => sum + (item.status === 'Compliant' ? 100 : item.status === 'At Risk' ? 65 : 25), 0) / items.length,
  );

  return { items, score };
};

const buildEmployeeProfile = (
  employee: DleEmployeeDirectoryRow,
  enrollments: EnrollmentRecord[],
  claims: BenefitClaim[],
  contacts: EmergencyContactRow[],
): EmployeeBenefitProfile => {
  const code = employeeCode(employee).toUpperCase();
  const employeeEnrollments = enrollments.filter((item) => item.employeeId.toUpperCase() === code);
  const employeeContacts = contacts.filter((item) => item.employeeCode === code);
  const planRecords = employeeEnrollments.map((item) => ({
    name: item.planName,
    type: item.planType,
    provider: item.planName.includes('RSA') ? str(employee.pensionProvider) : str(employee.benefitGroup) || 'HRIS',
    coverage: item.planType === 'Pension'
      ? `${str(employee.pensionProvider) || 'Pension'}${employee.pensionPin ? ` · ${employee.pensionPin}` : ''}`
      : item.planType === 'Allowance'
        ? 'Payroll allowance component'
        : str(employee.benefitGroup) || 'Assigned',
    status: (item.status === 'Pending' ? 'Pending' : 'Active') as BenefitStatus,
  }));

  const allowanceLines = collectAllowanceLines(employee).map((line) => ({
    name: str(line.name) || str(line.code),
    amount: `₦${roundMoney(line.amount).toLocaleString('en-NG')}`,
    frequency: 'Monthly',
  }));

  const dependents = employeeContacts
    .filter((item) => !item.isBeneficiary || item.relationship)
    .map((item) => ({
      name: item.fullName,
      relationship: item.relationship || 'Dependent',
      plan: str(employee.benefitGroup) || 'Medical',
    }));

  const beneficiaries = employeeContacts
    .filter((item) => item.isBeneficiary || item.isNextOfKin)
    .map((item, index, list) => ({
      name: item.fullName,
      relationship: item.relationship || 'Beneficiary',
      percentage: list.length === 1 ? 100 : Math.floor(100 / list.length) + (index === 0 ? 100 % list.length : 0),
    }));

  return {
    employeeId: code,
    employeeName: employee.fullName,
    jobTitle: str(employee.jobTitle) || str(employee.designation) || '—',
    department: str(employee.department) || 'Unassigned',
    location: str(employee.workLocation) || str(employee.location) || '—',
    hireDate: isoDate(employee.dateJoined) || isoDate(employee.contractStartDate),
    plans: planRecords,
    allowances: allowanceLines,
    dependents,
    beneficiaries,
    recentClaims: claims.filter((claim) => claim.employeeId.toUpperCase() === code),
  };
};

const buildAnalytics = (
  enrollments: EnrollmentRecord[],
  employees: DleEmployeeDirectoryRow[],
  payrollRecords: Awaited<ReturnType<typeof calculatePayrollForPeriod>>['records'],
) => {
  const scopedEnrollments = enrollmentsForActiveEmployees(enrollments, employees);
  const enrollmentByType = buildEnrollmentByType(scopedEnrollments);
  const benefitCosts = computeBenefitCosts(employees, payrollRecords);
  const costByPlanType = BENEFIT_PLAN_TYPES.map((type) => ({
    label: type,
    value: benefitCosts[type],
  }));

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return date.toLocaleString('en-US', { month: 'short' });
  });

  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  const activeEnrollments = scopedEnrollments.filter((item) => item.status === 'Active');
  const newSeries = monthKeys.map((key) =>
    activeEnrollments.filter((item) => item.enrolledOn.startsWith(key)).length,
  );
  const totalSeries = monthKeys.map((_, index) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - (5 - index));
    cutoff.setDate(31);
    cutoff.setHours(23, 59, 59, 999);
    return new Set(
      activeEnrollments
        .filter((item) => {
          const enrolled = item.enrolledOn;
          if (!enrolled) return index === monthKeys.length - 1;
          return new Date(enrolled).getTime() <= cutoff.getTime();
        })
        .map((item) => item.employeeId.toUpperCase()),
    ).size;
  });

  const monthlyEmployer = roundMoney(
    payrollRecords.reduce((sum, record) => sum + Number(record.allowances || 0) + Number(record.pensionEmployer || 0) + Number(record.statutoryEmployer || 0), 0),
  );
  const monthlyEmployee = roundMoney(
    payrollRecords.reduce((sum, record) => sum + Number(record.pensionEmployee || 0) + Number(record.statutoryEmployee || 0), 0),
  );

  return {
    costByPlanType,
    enrollmentByType,
    costTrend: { labels: months, employerSeries: months.map(() => monthlyEmployer), employeeSeries: months.map(() => monthlyEmployee) },
    enrollmentTrend: { labels: months, totalSeries, newSeries },
  };
};

export async function applyBenefitsManagementAction(action: string, body: Record<string, unknown> = {}) {
  if (action === 'save-settings') {
    const settings = { ...defaultSettings(), ...(body.settings as PersistedSettings | undefined) };
    await writeSettingsToDb(settings);
    return `Benefits settings saved.`;
  }

  const employees = (await readPayrollEmployees()).employees;

  if (action === 'create-plan') {
    const id = await insertPlan(body);
    return `Benefit plan ${id} created.`;
  }
  if (action === 'create-enrollment') {
    const id = await insertEnrollment(employees, body);
    return `Employee enrolled (${id}).`;
  }
  if (action === 'create-claim') {
    const id = await insertClaim(employees, body);
    return `Claim ${id} submitted for approval.`;
  }
  if (action === 'create-rule') {
    const id = await insertRule(body);
    return `Eligibility rule ${id} created.`;
  }
  if (action === 'create-provider') {
    const id = await insertProvider(body);
    return `Provider ${id} added.`;
  }
  if (action === 'bulk-approve') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map((item) => str(item)).filter(Boolean);
    if (!ids.length) throw new Error('Select at least one pending approval.');
    for (const id of ids) {
      await updateApprovalStatus(id, 'Approved');
      await updateClaimStatus(id, 'Approved');
    }
    return `Approved ${ids.length} request(s).`;
  }
  if (action === 'sync-sage') {
    const result = await syncSageBenefitsToHris({
      overwriteExisting: Boolean(body.overwriteExisting),
      dryRun: Boolean(body.dryRun),
    });
    return result.message;
  }

  const id = str(body.id);
  if (action === 'approve') {
    await updateApprovalStatus(id, 'Approved');
    await updateClaimStatus(id, 'Approved');
    return `Approved ${id || 'request'}.`;
  }
  if (action === 'reject') {
    await updateApprovalStatus(id, 'Rejected');
    await updateClaimStatus(id, 'Rejected');
    return `Rejected ${id || 'request'}.`;
  }
  throw new Error(`Unknown action: ${action || '(empty)'}`);
}

export async function readBenefitsManagementPayload(roleInput?: string | null): Promise<BenefitsPayload> {
  const role = (roleInput as BenefitsRole) || 'Benefits Administrator';
  const employeeSource = await readPayrollEmployees();
  const employees = employeeSource.employees;
  const period = await getActivePayrollPeriod().catch(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const payroll = await calculatePayrollForPeriod(period).catch(() => null);
  const payrollRecords = payroll?.records || [];
  const [contacts, contracts, claims, approvals, settings, customPlans, customEnrollments, customRules, customProviders] = await Promise.all([
    readEmergencyContactsFromDb(),
    readEmployeeContractsFromDb().catch(() => []),
    readClaimsFromDb(),
    readApprovalsFromDb(),
    readSettingsFromDb(),
    readCustomPlansFromDb(),
    readCustomEnrollmentsFromDb(),
    readCustomRulesFromDb(),
    readCustomProvidersFromDb(),
  ]);

  const benefitGroupPlans = buildBenefitGroupPlans(employees);
  const pensionPlans = buildPensionPlans(employees);
  const allowancePlans = buildAllowancePlans(employees);
  const insurancePlans = buildInsurancePlans(employees);
  const derivedPlans = [...benefitGroupPlans, ...pensionPlans, ...allowancePlans, ...insurancePlans];
  const mergedPlans = mergePlans(derivedPlans, customPlans);
  const derivedEnrollments = buildEnrollments(employees, mergedPlans);
  const enrollments = mergeEnrollments(derivedEnrollments, customEnrollments);
  const plans = applyPlanEnrollmentCounts(mergedPlans, enrollments);
  const derivedProviders = buildProviders(plans);
  const providers = mergeProviders(derivedProviders, customProviders);
  const derivedRules = buildEligibilityRules(employees, contracts);
  const eligibilityRules = mergeRules(derivedRules, customRules);
  const compliance = buildCompliance(employees, payrollRecords);
  const scopedEnrollments = enrollmentsForActiveEmployees(enrollments, employees);
  const activeEnrollmentRecords = scopedEnrollments.filter((item) => item.status === 'Active');
  const enrolledEmployees = new Set(activeEnrollmentRecords.map((item) => item.employeeId.toUpperCase())).size;
  const analytics = buildAnalytics(enrollments, employees, payrollRecords);

  const periodBenefitCost = roundMoney(
    payrollRecords.reduce(
      (sum, record) => sum + Number(record.allowances || 0) + Number(record.pensionEmployer || 0) + Number(record.statutoryEmployer || 0),
      0,
    ),
  );
  const totalBenefitCostYtd = computeYtdBenefitCost(employees, periodBenefitCost);

  const enrolledEmployeeIds = new Set(enrollments.map((item) => item.employeeId.toUpperCase()));
  const employeeProfiles = employees
    .filter((employee) => enrolledEmployeeIds.has(employeeCode(employee).toUpperCase()))
    .map((employee) => buildEmployeeProfile(employee, enrollments, claims, contacts));

  const dataSource = payrollDataSourceInfo(employeeSource);
  const warnings = [employeeSource.warning, payroll ? null : 'Payroll calculation unavailable; benefit cost analytics may be incomplete.']
    .filter(Boolean)
    .join(' ');

  return {
    generatedAt: new Date().toISOString(),
    source: `${dataSource.source}; ${SOURCE_SYSTEM} Benefits Management`,
    role,
    dataSource: {
      source: dataSource.source,
      databaseAvailable: dataSource.databaseAvailable,
      warning: warnings || null,
      employeeCount: dataSource.employeeCount,
    },
    summary: {
      totalEmployees: employees.filter(isActiveEmployee).length,
      totalPlans: plans.length,
      activeEnrollments: activeEnrollmentRecords.length,
      enrolledEmployees,
      pendingClaims: claims.filter((item) => item.status === 'Pending Approval' || item.status === 'In Review').length,
      totalBenefitCostYtd,
      periodBenefitCost,
      pendingApprovals: approvals.filter((item) => item.status === 'Pending').length,
      complianceScore: compliance.score,
    },
    analytics,
    plans,
    enrollments,
    claims,
    approvals,
    eligibilityRules,
    providers,
    compliance: compliance.items,
    employeeProfiles,
    settings,
  };
}
