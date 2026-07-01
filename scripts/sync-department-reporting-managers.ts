import fs from 'node:fs';
import path from 'node:path';

import { auditDepartmentReportingManagers, syncDepartmentReportingManagers } from '../apps/dashboard/lib/department-reporting-manager-sync';

const loadWorkspaceEnv = () => {
  for (const file of [path.resolve('.env'), path.join(process.cwd(), 'apps', 'dashboard', '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
};

loadWorkspaceEnv();

const dryRun = process.argv.includes('--dry-run');
const auditOnly = process.argv.includes('--audit');

const main = async () => {
  if (auditOnly || dryRun) {
    const audit = await auditDepartmentReportingManagers();
    console.log(JSON.stringify(audit, null, 2));
    if (auditOnly || dryRun) return;
  }

  const result = await syncDepartmentReportingManagers({
    dryRun: false,
    performedBy: 'scripts/sync-department-reporting-managers.ts',
  });
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
