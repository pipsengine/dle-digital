USE [DLE_Enterprise];
GO

SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'[hris].[EmployeeSourceRecords]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'hris.Employees', N'source_system') IS NOT NULL
    AND COL_LENGTH(N'hris.Employees', N'source_employee_id') IS NOT NULL
  BEGIN
    INSERT [hris].[EmployeeSourceRecords] (
      employee_id, source_system, source_employee_id, source_employee_code, raw_payload_json
    )
    SELECT
      e.employee_id,
      e.source_system,
      e.source_employee_id,
      e.employee_code,
      N'{"migratedFrom":"hris.Employees"}'
    FROM [hris].[Employees] e
    WHERE e.source_employee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM [hris].[EmployeeSourceRecords] src
        WHERE src.source_system = e.source_system
          AND src.source_employee_id = e.source_employee_id
      );
  END;

  IF COL_LENGTH(N'hris.Employees', N'source_draft_id') IS NOT NULL
  BEGIN
    INSERT [hris].[EmployeeSourceRecords] (
      employee_id, source_system, source_employee_id, source_employee_code, raw_payload_json
    )
    SELECT
      e.employee_id,
      N'DLE Employee Draft',
      e.source_draft_id,
      e.employee_code,
      N'{"migratedFrom":"hris.Employees.source_draft_id"}'
    FROM [hris].[Employees] e
    WHERE e.source_draft_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM [hris].[EmployeeSourceRecords] src
        WHERE src.source_system = N'DLE Employee Draft'
          AND src.source_employee_id = e.source_draft_id
      );
  END;
END;
GO

CREATE OR ALTER VIEW [hris].[EmployeeMasterView]
AS
SELECT
  e.employee_id,
  e.employee_code,
  e.full_name,
  e.preferred_name,
  e.employment_status,
  e.employment_type,
  p.first_name,
  p.middle_name,
  p.last_name,
  p.gender,
  p.date_of_birth,
  c.official_email,
  c.personal_email,
  c.primary_phone,
  c.city,
  c.state,
  c.country,
  emp.date_joined,
  emp.work_mode,
  emp.work_location,
  j.job_title,
  j.designation,
  j.job_grade,
  j.department,
  j.division,
  j.business_unit,
  j.cost_center,
  j.project_site,
  j.reporting_manager,
  e.created_at,
  e.modified_at
FROM [hris].[Employees] e
LEFT JOIN [hris].[EmployeePersonalInfo] p ON p.employee_id = e.employee_id
LEFT JOIN [hris].[EmployeeContactInfo] c ON c.employee_id = e.employee_id
LEFT JOIN [hris].[EmployeeEmploymentInfo] emp ON emp.employee_id = e.employee_id
LEFT JOIN [hris].[EmployeeJobInfo] j ON j.employee_id = e.employee_id;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[hris].[Employees]') AND name = N'IX_Employees_active_status')
  DROP INDEX IX_Employees_active_status ON [hris].[Employees];
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[hris].[Employees]') AND name = N'FK_Employees_SourceDraft')
  ALTER TABLE [hris].[Employees] DROP CONSTRAINT FK_Employees_SourceDraft;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'[hris].[Employees]') AND name = N'CK_Employees_soft_delete')
  ALTER TABLE [hris].[Employees] DROP CONSTRAINT CK_Employees_soft_delete;
GO

DECLARE @dropDefaults nvarchar(max) = N'';

SELECT @dropDefaults += N'ALTER TABLE [hris].[Employees] DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(13)
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.object_id = dc.parent_object_id
 AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'[hris].[Employees]')
  AND c.name IN (N'source_system', N'is_deleted');

IF @dropDefaults <> N''
  EXEC sys.sp_executesql @dropDefaults;
GO

IF COL_LENGTH(N'hris.Employees', N'source_system') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN source_system;
GO
IF COL_LENGTH(N'hris.Employees', N'source_employee_id') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN source_employee_id;
GO
IF COL_LENGTH(N'hris.Employees', N'source_draft_id') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN source_draft_id;
GO
IF COL_LENGTH(N'hris.Employees', N'is_deleted') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN is_deleted;
GO
IF COL_LENGTH(N'hris.Employees', N'deleted_at') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN deleted_at;
GO
IF COL_LENGTH(N'hris.Employees', N'deleted_by') IS NOT NULL
  ALTER TABLE [hris].[Employees] DROP COLUMN deleted_by;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[hris].[Employees]') AND name = N'IX_Employees_active_status')
  CREATE INDEX IX_Employees_active_status ON [hris].[Employees](employment_status, employment_type) INCLUDE (employee_code, full_name);
GO
