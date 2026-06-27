/**
 * Import a single Sage employee into DLE_Enterprise HRIS.
 * Usage: npx tsx --tsconfig apps/dashboard/tsconfig.json scripts/import-sage-employee.mts 0465
 */
import { readFileSync } from 'node:fs';
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

import { importSagePayrollEmployeesToDb, loadWorkspaceEnv, type SagePayrollEmployeeImportRow } from '../apps/dashboard/lib/dle-enterprise-db.ts';

const targetCode = (process.argv[2] || '0465').replace(/^P/i, '');
const FULL_NAME_OVERRIDE = process.env.HRIS_IMPORT_FULL_NAME || 'Mrs ABE OLUFUNKE COMFORT';
const BANK_OVERRIDE = {
  bankName: 'Zenith Bank Plc',
  accountNo: '2383082901',
  branchCode: '1',
  accountName: 'ABE OLUFUNKE COMFORT',
};

loadWorkspaceEnv();

const sageConfig = {
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
  connectionTimeout: 20000,
  requestTimeout: 120000,
};

const dleConfig = {
  server: process.env.DLE_ENTERPRISE_DB_HOST,
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME,
  user: process.env.DLE_ENTERPRISE_DB_USER,
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
  },
};

const sageQuery = `
WITH latestContract AS (
  SELECT ec.EmployeeID, ec.ContractStartDate, ec.ContractExpiryDate,
    ROW_NUMBER() OVER (PARTITION BY ec.EmployeeID ORDER BY CASE WHEN ec.Active = 1 THEN 0 ELSE 1 END, ISNULL(ec.ContractStartDate, ec.TransactionDate) DESC, ec.EmployeeContractID DESC) AS rn
  FROM Employee.EmployeeContract ec
)
SELECT
  e.EmployeeID AS employeeId,
  e.EmployeeCode AS employeeCode,
  CONCAT('P', REPLACE(LTRIM(RTRIM(e.EmployeeCode)), '_', '')) AS directoryEmployeeCode,
  ed.EmployeeCodeDisplay AS employeeCodeDisplay,
  ge.EntityCode AS entityCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.DisplayName)), ''), ge.DisplayName) AS displayName,
  ed.Title AS title,
  ed.FirstNames AS firstNames,
  ed.SecondName AS middleName,
  ed.KnownAsName AS knownAsName,
  ed.LastName AS lastName,
  ed.Gender AS gender,
  ed.BirthDate AS birthDate,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.MaritalStatusDisplay)), ''), NULLIF(LTRIM(RTRIM(ed.MaritalStatusShortDescription)), '')) AS maritalStatus,
  ed.IDNumber AS idNumber,
  ed.PassportNo AS passportNo,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.EmailAddress)), ''), NULL) AS emailAddress,
  ed.HomeTelNo AS homeTelNo,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.CellNo)), ''), NULLIF(LTRIM(RTRIM(ed.WorkTelNo)), '')) AS cellNo,
  ed.WorkTelNo AS workTelNo,
  CONCAT_WS(', ', NULLIF(LTRIM(RTRIM(ed.PhysicalUnitPostalNumber)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalComplex)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalStreetNumber)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalStreetFarmName)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalSuburbDistrict)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalCityTown)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalProvince)), ''), NULLIF(LTRIM(RTRIM(ed.PhysicalCountryCode)), '')) AS physicalAddress,
  ed.PhysicalCityTown AS physicalCityTown,
  ed.PhysicalProvince AS physicalProvince,
  ed.PhysicalCountryCode AS physicalCountryCode,
  ed.PhysicalPostalCode AS physicalPostalCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.PostalConcat)), ''), ed.PostalCityTown) AS postalAddress,
  ed.PostalCityTown AS postalCityTown,
  ed.PostalPostalCode AS postalPostalCode,
  ed.JobTitle AS jobTitle,
  ed.JobTitleCode AS jobTitleCode,
  ed.JobGrade AS jobGrade,
  ed.JobGradeCode AS jobGradeCode,
  ed.HierarchyCodeB AS departmentCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS departmentName,
  ed.HierarchyCode AS siteCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HAName)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyName)), '')) AS siteName,
  ed.HierarchyCode AS hierarchyLocationCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HAName)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyName)), '')) AS hierarchyLocationName,
  ed.HierarchyCodeB AS hierarchyDepartmentCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS hierarchyDepartmentName,
  ed.HierarchyCodeC AS hierarchyEmployeeTypeCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameC)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameC)), '')) AS hierarchyEmployeeTypeName,
  e.ReportToEmployeeID AS managerEmployeeId,
  mgr.EmployeeCode AS managerEmployeeCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.ReportsToEmployeeDisplay)), ''), mgrge.DisplayName) AS managerName,
  ed.Nationality AS nationality,
  ed.DateEngaged AS dateEngaged,
  ed.DateJoinedGroup AS dateJoinedGroup,
  ed.ProbationPeriodEndDate AS probationPeriodEndDate,
  lc.ContractStartDate AS contractStartDate,
  lc.ContractExpiryDate AS contractExpiryDate,
  c.CompanyCode AS companyCode,
  cge.DisplayName AS companyName,
  c.CompanyCCY AS companyCurrency,
  ed.PaymentRunDefShort AS paymentRunShort,
  ed.PaymentRunDefLong AS paymentRunLong,
  ed.PaymentTypeCode AS paymentTypeCode,
  ed.PaymentType AS paymentType,
  ed.RemunerationDefinitionHeaderDisplay AS remunerationDefinition,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.TaxNo)), ''), NULLIF(LTRIM(RTRIM(ge.TaxNo)), '')) AS taxNo,
  ed.BankName AS bankName,
  ed.BankCode AS bankCode,
  ed.BranchName AS branchName,
  ed.BranchCode AS branchCode,
  ed.AccountNo AS accountNo,
  ed.AccountName AS accountName,
  ed.AccountTypeID AS accountTypeId,
  ed.AnnualSalary AS annualSalary,
  ed.PeriodSalary AS periodSalary,
  ed.RatePerHour AS ratePerHour,
  ed.RatePerDay AS ratePerDay,
  ed.HoursPerDay AS hoursPerDay,
  ed.HoursPerPeriod AS hoursPerPeriod,
  ed.WorkMonday AS workMonday,
  ed.WorkTuesday AS workTuesday,
  ed.WorkWednesday AS workWednesday,
  ed.WorkThursday AS workThursday,
  ed.WorkFriday AS workFriday,
  ed.WorkSaturday AS workSaturday,
  ed.WorkSunday AS workSunday,
  es.Code AS statusCode,
  es.ShortDescription AS statusName,
  e.TerminationDate AS terminationDate,
  NULL AS sageEmployeeJson,
  NULL AS sageEmployeeDetailJson,
  NULL AS sageEmployeeContractJson,
  NULL AS sageEntityJson,
  NULL AS sageCompanyJson,
  NULL AS sageEmployeeStatusJson
FROM Employee.Employee e
JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
JOIN Company.Company c ON c.CompanyID = e.CompanyID
JOIN Entity.GenEntity cge ON cge.GenEntityID = c.GenEntityID
LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
LEFT JOIN Employee.Employee mgr ON mgr.EmployeeID = e.ReportToEmployeeID
LEFT JOIN Entity.GenEntity mgrge ON mgrge.GenEntityID = mgr.GenEntityID
LEFT JOIN latestContract lc ON lc.EmployeeID = e.EmployeeID AND lc.rn = 1
WHERE REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') IN (@code, CONCAT('P', @code))
   OR e.EmployeeID = TRY_CONVERT(int, @code);
`;

