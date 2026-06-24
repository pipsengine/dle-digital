import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Statutory Deductions',
};

export default function StatutoryCompliancePage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="statutory" initialTab="overview" />;
}
