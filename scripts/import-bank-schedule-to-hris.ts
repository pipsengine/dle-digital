import { readFile } from 'node:fs/promises';
import sql from 'mssql';
import { getDleEnterpriseDbPool } from '../apps/dashboard/lib/dle-enterprise-db';

type BankScheduleRow = {
  employeeCode: string;
  fullName?: string;
  bankName?: string;
  accountNo?: string;
  branchCode?: string;
  payrollGroup?: string;
};

const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error('Usage: npx tsx scripts/import-bank-schedule-to-hris.ts <bank-identities.json>');
}

const nullable = (value: unknown) => {
  const text = String(value || '').trim();
  return text || null;
};

const permanentCode = (value: unknown) => {
  const text = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^\d+$/.test(text)) return '';
  return `P${text.padStart(4, '0')}`;
};

const main = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) throw new Error('DLE Enterprise DB unavailable.');

  const raw = (await readFile(inputPath, 'utf8')).replace(/^\uFEFF/, '');
  const rows = JSON.parse(raw) as BankScheduleRow[];

  await pool.request().query(`
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'bank_code') IS NULL
      ALTER TABLE hris.EmployeePayrollSetup ADD bank_code nvarchar(50) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'branch_name') IS NULL
      ALTER TABLE hris.EmployeePayrollSetup ADD branch_name nvarchar(150) NULL;
    IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'branch_code') IS NULL
      ALTER TABLE hris.EmployeePayrollSetup ADD branch_code nvarchar(50) NULL;
  `);

  let updated = 0;
  let inserted = 0;
  let missing = 0;

  for (const row of rows) {
    const result = await pool.request()
      .input('employee_code', sql.NVarChar(50), nullable(row.employeeCode))
      .input('permanent_employee_code', sql.NVarChar(50), nullable(permanentCode(row.employeeCode)))
      .input('bank_name', sql.NVarChar(150), nullable(row.bankName))
      .input('account_number', sql.NVarChar(50), nullable(row.accountNo))
      .input('account_name', sql.NVarChar(250), nullable(row.fullName))
      .input('bank_code', sql.NVarChar(50), null)
      .input('branch_name', sql.NVarChar(150), null)
      .input('branch_code', sql.NVarChar(50), nullable(row.branchCode))
      .input('payroll_group', sql.NVarChar(100), nullable(row.payrollGroup))
      .query(`
        DECLARE @employee_id bigint;
        SELECT @employee_id = employee_id
        FROM hris.Employees
        WHERE employee_code = @employee_code
           OR employee_code = @permanent_employee_code;

        IF @employee_id IS NULL
        BEGIN
          SELECT CAST(0 AS int) AS action;
          RETURN;
        END;

        IF EXISTS (SELECT 1 FROM hris.EmployeePayrollSetup WHERE employee_id = @employee_id)
        BEGIN
          UPDATE hris.EmployeePayrollSetup
          SET bank_name = COALESCE(NULLIF(@bank_name, N''), bank_name),
              account_number = COALESCE(NULLIF(@account_number, N''), account_number),
              account_name = COALESCE(NULLIF(@account_name, N''), account_name),
              bank_code = COALESCE(NULLIF(@bank_code, N''), bank_code),
              branch_name = COALESCE(NULLIF(@branch_name, N''), branch_name),
              branch_code = COALESCE(NULLIF(@branch_code, N''), branch_code),
              payroll_group = COALESCE(NULLIF(@payroll_group, N''), payroll_group),
              modified_at = SYSUTCDATETIME()
          WHERE employee_id = @employee_id;
          SELECT CAST(1 AS int) AS action;
        END
        ELSE
        BEGIN
          INSERT hris.EmployeePayrollSetup(
            employee_id, payroll_group, bank_name, account_number, account_name,
            bank_code, branch_name, branch_code, setup_assigned_to_payroll
          )
          VALUES(
            @employee_id, @payroll_group, @bank_name, @account_number, @account_name,
            @bank_code, @branch_name, @branch_code, 1
          );
          SELECT CAST(2 AS int) AS action;
        END;
      `);

    const action = Number(result.recordset?.[0]?.action || 0);
    if (action === 1) updated += 1;
    else if (action === 2) inserted += 1;
    else missing += 1;
  }

  console.log(JSON.stringify({ rows: rows.length, updated, inserted, missing }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
