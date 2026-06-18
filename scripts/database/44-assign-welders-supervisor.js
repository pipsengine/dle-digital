const fs = require('fs');
const sql = require('mssql');

const ASSIGNMENT_BATCH = '2026-06-18-welders-supervisor';
const ASSIGNMENT_GROUP = 'WELDERS';
const SUPERVISOR_CODE = 'P0072';
const PERFORMED_BY = 'codex.database-import';
const REASON = 'Welders supervisor assignment from provided WELDERS schedule.';

const roster = [
  { sourceName: 'Adewale Adekoya', tradeRole: '6G SMAW+GTAW Welder', employeeCode: 'C1162', matchConfidence: 'Exact' },
  { sourceName: 'Ibrahim Mohammed', tradeRole: '6G SMAW+GTAW Welder', employeeCode: 'C1728', matchConfidence: 'ExactReversed' },
  { sourceName: 'Ebuno Kennedy', tradeRole: '6G SMAW+GTAW Welder', employeeCode: 'C1779', matchConfidence: 'ExactReversed' },
  { sourceName: 'Nasiru Jamiu', tradeRole: '6G SMAW+1G SAW Welder', employeeCode: 'C2462', matchConfidence: 'Exact' },
  { sourceName: 'Mohammed Rotimi', tradeRole: '6G SMAW Welder', employeeCode: 'C2566', matchConfidence: 'Exact' },
  { sourceName: 'CHINEMERE ONWUN', tradeRole: '6G SMAW Welder', employeeCode: 'C2507', matchConfidence: 'Prefix', matchNote: 'Database surname is ONWUNTA.' },
  { sourceName: 'Oyabugbe Irikefe', tradeRole: '6G SMAW Welder', employeeCode: 'C2597', matchConfidence: 'Exact' },
  { sourceName: 'ONYEMERI ABRAHAM', tradeRole: '6G SMAW Welder', employeeCode: 'C1938', matchConfidence: 'ExactReversed' },
  { sourceName: 'Christopher Osauzo', tradeRole: '6G SMAW Welder', employeeCode: 'C2665', matchConfidence: 'Exact' },
  { sourceName: 'Okpe Daniel', tradeRole: '6G SMAW+GTAW Welder', employeeCode: 'C2421', matchConfidence: 'Exact' },
  { sourceName: 'Janet James', tradeRole: '3G Welder/SMAW', employeeCode: 'C2463', matchConfidence: 'Exact' },
  { sourceName: 'Mbarama Richard', tradeRole: 'Hydrotester', employeeCode: 'C1612', matchConfidence: 'SpellingAlias', matchNote: 'Database surname is MBAMARA.' },
  { sourceName: 'Olatunji Yekini', tradeRole: '1G Saw Welder', employeeCode: 'C1888', matchConfidence: 'Exact' },
  { sourceName: 'Uzoma Veronica', tradeRole: '6G GTAW Welder', employeeCode: 'C2805', matchConfidence: 'ExactReversed' },
  { sourceName: 'Monday Nwachukwu', tradeRole: '6G Welder SMAW', employeeCode: 'C2623', matchConfidence: 'Exact' },
  { sourceName: 'Oguwa Christian', tradeRole: '3G Welder/SMAW', employeeCode: null, matchConfidence: 'Unresolved', matchNote: 'No safe database match found. Possible OGWUA/CHRIS record needs human confirmation.' },
  { sourceName: 'Godwin Akor', tradeRole: '3G Welder/SMAW', employeeCode: 'C2445', matchConfidence: 'Exact' },
  { sourceName: 'Ichukwu Peter', tradeRole: '3G Welder/SMAW', employeeCode: 'C2449', matchConfidence: 'ExactReversed' },
  { sourceName: 'Onaji Friday', tradeRole: '3G SMAW Welder', employeeCode: 'C2605', matchConfidence: 'ExactReversed' },
  { sourceName: 'Obilikwu Raphael', tradeRole: '3G SMAW Welder', employeeCode: 'C2482', matchConfidence: 'ExactReversed' },
  { sourceName: 'Moses Aimanokhai', tradeRole: 'Consumables Controller', employeeCode: 'C2724', matchConfidence: 'SpellingAlias', matchNote: 'Database surname is AMANOKHAI.' },
  { sourceName: 'NWOSU CHIBUEZE', tradeRole: '6G Welder SMAW', employeeCode: 'C2002', matchConfidence: 'ExactReversed' },
  { sourceName: 'Kingsley Obiefe', tradeRole: '6G SMAW/Welder', employeeCode: 'C2469', matchConfidence: 'SpellingAlias', matchNote: 'Database surname is OBIEJE.' },
  { sourceName: 'Jerome Micheal', tradeRole: '6G SMAW/Welder', employeeCode: 'C1736', matchConfidence: 'SpellingAlias', matchNote: 'Database first name is MICHAEL.' },
  { sourceName: 'Ogunyemi Ismaila', tradeRole: '6G SMAW/Welder', employeeCode: 'C1889', matchConfidence: 'ExactReversed' },
  { sourceName: 'Sunday Olarewaju', tradeRole: '1G Welder', employeeCode: 'C2776', matchConfidence: 'SpellingAlias', matchNote: 'Database name is OLANREWAJU ISAIAH SUNDAY.' },
  { sourceName: 'Dia John Kaita', tradeRole: 'Welder mate', employeeCode: 'C2809', matchConfidence: 'Partial', matchNote: 'Database name is JOHN DIA; KAITA was not present in the employee record.' },
  { sourceName: 'Fatai Shonde', tradeRole: '6G SMAW+GTAW Welder (Staff)', employeeCode: 'P0033', matchConfidence: 'Exact' },
  { sourceName: 'Owolabi Akeeb', tradeRole: '6G SMAW+GTAW Welder (Staff)', employeeCode: 'P0050', matchConfidence: 'Exact' },
];

