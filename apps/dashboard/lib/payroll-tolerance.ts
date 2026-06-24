/** May/June cutover: defer known migration gaps so payroll workflow can be exercised. Corrections land in the next period. */
export const payrollTolerancePeriods = () =>
  String(process.env.HRIS_PAYROLL_TOLERANCE_PERIODS || '2026-05')
    .split(',')
    .map((value) => value.trim().replace(/^per-/, ''))
    .filter(Boolean);

export const payrollToleranceActive = (period: string) => {
  if (process.env.HRIS_PAYROLL_TOLERANCE_MODE === 'false') return false;
  if (process.env.HRIS_PAYROLL_TOLERANCE_MODE === 'true') return true;
  const normalized = String(period || '').replace(/^per-/, '');
  return payrollTolerancePeriods().includes(normalized);
};

const DEFERRED_ISSUE_PATTERNS = [
  /approved timesheet hours are not available/i,
  /pension: employment type is not eligible/i,
  /pension: rsa pin is not on file/i,
  /pension: pfa provider is not assigned/i,
  /sage gross variance/i,
  /sage net variance/i,
  /sage period comparison unavailable/i,
  /deduction ratio exceeds/i,
  /statutory:/i,
  /loan:/i,
  /payroll setup is not assigned/i,
  /payroll group is missing/i,
  /pay currency is missing/i,
  /gross pay is missing/i,
  /net pay is zero after deductions/i,
];

export const partitionPayrollIssues = (issues: string[], tolerance: boolean) => {
  if (!tolerance) return { blocking: issues, deferred: [] as string[] };
  const blocking: string[] = [];
  const deferred: string[] = [];
  for (const issue of issues) {
    if (DEFERRED_ISSUE_PATTERNS.some((pattern) => pattern.test(issue))) deferred.push(issue);
    else blocking.push(issue);
  }
  return { blocking, deferred };
};
