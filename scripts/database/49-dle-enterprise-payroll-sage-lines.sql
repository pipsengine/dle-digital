-- Persist latest Sage payslip earning/deduction/contribution line snapshots on employee payroll setup.
USE [DLE_Enterprise];
GO

IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_payslip_period') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_payslip_period] nvarchar(7) NULL;
GO
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_earning_lines_json') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_earning_lines_json] nvarchar(max) NULL;
GO
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_deduction_lines_json') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_deduction_lines_json] nvarchar(max) NULL;
GO
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_contribution_lines_json') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_contribution_lines_json] nvarchar(max) NULL;
GO
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'sage_payslip_synced_at') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD [sage_payslip_synced_at] datetime2(3) NULL;
GO
