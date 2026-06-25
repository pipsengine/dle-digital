-- Latest payslip allowance/deduction snapshot columns for employee profile payroll tab.
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'latest_allowances') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD latest_allowances decimal(19,4) NULL;
GO
IF COL_LENGTH(N'hris.EmployeePayrollSetup', N'latest_deductions') IS NULL
  ALTER TABLE [hris].[EmployeePayrollSetup] ADD latest_deductions decimal(19,4) NULL;
GO
