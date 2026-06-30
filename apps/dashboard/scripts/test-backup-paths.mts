import sql from 'mssql';
import { getDleEnterpriseDbPool } from '../lib/dle-enterprise-db.ts';

async function main() {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) return;
  const dir = 'G:\\DLE_Connect';
  try {
    await pool.request().input('dirPath', sql.NVarChar(4000), dir).query(`
      BEGIN TRY
        EXEC master.dbo.xp_create_subdir @dirPath;
      END TRY
      BEGIN CATCH
        IF ERROR_NUMBER() NOT IN (183, 517) THROW;
      END CATCH
    `);
    console.log('created dir');
  } catch (e) {
    console.log('mkdir err', e instanceof Error ? e.message : e);
  }
  const exists = await pool.request().input('dirPath', dir).query(`
    DECLARE @fileExists int;
    EXEC master.dbo.xp_fileexist @dirPath, @fileExists OUTPUT;
    SELECT @fileExists AS fileExists;
  `);
  console.log('exists', exists.recordset[0]);
  const file = `${dir}\\DLE_Enterprise_FULL_test.bak`;
  try {
    const request = pool.request();
    (request as typeof request & { timeout: number }).timeout = 900000;
    await request.input('BackupPath', sql.NVarChar(4000), file).query(`
      BACKUP DATABASE [DLE_Enterprise] TO DISK = @BackupPath WITH INIT, CHECKSUM, COMPRESSION, STATS = 10;
      RESTORE VERIFYONLY FROM DISK = @BackupPath WITH CHECKSUM;
    `);
    console.log('BACKUP OK', file);
  } catch (e) {
    console.log('BACKUP FAIL', e instanceof Error ? e.message : e);
  }
}

main().catch(console.error);
