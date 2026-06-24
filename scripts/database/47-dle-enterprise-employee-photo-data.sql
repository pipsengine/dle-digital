USE [DLE_Enterprise];
GO

SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_data') IS NULL
BEGIN
  ALTER TABLE [hris].[EmployeePersonalInfo]
    ADD photo_data varbinary(max) NULL;
END;
GO

IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_source') IS NULL
BEGIN
  ALTER TABLE [hris].[EmployeePersonalInfo]
    ADD photo_source nvarchar(120) NULL;
END;
GO

IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_migrated_at') IS NULL
BEGIN
  ALTER TABLE [hris].[EmployeePersonalInfo]
    ADD photo_migrated_at datetime2(0) NULL;
END;
GO
