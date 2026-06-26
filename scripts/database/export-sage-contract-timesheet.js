/**
 * Export Sage 300 People (DLE_JUNE) contract timesheet / attendance inputs used for payroll.
 *
 * Reads PayslipEarnUnit rows (days, hours, rates) per earning code for the payroll period,
 * builds a per-employee summary (weekday days, meal days, overtime, PH, weekend, refund),
 * and writes CSV + JSON under exports/sage-timesheet/<period>/.
 *
 * Usage:
 *   node scripts/database/export-sage-contract-timesheet.js
 *   node scripts/database/export-sage-contract-timesheet.js --period 2026-06
 *   node scripts/database/export-sage-contract-timesheet.js --period 2026-06 --employee C1728
 */

const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const ROOT = process.cwd();
const envFile = path.join(ROOT, 'apps', 'dashboard', '.env');

const loadEnv = () => {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
};

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const period = getArg('--period') || process.env.HRIS_ACTIVE_PAYROLL_PERIOD || '2026-06';
const employeeFilter = (getArg('--employee') || '').trim().toUpperCase();
const outputRoot = getArg('--output') || path.join(ROOT, 'exports', 'sage-timesheet', period);

const periodBounds = (value) => {
  const [year, month] = String(value).split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start, end, label: value };
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundUnits = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const writeCsv = (filePath, rows, columns) => {
  const header = columns.map((column) => csvEscape(column)).join(',');
  const lines = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, [header, ...lines].join('\r\n'), 'utf8');
};

const EARNING_BUCKETS = {
  weekdayDays: new Set(['JCWEEKDAY', 'JBCBASIC', 'JCWEEKDAY_NT']),
  mealDays: new Set(['MEAL', 'NNDMEAL', 'MEAL_ARREARS']),
  weekdayOvertimeHours: new Set(['WEEKDAYOVT', 'OVT', 'WEEKDAY_OVT']),
  saturdayHours: new Set(['SATURDAY_OVT', 'SATEARN', 'SATURDAY']),
  sundayHours: new Set(['SUNDAY_OVT', 'SUNDAYEARN', 'SUNDAY']),
  publicHolidayHours: new Set(['PUBLIC_OVT', 'PUBHOL', 'PUBLHOL', 'PUBLIC_HOLIDAY']),
  refundAmount: new Set(['REFUND']),
};

const bucketForCode = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  for (const [bucket, codes] of Object.entries(EARNING_BUCKETS)) {
    if (codes.has(normalized)) return bucket;
  }
  return 'other';
};

