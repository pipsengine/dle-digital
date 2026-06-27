/**
 * Migrate Sage DLE_JUNE latest payslip earnings, deductions, and contributions
 * into DLE_Enterprise employee payroll setup for all active employees.
 *
 * Usage:
 *   node scripts/database/sync-sage-payroll-deductions.js --audit-only
 *   node scripts/database/sync-sage-payroll-deductions.js --apply
 *   node scripts/database/sync-sage-payroll-deductions.js --apply --grade=SS5
 */
const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const REPORT_GRADES = [
  'CONTRACT ON LUMPSUM', 'Daily Rate', 'JS1', 'JS2A', 'JS2B', 'Lumpsum',
  'MGT6', 'MGT7', 'MGTCOLA', 'PERMANENT', 'Permanent', 'SMGT10', 'SMGT8', 'SS3', 'SS4', 'SS5',
];

const DEDUCTION_CODES = ['PAYE', 'PENSION_EE', 'NHF', 'LOAN', 'OTHERDEDUCTION', 'SNR_UNION', 'JNR_UNION', 'SUSPENSION'];

const SUPPLEMENTAL_EARNING_CODES = new Set([
  'ARREARS', 'REFUND', 'LEAVEALLOW', 'OVT', 'LTI', 'LSAWAD', 'MISC_ALL', 'SPECIAL_ALL',
  'WKEND_ALL', 'SITEALL', 'CTHPAY', 'PER_NIGHT_ALL', 'TCMMEAL',
]);

const isSupplementalEarning = (code) => SUPPLEMENTAL_EARNING_CODES.has(clean(code).toUpperCase());

const loadEnv = () => {
  for (const file of [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
};

const clean = (value) => String(value ?? '').trim();
const roundMoney = (value) => Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100) / 100;
const numOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const employeeCode = (rawCode) => {
  const code = clean(rawCode).replace(/_/g, '').toUpperCase();
  if (!code) return '';
  if (/^(P|C|L|IT|NYSC|N|I)/.test(code)) return code;
  return `P${code}`;
};

const normalizeGrade = (value) => clean(value).toUpperCase().replace(/\s+/g, ' ');

const payrollPeriod = () => {
  const value = clean(process.env.HRIS_ACTIVE_PAYROLL_PERIOD || '2026-06');
  return /^\d{4}-\d{2}$/.test(value) ? value : '2026-06';
};

const periodSqlRange = (period) => {
  const [year, month] = period.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start, end };
};

const sageConfig = () => ({
  server: process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8',
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL',
  },
  connectionTimeout: Number(process.env.SAGE_PAYROLL_DB_CONNECT_TIMEOUT || 15000),
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 120000),
});

const dleConfig = () => ({
  server: process.env.DLE_ENTERPRISE_DB_HOST || 'localhost',
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise',
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true').toLowerCase() !== 'false',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  },
  connectionTimeout: Number(process.env.DLE_ENTERPRISE_DB_CONNECTION_TIMEOUT_MS || 20000),
  requestTimeout: Number(process.env.DLE_ENTERPRISE_DB_REQUEST_TIMEOUT_MS || 120000),
});

const ensurePayrollColumns = async (pool) => {
  await pool.request().query(`
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_payslip_period') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_payslip_period] nvarchar(7) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_earning_lines_json') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_earning_lines_json] nvarchar(max) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_deduction_lines_json') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_deduction_lines_json] nvarchar(max) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_contribution_lines_json') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_contribution_lines_json] nvarchar(max) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_payslip_synced_at') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_payslip_synced_at] datetime2(3) NULL;
  `);
};

