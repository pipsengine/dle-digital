import TimeAndLogsManagementClient from './TimeAndLogsManagementClient';

export default function TimeAndLogsPage() {
  return <TimeAndLogsManagementClient initialNow={new Date().toISOString()} />;
}
