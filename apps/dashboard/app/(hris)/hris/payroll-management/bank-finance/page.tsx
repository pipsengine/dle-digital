import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Bank & Finance',
};

const bankFinanceTabs = new Set(['overview', 'bank-schedule', 'payment-files', 'payroll-journal', 'reconciliation', 'exceptions']);

export default async function BankFinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const rawTab = typeof sp.tab === 'string' ? sp.tab : Array.isArray(sp.tab) ? sp.tab[0] : undefined;
  const tab = rawTab && bankFinanceTabs.has(rawTab) ? rawTab : 'overview';
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="bank-finance" initialTab={tab} />;
}
