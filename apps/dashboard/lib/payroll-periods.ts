export const ACTIVE_PAYROLL_PERIOD = process.env.HRIS_ACTIVE_PAYROLL_PERIOD || '2026-05';
export const NEXT_PAYROLL_PERIOD = process.env.HRIS_NEXT_PAYROLL_PERIOD || '2026-06';

/** Synchronous fallback — prefer resolveActivePayrollPeriod() in API routes. */
export const activePayrollPeriod = () => process.env.HRIS_ACTIVE_PAYROLL_PERIOD || ACTIVE_PAYROLL_PERIOD;

export const resolveActivePayrollPeriod = async () => {
  try {
    const { getActivePayrollPeriod } = await import('@/lib/payroll-period-store');
    return await getActivePayrollPeriod();
  } catch {
    return activePayrollPeriod();
  }
};

export const payrollPeriodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
