param(
  [string]$DleServerInstance = 'localhost',
  [string]$DleDatabase = 'DLE_Enterprise',
  [string]$OnlyPayrollClass = '',
  [switch]$OverwriteExistingPay,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') { return }
    $parts = $line.Split('=', 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

Read-DotEnv -Path (Join-Path (Get-Location) '.env')
Read-DotEnv -Path (Join-Path (Get-Location) 'apps\dashboard\.env')

function EnvOrDefault {
  param([string]$Name, [string]$Default = '')
  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value
}

function Get-Field {
  param($Row, [string]$Name)
  if ($null -eq $Row) { return $null }
  try { return $Row[$Name] } catch {}
  try { return $Row.$Name } catch {}
  return $null
}

function Normalize-String {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return '' }
  return ([string]$Value).Trim()
}

function DbNullIfBlank {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return [DBNull]::Value }
  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) { return [DBNull]::Value }
  return $Value
}

function DbMoney {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return [DBNull]::Value }
  try {
    $number = [decimal]$Value
    if ($number -le 0) { return [DBNull]::Value }
    return $number
  } catch {
    return [DBNull]::Value
  }
}

$sageHost = EnvOrDefault 'SAGE_PAYROLL_DB_HOST' '192.168.5.8'
$sagePort = [int](EnvOrDefault 'SAGE_PAYROLL_DB_PORT' '1433')
$sageDb = EnvOrDefault 'SAGE_PAYROLL_DB_NAME' 'DLE_JUNE'
$sageUser = EnvOrDefault 'SAGE_PAYROLL_DB_USER' 'sa'
$sagePassword = EnvOrDefault 'SAGE_PAYROLL_DB_PASSWORD'
$sageInstance = EnvOrDefault 'SAGE_PAYROLL_DB_INSTANCE' 'MSSQLSERVERPEOPL'
$dleUser = EnvOrDefault 'DLE_ENTERPRISE_DB_USER'
$dlePassword = EnvOrDefault 'DLE_ENTERPRISE_DB_PASSWORD'

if ([string]::IsNullOrWhiteSpace($sagePassword)) {
  throw 'SAGE_PAYROLL_DB_PASSWORD is required in .env or process environment.'
}

$sageConnectionString = "Server=tcp:$sageHost,$sagePort;Database=$sageDb;User ID=$sageUser;Password=$sagePassword;TrustServerCertificate=True;Encrypt=False"
if (-not [string]::IsNullOrWhiteSpace($sageInstance)) {
  $sageConnectionString = "Server=$sageHost\$sageInstance;Database=$sageDb;User ID=$sageUser;Password=$sagePassword;TrustServerCertificate=True;Encrypt=False"
}

$dleConnectionString = "Server=$DleServerInstance;Database=$DleDatabase;Integrated Security=True;TrustServerCertificate=True"
if (-not [string]::IsNullOrWhiteSpace($dleUser) -and -not [string]::IsNullOrWhiteSpace($dlePassword)) {
  $dleConnectionString = "Server=$DleServerInstance;Database=$DleDatabase;User ID=$dleUser;Password=$dlePassword;TrustServerCertificate=True;Encrypt=False"
}

