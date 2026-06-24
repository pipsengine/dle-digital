const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const loadEnv = () => {
  for (const file of [path.join(process.cwd(), '.env'), path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
};

const clean = (value) => String(value ?? '').trim();

const employeeCode = (rawCode) => {
  const code = clean(rawCode).replace(/_/g, '').toUpperCase();
  if (!code) return '';
  if (/^(P|C|L|IT|NYSC|N|I)/.test(code)) return code;
  return `P${code}`;
};

const extensionForMime = (mimeType) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/bmp') return 'bmp';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

const detectMime = (buffer) => {
  if (!buffer || buffer.length < 4) return 'application/octet-stream';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  return 'image/jpeg';
};

const sageConfig = () => ({
  server: process.env.SAGE_PAYROLL_DB_HOST || '192.168.5.8',
  port: Number(process.env.SAGE_PAYROLL_DB_PORT || 1433),
  database: process.env.SAGE_PAYROLL_DB_NAME || 'DLE_JUNE',
  user: process.env.SAGE_PAYROLL_DB_USER || 'sa',
  password: process.env.SAGE_PAYROLL_DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.SAGE_PAYROLL_DB_INSTANCE || 'MSSQLSERVERPEOPL',
  },
  connectionTimeout: Number(process.env.SAGE_PAYROLL_DB_CONNECT_TIMEOUT || 15000),
  requestTimeout: Number(process.env.SAGE_PAYROLL_DB_REQUEST_TIMEOUT || 300000),
});

const dleConfig = () => ({
  server: process.env.DLE_ENTERPRISE_DB_HOST || '192.168.5.5',
  port: Number(process.env.DLE_ENTERPRISE_DB_PORT || 1433),
  database: process.env.DLE_ENTERPRISE_DB_NAME || 'DLE_Enterprise',
  user: process.env.DLE_ENTERPRISE_DB_USER || 'sa',
  password: process.env.DLE_ENTERPRISE_DB_PASSWORD || '',
  options: {
    encrypt: String(process.env.DLE_ENTERPRISE_DB_ENCRYPT || 'true').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.DLE_ENTERPRISE_DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true',
  },
  connectionTimeout: 15000,
  requestTimeout: 300000,
});

const ensurePhotoColumns = async (pool) => {
  await pool.request().query(`
    IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_data') IS NULL
      ALTER TABLE [hris].[EmployeePersonalInfo] ADD photo_data varbinary(max) NULL;
    IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_source') IS NULL
      ALTER TABLE [hris].[EmployeePersonalInfo] ADD photo_source nvarchar(120) NULL;
    IF COL_LENGTH(N'hris.EmployeePersonalInfo', N'photo_migrated_at') IS NULL
      ALTER TABLE [hris].[EmployeePersonalInfo] ADD photo_migrated_at datetime2(0) NULL;
  `);
};

const readSageEmployeePhotos = async (limit = 0) => {
  const pool = await new sql.ConnectionPool(sageConfig()).connect();
  try {
    const top = limit > 0 ? `TOP (${limit})` : '';
    const result = await pool.request().query(`
      SELECT ${top}
        e.EmployeeID AS sourceEmployeeId,
        e.EmployeeCode AS rawEmployeeCode,
        ge.DisplayName AS displayName,
        CAST(gp.Photo AS varbinary(max)) AS photoData,
        DATALENGTH(gp.Photo) AS photoSize
      FROM Employee.Employee e
      JOIN Entity.GenEntity ge ON ge.GenEntityID = e.GenEntityID
      JOIN Company.Company c ON c.CompanyID = e.CompanyID
      LEFT JOIN Employee.EmployeeStatus es ON es.EmployeeStatusID = e.EmployeeStatusID
      INNER JOIN Entity.GenEntityPhoto gp ON gp.GenEntityID = ge.GenEntityID
      WHERE e.TerminationDate IS NULL
        AND ISNULL(es.Code, 'A') = 'A'
        AND ge.Status = 'A'
        AND c.Status = 'A'
        AND gp.Photo IS NOT NULL
        AND DATALENGTH(gp.Photo) > 0
      ORDER BY e.EmployeeCode;
    `);
    return result.recordset;
  } finally {
    await pool.close();
  }
};

const migratePhoto = async (pool, row, dryRun) => {
  const code = employeeCode(row.rawEmployeeCode);
  const sourceEmployeeId = clean(row.sourceEmployeeId);
  const buffer = Buffer.isBuffer(row.photoData) ? row.photoData : row.photoData ? Buffer.from(row.photoData) : null;
  if (!code || !buffer?.length) return { status: 'skipped', reason: 'missing-code-or-photo', code, sourceEmployeeId };

  const mimeType = detectMime(buffer);
  const fileName = `${code}.${extensionForMime(mimeType)}`;
  const sizeBytes = buffer.length;

  if (dryRun) {
    return { status: 'dry-run', code, sourceEmployeeId, fileName, mimeType, sizeBytes };
  }

  const request = pool
    .request()
    .input('employee_code', sql.NVarChar(50), code)
    .input('source_employee_id', sql.NVarChar(80), sourceEmployeeId)
    .input('photo_data', sql.VarBinary(sql.MAX), buffer)
    .input('photo_file_name', sql.NVarChar(260), fileName)
    .input('photo_mime_type', sql.NVarChar(120), mimeType)
    .input('photo_size_bytes', sql.BigInt, sizeBytes);

  const result = await request.query(`
    DECLARE @employee_id bigint;

    SELECT @employee_id = employee_id
    FROM [hris].[EmployeeSourceRecords] WITH (UPDLOCK, HOLDLOCK)
    WHERE source_system = N'Sage 300 People Payroll'
      AND source_employee_id = @source_employee_id;

    IF @employee_id IS NULL
    BEGIN
      SELECT @employee_id = employee_id
      FROM [hris].[Employees] WITH (UPDLOCK, HOLDLOCK)
      WHERE employee_code = @employee_code;
    END;

    IF @employee_id IS NULL
    BEGIN
      SELECT 0 AS synced, N'employee-not-found' AS reason;
      RETURN;
    END;

    IF EXISTS (SELECT 1 FROM [hris].[EmployeePersonalInfo] WHERE employee_id = @employee_id)
    BEGIN
      UPDATE [hris].[EmployeePersonalInfo]
      SET photo_data = @photo_data,
          photo_file_name = @photo_file_name,
          photo_mime_type = @photo_mime_type,
          photo_size_bytes = @photo_size_bytes,
          photo_source = N'Sage 300 People Payroll',
          photo_migrated_at = SYSUTCDATETIME(),
          modified_at = SYSUTCDATETIME()
      WHERE employee_id = @employee_id;
    END
    ELSE
    BEGIN
      INSERT INTO [hris].[EmployeePersonalInfo] (
        employee_id, first_name, last_name, photo_data, photo_file_name, photo_mime_type, photo_size_bytes, photo_source, photo_migrated_at
      )
      SELECT
        @employee_id,
        COALESCE(NULLIF(LTRIM(RTRIM(e.full_name)), N''), @employee_code),
        N'-',
        @photo_data,
        @photo_file_name,
        @photo_mime_type,
        @photo_size_bytes,
        N'Sage 300 People Payroll',
        SYSUTCDATETIME()
      FROM [hris].[Employees] e
      WHERE e.employee_id = @employee_id;
    END;

    SELECT 1 AS synced, NULL AS reason;
  `);

  const synced = result.recordset?.[0]?.synced === 1;
  return {
    status: synced ? 'migrated' : 'skipped',
    reason: result.recordset?.[0]?.reason || null,
    code,
    sourceEmployeeId,
    fileName,
    mimeType,
    sizeBytes,
  };
};

(async () => {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

  if (!process.env.SAGE_PAYROLL_DB_PASSWORD) {
    throw new Error('SAGE_PAYROLL_DB_PASSWORD is required.');
  }
  if (!dryRun && !process.env.DLE_ENTERPRISE_DB_PASSWORD) {
    throw new Error('DLE_ENTERPRISE_DB_PASSWORD is required for migration (use --dry-run to inspect Sage photos only).');
  }

  const sageRows = await readSageEmployeePhotos(limit);
  console.log(JSON.stringify({ sagePhotosFound: sageRows.length, dryRun, limit: limit || null }, null, 2));

  if (dryRun && sageRows.length) {
    const preview = sageRows.slice(0, 5).map((row) => {
      const buffer = Buffer.isBuffer(row.photoData) ? row.photoData : Buffer.from(row.photoData || []);
      return {
        code: employeeCode(row.rawEmployeeCode),
        sourceEmployeeId: clean(row.sourceEmployeeId),
        displayName: clean(row.displayName),
        sizeBytes: buffer.length,
        mimeType: detectMime(buffer),
      };
    });
    console.log(JSON.stringify({ preview }, null, 2));
    return;
  }

  const pool = await new sql.ConnectionPool(dleConfig()).connect();
  const summary = { migrated: 0, skipped: 0, notFound: 0, failures: 0, samples: [] };
  try {
    await ensurePhotoColumns(pool);
    for (const row of sageRows) {
      try {
        const result = await migratePhoto(pool, row, false);
        if (result.status === 'migrated') summary.migrated += 1;
        else if (result.reason === 'employee-not-found') summary.notFound += 1;
        else summary.skipped += 1;
        if (summary.samples.length < 8) summary.samples.push(result);
      } catch (error) {
        summary.failures += 1;
        if (summary.samples.length < 8) {
          summary.samples.push({
            status: 'failed',
            code: employeeCode(row.rawEmployeeCode),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } finally {
    await pool.close();
  }

  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