const sageBaseConfig = () => ({
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 120000),
  connectionTimeout: Number(process.env.SAGE_PAYROLL_DB_CONNECT_TIMEOUT || 60000),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

const sageConnectionCandidates = () => {
  const host = process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8';
  const port = Number(process.env.SAGE_PAYROLL_DB_PORT || 1433);
  const instance = String(process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL').trim();
  const base = sageBaseConfig();
  const candidates = [
    { label: `tcp:${host},${port}`, config: { ...base, server: host, port } },
    { label: `${host}\\${instance}`, config: { ...base, server: host, options: { ...base.options, instanceName: instance } } },
    { label: host, config: { ...base, server: host, options: { ...base.options, instanceName: instance } } },
  ];
  const seen = new Set();
  return candidates.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
};

const connectSagePool = async () => {
  const failures = [];
  for (const candidate of sageConnectionCandidates()) {
    try {
      const pool = await sql.connect(candidate.config);
      console.log(`Connected via ${candidate.label}`);
      return pool;
    } catch (error) {
      failures.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Unable to connect to Sage SQL Server.\n${failures.join('\n')}`);
};

const discoverAttendanceTables = async (pool) => {
  const result = await pool.request().query(`
    SELECT s.name AS schemaName, t.name AS tableName
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.name LIKE '%Time%'
       OR t.name LIKE '%Attend%'
       OR t.name LIKE '%Timesheet%'
       OR t.name LIKE '%Clock%'
       OR t.name LIKE '%Shift%'
       OR t.name LIKE '%Daily%'
    ORDER BY s.name, t.name
  `);
  return result.recordset;
};

const discoverPayslipEarnUnitColumns = async (pool) => {
  const result = await pool.request().query(`
    SELECT c.name, ty.name AS typeName
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Payroll' AND t.name = 'PayslipEarnUnit'
    ORDER BY c.column_id
  `);
  return result.recordset;
};

const pickColumn = (columns, patterns) =>
  columns.find((column) => patterns.some((pattern) => pattern.test(column))) || null;

const earnUnitsQuery = (bounds, employeeCode) => {
  const employeeClause = employeeCode
    ? `AND UPPER(LTRIM(RTRIM(e.EmployeeCode))) = '${employeeCode.replace(/'/g, "''")}'`
    : '';
  return `
DECLARE @PayrollPeriodStart date = '${bounds.start}';
DECLARE @PayrollPeriodEnd date = '${bounds.end}';

WITH latestPayslipPeriods AS (
  SELECT
    e.EmployeeID,
    e.EmployeeCode,
    ge.DisplayName AS employeeName,
    ed.JobGradeCode,
    ed.HoursPerDay,
    ed.HoursPerPeriod,
    ed.PeriodSalary,
    epp.EmployeePayPeriodID,
    epp.LastCalcDate,
    p.PayslipID,
    ROW_NUMBER() OVER (PARTITION BY e.EmployeeID ORDER BY epp.EmployeePayPeriodID DESC, p.PayslipID DESC) AS rn
  FROM Employee.Employee e
  JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
  JOIN Company.Company c ON c.CompanyID = e.CompanyID
  LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
  JOIN Employee.EmployeePayPeriod epp ON epp.EmployeeID = e.EmployeeID
  JOIN Payroll.Payslip p ON p.EmployeePayPeriodID = epp.EmployeePayPeriodID
  LEFT JOIN Employee.EmployeeDetail ed ON ed.EmployeeID = e.EmployeeID
  WHERE
    UPPER(LTRIM(RTRIM(e.EmployeeCode))) LIKE 'C%'
    AND e.TerminationDate IS NULL
    AND ISNULL(es.Code, 'A') = 'A'
    AND ge.Status = 'A'
    AND c.Status = 'A'
    AND epp.LastCalcDate >= @PayrollPeriodStart
    AND epp.LastCalcDate < @PayrollPeriodEnd
    ${employeeClause}
)
SELECT
  lp.EmployeeID AS sageEmployeeId,
  lp.EmployeeCode AS employeeCode,
  lp.employeeName,
  lp.JobGradeCode AS jobGradeCode,
  lp.HoursPerDay AS hoursPerDay,
  lp.HoursPerPeriod AS hoursPerPeriod,
  lp.PeriodSalary AS periodSalary,
  lp.EmployeePayPeriodID AS employeePayPeriodId,
  lp.LastCalcDate AS lastCalcDate,
  lp.PayslipID AS payslipId,
  edef.DefCode AS earningCode,
  COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), NULLIF(LTRIM(RTRIM(edef.LongDescription)), ''), edef.DefCode) AS earningName,
  pel.Total AS lineTotal,
  pel.TaxableAmount AS taxableAmount,
  pel.YTDTotal AS ytdTotal,
  peu.PayslipEarnUnitID AS payslipEarnUnitId,
  peu.Units AS units,
  peu.Rate AS rate,
  peu.EmployeeRate AS employeeRate,
  peu.CustomRate AS customRate,
  peu.PayFactorID AS payFactorId
FROM latestPayslipPeriods lp
JOIN Payroll.PayslipEarnLine pel ON pel.PayslipID = lp.PayslipID
JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
LEFT JOIN Payroll.PayslipEarnUnit peu ON peu.PayslipEarnLineID = pel.PayslipEarnLineID
WHERE lp.rn = 1
  AND ISNULL(pel.Total, 0) <> 0
ORDER BY lp.EmployeeCode, edef.DefCode, peu.PayslipEarnUnitID;
`;
};

const buildSummary = (detailRows) => {
  const byEmployee = new Map();

  for (const row of detailRows) {
    const key = String(row.employeeCode || row.EmployeeCode || '').trim().toUpperCase();
    if (!key) continue;
    const current = byEmployee.get(key) || {
      employeeCode: key,
      employeeName: row.employeeName || '',
      sageEmployeeId: row.sageEmployeeId,
      hoursPerDay: row.hoursPerDay,
      hoursPerPeriod: row.hoursPerPeriod,
      periodSalary: row.periodSalary,
      lastCalcDate: row.lastCalcDate,
      weekdayDays: 0,
      mealDays: 0,
      weekdayOvertimeHours: 0,
      saturdayHours: 0,
      sundayHours: 0,
      publicHolidayHours: 0,
      refundAmount: 0,
      otherEarnings: 0,
      grossFromLines: 0,
      earningCodes: [],
    };

    const code = String(row.earningCode || '').trim().toUpperCase();
    const units = Number(row.units || 0);
    const lineTotal = Number(row.lineTotal || 0);
    const bucket = bucketForCode(code);
    current.grossFromLines = roundMoney(current.grossFromLines + lineTotal);
    current.earningCodes.push(code);

    if (bucket === 'refundAmount') {
      current.refundAmount = roundMoney(current.refundAmount + lineTotal);
    } else if (bucket === 'other') {
      current.otherEarnings = roundMoney(current.otherEarnings + lineTotal);
    } else if (units > 0) {
      current[bucket] = roundUnits(current[bucket] + units);
    } else if (lineTotal > 0 && row.employeeRate > 0) {
      const inferredUnits = lineTotal / Number(row.employeeRate);
      current[bucket] = roundUnits(current[bucket] + inferredUnits);
    }

    byEmployee.set(key, current);
  }

  return Array.from(byEmployee.values())
    .map((row) => ({
      ...row,
      earningCodes: Array.from(new Set(row.earningCodes)).sort().join('; '),
      impliedDailyRate: row.weekdayDays > 0
        ? roundMoney((detailRows.filter((item) => String(item.employeeCode).toUpperCase() === row.employeeCode && String(item.earningCode).toUpperCase() === 'JCWEEKDAY').reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)) / row.weekdayDays)
        : null,
    }))
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
};

const trySampleAttendanceTable = async (pool, schemaName, tableName) => {
  try {
    const result = await pool.request().query(`
      SELECT TOP 5 *
      FROM [${schemaName.replace(/]/g, ']]')}].[${tableName.replace(/]/g, ']]')}]
      ORDER BY 1 DESC
    `);
    return result.recordset;
  } catch {
    return null;
  }
};

const main = async () => {
  loadEnv();
  if (!process.env.SAGE_PAYROLL_DB_PASSWORD) {
    throw new Error('SAGE_PAYROLL_DB_PASSWORD is required in apps/dashboard/.env');
  }

  const bounds = periodBounds(period);
  const pool = await connectSagePool();

  console.log(`Using Sage database ${process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE'} for period ${bounds.label}`);

  const attendanceTables = await discoverAttendanceTables(pool);
  const earnUnitColumns = await discoverPayslipEarnUnitColumns(pool);
  const unitsColumn = pickColumn(earnUnitColumns.map((row) => row.name), [/^Units$/i]);
  if (!unitsColumn) {
    console.warn('Warning: Payroll.PayslipEarnUnit.Units column not found. Summary will infer units from amount/rate where possible.');
  }

  let detailRows = [];
  try {
    const detail = await pool.request().query(earnUnitsQuery(bounds, employeeFilter));
    detailRows = detail.recordset || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Invalid column name 'Units'/.test(message)) {
      console.warn('Units column unavailable — retrying without explicit unit fields.');
      const fallbackQuery = earnUnitsQuery(bounds, employeeFilter)
        .replace(/,\s*peu\.Units AS units/g, '')
        .replace(/,\s*peu\.Rate AS rate/g, '')
        .replace(/,\s*peu\.EmployeeRate AS employeeRate/g, '')
        .replace(/,\s*peu\.CustomRate AS customRate/g, '')
        .replace(/,\s*peu\.PayFactorID AS payFactorId/g, '');
      const detail = await pool.request().query(fallbackQuery);
      detailRows = detail.recordset || [];
    } else {
      throw error;
    }
  }

  const summaryRows = buildSummary(detailRows);
  fs.mkdirSync(outputRoot, { recursive: true });

  const detailPath = path.join(outputRoot, `sage-contract-earn-units-detail-${bounds.label}.csv`);
  const summaryPath = path.join(outputRoot, `sage-contract-timesheet-summary-${bounds.label}.csv`);
  const schemaPath = path.join(outputRoot, `sage-attendance-schema-discovery-${bounds.label}.json`);
  const readmePath = path.join(outputRoot, 'README.txt');

  const detailColumns = [
    'employeeCode', 'employeeName', 'sageEmployeeId', 'earningCode', 'earningName',
    'units', 'employeeRate', 'rate', 'customRate', 'lineTotal', 'taxableAmount', 'ytdTotal',
    'hoursPerDay', 'hoursPerPeriod', 'periodSalary', 'lastCalcDate', 'employeePayPeriodId', 'payslipId',
  ];

  writeCsv(detailPath, detailRows.map((row) => ({
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    sageEmployeeId: row.sageEmployeeId,
    earningCode: row.earningCode,
    earningName: row.earningName,
    units: row.units ?? '',
    employeeRate: row.employeeRate ?? '',
    rate: row.rate ?? '',
    customRate: row.customRate ?? '',
    lineTotal: row.lineTotal ?? '',
    taxableAmount: row.taxableAmount ?? '',
    ytdTotal: row.ytdTotal ?? '',
    hoursPerDay: row.hoursPerDay ?? '',
    hoursPerPeriod: row.hoursPerPeriod ?? '',
    periodSalary: row.periodSalary ?? '',
    lastCalcDate: row.lastCalcDate ?? '',
    employeePayPeriodId: row.employeePayPeriodId ?? '',
    payslipId: row.payslipId ?? '',
  })), detailColumns);

  writeCsv(summaryPath, summaryRows, [
    'employeeCode', 'employeeName', 'weekdayDays', 'mealDays',
    'weekdayOvertimeHours', 'saturdayHours', 'sundayHours', 'publicHolidayHours',
    'refundAmount', 'otherEarnings', 'grossFromLines', 'impliedDailyRate',
    'hoursPerDay', 'hoursPerPeriod', 'periodSalary', 'lastCalcDate', 'earningCodes',
  ]);

  const schemaDiscovery = {
    exportedAt: new Date().toISOString(),
    sageDatabase: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
    payrollPeriod: bounds.label,
    employeeFilter: employeeFilter || null,
    payslipEarnUnitColumns: earnUnitColumns,
    candidateAttendanceTables: attendanceTables,
    tableSamples: {},
  };

  for (const table of attendanceTables.slice(0, 12)) {
    const sample = await trySampleAttendanceTable(pool, table.schemaName, table.tableName);
    if (sample && sample.length) {
      schemaDiscovery.tableSamples[`${table.schemaName}.${table.tableName}`] = sample;
    }
  }

  fs.writeFileSync(schemaPath, JSON.stringify(schemaDiscovery, null, 2), 'utf8');

  const readme = [
    `Sage contract timesheet export — ${bounds.label}`,
    `Database: ${process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE'} @ ${process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8'}`,
  '',
    'Files:',
    `  1. ${path.basename(detailPath)} — one row per employee/earning code with units, rates, and amounts from Payroll.PayslipEarnUnit`,
    `  2. ${path.basename(summaryPath)} — rolled-up weekday days, meal days, overtime/PH/weekend hours, refund, gross`,
    `  3. ${path.basename(schemaPath)} — discovered attendance/time tables and PayslipEarnUnit schema`,
  '',
    'How Sage maps earning codes:',
    '  JCWEEKDAY / JBCBASIC      -> weekdayDays (regular days worked)',
    '  MEAL                      -> mealDays',
    '  WEEKDAYOVT / OVT          -> weekdayOvertimeHours',
    '  SATURDAY_OVT / SATEARN    -> saturdayHours',
    '  SUNDAY_OVT / SUNDAYEARN   -> sundayHours',
    '  PUBLIC_OVT / PUBHOL       -> publicHolidayHours',
    '  REFUND                    -> refundAmount',
  '',
    'Open the CSV files in Excel for review. Use summary vs HRIS timesheet to reconcile contract payroll.',
    '',
    `Rows exported: ${detailRows.length} detail, ${summaryRows.length} summary`,
  ].join('\r\n');

  fs.writeFileSync(readmePath, readme, 'utf8');

  await pool.close();

  console.log(`\nExport complete:`);
  console.log(`  ${detailPath}`);
  console.log(`  ${summaryPath}`);
  console.log(`  ${schemaPath}`);
  console.log(`  ${readmePath}`);
  console.log(`\nSummary employees: ${summaryRows.length}`);
  if (employeeFilter) {
    const match = summaryRows.find((row) => row.employeeCode === employeeFilter);
    if (match) {
      console.log(`\n${employeeFilter} snapshot:`, JSON.stringify(match, null, 2));
    }
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
