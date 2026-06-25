/**
 * Audit and backfill employee profile fields from Sage DLE_JUNE into DLE_Enterprise.
 * Fills missing DOB, date joined, gender, marital status, addresses, job, payroll setup, etc.
 *
 * Usage:
 *   node scripts/database/sync-sage-employee-profiles.js --audit-only
 *   node scripts/database/sync-sage-employee-profiles.js --apply
 *   node scripts/database/sync-sage-employee-profiles.js --apply --limit=50
 */
const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

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
const nullable = (value) => {
  const text = clean(value);
  return text || null;
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const numOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const employeeCode = (rawCode) => {
  const code = clean(rawCode).replace(/_/g, '').toUpperCase();
  if (!code) return '';
  if (/^(P|C|L|IT|NYSC|N|I)/.test(code)) return code;
  return `P${code}`;
};

const employeeType = (code) => {
  if (/^C/i.test(code)) return 'Daily Rate';
  if (/^L/i.test(code)) return 'Lumpsum';
  return 'Permanent';
};

const sageStatus = (statusName, statusCode) => {
  const code = clean(statusCode).toUpperCase();
  const name = clean(statusName).toLowerCase();
  if (code === 'T' || name.includes('terminat')) return 'Terminated';
  if (code === 'S' || name.includes('suspend')) return 'Suspended';
  return 'Active';
};

const fullName = (row) => {
  const firstNames = clean(row.firstNames);
  const middleName = clean(row.middleName);
  return [
    clean(row.title),
    firstNames,
    middleName && !firstNames.toLowerCase().includes(middleName.toLowerCase()) ? middleName : '',
    clean(row.lastName),
  ].filter(Boolean).join(' ') || clean(row.displayName) || employeeCode(row.employeeCode);
};

const concatAddress = (...parts) => parts.map(clean).filter(Boolean).join(', ');

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
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 600000),
});

const dleConfig = () => ({
  server: process.env.DLE_ENTERPRISE_DB_HOST || '192.168.5.5',
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise',
  user: process.env.DLE_ENTERPRISE_DB_USER || 'sa',
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD || '',
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
  },
  connectionTimeout: 15000,
  requestTimeout: 600000,
});

