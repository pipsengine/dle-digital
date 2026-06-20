import OvertimeManagementClient from './OvertimeManagementClient';

export default function OvertimeManagementPage() {
  return <OvertimeManagementClient initialNow={new Date().toISOString()} />;
}