$sageQuery = @'
WITH activeEmployees AS (
  SELECT
    e.EmployeeID,
    e.EmployeeCode,
    REPLACE(UPPER(LTRIM(RTRIM(e.EmployeeCode))), '_', '') AS normalizedCode
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
    epp.EmployeePayPeriodID,
    p.PayslipID,
    ROW_NUMBER() OVER (PARTITION BY ae.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM activeEmployees ae
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = ae.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
),
latestGross AS (
  SELECT
    lp.EmployeeID,
    SUM(ISNULL(pel.Total, 0)) AS grossPay
  FROM latestPayslipPeriods lp
  JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = lp.PayslipID
  WHERE lp.rn = 1
  GROUP BY lp.EmployeeID
),
contractWeekdayRates AS (
  SELECT
    ae.EmployeeID,
    epp.EmployeePayPeriodID,
    edef.DefCode,
    MAX(CASE WHEN peu.EmployeeRate > 0 THEN peu.EmployeeRate ELSE NULL END) AS EmployeeRate
  FROM activeEmployees ae
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = ae.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = p.PayslipID
  JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
  JOIN Payroll.PayslipEarnUnit peu ON peu.PayslipEarnLineID = pel.PayslipEarnLineID
  WHERE ae.normalizedCode LIKE 'C%'
    AND edef.DefCode IN ('JCWEEKDAY', 'JCWEEKDAY_NT')
    AND ISNULL(peu.EmployeeRate, 0) > 0
  GROUP BY ae.EmployeeID, epp.EmployeePayPeriodID, edef.DefCode
),
contractRatePeriods AS (
  SELECT
    EmployeeID,
    EmployeePayPeriodID,
    ROW_NUMBER() OVER (PARTITION BY EmployeeID ORDER BY EmployeePayPeriodID DESC) AS rn
  FROM (
    SELECT DISTINCT EmployeeID, EmployeePayPeriodID
    FROM contractWeekdayRates
  ) periods
),
contractDailyRates AS (
  SELECT
    wr.EmployeeID,
    SUM(wr.EmployeeRate) AS ratePerDay
  FROM contractWeekdayRates wr
  JOIN contractRatePeriods rp
    ON rp.EmployeeID = wr.EmployeeID
    AND rp.EmployeePayPeriodID = wr.EmployeePayPeriodID
    AND rp.rn = 1
  GROUP BY wr.EmployeeID
)
SELECT
  e.EmployeeID AS sageEmployeeId,
  e.EmployeeCode AS sageEmployeeCode,
  ae.normalizedCode AS normalizedCode,
  CASE
    WHEN ae.normalizedCode LIKE 'C%' THEN ae.normalizedCode
    WHEN ae.normalizedCode LIKE 'L%' THEN ae.normalizedCode
    WHEN ae.normalizedCode LIKE 'P%' THEN ae.normalizedCode
    ELSE CONCAT('P', ae.normalizedCode)
  END AS directoryEmployeeCode,
  CASE
    WHEN ae.normalizedCode LIKE 'C%' THEN 'Daily Rate'
    WHEN ae.normalizedCode LIKE 'L%' THEN 'Lumpsum'
    WHEN ae.normalizedCode LIKE 'NYSC%' OR ae.normalizedCode LIKE 'N%' THEN 'NYSC'
    WHEN ae.normalizedCode LIKE 'IT%' OR ae.normalizedCode LIKE 'I%' THEN 'Industrial Trainee'
    ELSE 'Permanent'
  END AS payrollClass,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.DisplayName)), ''), ge.DisplayName) AS employeeName,
  c.CompanyCode AS companyCode,
  c.CompanyCCY AS companyCurrency,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.JobGradeCode)), ''), NULLIF(LTRIM(RTRIM(ed.JobGrade)), '')) AS jobGrade,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.PaymentRunDefLong)), ''), NULLIF(LTRIM(RTRIM(ed.PaymentRunDefShort)), '')) AS paymentRun,
  COALESCE(NULLIF(LTRIM(RTRIM(ed.PaymentType)), ''), NULLIF(LTRIM(RTRIM(ed.PaymentTypeCode)), '')) AS paymentType,
  ed.RemunerationDefinitionHeaderDisplay AS remunerationDefinition,
  COALESCE(NULLIF(ed.PeriodSalary, 0), lg.grossPay, CASE WHEN ae.normalizedCode LIKE 'C%' THEN cdr.ratePerDay ELSE NULL END) AS periodSalary,
  COALESCE(NULLIF(ed.AnnualSalary, 0), CASE WHEN COALESCE(NULLIF(ed.PeriodSalary, 0), lg.grossPay) > 0 THEN COALESCE(NULLIF(ed.PeriodSalary, 0), lg.grossPay) * 12 ELSE NULL END) AS annualSalary,
  CASE WHEN ae.normalizedCode LIKE 'C%' THEN cdr.ratePerDay ELSE NULL END AS ratePerDay,
  CASE WHEN ae.normalizedCode LIKE 'C%' AND cdr.ratePerDay > 0 THEN cdr.ratePerDay / 8.0 ELSE NULL END AS ratePerHour,
  ed.HoursPerDay AS hoursPerDay,
  ed.HoursPerPeriod AS hoursPerPeriod
