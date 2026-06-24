import type { Metadata } from 'next';
import PayrollManagementClient from '../PayrollManagementClient';

export const metadata: Metadata = {
  title: 'Payroll Reports',
};

export default function PayrollReportsPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection="reports" initialTab="standard-reports" />;
}
