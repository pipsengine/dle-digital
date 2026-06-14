import PayrollManagementClient from './PayrollManagementClient';

export default function PayrollManagementPage() {
  return <PayrollManagementClient initialNow={new Date().toISOString()} />;
}