const sagePayrollQuery = (period) => {
  const { start, end } = periodSqlRange(period);
  return `
DECLARE @PayrollPeriodStart date = '${start}';
DECLARE @PayrollPeriodEnd date = '${end}';

IF OBJECT_ID('tempdb..#LatestPayslipPeriods') IS NOT NULL DROP TABLE #LatestPayslipPeriods;

WITH activeEmployees AS (
  SELECT
    e.EmployeeID,
    e.EmployeeCode,
    REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') AS normalizedCode,
    ge.DisplayName AS employeeName
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
  WHERE e.TerminationDate IS NULL
    AND ISNULL(es.Code, 'A') = 'A'
    AND ge.Status = 'A'
    AND c.Status = 'A'
),
latestPayslipPeriods AS (
  SELECT
    ae.EmployeeID,
    ae.EmployeeCode,
    ae.normalizedCode,
    ae.employeeName,
    epp.EmployeePayPeriodID,
    p.PayslipID,
    epp.LastCalcDate,
    ROW_NUMBER() OVER (PARTITION BY ae.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM activeEmployees ae
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = ae.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  WHERE epp.LastCalcDate >= @PayrollPeriodStart
    AND epp.LastCalcDate < @PayrollPeriodEnd
)
SELECT
  lp.EmployeeID AS sageEmployeeId,
  lp.EmployeeCode AS sageEmployeeCode,
  lp.normalizedCode,
  CASE
    WHEN lp.normalizedCode LIKE 'C%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'L%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'P%' THEN lp.normalizedCode
    ELSE CONCAT('P', lp.normalizedCode)
  END AS directoryEmployeeCode,
  lp.employeeName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')) AS jobGrade,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.RemunerationDefinitionHeaderDisplay)), ''), NULLIF(LTRIM(RTRIM(ed.PaymentType)), '')) AS remunerationDefinition,
  c.CompanyCode AS companyCode,
  edef.DefCode AS lineType,
  'earning' AS lineCategory,
  COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(edef.LongDescription)), ''), edef.DefCode) AS lineName,
  pel.Total AS amount,
  pel.TaxableAmount AS taxableAmount
FROM latestPayslipPeriods lp
JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = lp.EmployeeID
JOIN Company.Company c ON c.CompanyID = (SELECT CompanyID FROM Employee.Employee WHERE EmployeeID = lp.EmployeeID)
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = lp.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
WHERE lp.rn = 1 AND ISNULL(pel.Total, 0) <> 0

UNION ALL

SELECT
  lp.EmployeeID,
  lp.EmployeeCode,
  lp.normalizedCode,
  CASE
    WHEN lp.normalizedCode LIKE 'C%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'L%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'P%' THEN lp.normalizedCode
    ELSE CONCAT('P', lp.normalizedCode)
  END,
  lp.employeeName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')),
  COALESCE(NULLIF(LTRIM(RTRIM(ed.RemunerationDefinitionHeaderDisplay)), ''), NULLIF(LTRIM(RTRIM(ed.PaymentType)), '')),
  c.CompanyCode,
  dd.DefCode,
  'deduction',
  COALESCE(NULLIF(LTRIM(RTRIM(dd.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(dd.LongDescription)), ''), dd.DefCode),
  pdl.Total,
  NULL
FROM latestPayslipPeriods lp
JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = lp.EmployeeID
JOIN Company.Company c ON c.CompanyID = (SELECT CompanyID FROM Employee.Employee WHERE EmployeeID = lp.EmployeeID)
JOIN Payroll.PayslipDeductionLine pdl ON pdl.PayslipID = lp.PayslipID
JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
WHERE lp.rn = 1 AND ISNULL(pdl.Total, 0) <> 0

UNION ALL

SELECT
  lp.EmployeeID,
  lp.EmployeeCode,
  lp.normalizedCode,
  CASE
    WHEN lp.normalizedCode LIKE 'C%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'L%' THEN lp.normalizedCode
    WHEN lp.normalizedCode LIKE 'P%' THEN lp.normalizedCode
    ELSE CONCAT('P', lp.normalizedCode)
  END,
  lp.employeeName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')),
  COALESCE(NULLIF(LTRIM(RTRIM(ed.RemunerationDefinitionHeaderDisplay)), ''), NULLIF(LTRIM(RTRIM(ed.PaymentType)), '')),
  c.CompanyCode,
  ccd.DefCode,
  'contribution',
  COALESCE(NULLIF(LTRIM(RTRIM(ccd.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(ccd.LongDescription)), ''), ccd.DefCode),
  pccl.Total,
  NULL
FROM latestPayslipPeriods lp
JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = lp.EmployeeID
JOIN Company.Company c ON c.CompanyID = (SELECT CompanyID FROM Employee.Employee WHERE EmployeeID = lp.EmployeeID)
JOIN Payroll.PayslipCompanyContributionLine pccl ON pccl.PayslipID = lp.PayslipID
JOIN Payroll.CompanyContributionDef ccd ON ccd.CompanyContributionDefID = pccl.DefID
WHERE lp.rn = 1 AND ISNULL(pccl.Total, 0) <> 0

ORDER BY directoryEmployeeCode, lineCategory, lineType;
`;
};

