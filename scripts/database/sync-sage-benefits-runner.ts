import fs from 'node:fs';
import path from 'node:path';

const loadEnvFiles = () => {
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

loadEnvFiles();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || (!args.includes('--apply') && !args.includes('--overwrite'));
const overwriteExisting = args.includes('--overwrite');

const main = async () => {
  const { syncSageBenefitsToHris } = await import('../../apps/dashboard/lib/sage-benefits-sync');
  const result = await syncSageBenefitsToHris({ dryRun, overwriteExisting });
  console.log(JSON.stringify(result, null, 2));
  if (result.warnings.length) {
    console.warn('\nWarnings:');
    for (const warning of result.warnings) console.warn(`- ${warning}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
