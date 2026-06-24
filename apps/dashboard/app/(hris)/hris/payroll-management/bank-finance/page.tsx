import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Bank & Finance',
};

export default function BankFinancePage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="bank-finance" initialTab="overview" />;
}
