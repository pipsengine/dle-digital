import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Pay Setup',
};

export default function PaySetupPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="pay-setup" initialTab="overview" />;
}