const groupSageRows = (rows) => {
  const byEmployee = new Map();
  for (const row of rows) {
    const key = String(row.sageEmployeeId);
    const current = byEmployee.get(key) || {
      sageEmployeeId: String(row.sageEmployeeId),
      sageEmployeeCode: clean(row.sageEmployeeCode),
      directoryEmployeeCode: employeeCode(row.directoryEmployeeCode || row.sageEmployeeCode),
      employeeName: clean(row.employeeName),
      jobGrade: clean(row.jobGrade),
      remunerationDefinition: clean(row.remunerationDefinition),
      companyCode: clean(row.companyCode),
      earnings: [],
      deductions: [],
      contributions: [],
    };
    const line = {
      code: clean(row.lineType),
      name: clean(row.lineName || row.lineType),
      amount: roundMoney(row.amount),
      taxableAmount: row.taxableAmount === null || row.taxableAmount === undefined ? null : roundMoney(row.taxableAmount),
    };
    if (row.lineCategory === 'earning') current.earnings.push(line);
    if (row.lineCategory === 'deduction') current.deductions.push(line);
    if (row.lineCategory === 'contribution') current.contributions.push(line);
    byEmployee.set(key, current);
  }
  return [...byEmployee.values()];
};

const summarizeDeductions = (lines) => {
  const findAmount = (pattern) => lines.find((line) => pattern.test(line.code))?.amount || 0;
  const paye = findAmount(/^PAYE$/i);
  const pensionEmployee = lines.filter((line) => /PENSION/i.test(line.code) && !/ER$/i.test(line.code)).reduce((sum, line) => sum + line.amount, 0);
  const nhf = findAmount(/^NHF$/i);
  const totalDeductions = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  return { paye, pensionEmployee, nhf, totalDeductions };
};

const BASIC_PERCENT_BY_PREFIX = {
  JNR: 0.4,
  SNR: 0.416,
  MGT: 0.25,
  MGT1COLA: 0.4,
  SNM: 0.2,
};

const derivePackageSalary = (employee) => {
  const basicLine = employee.earnings.find((line) => /_(BASIC)$/i.test(clean(line.code)) || /^BASIC/i.test(clean(line.code)));
  if (basicLine && Number(basicLine.amount) > 0) {
    const code = clean(basicLine.code).toUpperCase();
    const prefix = Object.keys(BASIC_PERCENT_BY_PREFIX).find((key) => code.startsWith(key));
    const basicPercent = prefix ? BASIC_PERCENT_BY_PREFIX[prefix] : 0;
    if (basicPercent > 0) return roundMoney(Number(basicLine.amount) / basicPercent);
  }
  return roundMoney(
    employee.earnings.filter((line) => !isSupplementalEarning(line.code)).reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );
};

