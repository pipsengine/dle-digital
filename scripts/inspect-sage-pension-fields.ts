import sql from 'mssql';
import { loadWorkspaceEnv } from '../apps/dashboard/lib/dle-enterprise-db';

loadWorkspaceEnv();

const main = async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.SAGE_PAYROLL_DB_HOST || '',
    port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
    database: process.env.SAGE_PAYROLL_DB_NAME || '',
    user: process.env.SAGE_PAYROLL_DB_USER || '',
    password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(process.env.SAGE_PAYROLL_DB_INSTANCE ? { instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE } : {}),
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  }).connect();

  const result = await pool.request().query(`
    SELECT TOP 300
      s.name AS schemaName,
      t.name AS tableName,
      c.name AS columnName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE c.name LIKE '%Pension%'
       OR c.name LIKE '%PFA%'
       OR c.name LIKE '%RSA%'
       OR c.name LIKE '%Retirement%'
       OR c.name LIKE '%Fund%'
       OR c.name LIKE '%PIN%'
    ORDER BY s.name, t.name, c.column_id;
  `);

  console.log(JSON.stringify(result.recordset, null, 2));

  const tableColumns = await pool.request().query(`
    SELECT
      s.name AS schemaName,
      t.name AS tableName,
      c.column_id AS columnId,
      c.name AS columnName,
      ty.name AS typeName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE (s.name = 'Payroll' AND t.name IN ('EmployeeRetirementFund', 'RetirementFund', 'FundDefinition', 'CompanyRetirementFund'))
       OR (s.name = 'Employee' AND t.name IN ('EmployeeRule'))
    ORDER BY s.name, t.name, c.column_id;
  `);

  console.log('--- table columns ---');
  console.log(JSON.stringify(tableColumns.recordset, null, 2));
  await pool.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
