import WorkforceManagementClient from './WorkforceManagementClient';

export default function WorkforceManagementPage() {
  return <WorkforceManagementClient initialNow={new Date().toISOString()} />;
}
