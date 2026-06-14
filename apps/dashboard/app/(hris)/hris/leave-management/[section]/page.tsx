import LeaveManagementClient from '../LeaveManagementClient';

export default async function LeaveManagementSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <LeaveManagementClient initialNow={new Date().toISOString()} initialSection={section} />;
}