const SAGE_PROFILE_QUERY = `
WITH latestContract AS (
  SELECT
    ec.EmployeeID,
    ec.ContractStartDate,
    ec.ContractExpiryDate,
    ROW_NUMBER() OVER (
      PARTITION BY ec.EmployeeID
      ORDER BY
        CASE WHEN ec.Active = 1 THEN 0 ELSE 1 END,
        ISNULL(ec.ContractStartDate, ec.TransactionDate) DESC,
        ec.EmployeeContractID DESC
    ) AS rn
  FROM Employee.EmployeeContract ec
),
latestPayslipPeriods AS (
  SELECT
    epp.EmployeeID,
    p.PayslipID,
    ROW_NUMBER() OVER (
      PARTITION BY epp.EmployeeID
      ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC
    ) AS rn
  FROM Employee.EmployeePayPeriod epp
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
),
latestPayslipDeductions AS (
  SELECT
    lp.EmployeeID,
    SUM(ISNULL(pdl.Total, 0)) AS totalDeductions,
    SUM(CASE
      WHEN (UPPER(dd.DefCode) IN ('PENSION', 'PENSION_EE', 'PENSION_EE2', 'PENSION_BONGA', 'PENARR', 'VOLPENS')
        OR UPPER(dd.ShortDescription) LIKE '%PENSION%') AND UPPER(dd.DefCode) <> 'SUSPENSION'
      THEN ISNULL(pdl.Total, 0) ELSE 0 END) AS pensionEmployee
  FROM latestPayslipPeriods lp
  JOIN Payroll.PayslipDeductionLine pdl ON pdl.PayslipID = lp.PayslipID
  JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
  WHERE lp.rn = 1
  GROUP BY lp.EmployeeID
),
latestPayslipContributions AS (
  SELECT
    lp.EmployeeID,
    SUM(CASE WHEN ccd.DefCode = 'PENSION_ER' THEN ISNULL(pccl.Total, 0) ELSE 0 END) AS pensionEmployer
  FROM latestPayslipPeriods lp
  JOIN Payroll.PayslipCompanyContributionLine pccl ON pccl.PayslipID = lp.PayslipID
  JOIN Payroll.CompanyContributionDef ccd ON ccd.CompanyContributionDefID = pccl.DefID
  WHERE lp.rn = 1
  GROUP BY lp.EmployeeID
),
latestPayslipGross AS (
  SELECT
    lp.EmployeeID,
    SUM(ISNULL(pel.Total, 0)) AS grossPay
  FROM latestPayslipPeriods lp
  JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = lp.PayslipID
  WHERE lp.rn = 1
  GROUP BY lp.EmployeeID
)
SELECT
  e.EmployeeID AS employeeId,
  e.EmployeeCode AS employeeCode,
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
  ed.Nationality AS nationality,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.email)), ''), NULLIF(LTRIM(RTRIM(ed.EmailAddress)), '')) AS emailAddress,
  ed.HomeTelNo AS homeTelNo,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.phone_number)), ''), NULLIF(LTRIM(RTRIM(ed.CellNo)), ''), NULLIF(LTRIM(RTRIM(ed.WorkTelNo)), '')) AS cellNo,
  ed.WorkTelNo AS workTelNo,
  CONCAT_WS(', ',
    NULLIF(LTRIM(RTRIM(ed.PhysicalUnitPostalNumber)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalComplex)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalStreetNumber)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalStreetFarmName)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalSuburbDistrict)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalCityTown)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalProvince)), ''),
    NULLIF(LTRIM(RTRIM(ed.PhysicalCountryCode)), '')
  ) AS physicalAddress,
  ed.PhysicalCityTown AS physicalCityTown,
  ed.PhysicalProvince AS physicalProvince,
  ed.PhysicalCountryCode AS physicalCountryCode,
  ed.PhysicalPostalCode AS physicalPostalCode,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.PostalConcat)), ''), CONCAT_WS(', ',
    NULLIF(LTRIM(RTRIM(ed.PostalUnitPostalNumber)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalComplex)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalStreetNumber)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalStreetFarmName)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalSuburbDistrict)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalCityTown)), ''),
    NULLIF(LTRIM(RTRIM(ed.PostalProvince)), '')
  )) AS postalAddress,
  ed.PostalCityTown AS postalCityTown,
  ed.PostalPostalCode AS postalPostalCode,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.job_title)), ''), NULLIF(LTRIM(RTRIM(ed.JobTitle)), '')) AS jobTitle,
  ed.JobTitleCode AS jobTitleCode,
  ed.JobGrade AS jobGrade,
  ed.JobGradeCode AS jobGradeCode,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.department_code)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyCodeB)), '')) AS departmentCode,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.department_name)), ''), NULLIF(LTRIM(RTRIM(ed.HANameB)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameB)), '')) AS departmentName,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.site_code)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyCode)), '')) AS siteCode,
  COALESCE(NULLIF(LTRIM(RTRIM(sd.site_name)), ''), NULLIF(LTRIM(RTRIM(ed.HAName)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyName)), '')) AS siteName,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.HANameC)), ''), NULLIF(LTRIM(RTRIM(ed.HierarchyNameC)), '')) AS hierarchyEmployeeTypeName,
  COALESCE(
    NULLIF(LTRIM(RTRIM(ed.ReportsToEmployeeDisplay)), ''),
    mgrge.DisplayName,
    reverseMgrGe.DisplayName
  ) AS managerName,
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
  ed.PaymentType AS paymentType,
  ed.RemunerationDefinitionHeaderDisplay AS remunerationDefinition,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.TaxNo)), ''), NULLIF(LTRIM(RTRIM(ge.TaxNo)), '')) AS taxNo,
  ed.BankName AS bankName,
  ed.BankCode AS bankCode,
  ed.BranchName AS branchName,
  ed.BranchCode AS branchCode,
  ed.AccountNo AS accountNo,
  ed.AccountName AS accountName,
  ed.AnnualSalary AS annualSalary,
  ed.PeriodSalary AS periodSalary,
  ed.RatePerDay AS ratePerDay,
  ed.RatePerHour AS ratePerHour,
  ed.HoursPerDay AS hoursPerDay,
  ed.HoursPerPeriod AS hoursPerPeriod,
  lpg.grossPay AS latestGrossPay,
  lpd.totalDeductions AS latestTotalDeductions,
  CASE
    WHEN ISNULL(lpd.pensionEmployee, 0) <> 0 OR ISNULL(lpc.pensionEmployer, 0) <> 0 THEN 'Pension Fund'
    ELSE NULL
  END AS pensionProvider,
  es.Code AS statusCode,
  es.ShortDescription AS statusName
FROM Employee.Employee e
JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
JOIN Company.Company c ON c.CompanyID = e.CompanyID
JOIN Entity.GenEntity cge ON cge.GenEntityID = c.GenEntityID
LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
LEFT JOIN dbo.vw_ServiceDesk_Employees sd ON sd.external_employee_id = CAST(e.EmployeeID AS varchar(50))
LEFT JOIN Employee.Employee mgr ON mgr.EmployeeID = e.ReportToEmployeeID
LEFT JOIN Entity.GenEntity mgrge ON mgrge.GenEntityID = mgr.GenEntityID
LEFT JOIN Employee.EmployeesReportsToMeView reverseManager ON reverseManager.EmployeeID = e.EmployeeID
LEFT JOIN Employee.Employee reverseMgr ON reverseMgr.EmployeeID = reverseManager.ReportToEmployeeID
LEFT JOIN Entity.GenEntity reverseMgrGe ON reverseMgrGe.GenEntityID = reverseMgr.GenEntityID
LEFT JOIN latestContract lc ON lc.EmployeeID = e.EmployeeID AND lc.rn = 1
LEFT JOIN latestPayslipDeductions lpd ON lpd.EmployeeID = e.EmployeeID
LEFT JOIN latestPayslipContributions lpc ON lpc.EmployeeID = e.EmployeeID
LEFT JOIN latestPayslipGross lpg ON lpg.EmployeeID = e.EmployeeID
WHERE e.TerminationDate IS NULL
  AND ISNULL(es.Code, 'A') = 'A'
  AND ge.Status = 'A'
  AND c.Status = 'A'
ORDER BY e.EmployeeCode;
`;

