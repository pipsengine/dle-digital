/**
 * Import Sage employee 0465 (ABE OLUFUNKE COMFORT) into DLE_Enterprise HRIS.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sql from 'mssql';

for (const file of [resolve('.env'), resolve('apps/dashboard/.env')]) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

const EMPLOYEE_CODE = 'P0465';
const SOURCE_CODE = '0465';
const FULL_NAME = 'Mrs ABE OLUFUNKE COMFORT';
const BANK = {
  bankName: 'Zenith Bank Plc',
  accountNo: '2383082901',
  branchCode: '1',
  accountName: 'ABE OLUFUNKE COMFORT',
};

const sagePool = await new sql.ConnectionPool({
  server: process.env.SAGE_PAYROLL_DB_HOST,
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME,
  user: process.env.SAGE_PAYROLL_DB_USER,
  password: process.env.SAGE_PAYROLL_DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE },
}).connect();

const sage = (await sagePool.request().query(`
  SELECT TOP 1
    e.EmployeeID AS employeeId,
    e.EmployeeCode AS employeeCode,
    ge.EntityCode AS entityCode,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.DisplayName)), ''), ge.DisplayName) AS displayName,
    ed.Title AS title,
    ed.FirstNames AS firstNames,
    ed.SecondName AS middleName,
    ed.LastName AS lastName,
    ed.Gender AS gender,
    ed.BirthDate AS birthDate,
    ed.Nationality AS nationality,
    ed.EmailAddress AS emailAddress,
    ed.CellNo AS cellNo,
    ed.WorkTelNo AS workTelNo,
    ed.JobTitle AS jobTitle,
    ed.JobGrade AS jobGrade,
    ed.JobGradeCode AS jobGradeCode,
    ed.HierarchyCodeB AS departmentCode,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS departmentName,
    ed.HierarchyCode AS siteCode,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.HAName)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyName)), '')) AS siteName,
    ed.HierarchyCodeC AS hierarchyEmployeeTypeCode,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameC)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameC)), '')) AS hierarchyEmployeeTypeName,
    ed.DateEngaged AS dateEngaged,
    ed.DateJoinedGroup AS dateJoinedGroup,
    ed.ProbationPeriodEndDate AS probationPeriodEndDate,
    c.CompanyCode AS companyCode,
    cge.DisplayName AS companyName,
    c.CompanyCCY AS companyCurrency,
    ed.PaymentRunDefLong AS paymentRunLong,
    ed.PaymentType AS paymentType,
    ed.RemunerationDefinitionHeaderDisplay AS remunerationDefinition,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.TaxNo)), ''), NULLIF(LTRIM(RTRIM(ge.TaxNo)), '')) AS taxNo,
    ed.AnnualSalary AS annualSalary,
    ed.PeriodSalary AS periodSalary,
    es.Code AS statusCode,
    es.ShortDescription AS statusName,
    COALESCE(NULLIF(LTRIM(RTRIM(ed.ReportsToEmployeeDisplay)), ''), mgrge.DisplayName) AS managerName
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  JOIN Entity.GenEntity cge ON cge.GenEntityID = c.GenEntityID
  LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
  LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
  LEFT JOIN Employee.Employee mgr ON mgr.EmployeeID = e.ReportToEmployeeID
  LEFT JOIN Entity.GenEntity mgrge ON mgrge.GenEntityID = mgr.GenEntityID
  WHERE REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') = '${SOURCE_CODE}'
`)).recordset[0];

await sagePool.close();

if (!sage) {
  console.error(JSON.stringify({ error: 'Sage employee 0465 not found' }, null, 2));
  process.exit(1);
}

const sageStatusToHris = (code, name) => {
  const statusCode = String(code || '').trim().toUpperCase();
  const statusName = String(name || '').trim().toLowerCase();
  if (statusCode === 'A' || statusName === 'active') return 'Active';
  if (statusName.includes('leave')) return 'On Leave';
  if (statusName.includes('probation')) return 'Probation';
  if (statusName.includes('suspend')) return 'Suspended';
  if (statusName.includes('resign')) return 'Resigned';
  if (statusName.includes('termin')) return 'Terminated';
  if (statusName.includes('retire')) return 'Retired';
  if (statusName.includes('contract')) return 'Contract';
  // Sage 0465 carries status N but is on active payroll — HR confirmed Active.
  return 'Active';
};

const employmentStatus = sageStatusToHris(sage.statusCode, sage.statusName);
const rawPayload = JSON.stringify({ ...sage, directoryEmployeeCode: EMPLOYEE_CODE, confirmedName: FULL_NAME });

const dlePool = await new sql.ConnectionPool({
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
}).connect();

const importResult = await dlePool.request()
  .input('employee_code', sql.NVarChar(50), EMPLOYEE_CODE)
  .input('full_name', sql.NVarChar(250), FULL_NAME)
  .input('employment_status', sql.VarChar(40), employmentStatus)
  .input('employment_type', sql.VarChar(40), 'Permanent')
  .input('source_employee_id', sql.NVarChar(80), String(sage.employeeId))
  .input('title', sql.NVarChar(30), sage.title || null)
  .input('first_name', sql.NVarChar(100), 'ABE')
  .input('middle_name', sql.NVarChar(100), 'OLUFUNKE')
  .input('last_name', sql.NVarChar(100), 'COMFORT')
  .input('gender', sql.NVarChar(40), sage.gender || null)
  .input('date_of_birth', sql.Date, sage.birthDate || null)
  .input('nationality', sql.NVarChar(100), sage.nationality || null)
  .input('official_email', sql.NVarChar(320), sage.emailAddress || null)
  .input('primary_phone', sql.NVarChar(50), sage.cellNo || null)
  .input('alternate_phone', sql.NVarChar(50), sage.workTelNo || null)
  .input('employee_type_name', sql.NVarChar(100), sage.hierarchyEmployeeTypeName || 'Permanent')
  .input('date_joined_group', sql.Date, sage.dateJoinedGroup || null)
  .input('date_engaged', sql.Date, sage.dateEngaged || null)
  .input('probation_end_date', sql.Date, sage.probationPeriodEndDate || null)
  .input('work_location', sql.NVarChar(150), sage.siteName || 'IDI_ORO')
  .input('expatriate_status', sql.NVarChar(80), 'Local')
  .input('job_title', sql.NVarChar(150), sage.jobTitle || null)
  .input('job_grade', sql.NVarChar(80), sage.jobGradeCode || sage.jobGrade || null)
  .input('department', sql.NVarChar(150), sage.departmentName || null)
  .input('department_code', sql.NVarChar(80), sage.departmentCode || null)
  .input('company_code', sql.NVarChar(80), sage.companyCode || 'DLE')
  .input('company_currency', sql.NVarChar(10), sage.companyCurrency || 'NGN')
  .input('payment_type', sql.NVarChar(100), sage.paymentType || null)
  .input('payment_run', sql.NVarChar(150), sage.paymentRunLong || 'Main Payment Run')
  .input('remuneration_definition', sql.NVarChar(250), sage.remunerationDefinition || null)
  .input('tax_no', sql.NVarChar(80), sage.taxNo || null)
  .input('bank_name', sql.NVarChar(150), BANK.bankName)
  .input('account_number', sql.NVarChar(50), BANK.accountNo)
  .input('branch_code', sql.NVarChar(50), BANK.branchCode)
  .input('account_name', sql.NVarChar(250), BANK.accountName)
  .input('annual_salary', sql.Decimal(19, 4), sage.annualSalary || null)
  .input('period_salary', sql.Decimal(19, 4), sage.periodSalary || null)
  .input('site_code', sql.NVarChar(150), sage.siteCode || null)
  .input('site_name', sql.NVarChar(150), sage.siteName || 'IDI_ORO')
  .input('manager_name', sql.NVarChar(250), sage.managerName || null)
  .input('source_employee_code', sql.NVarChar(80), sage.employeeCode)
  .input('source_entity_code', sql.NVarChar(80), sage.entityCode || null)
  .input('source_status_code', sql.NVarChar(80), sage.statusCode || null)
  .input('source_status_name', sql.NVarChar(150), sage.statusName || null)
  .input('raw_payload_json', sql.NVarChar(sql.MAX), rawPayload)
  .query(`
DECLARE @employee_id bigint;
DECLARE @was_insert bit = 0;

SELECT @employee_id = employee_id
FROM hris.EmployeeSourceRecords WITH (UPDLOCK, HOLDLOCK)
WHERE source_system = N'Sage 300 People Payroll' AND source_employee_id = @source_employee_id;

IF @employee_id IS NULL
  SELECT @employee_id = employee_id FROM hris.Employees WITH (UPDLOCK, HOLDLOCK) WHERE employee_code = @employee_code;

IF @employee_id IS NULL
BEGIN
  INSERT hris.Employees(employee_code, full_name, employment_status, employment_type)
  VALUES (@employee_code, @full_name, @employment_status, @employment_type);
  SET @employee_id = CONVERT(bigint, SCOPE_IDENTITY());
  SET @was_insert = 1;
END
ELSE
BEGIN
  UPDATE hris.Employees
  SET full_name = @full_name, employment_status = @employment_status, employment_type = @employment_type,
      modified_at = SYSUTCDATETIME(), modified_by = SUSER_SNAME()
  WHERE employee_id = @employee_id;
END;

MERGE hris.EmployeePersonalInfo AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET title = @title, first_name = @first_name, middle_name = @middle_name, last_name = @last_name,
  gender = @gender, date_of_birth = @date_of_birth, nationality = @nationality, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, title, first_name, middle_name, last_name, gender, date_of_birth, nationality)
VALUES (@employee_id, @title, @first_name, @middle_name, @last_name, @gender, @date_of_birth, @nationality);

MERGE hris.EmployeeContactInfo AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET official_email = @official_email, primary_phone = @primary_phone, alternate_phone = @alternate_phone, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, official_email, primary_phone, alternate_phone)
VALUES (@employee_id, @official_email, @primary_phone, @alternate_phone);

MERGE hris.EmployeeEmploymentInfo AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET staff_category = @employee_type_name, employee_category = @employee_type_name,
  date_joined = COALESCE(@date_joined_group, @date_engaged), probation_end_date = @probation_end_date,
  work_location = @work_location, expatriate_status = @expatriate_status, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, staff_category, employee_category, date_joined, probation_end_date, work_location, expatriate_status)
VALUES (@employee_id, @employee_type_name, @employee_type_name, COALESCE(@date_joined_group, @date_engaged), @probation_end_date, @work_location, @expatriate_status);

MERGE hris.EmployeeJobInfo AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET job_title = @job_title, job_grade = @job_grade, department = @department, division = @department_code,
  business_unit = @company_code, cost_center = @department_code, project_site = @site_code, office_location = @site_name,
  reporting_manager = @manager_name, role_profile = @employee_type_name, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, job_title, job_grade, department, division, business_unit, cost_center, project_site, office_location, reporting_manager, role_profile)
VALUES (@employee_id, @job_title, @job_grade, @department, @department_code, @company_code, @department_code, @site_code, @site_name, @manager_name, @employee_type_name);

MERGE hris.EmployeePayrollSetup AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET payroll_group = @company_code, salary_grade = @job_grade, bank_name = @bank_name,
  branch_code = @branch_code, account_number = @account_number, account_name = @account_name,
  tax_identification_number = @tax_no, pay_currency = @company_currency, payment_type = @payment_type,
  payment_run = @payment_run, remuneration_structure = @remuneration_definition,
  annual_salary = @annual_salary, period_salary = @period_salary, setup_assigned_to_payroll = 1, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, payroll_group, salary_grade, bank_name, branch_code, account_number, account_name,
  tax_identification_number, pay_currency, payment_type, payment_run, remuneration_structure, annual_salary, period_salary, setup_assigned_to_payroll)
VALUES (@employee_id, @company_code, @job_grade, @bank_name, @branch_code, @account_number, @account_name,
  @tax_no, @company_currency, @payment_type, @payment_run, @remuneration_definition, @annual_salary, @period_salary, 1);

MERGE hris.EmployeeSourceRecords AS target
USING (SELECT N'Sage 300 People Payroll' AS source_system, @source_employee_id AS source_employee_id) AS source
ON target.source_system = source.source_system AND target.source_employee_id = source.source_employee_id
WHEN MATCHED THEN UPDATE SET employee_id = @employee_id, source_employee_code = @source_employee_code, source_entity_code = @source_entity_code,
  source_company_code = @company_code, source_status_code = @source_status_code, source_status_name = @source_status_name,
  raw_payload_json = @raw_payload_json, imported_at = SYSUTCDATETIME(), imported_by = SUSER_SNAME()
WHEN NOT MATCHED THEN INSERT (employee_id, source_system, source_employee_id, source_employee_code, source_entity_code, source_company_code, source_status_code, source_status_name, raw_payload_json)
VALUES (@employee_id, N'Sage 300 People Payroll', @source_employee_id, @source_employee_code, @source_entity_code, @company_code, @source_status_code, @source_status_name, @raw_payload_json);

INSERT hris.EmployeeAuditLog(employee_id, audit_action, performed_by, reason, new_value)
SELECT @employee_id, N'Sage payroll employee import', SUSER_SNAME(), N'Manual import — ABE OLUFUNKE COMFORT confirmed as Sage 0465', LEFT(@raw_payload_json, 3500)
WHERE @employee_id IS NOT NULL;

SELECT @employee_id AS employee_id, @was_insert AS was_insert;
`);

const verify = await dlePool.request()
  .input('employee_code', sql.NVarChar(20), EMPLOYEE_CODE)
  .query(`
    SELECT e.employee_code, e.full_name, e.employment_status, e.employment_type,
      ps.payroll_group, ps.pay_currency, ps.bank_name, ps.account_number, ps.account_name, ps.setup_assigned_to_payroll,
      src.source_employee_id, src.source_company_code
    FROM hris.Employees e
    LEFT JOIN hris.EmployeePayrollSetup ps ON ps.employee_id = e.employee_id
    LEFT JOIN hris.EmployeeSourceRecords src ON src.employee_id = e.employee_id AND src.source_system = N'Sage 300 People Payroll'
    WHERE e.employee_code = @employee_code;
  `);

await dlePool.close();

const identitiesPath = resolve('apps/dashboard/data/hris/payroll-payslip-identities.json');
const identities = JSON.parse(readFileSync(identitiesPath, 'utf8'));
const idx = identities.findIndex((row) => String(row.employeeCode || row.employeeId || '').replace(/^P/i, '') === SOURCE_CODE);
if (idx >= 0) {
  identities[idx] = {
    ...identities[idx],
    employeeId: EMPLOYEE_CODE,
    employeeCode: EMPLOYEE_CODE,
    sourceEmployeeCode: SOURCE_CODE,
    fullName: FULL_NAME,
    bankName: BANK.bankName,
    accountNo: BANK.accountNo,
    branchCode: BANK.branchCode,
    accountName: BANK.accountName,
    payrollGroup: 'DLE',
    payCurrency: 'NGN',
    location: 'IDI - IDI_ORO',
    sourceSystem: 'Sage Payroll',
    migratedAt: new Date().toISOString(),
    migratedBy: 'Manual Sage import — ABE OLUFUNKE COMFORT',
  };
  writeFileSync(identitiesPath, `${JSON.stringify(identities, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  sageEmployee: sage,
  importResult: importResult.recordset[0],
  hrisRecord: verify.recordset[0],
  identityUpdated: idx >= 0,
}, null, 2));
