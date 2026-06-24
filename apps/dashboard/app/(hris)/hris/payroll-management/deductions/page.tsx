import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Deductions Management',
};

export default function DeductionsManagementPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="deductions" initialTab="overview" />;
}
