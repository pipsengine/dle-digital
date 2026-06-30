import { readEnrichedBackupDisasterRecoveryState, runDleEnterpriseFullBackup } from '../lib/backup-disaster-recovery-service.ts';
import { getDleEnterpriseDbPool } from '../lib/dle-enterprise-db.ts';

async function main() {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) {
    console.log('NO POOL');
    return;
  }
  const state = await readEnrichedBackupDisasterRecoveryState();
  console.log('Primary:', state.replicationTargets.find((t) => t.target === 'Primary Backup')?.location);
  console.log('Metrics:', state.serviceMetrics.map((m) => `${m.label}: ${m.value}`));
  const dirs = await pool.request().query(`
    SELECT
      CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) AS backupPath,
      CAST(SERVERPROPERTY('MachineName') AS nvarchar(256)) AS machineName,
      @@SERVERNAME AS serverName
  `);
  console.log('SQL server info:', dirs.recordset[0]);
  try {
    const r = await runDleEnterpriseFullBackup('Diagnostic test');
    console.log('Backup metric:', r.serviceMetrics[0]);
    console.log('Incidents:', JSON.stringify(r.incidents.slice(0, 2), null, 2));
    console.log('Queue head:', JSON.stringify(r.executionQueue[0], null, 2));
  } catch (error) {
    console.log('BACKUP THREW:', error instanceof Error ? error.message : error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