const sagePool = await new sql.ConnectionPool(sageConfig).connect();
const { recordset } = await sagePool.request()
  .input('code', sql.NVarChar(20), targetCode)
  .query(sageQuery);
await sagePool.close();

if (!recordset.length) {
  console.error(JSON.stringify({ error: `Sage employee ${targetCode} not found` }, null, 2));
  process.exit(1);
}

const sageEmployee = recordset[0] as SagePayrollEmployeeImportRow;
sageEmployee.bankName = sageEmployee.bankName || BANK_OVERRIDE.bankName;
sageEmployee.accountNo = sageEmployee.accountNo || BANK_OVERRIDE.accountNo;
sageEmployee.branchCode = sageEmployee.branchCode || BANK_OVERRIDE.branchCode;
sageEmployee.accountName = sageEmployee.accountName || BANK_OVERRIDE.accountName;

const importResult = await importSagePayrollEmployeesToDb([sageEmployee]);
if (!importResult) {
  console.error(JSON.stringify({ error: 'DLE_Enterprise database unavailable' }, null, 2));
  process.exit(1);
}

const employeeCode = `P${targetCode}`;
const dlePool = await new sql.ConnectionPool(dleConfig).connect();
await dlePool.request()
  .input('employee_code', sql.NVarChar(20), employeeCode)
  .input('full_name', sql.NVarChar(250), FULL_NAME_OVERRIDE)
  .input('bank_name', sql.NVarChar(150), BANK_OVERRIDE.bankName)
  .input('account_number', sql.NVarChar(50), BANK_OVERRIDE.accountNo)
  .input('branch_code', sql.NVarChar(50), BANK_OVERRIDE.branchCode)
  .input('account_name', sql.NVarChar(250), BANK_OVERRIDE.accountName)
  .input('payroll_group', sql.NVarChar(80), 'DLE')
  .input('pay_currency', sql.NVarChar(10), 'NGN')
  .input('setup_assigned', sql.Bit, 1)
  .query(`
    UPDATE e SET full_name = @full_name, modified_at = SYSUTCDATETIME()
    FROM hris.Employees e WHERE e.employee_code = @employee_code;

    UPDATE ps SET
      bank_name = @bank_name,
      account_number = @account_number,
      branch_code = @branch_code,
      account_name = @account_name,
      payroll_group = @payroll_group,
      pay_currency = @pay_currency,
      setup_assigned_to_payroll = @setup_assigned,
      modified_at = SYSUTCDATETIME()
    FROM hris.EmployeePayrollSetup ps
    JOIN hris.Employees e ON e.employee_id = ps.employee_id
    WHERE e.employee_code = @employee_code;

    UPDATE pinfo SET
      first_name = N'ABE',
      middle_name = N'OLUFUNKE',
      last_name = N'COMFORT',
      modified_at = SYSUTCDATETIME()
    FROM hris.EmployeePersonalInfo pinfo
    JOIN hris.Employees e ON e.employee_id = pinfo.employee_id
    WHERE e.employee_code = @employee_code;
  `);

