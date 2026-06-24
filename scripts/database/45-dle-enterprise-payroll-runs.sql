/*
  DLE Enterprise - Payroll Runs persistence
  Unified payroll run storage for DLE Connect payroll processing and management.
*/
USE [DLE_Enterprise];
GO

IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
GO

IF OBJECT_ID(N'[hris].[PayrollRuns]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[PayrollRuns] (
    [run_id]           NVARCHAR(80)   NOT NULL PRIMARY KEY,
    [period_code]      CHAR(7)        NOT NULL,
    [run_status]       NVARCHAR(40)   NOT NULL,
    [employee_count]   INT            NOT NULL CONSTRAINT [DF_hris_PayrollRuns_employee_count] DEFAULT (0),
    [gross_pay]        DECIMAL(19, 4) NOT NULL CONSTRAINT [DF_hris_PayrollRuns_gross_pay] DEFAULT (0),
    [deductions]       DECIMAL(19, 4) NOT NULL CONSTRAINT [DF_hris_PayrollRuns_deductions] DEFAULT (0),
    [net_pay]          DECIMAL(19, 4) NOT NULL CONSTRAINT [DF_hris_PayrollRuns_net_pay] DEFAULT (0),
    [employer_cost]    DECIMAL(19, 4) NOT NULL CONSTRAINT [DF_hris_PayrollRuns_employer_cost] DEFAULT (0),
    [exception_count]  INT            NOT NULL CONSTRAINT [DF_hris_PayrollRuns_exception_count] DEFAULT (0),
    [run_json]         NVARCHAR(MAX)  NOT NULL,
    [created_at]       DATETIME2(3)   NOT NULL CONSTRAINT [DF_hris_PayrollRuns_created_at] DEFAULT (SYSUTCDATETIME()),
    [modified_at]      DATETIME2(3)   NOT NULL CONSTRAINT [DF_hris_PayrollRuns_modified_at] DEFAULT (SYSUTCDATETIME())
  );

  CREATE INDEX [IX_hris_PayrollRuns_period_code] ON [hris].[PayrollRuns] ([period_code] DESC);
  CREATE INDEX [IX_hris_PayrollRuns_run_status] ON [hris].[PayrollRuns] ([run_status]);
END
GO