const upsertEmployee = async (pool, employee, period, apply) => {
  const packageSalary = derivePackageSalary(employee);
  const basicLine = employee.earnings.find((line) => /_(BASIC)$/i.test(clean(line.code)) || /^BASIC/i.test(clean(line.code)));
  const basicSalary = basicLine ? roundMoney(Number(basicLine.amount)) : null;
  const deductionSummary = summarizeDeductions(employee.deductions);
  const periodSalary = packageSalary > 0 ? packageSalary : null;
  const salaryGrade = employee.jobGrade || employee.remunerationDefinition || null;

  if (!apply) {
    return { updated: false, reason: 'audit-only', salaryGrade, ...deductionSummary };
  }

  const result = await pool.request()
    .input('sage_employee_id', sql.NVarChar(80), employee.sageEmployeeId)
    .input('directory_employee_code', sql.NVarChar(80), employee.directoryEmployeeCode)
    .input('normalized_code', sql.NVarChar(80), clean(employee.sageEmployeeCode).replace(/_/g, '').toUpperCase())
    .input('salary_grade', sql.NVarChar(80), salaryGrade)
    .input('payroll_group', sql.NVarChar(80), employee.companyCode || null)
    .input('period_salary', sql.Decimal(19, 4), periodSalary)
    .input('basic_salary', sql.Decimal(19, 4), basicSalary)
    .input('annual_salary', sql.Decimal(19, 4), periodSalary ? roundMoney(periodSalary * 12) : null)
    .input('latest_deductions', sql.Decimal(19, 4), deductionSummary.totalDeductions || null)
    .input('sage_payslip_period', sql.NVarChar(7), period)
    .input('sage_earning_lines_json', sql.NVarChar(sql.MAX), JSON.stringify(employee.earnings))
    .input('sage_deduction_lines_json', sql.NVarChar(sql.MAX), JSON.stringify(employee.deductions))
    .input('sage_contribution_lines_json', sql.NVarChar(sql.MAX), JSON.stringify(employee.contributions))
    .query(`
DECLARE @employee_id bigint;

SELECT @employee_id = employee_id
FROM [hris].[EmployeeSourceRecords] WITH (UPDLOCK, HOLDLOCK)
WHERE source_system = N'Sage 300 People Payroll'
  AND source_employee_id = @sage_employee_id;

IF @employee_id IS NULL
BEGIN
  SELECT TOP (1) @employee_id = employee_id
  FROM [hris].[Employees] WITH (UPDLOCK, HOLDLOCK)
  WHERE REPLACE(UPPER(LTRIM(RTRIM(employee_code))), '_', '') IN (@directory_employee_code, @normalized_code, CONCAT(N'P', @normalized_code));
END;

IF @employee_id IS NULL
BEGIN
  SELECT CAST(0 AS bit) AS updated, N'Missing DLE employee' AS reason;
  RETURN;
END;

UPDATE [hris].[EmployeeJobInfo]
SET job_grade = COALESCE(NULLIF(@salary_grade, N''), job_grade),
    modified_at = SYSUTCDATETIME()
WHERE employee_id = @employee_id;

MERGE [hris].[EmployeePayrollSetup] AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET
  payroll_group = COALESCE(NULLIF(@payroll_group, N''), target.payroll_group),
  salary_grade = COALESCE(NULLIF(@salary_grade, N''), target.salary_grade),
  period_salary = COALESCE(@period_salary, target.period_salary),
  basic_salary = COALESCE(@basic_salary, target.basic_salary),
  annual_salary = COALESCE(@annual_salary, target.annual_salary),
  latest_deductions = COALESCE(@latest_deductions, target.latest_deductions),
  sage_payslip_period = @sage_payslip_period,
  sage_earning_lines_json = @sage_earning_lines_json,
  sage_deduction_lines_json = @sage_deduction_lines_json,
  sage_contribution_lines_json = @sage_contribution_lines_json,
  sage_payslip_synced_at = SYSUTCDATETIME(),
  setup_assigned_to_payroll = 1,
  modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
  employee_id, payroll_group, salary_grade, period_salary, annual_salary, latest_deductions,
  sage_payslip_period, sage_earning_lines_json, sage_deduction_lines_json, sage_contribution_lines_json,
  sage_payslip_synced_at, setup_assigned_to_payroll
) VALUES (
  @employee_id, @payroll_group, @salary_grade, @period_salary, @annual_salary, @latest_deductions,
  @sage_payslip_period, @sage_earning_lines_json, @sage_deduction_lines_json, @sage_contribution_lines_json,
  SYSUTCDATETIME(), 1
);

INSERT [hris].[EmployeeAuditLog](employee_id, audit_action, performed_by, reason, new_value)
VALUES (
  @employee_id,
  N'Sage payroll deduction migration',
  SUSER_SNAME(),
  N'Synced Sage payslip earnings, deductions, and contributions from DLE_JUNE',
  LEFT(@sage_deduction_lines_json, 3500)
);

SELECT CAST(1 AS bit) AS updated, N'Updated' AS reason;
`);

  const row = result.recordset?.[0];
  return {
    updated: Boolean(row?.updated),
    reason: clean(row?.reason) || 'unknown',
    salaryGrade,
    ...deductionSummary,
  };
};

