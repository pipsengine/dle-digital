/** First payroll period where DLE_Enterprise is the sole runtime payroll authority. Sage is migration-only before this. */
export const ENTERPRISE_PAYROLL_FROM_PERIOD = String(process.env.HRIS_PAYROLL_ENTERPRISE_FROM || '2026-06').trim();

const periodSortKey = (period: string) => {
  const normalized = String(period || '').replace(/^per-/, '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return 0;
  const [year, month] = normalized.split('-').map(Number);
  return year * 100 + month;
};

export const isEnterprisePayrollPeriod = (period: string) =>
  periodSortKey(period) >= periodSortKey(ENTERPRISE_PAYROLL_FROM_PERIOD);

/** Sage live comparison is only valid for pre-cutover migration periods. */
export const shouldComparePayrollWithSage = (period: string) => !isEnterprisePayrollPeriod(period);

export const enterprisePayrollSourceLabel = (period: string) =>
  isEnterprisePayrollPeriod(period) ? 'DLE_Enterprise payroll engine' : 'DLE unified payroll calculation engine';