const dryRun = process.argv.includes('--dry-run');

function loadWorkspaceEnv() {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function dbConfig() {
  return {
    server: process.env.DLE_ENTERPRISE_DB_HOST,
    port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
    database: process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise',
    user: process.env.DLE_ENTERPRISE_DB_USER,
    password: process.env.DLE_ENTERPRISE_DB_PASSWORD,
    options: {
      encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT).toLowerCase() !== 'false',
      trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE).toLowerCase() === 'true',
    },
  };
}

async function ensureAssignmentTable(request) {
  await request.query(`
IF OBJECT_ID(N'[hris].[SupervisorEmployeeAssignments]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[SupervisorEmployeeAssignments] (
    assignment_id bigint IDENTITY(1,1) NOT NULL,
    assignment_batch nvarchar(120) NOT NULL,
    assignment_group nvarchar(120) NOT NULL,
    source_label nvarchar(250) NOT NULL,
    supervisor_employee_id bigint NULL,
    supervisor_employee_code nvarchar(50) NULL,
    supervisor_name nvarchar(250) NULL,
    employee_id bigint NULL,
    employee_code nvarchar(50) NULL,
    employee_name nvarchar(250) NULL,
    trade_role nvarchar(250) NULL,
    matched_status nvarchar(40) NOT NULL,
    match_confidence nvarchar(40) NULL,
    match_note nvarchar(500) NULL,
    previous_reporting_manager nvarchar(250) NULL,
    new_reporting_manager nvarchar(250) NULL,
    assigned_at datetime2(0) NOT NULL CONSTRAINT DF_SupervisorEmployeeAssignments_assigned_at DEFAULT SYSUTCDATETIME(),
    assigned_by sysname NOT NULL CONSTRAINT DF_SupervisorEmployeeAssignments_assigned_by DEFAULT SUSER_SNAME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_SupervisorEmployeeAssignments PRIMARY KEY CLUSTERED (assignment_id)
  );

  CREATE UNIQUE INDEX UX_SupervisorEmployeeAssignments_BatchSource
    ON [hris].[SupervisorEmployeeAssignments](assignment_batch, source_label);
END;
`);
}

