import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Earnings Management',
};

export default function EarningsManagementPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="earnings" initialTab="overview" />;
}
