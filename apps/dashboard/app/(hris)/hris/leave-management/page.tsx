import LeaveManagementClient from './LeaveManagementClient';

export default function LeaveManagementPage() {
  return <LeaveManagementClient initialNow={new Date().toISOString()} />;
}