async function findEmployee(tx, employeeCode) {
  if (!employeeCode) return null;
  const result = await new sql.Request(tx)
    .input('employee_code', sql.NVarChar(50), employeeCode)
    .query(`
SELECT TOP 1 e.employee_id, e.employee_code, e.full_name, e.employment_status,
       p.first_name, p.middle_name, p.last_name,
       j.reporting_manager, j.job_title
FROM [hris].[Employees] e
LEFT JOIN [hris].[EmployeePersonalInfo] p ON p.employee_id = e.employee_id
LEFT JOIN [hris].[EmployeeJobInfo] j ON j.employee_id = e.employee_id
WHERE e.employee_code = @employee_code
ORDER BY e.employee_id;
`);
  return result.recordset[0] || null;
}

function displayName(employee) {
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || employee.full_name;
}

async function upsertAssignment(tx, values) {
  await new sql.Request(tx)
    .input('assignment_batch', sql.NVarChar(120), ASSIGNMENT_BATCH)
    .input('assignment_group', sql.NVarChar(120), ASSIGNMENT_GROUP)
    .input('source_label', sql.NVarChar(250), values.sourceName)
    .input('supervisor_employee_id', sql.BigInt, values.supervisorEmployeeId)
    .input('supervisor_employee_code', sql.NVarChar(50), values.supervisorEmployeeCode)
    .input('supervisor_name', sql.NVarChar(250), values.supervisorName)
    .input('employee_id', sql.BigInt, values.employeeId)
    .input('employee_code', sql.NVarChar(50), values.employeeCode)
    .input('employee_name', sql.NVarChar(250), values.employeeName)
    .input('trade_role', sql.NVarChar(250), values.tradeRole)
    .input('matched_status', sql.NVarChar(40), values.matchedStatus)
    .input('match_confidence', sql.NVarChar(40), values.matchConfidence)
    .input('match_note', sql.NVarChar(500), values.matchNote)
    .input('previous_reporting_manager', sql.NVarChar(250), values.previousReportingManager)
    .input('new_reporting_manager', sql.NVarChar(250), values.newReportingManager)
    .input('assigned_by', sql.NVarChar(128), PERFORMED_BY)
    .query(`
MERGE [hris].[SupervisorEmployeeAssignments] AS target
USING (SELECT @assignment_batch AS assignment_batch, @source_label AS source_label) AS source
ON target.assignment_batch = source.assignment_batch AND target.source_label = source.source_label
WHEN MATCHED THEN UPDATE SET
  assignment_group = @assignment_group,
  supervisor_employee_id = @supervisor_employee_id,
  supervisor_employee_code = @supervisor_employee_code,
  supervisor_name = @supervisor_name,
  employee_id = @employee_id,
  employee_code = @employee_code,
  employee_name = @employee_name,
  trade_role = @trade_role,
  matched_status = @matched_status,
  match_confidence = @match_confidence,
  match_note = @match_note,
  previous_reporting_manager = @previous_reporting_manager,
  new_reporting_manager = @new_reporting_manager,
  assigned_at = SYSUTCDATETIME(),
  assigned_by = @assigned_by
WHEN NOT MATCHED THEN INSERT (
  assignment_batch, assignment_group, source_label, supervisor_employee_id, supervisor_employee_code,
  supervisor_name, employee_id, employee_code, employee_name, trade_role, matched_status,
  match_confidence, match_note, previous_reporting_manager, new_reporting_manager, assigned_by
) VALUES (
  @assignment_batch, @assignment_group, @source_label, @supervisor_employee_id, @supervisor_employee_code,
  @supervisor_name, @employee_id, @employee_code, @employee_name, @trade_role, @matched_status,
  @match_confidence, @match_note, @previous_reporting_manager, @new_reporting_manager, @assigned_by
);
`);
}

