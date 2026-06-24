/*
  DLE Enterprise - Payroll periods, audit trail, and calculation snapshots.
  Complements [hris].[PayrollRuns] (script 45).
*/
USE [DLE_Enterprise];
GO

IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
GO

IF OBJECT_ID(N'[hris].[PayrollPeriods]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[PayrollPeriods] (
    [period_code]    CHAR(7)        NOT NULL PRIMARY KEY,
    [period_label]   NVARCHAR(80)   NOT NULL,
    [period_status]  NVARCHAR(40)   NOT NULL,
    [payment_date]   DATE           NULL,
    [opened_at]      DATETIME2(3)   NULL,
    [opened_by]      NVARCHAR(128)  NULL,
    [closed_at]      DATETIME2(3)   NULL,
    [closed_by]      NVARCHAR(128)  NULL,
    [reopened_at]    DATETIME2(3)   NULL,
    [reopened_by]    NVARCHAR(128)  NULL,
    [reopen_reason]  NVARCHAR(500)  NULL,
    [created_at]     DATETIME2(3)   NOT NULL CONSTRAINT [DF_hris_PayrollPeriods_created_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]     DATETIME2(3)   NOT NULL CONSTRAINT [DF_hris_PayrollPeriods_updated_at] DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX [IX_hris_PayrollPeriods_status] ON [hris].[PayrollPeriods] ([period_status]);
END
GO

IF OBJECT_ID(N'[hris].[PayrollSettings]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[PayrollSettings] (
    [setting_key]   NVARCHAR(80)   NOT NULL PRIMARY KEY,
    [setting_value] NVARCHAR(400)  NOT NULL,
    [updated_at]    DATETIME2(3)   NOT NULL CONSTRAINT [DF_hris_PayrollSettings_updated_at] DEFAULT (SYSUTCDATETIME())
  );
END
GO

IF OBJECT_ID(N'[hris].[PayrollRunAudit]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[PayrollRunAudit] (
    [audit_id]    NVARCHAR(80)   NOT NULL PRIMARY KEY,
    [run_id]      NVARCHAR(80)   NULL,
    [record_ref]  NVARCHAR(120)  NULL,
    [at]          DATETIME2(3)   NOT NULL,
    [user_name]   NVARCHAR(128)  NOT NULL,
    [role_name]   NVARCHAR(80)   NOT NULL,
    [action]      NVARCHAR(120)  NOT NULL,
    [old_value]   NVARCHAR(400)  NULL,
    [new_value]   NVARCHAR(400)  NULL,
    [reason]      NVARCHAR(500)  NULL,
    [comment]     NVARCHAR(1000) NULL,
    [ip_address]  NVARCHAR(64)   NULL
  );
  CREATE INDEX [IX_hris_PayrollRunAudit_at] ON [hris].[PayrollRunAudit] ([at] DESC);
  CREATE INDEX [IX_hris_PayrollRunAudit_run_id] ON [hris].[PayrollRunAudit] ([run_id]);
END
GO

IF OBJECT_ID(N'[hris].[PayrollRunSnapshots]', N'U') IS NULL
BEGIN
  CREATE TABLE [hris].[PayrollRunSnapshots] (
    [run_id]        NVARCHAR(80)  NOT NULL PRIMARY KEY,
    [captured_at]   DATETIME2(3)  NOT NULL,
    [captured_by]   NVARCHAR(128) NOT NULL,
    [action]        NVARCHAR(80)  NOT NULL,
    [snapshot_json] NVARCHAR(MAX) NOT NULL
  );
END
GO

IF OBJECT_ID(N'[hris].[PayrollRuns]', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_hris_PayrollRuns_period_code'
      AND object_id = OBJECT_ID(N'[hris].[PayrollRuns]')
  )
BEGIN
  CREATE UNIQUE INDEX [UX_hris_PayrollRuns_period_code] ON [hris].[PayrollRuns] ([period_code]);
END
GO