const verify = await dlePool.request()
  .input('employee_code', sql.NVarChar(20), employeeCode)
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

// Update payslip identity: 0465 -> P0465
const identitiesPath = resolve('apps/dashboard/data/hris/payroll-payslip-identities.json');
const identities = JSON.parse(readFileSync(identitiesPath, 'utf8'));
const idx = identities.findIndex((row: { employeeCode?: string; employeeId?: string }) =>
  String(row.employeeCode || row.employeeId || '').replace(/^P/i, '') === targetCode);
if (idx >= 0) {
  identities[idx] = {
    ...identities[idx],
    employeeId: employeeCode,
    employeeCode,
    sourceEmployeeCode: targetCode,
    fullName: FULL_NAME_OVERRIDE,
    bankName: BANK_OVERRIDE.bankName,
    accountNo: BANK_OVERRIDE.accountNo,
    branchCode: BANK_OVERRIDE.branchCode,
    accountName: BANK_OVERRIDE.accountName,
    payrollGroup: 'DLE',
    payCurrency: 'NGN',
    sourceSystem: 'Sage Payroll',
    migratedAt: new Date().toISOString(),
    migratedBy: 'Manual Sage import — ABE OLUFUNKE COMFORT',
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(identitiesPath, `${JSON.stringify(identities, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  sageEmployee: {
    employeeId: sageEmployee.employeeId,
    employeeCode: sageEmployee.employeeCode,
    displayName: sageEmployee.displayName,
    statusCode: sageEmployee.statusCode,
    statusName: sageEmployee.statusName,
    companyCode: sageEmployee.companyCode,
    jobTitle: sageEmployee.jobTitle,
    jobGrade: sageEmployee.jobGrade,
  },
  importResult,
  hrisRecord: verify.recordset[0] || null,
  identityUpdated: idx >= 0,
}, null, 2));