async function main() {
  loadWorkspaceEnv();
  const pool = await sql.connect(dbConfig());
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    await ensureAssignmentTable(new sql.Request(tx));

    const supervisor = await findEmployee(tx, SUPERVISOR_CODE);
    if (!supervisor) throw new Error(`Supervisor ${SUPERVISOR_CODE} was not found.`);
    const supervisorLabel = `${supervisor.employee_code} - ${supervisor.full_name}`;
    const supervisorName = displayName(supervisor);

    const results = [];

    await new sql.Request(tx)
      .input('employee_id', sql.BigInt, supervisor.employee_id)
      .query(`
MERGE [hris].[EmployeeJobInfo] AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET is_people_manager = 1, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, is_people_manager, is_budget_owner)
VALUES (@employee_id, 1, 0);
`);

    for (const item of roster) {
      const employee = await findEmployee(tx, item.employeeCode);
      const matchedStatus = employee ? 'Matched' : 'Unresolved';
      const previousReportingManager = employee?.reporting_manager || null;
      const employeeName = employee ? displayName(employee) : null;
      const newReportingManager = employee ? supervisorLabel : null;

      await upsertAssignment(tx, {
        sourceName: item.sourceName,
        supervisorEmployeeId: supervisor.employee_id,
        supervisorEmployeeCode: supervisor.employee_code,
        supervisorName,
        employeeId: employee?.employee_id || null,
        employeeCode: employee?.employee_code || item.employeeCode,
        employeeName,
        tradeRole: item.tradeRole,
        matchedStatus,
        matchConfidence: item.matchConfidence,
        matchNote: item.matchNote || null,
        previousReportingManager,
        newReportingManager,
      });

      if (employee) {
        await new sql.Request(tx)
          .input('employee_id', sql.BigInt, employee.employee_id)
          .input('reporting_manager', sql.NVarChar(250), supervisorLabel)
          .query(`
MERGE [hris].[EmployeeJobInfo] AS target
USING (SELECT @employee_id AS employee_id) AS source
ON target.employee_id = source.employee_id
WHEN MATCHED THEN UPDATE SET reporting_manager = @reporting_manager, modified_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (employee_id, reporting_manager, is_people_manager, is_budget_owner)
VALUES (@employee_id, @reporting_manager, 0, 0);
`);

        if (previousReportingManager !== supervisorLabel) {
          await new sql.Request(tx)
            .input('employee_id', sql.BigInt, employee.employee_id)
            .input('audit_action', sql.NVarChar(150), 'Supervisor assignment import')
            .input('performed_by', sql.NVarChar(128), PERFORMED_BY)
            .input('reason', sql.NVarChar(1000), REASON)
            .input('old_value', sql.NVarChar(sql.MAX), JSON.stringify({ reportingManager: previousReportingManager }))
            .input('new_value', sql.NVarChar(sql.MAX), JSON.stringify({
              reportingManager: supervisorLabel,
              assignmentBatch: ASSIGNMENT_BATCH,
              assignmentGroup: ASSIGNMENT_GROUP,
              sourceName: item.sourceName,
              tradeRole: item.tradeRole,
              matchConfidence: item.matchConfidence,
              matchNote: item.matchNote || null,
            }))
            .query(`
INSERT [hris].[EmployeeAuditLog](employee_id, audit_action, performed_by, reason, old_value, new_value)
VALUES (@employee_id, @audit_action, @performed_by, @reason, @old_value, @new_value);
`);
        }
      }

      results.push({
        sourceName: item.sourceName,
        employeeCode: employee?.employee_code || item.employeeCode || '',
        employeeName: employeeName || '',
        status: matchedStatus,
        previousReportingManager,
        newReportingManager,
        note: item.matchNote || '',
      });
    }

    if (dryRun) {
      await tx.rollback();
    } else {
      await tx.commit();
    }

    console.table(results);
    console.log(`${dryRun ? 'Dry run complete' : 'Assignment committed'}: ${results.filter((x) => x.status === 'Matched').length} matched, ${results.filter((x) => x.status !== 'Matched').length} unresolved.`);
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