const main = async () => {
  loadEnv();
  const apply = process.argv.includes('--apply');
  const auditOnly = process.argv.includes('--audit-only') || !apply;
  const gradeFilter = (process.argv.find((arg) => arg.startsWith('--grade=')) || '').split('=')[1] || '';
  const period = payrollPeriod();

  if (!process.env.SAGE_PAYROLL_DB_PASSWORD) {
    throw new Error('SAGE_PAYROLL_DB_PASSWORD is required.');
  }

  const sagePool = await new sql.ConnectionPool(sageConfig()).connect();
  const dlePool = await new sql.ConnectionPool(dleConfig()).connect();
  try {
    await ensurePayrollColumns(dlePool);
    const sageRows = (await sagePool.request().query(sagePayrollQuery(period))).recordset || [];
    const employees = groupSageRows(sageRows);
    const filtered = gradeFilter
      ? employees.filter((employee) => normalizeGrade(employee.jobGrade) === normalizeGrade(gradeFilter))
      : employees;

    const gradeCounts = filtered.reduce((map, employee) => {
      const grade = normalizeGrade(employee.jobGrade) || 'UNASSIGNED';
      map.set(grade, (map.get(grade) || 0) + 1);
      return map;
    }, new Map());

    let updated = 0;
    let missing = 0;
    const samples = [];

    for (const employee of filtered) {
      const result = await upsertEmployee(dlePool, employee, period, apply && !auditOnly);
      if (result.updated) updated += 1;
      if (result.reason === 'Missing DLE employee') missing += 1;
      if (samples.length < 12 && employee.deductions.length) {
        samples.push({
          employee: employee.directoryEmployeeCode,
          grade: employee.jobGrade,
          deductions: employee.deductions.map((line) => `${line.code}:${line.amount}`).join(', '),
        });
      }
    }

    console.log(JSON.stringify({
      mode: apply && !auditOnly ? 'apply' : 'audit-only',
      period,
      sageLineRows: sageRows.length,
      sageEmployees: employees.length,
      processedEmployees: filtered.length,
      updated,
      missingDleEmployees: missing,
      gradeCounts: Object.fromEntries([...gradeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
      reportGradesPresent: REPORT_GRADES.filter((grade) => gradeCounts.has(normalizeGrade(grade))),
      reportGradesMissing: REPORT_GRADES.filter((grade) => !gradeCounts.has(normalizeGrade(grade))),
      deductionCodesTracked: DEDUCTION_CODES,
      samples,
    }, null, 2));
  } finally {
    await sagePool.close();
    await dlePool.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
