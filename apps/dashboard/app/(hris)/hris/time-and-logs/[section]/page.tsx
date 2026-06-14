import TimeAndLogsManagementClient from '../TimeAndLogsManagementClient';

export default async function TimeAndLogsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <TimeAndLogsManagementClient initialNow={new Date().toISOString()} initialSection={section} />;
}
