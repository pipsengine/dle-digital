import sql from 'mssql';
import { loadWorkspaceEnv } from '../apps/dashboard/lib/dle-enterprise-db';

loadWorkspaceEnv();

const connect = async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SAGE_PAYROLL_DB_HOST || '',
    port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
    database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
    user: process.env.SAGE_PAYROLL_DB_USER || '',
    password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(process.env.SAGE_PAYROLL_DB_INSTANCE ? { instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE } : {}),
    },
    connectionTimeout: 30000,
    requestTimeout: 120000,
  }).connect();
  return pool;
};

const main = async () => {
  const pool = await connect();
  console.log('=== DLE_JUNE Benefits Schema Discovery ===\n');

  const keywordPatterns = [
    '%Benefit%', '%Pension%', '%PFA%', '%RSA%', '%Retirement%', '%Fund%',
    '%Insurance%', '%HMO%', '%Medical%', '%Health%', '%Welfare%',
    '%Allowance%', '%Dependent%', '%Beneficiar%', '%Claim%', '%Provider%',
    '%NextOfKin%', '%Emergency%', '%Life%', '%GLI%', '%NSITF%', '%NHF%',
  ];
  const where = keywordPatterns.map((p) => `c.name LIKE '${p}'`).join(' OR ');

  const columns = await pool.request().query(`
    SELECT s.name AS schemaName, t.name AS tableName, c.name AS columnName, ty.name AS typeName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE ${where}
    ORDER BY s.name, t.name, c.column_id;
  `);
  console.log(`--- Columns matching benefit keywords (${columns.recordset.length}) ---`);
  console.log(JSON.stringify(columns.recordset, null, 2));

  const tables = await pool.request().query(`
    SELECT s.name AS schemaName, t.name AS tableName, SUM(p.rows) AS rowCount
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    WHERE (
      t.name LIKE '%Benefit%' OR t.name LIKE '%Pension%' OR t.name LIKE '%Retirement%'
      OR t.name LIKE '%Fund%' OR t.name LIKE '%Insurance%' OR t.name LIKE '%Medical%'
      OR t.name LIKE '%Allowance%' OR t.name LIKE '%Dependent%' OR t.name LIKE '%Claim%'
      OR t.name LIKE '%Welfare%' OR t.name LIKE '%HMO%' OR t.name LIKE '%Life%'
      OR t.name LIKE '%NextOfKin%' OR t.name LIKE '%Emergency%'
    )
    GROUP BY s.name, t.name
    ORDER BY SUM(p.rows) DESC, s.name, t.name;
  `);
  console.log(`\n--- Benefit-related tables (${tables.recordset.length}) ---`);
  console.log(JSON.stringify(tables.recordset, null, 2));

  const payrollDefs = await pool.request().query(`
    SELECT 'Earning' AS defType, DefCode AS code, ShortDescription AS shortDesc, LongDescription AS longDesc, Active
    FROM Payroll.EarningDef
    WHERE DefCode LIKE '%ALLOW%' OR DefCode LIKE '%HOUS%' OR DefCode LIKE '%TRANS%'
       OR DefCode LIKE '%HAZ%' OR DefCode LIKE '%SITE%' OR DefCode LIKE '%MEAL%'
       OR DefCode LIKE '%INS%' OR DefCode LIKE '%LIFE%' OR DefCode LIKE '%GLI%'
       OR DefCode LIKE '%MED%' OR DefCode LIKE '%HMO%' OR DefCode LIKE '%WELF%'
       OR DefCode LIKE '%BENEFIT%' OR ShortDescription LIKE '%allow%' OR ShortDescription LIKE '%insur%'
       OR ShortDescription LIKE '%life%' OR ShortDescription LIKE '%medical%' OR ShortDescription LIKE '%welfare%'
    UNION ALL
    SELECT 'Deduction', DefCode, ShortDescription, LongDescription, Active
    FROM Payroll.DeductionDef
    WHERE DefCode LIKE '%PENSION%' OR DefCode LIKE '%PEN%' OR DefCode LIKE '%INS%'
       OR DefCode LIKE '%LIFE%' OR DefCode LIKE '%MED%' OR DefCode LIKE '%HMO%'
       OR DefCode LIKE '%NHF%' OR ShortDescription LIKE '%pension%' OR ShortDescription LIKE '%insur%'
    UNION ALL
    SELECT 'Contribution', DefCode, ShortDescription, LongDescription, Active
    FROM Payroll.CompanyContributionDef
    WHERE DefCode LIKE '%PENSION%' OR DefCode LIKE '%NSITF%' OR DefCode LIKE '%ITF%'
       OR DefCode LIKE '%INS%' OR DefCode LIKE '%LIFE%' OR DefCode LIKE '%MED%'
       OR ShortDescription LIKE '%pension%' OR ShortDescription LIKE '%insur%' OR ShortDescription LIKE '%welfare%'
    ORDER BY defType, code;
  `);
  console.log(`\n--- Payroll benefit-related definitions (${payrollDefs.recordset.length}) ---`);
  console.log(JSON.stringify(payrollDefs.recordset, null, 2));

  const employeeRuleCols = await pool.request().query(`
    SELECT c.name AS columnName, ty.name AS typeName
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Employee' AND t.name = 'EmployeeRule'
    ORDER BY c.column_id;
  `);
  console.log('\n--- Employee.EmployeeRule columns ---');
  console.log(JSON.stringify(employeeRuleCols.recordset, null, 2));

  const retirementFundTables = ['Payroll.EmployeeRetirementFund', 'Payroll.RetirementFund', 'Payroll.FundDefinition', 'Payroll.CompanyRetirementFund'];
  for (const fullName of retirementFundTables) {
    const [schema, table] = fullName.split('.');
    const exists = await pool.request().query(`
      SELECT 1 AS ok FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = '${schema}' AND t.name = '${table}'
    `);
    if (!exists.recordset.length) {
      console.log(`\n--- ${fullName}: NOT FOUND ---`);
      continue;
    }
    const sample = await pool.request().query(`SELECT TOP 5 * FROM ${fullName};`);
    const count = await pool.request().query(`SELECT COUNT(*) AS cnt FROM ${fullName};`);
    console.log(`\n--- ${fullName} (${count.recordset[0]?.cnt} rows, sample) ---`);
    console.log(JSON.stringify(sample.recordset, null, 2));
  }

  const benefitGroupProbe = await pool.request().query(`
    SELECT TOP 20
      c.name AS columnName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE c.name LIKE '%Benefit%' OR c.name LIKE '%MedicalScheme%' OR c.name LIKE '%HMO%'
       OR c.name LIKE '%Scheme%' OR c.name LIKE '%GroupLife%'
    ORDER BY s.name, t.name, c.column_id;
  `);
  console.log('\n--- Benefit/HMO/Scheme column names ---');
  console.log(JSON.stringify(benefitGroupProbe.recordset, null, 2));

  const earningUsage = await pool.request().query(`
    SELECT TOP 30
      edef.DefCode AS code,
      COALESCE(NULLIF(LTRIM(RTRIM(edef.ShortDescription)), ''), edef.DefCode) AS name,
      COUNT(DISTINCT pel.PayslipEarnLineID) AS lineCount,
      COUNT(DISTINCT p.EmployeePayPeriodID) AS employeePeriodCount,
      SUM(ISNULL(pel.Total, 0)) AS totalAmount
    FROM Payroll.PayslipEarnLine pel
    JOIN Payroll.EarningDef edef ON edef.EarningDefID = pel.DefID
    JOIN Payroll.Payslip p ON p.PayslipID = pel.PayslipID
    WHERE edef.DefCode NOT IN ('BASIC', 'BASICPAY', 'BASIC_PAY', 'SALARY', 'CONTRACTBASIC', 'JCWEEKDAY', 'JCWEEKDAY_NT')
      AND (
        edef.DefCode LIKE '%ALLOW%' OR edef.DefCode LIKE '%HOUS%' OR edef.DefCode LIKE '%TRANS%'
        OR edef.DefCode LIKE '%HAZ%' OR edef.DefCode LIKE '%SITE%' OR edef.DefCode LIKE '%MEAL%'
        OR edef.DefCode LIKE '%INS%' OR edef.DefCode LIKE '%LIFE%' OR edef.DefCode LIKE '%MED%'
        OR edef.ShortDescription LIKE '%allow%' OR edef.ShortDescription LIKE '%insur%'
        OR edef.ShortDescription LIKE '%housing%' OR edef.ShortDescription LIKE '%transport%'
        OR edef.ShortDescription LIKE '%hazard%' OR edef.ShortDescription LIKE '%site%'
      )
    GROUP BY edef.DefCode, edef.ShortDescription, edef.LongDescription
    ORDER BY totalAmount DESC;
  `);
  console.log('\n--- Top benefit-related earning lines (historical usage) ---');
  console.log(JSON.stringify(earningUsage.recordset, null, 2));

  const deductionUsage = await pool.request().query(`
    SELECT TOP 20
      dd.DefCode AS code,
      COALESCE(NULLIF(LTRIM(RTRIM(dd.ShortDescription)), ''), dd.DefCode) AS name,
      COUNT(DISTINCT pdl.PayslipDeductionLineID) AS lineCount,
      SUM(ISNULL(pdl.Total, 0)) AS totalAmount
    FROM Payroll.PayslipDeductionLine pdl
    JOIN Payroll.DeductionDef dd ON dd.DeductionDefID = pdl.DefID
    WHERE dd.DefCode LIKE '%PENSION%' OR dd.DefCode LIKE '%PEN%' OR dd.DefCode LIKE '%INS%'
       OR dd.DefCode LIKE '%LIFE%' OR dd.DefCode LIKE '%MED%' OR dd.DefCode LIKE '%NHF%'
       OR dd.ShortDescription LIKE '%pension%' OR dd.ShortDescription LIKE '%insur%'
    GROUP BY dd.DefCode, dd.ShortDescription, dd.LongDescription
    ORDER BY totalAmount DESC;
  `);
  console.log('\n--- Top benefit-related deduction lines ---');
  console.log(JSON.stringify(deductionUsage.recordset, null, 2));

  const employeeDetailBenefitCols = await pool.request().query(`
    SELECT c.name AS columnName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Employee' AND t.name = 'EmployeeDetail'
      AND (
        c.name LIKE '%Pension%' OR c.name LIKE '%Benefit%' OR c.name LIKE '%Medical%'
        OR c.name LIKE '%Insurance%' OR c.name LIKE '%HMO%' OR c.name LIKE '%Fund%'
        OR c.name LIKE '%Scheme%' OR c.name LIKE '%Dependent%' OR c.name LIKE '%NextOfKin%'
      )
    ORDER BY c.column_id;
  `);
  console.log('\n--- Employee.EmployeeDetail benefit columns ---');
  console.log(JSON.stringify(employeeDetailBenefitCols.recordset, null, 2));

  if (employeeDetailBenefitCols.recordset.length) {
    const colList = (employeeDetailBenefitCols.recordset as Array<{ columnName: string }>).map((r) => `[${r.columnName}]`).join(', ');
    const populated = await pool.request().query(`
      SELECT TOP 10 EmployeeID, ${colList}
      FROM Employee.EmployeeDetail
      WHERE ${(employeeDetailBenefitCols.recordset as Array<{ columnName: string }>).map((r) => `NULLIF(LTRIM(RTRIM(CAST([${r.columnName}] AS nvarchar(4000)))), '') IS NOT NULL`).join(' OR ')}
    `);
    console.log('\n--- EmployeeDetail benefit field samples ---');
    console.log(JSON.stringify(populated.recordset, null, 2));
  }

  const leaveAllowance = await pool.request().query(`
    SELECT s.name AS schemaName, t.name AS tableName, SUM(p.rows) AS rowCount
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    WHERE t.name LIKE '%Leave%' OR t.name LIKE '%Absence%'
    GROUP BY s.name, t.name
    HAVING SUM(p.rows) > 0
    ORDER BY SUM(p.rows) DESC;
  `);
  console.log('\n--- Leave/absence tables (welfare overlap) ---');
  console.log(JSON.stringify(leaveAllowance.recordset, null, 2));

  await pool.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