const readSageProfiles = async (limit = 0) => {
  const pool = await new sql.ConnectionPool(sageConfig()).connect();
  try {
    const top = limit > 0 ? `TOP (${limit})` : '';
    const query = SAGE_PROFILE_QUERY.replace('SELECT\n  e.EmployeeID', `SELECT ${top}\n  e.EmployeeID`);
    const result = await pool.request().query(query);
    return result.recordset;
  } finally {
    await pool.close();
  }
};

const readDleProfiles = async (pool) => {
  const result = await pool.request().query(`
    SELECT
      e.employee_id,
      e.employee_code,
      e.full_name,
      e.employment_status,
      src.source_employee_id,
      p.title,
      p.first_name,
      p.middle_name,
      p.last_name,
      p.preferred_name,
      p.gender,
      p.date_of_birth,
      p.marital_status,
      p.nationality,
      c.official_email,
      c.primary_phone,
      c.alternate_phone,
      c.residential_address,
      c.city,
      c.state,
      c.country,
      emp.date_joined,
      emp.probation_end_date,
      emp.contract_start_date,
      emp.contract_end_date,
      emp.work_location,
      emp.staff_category,
      j.job_title,
      j.job_grade,
      j.department,
      j.reporting_manager,
      pay.bank_name,
      pay.account_number,
      pay.tax_identification_number,
      pay.pension_provider,
      pay.basic_salary,
      pay.period_salary,
      pay.latest_allowances,
      pay.latest_deductions
    FROM [hris].[Employees] e
    OUTER APPLY (
      SELECT TOP 1 src.source_employee_id
      FROM [hris].[EmployeeSourceRecords] src
      WHERE src.employee_id = e.employee_id
        AND src.source_system = N'Sage 300 People Payroll'
      ORDER BY TRY_CONVERT(int, src.source_employee_id), src.source_employee_id
    ) src
    LEFT JOIN [hris].[EmployeePersonalInfo] p ON p.employee_id = e.employee_id
    LEFT JOIN [hris].[EmployeeContactInfo] c ON c.employee_id = e.employee_id
    LEFT JOIN [hris].[EmployeeEmploymentInfo] emp ON emp.employee_id = e.employee_id
    LEFT JOIN [hris].[EmployeeJobInfo] j ON j.employee_id = e.employee_id
    LEFT JOIN [hris].[EmployeePayrollSetup] pay ON pay.employee_id = e.employee_id
    WHERE e.employment_status <> 'Terminated'
  `);
  return result.recordset;
};

const auditGaps = (sageRows, dleByCode, dleBySourceId) => {
  const gaps = {
    sageTotal: sageRows.length,
    missingInDle: [],
    missingDob: [],
    missingDateJoined: [],
    wrongDateJoined: [],
    missingGender: [],
    missingMaritalStatus: [],
    missingNationality: [],
    missingJobTitle: [],
    missingDepartment: [],
    missingEmail: [],
    missingPhone: [],
    missingBank: [],
    missingTaxNo: [],
    missingPension: [],
    sageHasDobButDleMissing: 0,
    sageHasDateJoinedButDleMissing: 0,
    sageDateJoinedMismatch: 0,
    backfillCandidates: 0,
  };

  const sameDay = (a, b) => {
    if (!a || !b) return false;
    return a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate();
  };

  for (const sage of sageRows) {
    const code = employeeCode(sage.employeeCode);
    const sourceId = clean(sage.employeeId);
    let dle = dleBySourceId.get(sourceId);
    const byCode = dleByCode.get(code);
    if (!dle && !byCode) {
      gaps.missingInDle.push({ code, sourceId, name: fullName(sage) });
      gaps.backfillCandidates += 1;
      continue;
    }
    if (!dle) {
      if (!byCode || clean(byCode.source_employee_id) !== sourceId) continue;
      dle = byCode;
    }

    const sageDob = toDate(sage.birthDate);
    const sageJoined = toDate(sage.dateJoinedGroup || sage.dateEngaged);
    const needsDob = sageDob && !dle.date_of_birth;
    const needsJoined = sageJoined && !dle.date_joined;
    if (needsDob) {
      gaps.missingDob.push({ code, name: dle.full_name || fullName(sage) });
      gaps.sageHasDobButDleMissing += 1;
      gaps.backfillCandidates += 1;
    }
    if (needsJoined) {
      gaps.missingDateJoined.push({ code, name: dle.full_name || fullName(sage) });
      gaps.sageHasDateJoinedButDleMissing += 1;
      gaps.backfillCandidates += 1;
    } else if (sageJoined && dle.date_joined) {
      const dleJoined = toDate(dle.date_joined);
      if (dleJoined && !sameDay(sageJoined, dleJoined)) {
        gaps.wrongDateJoined.push({
          code,
          name: dle.full_name || fullName(sage),
          dleDate: dleJoined.toISOString().slice(0, 10),
          sageDate: sageJoined.toISOString().slice(0, 10),
        });
        gaps.sageDateJoinedMismatch += 1;
        gaps.backfillCandidates += 1;
      }
    }
    if (nullable(sage.gender) && !nullable(dle.gender)) gaps.missingGender.push(code);
    if (nullable(sage.maritalStatus) && !nullable(dle.marital_status)) gaps.missingMaritalStatus.push(code);
    if (nullable(sage.nationality) && !nullable(dle.nationality)) gaps.missingNationality.push(code);
    if (nullable(sage.jobTitle) && !nullable(dle.job_title)) gaps.missingJobTitle.push(code);
    if (nullable(sage.departmentName) && !nullable(dle.department)) gaps.missingDepartment.push(code);
    if (nullable(sage.emailAddress) && !nullable(dle.official_email)) gaps.missingEmail.push(code);
    if (nullable(sage.cellNo) && !nullable(dle.primary_phone)) gaps.missingPhone.push(code);
    if (nullable(sage.bankName) && !nullable(dle.bank_name)) gaps.missingBank.push(code);
    if (nullable(sage.taxNo) && !nullable(dle.tax_identification_number)) gaps.missingTaxNo.push(code);
    if (nullable(sage.pensionProvider) && !nullable(dle.pension_provider)) gaps.missingPension.push(code);
  }

  return gaps;
};