FROM activeEmployees ae
JOIN Employee.Employee e ON e.EmployeeID = ae.EmployeeID
JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
JOIN Company.Company c ON c.CompanyID = e.CompanyID
LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
LEFT JOIN latestGross lg ON lg.EmployeeID = e.EmployeeID
LEFT JOIN contractDailyRates cdr ON cdr.EmployeeID = e.EmployeeID
ORDER BY payrollClass, directoryEmployeeCode;
'@

Add-Type -AssemblyName System.Data

function Get-DataTable {
  param([string]$ConnectionString, [string]$Query)
  $cn = [System.Data.SqlClient.SqlConnection]::new($ConnectionString)
  $cn.Open()
  try {
    $cmd = $cn.CreateCommand()
    $cmd.CommandTimeout = 0
    $cmd.CommandText = $Query
    $da = [System.Data.SqlClient.SqlDataAdapter]::new($cmd)
    $dt = [System.Data.DataTable]::new()
    [void]$da.Fill($dt)
    return ,$dt
  }
  finally {
    $cn.Close()
    $cn.Dispose()
  }
}

Write-Host "Reading payroll input parameters from Sage 300 Payroll..."
$sageRows = Get-DataTable -ConnectionString $sageConnectionString -Query $sageQuery
Write-Host "Sage active payroll input rows found: $($sageRows.Rows.Count)"

if ($WhatIf) {
  $sageRows.Rows |
    Group-Object payrollClass |
    Sort-Object Name |
    Select-Object Name, Count |
    Format-Table -AutoSize
  $sageRows.Rows |
    Select-Object -First 40 sageEmployeeId, sageEmployeeCode, directoryEmployeeCode, payrollClass, jobGrade, periodSalary, annualSalary, ratePerDay |
    Format-Table -AutoSize
  Write-Host "WhatIf mode: no DLE_Enterprise changes were made."
  return
}

$dle = [System.Data.SqlClient.SqlConnection]::new($dleConnectionString)
$dle.Open()

$updated = 0
$skippedFilter = 0
$skippedMissingDle = 0
$skippedNoPay = 0
$failed = 0
$failures = New-Object System.Collections.Generic.List[string]

