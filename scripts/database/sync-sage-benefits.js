/**
 * CLI entry for Sage benefits migration. Prefer sync-sage-benefits-runner.ts via tsx.
 *
 * Usage:
 *   npx tsx scripts/database/sync-sage-benefits-runner.ts --dry-run
 *   npx tsx scripts/database/sync-sage-benefits-runner.ts --apply
 *   npx tsx scripts/database/sync-sage-benefits-runner.ts --apply --overwrite
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');
const runner = path.join(__dirname, 'sync-sage-benefits-runner.ts');
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'tsx',
  '--tsconfig',
  path.join(repoRoot, 'apps', 'dashboard', 'tsconfig.json'),
  runner,
  ...process.argv.slice(2),
], {
  stdio: 'inherit',
  cwd: repoRoot,
});
process.exit(result.status ?? 1);
