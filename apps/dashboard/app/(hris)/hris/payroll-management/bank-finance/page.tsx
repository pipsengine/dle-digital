import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Bank & Finance',
};

const bankFinanceTabs = new Set(['overview', 'bank-schedule', 'payment-files', 'payroll-journal', 'reconciliation', 'exceptions']);

export default function BankFinancePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = searchParams?.tab && bankFinanceTabs.has(searchParams.tab) ? searchParams.tab : 'overview';
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="bank-finance" initialTab={tab} />;
}