try {
  foreach ($row in $sageRows.Rows) {
    $payrollClass = Normalize-String (Get-Field $row 'payrollClass')
    if (-not [string]::IsNullOrWhiteSpace($OnlyPayrollClass) -and $payrollClass -ne $OnlyPayrollClass) {
      $skippedFilter++
      continue
    }
    $tx = $dle.BeginTransaction()
    try {
      $sageEmployeeId = Normalize-String (Get-Field $row 'sageEmployeeId')
      $sageEmployeeCode = Normalize-String (Get-Field $row 'sageEmployeeCode')
      $directoryEmployeeCode = Normalize-String (Get-Field $row 'directoryEmployeeCode')
      $normalizedCode = Normalize-String (Get-Field $row 'normalizedCode')
      $salaryGrade = Normalize-String (Get-Field $row 'jobGrade')
      if (-not $salaryGrade) {
        if ($payrollClass -eq 'Lumpsum') { $salaryGrade = 'Lumpsum' }
        elseif ($payrollClass -eq 'NYSC') { $salaryGrade = 'NYSC Stipend' }
        elseif ($payrollClass -eq 'Industrial Trainee') { $salaryGrade = 'IT Stipend' }
        elseif ($payrollClass -eq 'Daily Rate') { $salaryGrade = 'Daily Rate' }
      }
      $periodSalary = DbMoney (Get-Field $row 'periodSalary')
      $annualSalary = DbMoney (Get-Field $row 'annualSalary')
      $ratePerDay = DbMoney (Get-Field $row 'ratePerDay')
      $ratePerHour = DbMoney (Get-Field $row 'ratePerHour')

      if ($periodSalary -is [DBNull] -and $annualSalary -is [DBNull] -and $ratePerDay -is [DBNull] -and $ratePerHour -is [DBNull]) {
        $skippedNoPay++
      }

      $cmd = $dle.CreateCommand()
      $cmd.Transaction = $tx
      $cmd.CommandTimeout = 0
      $cmd.CommandText = @'
DECLARE @employee_id bigint;

SELECT @employee_id = employee_id
FROM hris.EmployeeSourceRecords WITH (UPDLOCK, HOLDLOCK)
WHERE source_system = N'Sage 300 People Payroll'
  AND source_employee_id = @sage_employee_id;

IF @employee_id IS NULL
BEGIN
  SELECT TOP (1) @employee_id = employee_id
  FROM hris.Employees WITH (UPDLOCK, HOLDLOCK)
  WHERE REPLACE(UPPER(LTRIM(RTRIM(employee_code))), '_', '') IN (@directory_employee_code, @normalized_code, CONCAT(N'P', @normalized_code));
END;

IF @employee_id IS NULL
BEGIN
  SELECT CAST(0 AS bit) AS updated, N'Missing DLE employee' AS reason;
  RETURN;
END;

UPDATE hris.Employees
SET employment_type = @payroll_class,
    modified_at = SYSUTCDATETIME(),
    modified_by = SUSER_SNAME()
WHERE employee_id = @employee_id
  AND (
    @payroll_class IN (N'Industrial Trainee', N'NYSC', N'Lumpsum', N'Daily Rate')
    OR NULLIF(LTRIM(RTRIM(employment_type)), N'') IS NULL
  );

UPDATE hris.EmployeeJobInfo
SET job_grade = COALESCE(NULLIF(@salary_grade, N''), job_grade),
    role_profile = COALESCE(NULLIF(@remuneration_definition, N''), role_profile),
    modified_at = SYSUTCDATETIME()
WHERE employee_id = @employee_id;

MERGE hris.EmployeePayrollSetup AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET
  payroll_group = COALESCE(NULLIF(@payroll_group, N''), target.payroll_group),
  salary_grade = COALESCE(NULLIF(@salary_grade, N''), target.salary_grade),
  pay_currency = COALESCE(NULLIF(@pay_currency, N''), target.pay_currency, N'NGN'),
  payment_run = COALESCE(NULLIF(@payment_run, N''), target.payment_run),
  payment_type = COALESCE(NULLIF(@payment_type, N''), target.payment_type),
  period_salary = CASE WHEN @overwrite_existing_pay = 1 OR ISNULL(target.period_salary, 0) <= 0 THEN @period_salary ELSE target.period_salary END,
  annual_salary = CASE WHEN @overwrite_existing_pay = 1 OR ISNULL(target.annual_salary, 0) <= 0 THEN @annual_salary ELSE target.annual_salary END,
  rate_per_day = CASE WHEN @payroll_class = N'Daily Rate' AND (@overwrite_existing_pay = 1 OR ISNULL(target.rate_per_day, 0) <= 0) THEN @rate_per_day ELSE target.rate_per_day END,
  rate_per_hour = CASE WHEN @payroll_class = N'Daily Rate' AND (@overwrite_existing_pay = 1 OR ISNULL(target.rate_per_hour, 0) <= 0) THEN @rate_per_hour ELSE target.rate_per_hour END,
  hours_per_day = COALESCE(@hours_per_day, target.hours_per_day),
  hours_per_period = COALESCE(@hours_per_period, target.hours_per_period),
  setup_assigned_to_payroll = 1,
  modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
  employee_id, payroll_group, salary_grade, pay_currency, payment_run, payment_type,
  period_salary, annual_salary, rate_per_day, rate_per_hour, hours_per_day, hours_per_period, setup_assigned_to_payroll
) VALUES (
  @employee_id, @payroll_group, @salary_grade, COALESCE(NULLIF(@pay_currency, N''), N'NGN'), @payment_run, @payment_type,
  @period_salary, @annual_salary, CASE WHEN @payroll_class = N'Daily Rate' THEN @rate_per_day ELSE NULL END,
  CASE WHEN @payroll_class = N'Daily Rate' THEN @rate_per_hour ELSE NULL END, @hours_per_day, @hours_per_period, 1
);

INSERT hris.EmployeeAuditLog(employee_id, audit_action, performed_by, reason, new_value)
VALUES (
  @employee_id,
  N'Sage payroll input repair',
  SUSER_SNAME(),
  N'Synced payroll class, salary structure, salary input, stipend, lump sum, or daily rate from Sage 300 Payroll',
  CONCAT(N'{"sageEmployeeId":"', @sage_employee_id, N'","sageEmployeeCode":"', @sage_employee_code, N'","class":"', @payroll_class, N'","periodSalary":', COALESCE(CONVERT(nvarchar(50), @period_salary), N'null'), N',"ratePerDay":', COALESCE(CONVERT(nvarchar(50), @rate_per_day), N'null'), N'}')
);

SELECT CAST(1 AS bit) AS updated, N'Updated' AS reason;
'@

      $params = @{
        '@sage_employee_id' = $sageEmployeeId
        '@sage_employee_code' = $sageEmployeeCode
        '@directory_employee_code' = $directoryEmployeeCode
        '@normalized_code' = $normalizedCode
        '@payroll_class' = $payrollClass
        '@payroll_group' = Normalize-String (Get-Field $row 'companyCode')
        '@salary_grade' = $salaryGrade
        '@pay_currency' = Normalize-String (Get-Field $row 'companyCurrency')
        '@payment_run' = Normalize-String (Get-Field $row 'paymentRun')
        '@payment_type' = Normalize-String (Get-Field $row 'paymentType')
        '@remuneration_definition' = Normalize-String (Get-Field $row 'remunerationDefinition')
        '@period_salary' = $periodSalary
        '@annual_salary' = $annualSalary
        '@rate_per_day' = $ratePerDay
        '@rate_per_hour' = $ratePerHour
        '@hours_per_day' = DbMoney (Get-Field $row 'hoursPerDay')
        '@hours_per_period' = DbMoney (Get-Field $row 'hoursPerPeriod')
        '@overwrite_existing_pay' = if ($OverwriteExistingPay) { 1 } else { 0 }
      }

      foreach ($name in $params.Keys) {
        $parameter = $cmd.Parameters.Add($name, [System.Data.SqlDbType]::NVarChar)
        if ($name -in @('@period_salary', '@annual_salary', '@rate_per_day', '@rate_per_hour')) {
          $parameter.SqlDbType = [System.Data.SqlDbType]::Decimal
          $parameter.Precision = 19
          $parameter.Scale = 4
        } elseif ($name -in @('@hours_per_day', '@hours_per_period')) {
          $parameter.SqlDbType = [System.Data.SqlDbType]::Decimal
          $parameter.Precision = 9
          $parameter.Scale = 4
        } elseif ($name -eq '@overwrite_existing_pay') {
          $parameter.SqlDbType = [System.Data.SqlDbType]::Bit
        }
        $parameter.Value = $params[$name]
      }

      $reader = $cmd.ExecuteReader()
      $result = $null
      if ($reader.Read()) {
        $result = @{
          updated = [bool]$reader['updated']
          reason = [string]$reader['reason']
        }
      }
      $reader.Close()

      if ($result.updated) {
        $updated++
      } elseif ($result.reason -eq 'Missing DLE employee') {
        $skippedMissingDle++
      }
      $tx.Commit()
    } catch {
      $failed++
      $failures.Add("$sageEmployeeCode - $($_.Exception.Message)") | Out-Null
      try { $tx.Rollback() } catch {}
    }
  }
}
finally {
  $dle.Close()
  $dle.Dispose()
}

Write-Host "Payroll input repair complete. Updated: $updated. Filter skipped: $skippedFilter. Missing DLE: $skippedMissingDle. No Sage pay input: $skippedNoPay. Failed: $failed."
if ($failures.Count -gt 0) {
  Write-Host "Failures:"
  $failures | Select-Object -First 20 | ForEach-Object { Write-Host " - $_" }
}