const ensurePayrollColumns = async (pool) => {
  await pool.request().query(`
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'latest_allowances') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD latest_allowances decimal(19,4) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'latest_deductions') IS NULL
      ALTER TABLE [hris].[EmployeePayrollSetup] ADD latest_deductions decimal(19,4) NULL;
  `);
};

const upsertProfile = async (pool, row) => {
  const code = employeeCode(row.employeeCode);
  const sourceEmployeeId = clean(row.employeeId);
  const name = fullName(row);
  const type = employeeType(code);
  const status = sageStatus(row.statusName, row.statusCode);
  const nationality = nullable(row.nationality);
  const isExpatriate = nationality && !/^(nigeria|nigerian)$/i.test(nationality) ? 'Expatriate' : 'Local';
  const dateJoinedGroup = toDate(row.dateJoinedGroup);
  const dateEngaged = toDate(row.dateEngaged);
  const periodSalary = numOrNull(row.periodSalary) ?? (numOrNull(row.ratePerDay) ? numOrNull(row.ratePerDay) * 22 : null);
  const basicSalary = periodSalary ?? numOrNull(row.ratePerDay);
  const grossPay = numOrNull(row.latestGrossPay);
  const latestAllowances = grossPay && periodSalary && grossPay > periodSalary ? grossPay - periodSalary : null;
  const latestDeductions = numOrNull(row.latestTotalDeductions);
  const salaryGrade = nullable(row.hierarchyEmployeeTypeName) || nullable(row.jobGradeCode || row.jobGrade) || type;
  const physicalAddress = nullable(row.physicalAddress) || concatAddress(
    row.physicalCityTown,
    row.physicalProvince,
    row.physicalCountryCode,
  );
  const postalAddress = nullable(row.postalAddress) || physicalAddress;
  const rawPayload = JSON.stringify({ ...row, directoryEmployeeCode: code });

  const request = pool
    .request()
    .input('employee_code', sql.NVarChar(50), code)
    .input('full_name', sql.NVarChar(250), name)
    .input('employment_status', sql.VarChar(40), status)
    .input('employment_type', sql.VarChar(40), type)
    .input('source_employee_id', sql.NVarChar(80), sourceEmployeeId)
    .input('title', sql.NVarChar(30), nullable(row.title))
    .input('first_name', sql.NVarChar(100), nullable(row.firstNames) || name)
    .input('middle_name', sql.NVarChar(100), nullable(row.middleName))
    .input('last_name', sql.NVarChar(100), nullable(row.lastName) || name)
    .input('preferred_name', sql.NVarChar(150), nullable(row.knownAsName))
    .input('gender', sql.NVarChar(40), nullable(row.gender))
    .input('date_of_birth', sql.Date, toDate(row.birthDate))
    .input('marital_status', sql.NVarChar(50), nullable(row.maritalStatus))
    .input('nationality', sql.NVarChar(100), nationality)
    .input('official_email', sql.NVarChar(320), nullable(row.emailAddress))
    .input('primary_phone', sql.NVarChar(50), nullable(row.cellNo))
    .input('alternate_phone', sql.NVarChar(50), nullable(row.homeTelNo))
    .input('office_extension', sql.NVarChar(30), nullable(row.workTelNo))
    .input('residential_address', sql.NVarChar(1000), physicalAddress)
    .input('permanent_address', sql.NVarChar(1000), postalAddress)
    .input('city', sql.NVarChar(120), nullable(row.physicalCityTown || row.postalCityTown))
    .input('state', sql.NVarChar(120), nullable(row.physicalProvince))
    .input('country', sql.NVarChar(120), nullable(row.physicalCountryCode))
    .input('postal_code', sql.NVarChar(30), nullable(row.physicalPostalCode || row.postalPostalCode))
    .input('employee_type_name', sql.NVarChar(100), nullable(row.hierarchyEmployeeTypeName) || type)
    .input('date_joined_group', sql.Date, dateJoinedGroup)
    .input('date_engaged', sql.Date, dateEngaged)
    .input('probation_end_date', sql.Date, toDate(row.probationPeriodEndDate))
    .input('contract_start_date', sql.Date, toDate(row.contractStartDate))
    .input('contract_end_date', sql.Date, toDate(row.contractExpiryDate))
    .input('work_location', sql.NVarChar(150), nullable(row.siteName))
    .input('expatriate_status', sql.NVarChar(80), isExpatriate)
    .input('job_title', sql.NVarChar(150), nullable(row.jobTitle))
    .input('job_grade', sql.NVarChar(80), nullable(row.jobGradeCode || row.jobGrade))
    .input('designation', sql.NVarChar(150), nullable(row.jobTitleCode))
    .input('department', sql.NVarChar(150), nullable(row.departmentName))
    .input('department_code', sql.NVarChar(80), nullable(row.departmentCode))
    .input('company_code', sql.NVarChar(80), nullable(row.companyCode))
    .input('company_currency', sql.NVarChar(10), nullable(row.companyCurrency))
    .input('manager_name', sql.NVarChar(250), nullable(row.managerName))
    .input('payment_run', sql.NVarChar(80), nullable(row.paymentRunShort || row.paymentRunLong))
    .input('payment_type', sql.NVarChar(80), nullable(row.paymentType))
    .input('remuneration_definition', sql.NVarChar(150), nullable(row.remunerationDefinition))
    .input('bank_name', sql.NVarChar(150), nullable(row.bankName))
    .input('bank_code', sql.NVarChar(50), nullable(row.bankCode))
    .input('branch_name', sql.NVarChar(150), nullable(row.branchName))
    .input('branch_code', sql.NVarChar(50), nullable(row.branchCode))
    .input('account_number', sql.NVarChar(80), nullable(row.accountNo))
    .input('account_name', sql.NVarChar(150), nullable(row.accountName))
    .input('pension_provider', sql.NVarChar(150), nullable(row.pensionProvider))
    .input('tax_no', sql.NVarChar(80), nullable(row.taxNo))
    .input('basic_salary', sql.Decimal(19, 4), basicSalary)
    .input('period_salary', sql.Decimal(19, 4), periodSalary)
    .input('annual_salary', sql.Decimal(19, 4), numOrNull(row.annualSalary))
    .input('rate_per_day', sql.Decimal(19, 4), numOrNull(row.ratePerDay))
    .input('rate_per_hour', sql.Decimal(19, 4), numOrNull(row.ratePerHour))
    .input('hours_per_day', sql.Decimal(9, 4), numOrNull(row.hoursPerDay))
    .input('hours_per_period', sql.Decimal(9, 4), numOrNull(row.hoursPerPeriod))
    .input('latest_allowances', sql.Decimal(19, 4), latestAllowances)
    .input('latest_deductions', sql.Decimal(19, 4), latestDeductions)
    .input('payroll_salary_grade', sql.NVarChar(80), salaryGrade)
    .input('source_employee_code', sql.NVarChar(80), nullable(row.employeeCode))
    .input('source_entity_code', sql.NVarChar(80), nullable(row.entityCode))
    .input('source_status_code', sql.NVarChar(40), nullable(row.statusCode))
    .input('source_status_name', sql.NVarChar(150), nullable(row.statusName))
    .input('raw_payload_json', sql.NVarChar(sql.MAX), rawPayload);

  const result = await request.query(`
    DECLARE @employee_id bigint;
    DECLARE @was_insert bit = 0;
    DECLARE @safe_official_email nvarchar(320) = @official_email;

    SELECT @employee_id = employee_id
    FROM [hris].[EmployeeSourceRecords] WITH (UPDLOCK, HOLDLOCK)
    WHERE source_system = N'Sage 300 People Payroll'
      AND source_employee_id = @source_employee_id;

    IF @employee_id IS NULL
    BEGIN
      SELECT @employee_id = employee_id
      FROM [hris].[Employees] WITH (UPDLOCK, HOLDLOCK)
      WHERE employee_code = @employee_code;

      IF @employee_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM [hris].[EmployeeSourceRecords] src
          WHERE src.employee_id = @employee_id
            AND src.source_system = N'Sage 300 People Payroll'
            AND src.source_employee_id <> @source_employee_id
        )
      BEGIN
        SELECT NULL AS employee_id, 0 AS was_insert, @employee_code AS employee_code, N'duplicate-sage-record' AS reason;
        RETURN;
      END;
    END;

    IF @employee_id IS NOT NULL
    BEGIN
      DECLARE @primary_source_employee_id nvarchar(80);
      SELECT TOP 1 @primary_source_employee_id = src.source_employee_id
      FROM [hris].[EmployeeSourceRecords] src
      WHERE src.employee_id = @employee_id
        AND src.source_system = N'Sage 300 People Payroll'
      ORDER BY TRY_CONVERT(int, src.source_employee_id), src.source_employee_id;

      IF @primary_source_employee_id IS NOT NULL AND @primary_source_employee_id <> @source_employee_id
      BEGIN
        SELECT NULL AS employee_id, 0 AS was_insert, @employee_code AS employee_code, N'non-primary-sage-record' AS reason;
        RETURN;
      END;
    END;

    IF @employee_id IS NULL
    BEGIN
      INSERT [hris].[Employees](employee_code, full_name, employment_status, employment_type)
      VALUES (@employee_code, @full_name, @employment_status, @employment_type);
      SET @employee_id = CONVERT(bigint, SCOPE_IDENTITY());
      SET @was_insert = 1;
    END
    ELSE
    BEGIN
      UPDATE [hris].[Employees]
      SET full_name = COALESCE(NULLIF(@full_name, N''), full_name),
          employment_status = COALESCE(NULLIF(@employment_status, N''), employment_status),
          employment_type = COALESCE(NULLIF(@employment_type, N''), employment_type),
          modified_at = SYSUTCDATETIME(),
          modified_by = SUSER_SNAME()
      WHERE employee_id = @employee_id;
    END;

    IF @safe_official_email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM [hris].[EmployeeContactInfo]
        WHERE official_email = @safe_official_email AND employee_id <> @employee_id
      )
      SET @safe_official_email = NULL;

    MERGE [hris].[EmployeePersonalInfo] AS target
    USING (SELECT @employee_id AS employee_id) AS source
    ON target.employee_id = source.employee_id
    WHEN MATCHED THEN UPDATE SET
      title = COALESCE(NULLIF(@title, N''), target.title),
      first_name = COALESCE(NULLIF(@first_name, N''), target.first_name),
      middle_name = COALESCE(NULLIF(@middle_name, N''), target.middle_name),
      last_name = COALESCE(NULLIF(@last_name, N''), target.last_name),
      preferred_name = COALESCE(NULLIF(@preferred_name, N''), target.preferred_name),
      gender = COALESCE(NULLIF(@gender, N''), target.gender),
      date_of_birth = COALESCE(@date_of_birth, target.date_of_birth),
      marital_status = COALESCE(NULLIF(@marital_status, N''), target.marital_status),
      nationality = COALESCE(NULLIF(@nationality, N''), target.nationality),
      modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, title, first_name, middle_name, last_name, preferred_name, gender, date_of_birth, marital_status, nationality
    ) VALUES (
      @employee_id, @title, @first_name, @middle_name, @last_name, @preferred_name, @gender, @date_of_birth, @marital_status, @nationality
    );

    MERGE [hris].[EmployeeContactInfo] AS target
    USING (SELECT @employee_id AS employee_id) AS source
    ON target.employee_id = source.employee_id
    WHEN MATCHED THEN UPDATE SET
      official_email = COALESCE(@safe_official_email, target.official_email),
      primary_phone = COALESCE(NULLIF(@primary_phone, N''), target.primary_phone),
      alternate_phone = COALESCE(NULLIF(@alternate_phone, N''), target.alternate_phone),
      office_extension = COALESCE(NULLIF(@office_extension, N''), target.office_extension),
      residential_address = COALESCE(NULLIF(@residential_address, N''), target.residential_address),
      permanent_address = COALESCE(NULLIF(@permanent_address, N''), target.permanent_address),
      city = COALESCE(NULLIF(@city, N''), target.city),
      state = COALESCE(NULLIF(@state, N''), target.state),
      country = COALESCE(NULLIF(@country, N''), target.country),
      postal_code = COALESCE(NULLIF(@postal_code, N''), target.postal_code),
      modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, official_email, primary_phone, alternate_phone, office_extension, residential_address, permanent_address, city, state, country, postal_code
    ) VALUES (
      @employee_id, @safe_official_email, @primary_phone, @alternate_phone, @office_extension, @residential_address, @permanent_address, @city, @state, @country, @postal_code
    );

    MERGE [hris].[EmployeeEmploymentInfo] AS target
    USING (SELECT @employee_id AS employee_id) AS source
    ON target.employee_id = source.employee_id
    WHEN MATCHED THEN UPDATE SET
      staff_category = COALESCE(NULLIF(@employee_type_name, N''), target.staff_category),
      employee_category = COALESCE(NULLIF(@employee_type_name, N''), target.employee_category),
      date_joined = CASE
        WHEN @date_joined_group IS NOT NULL OR @date_engaged IS NOT NULL
          THEN COALESCE(@date_joined_group, @date_engaged)
        ELSE target.date_joined
      END,
      probation_end_date = COALESCE(@probation_end_date, target.probation_end_date),
      contract_start_date = COALESCE(@contract_start_date, target.contract_start_date),
      contract_end_date = COALESCE(@contract_end_date, target.contract_end_date),
      work_location = COALESCE(NULLIF(@work_location, N''), target.work_location),
      expatriate_status = COALESCE(NULLIF(@expatriate_status, N''), target.expatriate_status),
      modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, staff_category, employee_category, date_joined, probation_end_date, contract_start_date, contract_end_date, work_location, expatriate_status
    ) VALUES (
      @employee_id, @employee_type_name, @employee_type_name, COALESCE(@date_joined_group, @date_engaged), @probation_end_date, @contract_start_date, @contract_end_date, @work_location, @expatriate_status
    );

    MERGE [hris].[EmployeeJobInfo] AS target
    USING (SELECT @employee_id AS employee_id) AS source
    ON target.employee_id = source.employee_id
    WHEN MATCHED THEN UPDATE SET
      job_title = COALESCE(NULLIF(@job_title, N''), target.job_title),
      designation = COALESCE(NULLIF(@designation, N''), target.designation),
      job_grade = COALESCE(NULLIF(@job_grade, N''), target.job_grade),
      department = COALESCE(NULLIF(@department, N''), target.department),
      division = COALESCE(NULLIF(@department_code, N''), target.division),
      business_unit = COALESCE(NULLIF(@company_code, N''), target.business_unit),
      cost_center = COALESCE(NULLIF(@department_code, N''), target.cost_center),
      project_site = COALESCE(NULLIF(@department_code, N''), target.project_site),
      office_location = COALESCE(NULLIF(@work_location, N''), target.office_location),
      reporting_manager = COALESCE(NULLIF(@manager_name, N''), target.reporting_manager),
      role_profile = COALESCE(NULLIF(@employee_type_name, N''), target.role_profile),
      modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, job_title, designation, job_grade, department, division, business_unit, cost_center, project_site, office_location, reporting_manager, role_profile
    ) VALUES (
      @employee_id, @job_title, @designation, @job_grade, @department, @department_code, @company_code, @department_code, @department_code, @work_location, @manager_name, @employee_type_name
    );

    MERGE [hris].[EmployeePayrollSetup] AS target
    USING (SELECT @employee_id AS employee_id) AS source
    ON target.employee_id = source.employee_id
    WHEN MATCHED THEN UPDATE SET
      payroll_group = COALESCE(NULLIF(@company_code, N''), target.payroll_group),
      salary_grade = COALESCE(NULLIF(@payroll_salary_grade, N''), target.salary_grade),
      basic_salary = COALESCE(NULLIF(@basic_salary, 0), target.basic_salary),
      pay_frequency = COALESCE(NULLIF(@payment_run, N''), target.pay_frequency),
      bank_name = CASE WHEN NULLIF(@bank_name, N'') IS NOT NULL THEN @bank_name ELSE target.bank_name END,
      bank_code = CASE WHEN NULLIF(@bank_code, N'') IS NOT NULL THEN @bank_code ELSE target.bank_code END,
      branch_name = CASE WHEN NULLIF(@branch_name, N'') IS NOT NULL THEN @branch_name ELSE target.branch_name END,
      branch_code = CASE WHEN NULLIF(@branch_code, N'') IS NOT NULL THEN @branch_code ELSE target.branch_code END,
      account_number = CASE WHEN NULLIF(@account_number, N'') IS NOT NULL THEN @account_number ELSE target.account_number END,
      account_name = CASE WHEN NULLIF(@account_name, N'') IS NOT NULL THEN @account_name ELSE target.account_name END,
      pension_provider = CASE WHEN NULLIF(@pension_provider, N'') IS NOT NULL THEN @pension_provider ELSE target.pension_provider END,
      tax_identification_number = CASE WHEN NULLIF(@tax_no, N'') IS NOT NULL THEN @tax_no ELSE target.tax_identification_number END,
      pay_currency = COALESCE(NULLIF(@company_currency, N''), target.pay_currency),
      payment_type = COALESCE(NULLIF(@payment_type, N''), target.payment_type),
      payment_run = COALESCE(NULLIF(@payment_run, N''), target.payment_run),
      remuneration_structure = COALESCE(NULLIF(@remuneration_definition, N''), target.remuneration_structure),
      annual_salary = COALESCE(NULLIF(@annual_salary, 0), target.annual_salary),
      period_salary = COALESCE(NULLIF(@period_salary, 0), target.period_salary),
      rate_per_hour = COALESCE(NULLIF(@rate_per_hour, 0), target.rate_per_hour),
      rate_per_day = COALESCE(NULLIF(@rate_per_day, 0), target.rate_per_day),
      hours_per_day = COALESCE(NULLIF(@hours_per_day, 0), target.hours_per_day),
      hours_per_period = COALESCE(NULLIF(@hours_per_period, 0), target.hours_per_period),
      latest_allowances = COALESCE(NULLIF(@latest_allowances, 0), target.latest_allowances),
      latest_deductions = COALESCE(NULLIF(@latest_deductions, 0), target.latest_deductions),
      setup_assigned_to_payroll = 1,
      modified_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, payroll_group, salary_grade, basic_salary, pay_frequency, bank_name, bank_code, branch_name, branch_code,
      account_number, account_name, pension_provider, tax_identification_number, pay_currency, payment_type, payment_run,
      remuneration_structure, annual_salary, period_salary, rate_per_hour, rate_per_day, hours_per_day, hours_per_period,
      latest_allowances, latest_deductions, setup_assigned_to_payroll
    ) VALUES (
      @employee_id, @company_code, @payroll_salary_grade, @basic_salary, @payment_run, @bank_name, @bank_code, @branch_name, @branch_code,
      @account_number, @account_name, @pension_provider, @tax_no, @company_currency, @payment_type, @payment_run,
      @remuneration_definition, @annual_salary, @period_salary, @rate_per_hour, @rate_per_day, @hours_per_day, @hours_per_period,
      @latest_allowances, @latest_deductions, 1
    );

    MERGE [hris].[EmployeeSourceRecords] AS target
    USING (SELECT N'Sage 300 People Payroll' AS source_system, @source_employee_id AS source_employee_id) AS source
    ON target.source_system = source.source_system
      AND target.source_employee_id = source.source_employee_id
    WHEN MATCHED THEN UPDATE SET
      employee_id = @employee_id,
      source_employee_code = COALESCE(NULLIF(@source_employee_code, N''), target.source_employee_code),
      source_entity_code = COALESCE(NULLIF(@source_entity_code, N''), target.source_entity_code),
      source_company_code = COALESCE(NULLIF(@company_code, N''), target.source_company_code),
      source_status_code = COALESCE(NULLIF(@source_status_code, N''), target.source_status_code),
      source_status_name = COALESCE(NULLIF(@source_status_name, N''), target.source_status_name),
      raw_payload_json = @raw_payload_json,
      imported_at = SYSUTCDATETIME(),
      imported_by = SUSER_SNAME()
    WHEN NOT MATCHED THEN INSERT (
      employee_id, source_system, source_employee_id, source_employee_code, source_entity_code, source_company_code,
      source_status_code, source_status_name, raw_payload_json
    ) VALUES (
      @employee_id, N'Sage 300 People Payroll', @source_employee_id, @source_employee_code, @source_entity_code, @company_code,
      @source_status_code, @source_status_name, @raw_payload_json
    );

    SELECT @employee_id AS employee_id, @was_insert AS was_insert, @employee_code AS employee_code, NULL AS reason;
  `);

  return result.recordset[0];
};

