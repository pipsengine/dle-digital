import PayrollManagementClient from '../../payroll-management/PayrollManagementClient';

export default function PayrollDashboardPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} />;
}
