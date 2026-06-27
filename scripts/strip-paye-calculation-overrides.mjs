/**
 * Remove payeCalculation blocks seeded incorrectly; keep nhfApplicable and other fields.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('apps/dashboard/data/hris/payroll-employee-options.json');
const options = JSON.parse(readFileSync(path, 'utf8'));
let removed = 0;
for (const option of options) {
  if (option.payeCalculation) {
    delete option.payeCalculation;
    removed += 1;
  }
}
writeFileSync(path, `${JSON.stringify(options, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ removed, remaining: options.length }, null, 2));