const summarizeList = (items, max = 12) => ({
  count: items.length,
  sample: items.slice(0, max),
});

(async () => {
  loadEnv();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const auditOnly = args.includes('--audit-only') || (!apply && !args.includes('--apply'));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

  if (!process.env.SAGE_PAYROLL_DB_PASSWORD) {
    throw new Error('SAGE_PAYROLL_DB_PASSWORD is required.');
  }
  if (apply && !process.env.DLE_ENTERPRISE_DB_PASSWORD) {
    throw new Error('DLE_ENTERPRISE_DB_PASSWORD is required for --apply.');
  }

  console.log('Reading Sage payroll employee profiles...');
  const sageRows = await readSageProfiles(limit);
  console.log(`Sage active employees: ${sageRows.length}`);

  if (!process.env.DLE_ENTERPRISE_DB_PASSWORD) {
    console.log(JSON.stringify({ sageRows: sageRows.length, note: 'Set DLE_ENTERPRISE_DB_PASSWORD to audit or apply against DLE_Enterprise.' }, null, 2));
    return;
  }

  const dlePool = await new sql.ConnectionPool(dleConfig()).connect();
  try {
    await ensurePayrollColumns(dlePool);
    const dleRows = await readDleProfiles(dlePool);
    const dleByCode = new Map(dleRows.map((row) => [clean(row.employee_code).toUpperCase(), row]));
    const dleBySourceId = new Map(
      dleRows.filter((row) => clean(row.source_employee_id)).map((row) => [clean(row.source_employee_id), row]),
    );

    const gaps = auditGaps(sageRows, dleByCode, dleBySourceId);
    const report = {
      mode: apply ? 'apply' : 'audit-only',
      sageTotal: gaps.sageTotal,
      dleTotal: dleRows.length,
      missingInDle: summarizeList(gaps.missingInDle),
      sageHasDobButDleMissing: gaps.sageHasDobButDleMissing,
      sageHasDateJoinedButDleMissing: gaps.sageHasDateJoinedButDleMissing,
      sageDateJoinedMismatch: gaps.sageDateJoinedMismatch,
      missingDob: summarizeList(gaps.missingDob),
      missingDateJoined: summarizeList(gaps.missingDateJoined),
      wrongDateJoined: summarizeList(gaps.wrongDateJoined),
      missingGender: { count: gaps.missingGender.length },
      missingMaritalStatus: { count: gaps.missingMaritalStatus.length },
      missingNationality: { count: gaps.missingNationality.length },
      missingJobTitle: { count: gaps.missingJobTitle.length },
      missingDepartment: { count: gaps.missingDepartment.length },
      missingEmail: { count: gaps.missingEmail.length },
      missingPhone: { count: gaps.missingPhone.length },
      missingBank: { count: gaps.missingBank.length },
      missingTaxNo: { count: gaps.missingTaxNo.length },
      missingPension: { count: gaps.missingPension.length },
    };
    console.log(JSON.stringify(report, null, 2));

    if (!apply) {
      console.log('Audit complete. Re-run with --apply to backfill missing profile fields.');
      return;
    }

    await ensurePayrollColumns(dlePool);
    const summary = { inserted: 0, updated: 0, skippedDuplicates: 0, failures: 0, samples: [] };
    for (const row of sageRows) {
      try {
        const result = await upsertProfile(dlePool, row);
        if (result?.reason === 'duplicate-sage-record' || result?.reason === 'non-primary-sage-record') summary.skippedDuplicates += 1;
        else if (result?.was_insert) summary.inserted += 1;
        else summary.updated += 1;
        if (summary.samples.length < 8) {
          summary.samples.push({ code: result?.employee_code, wasInsert: Boolean(result?.was_insert) });
        }
      } catch (error) {
        summary.failures += 1;
        if (summary.samples.length < 12) {
          summary.samples.push({
            code: employeeCode(row.employeeCode),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const postRows = await readDleProfiles(dlePool);
    const postByCode = new Map(postRows.map((row) => [clean(row.employee_code).toUpperCase(), row]));
    const postBySourceId = new Map(
      postRows.filter((row) => clean(row.source_employee_id)).map((row) => [clean(row.source_employee_id), row]),
    );
    const postGaps = auditGaps(sageRows, postByCode, postBySourceId);

    console.log(JSON.stringify({
      migration: summary,
      after: {
        sageHasDobButDleMissing: postGaps.sageHasDobButDleMissing,
        sageHasDateJoinedButDleMissing: postGaps.sageHasDateJoinedButDleMissing,
        sageDateJoinedMismatch: postGaps.sageDateJoinedMismatch,
        missingInDle: postGaps.missingInDle.length,
      },
    }, null, 2));
  } finally {
    await dlePool.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
