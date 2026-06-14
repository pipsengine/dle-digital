import PayrollManagementClient from '../PayrollManagementClient';

export default async function PayrollManagementSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <PayrollManagementClient initialNow={new Date().toISOString()} initialSection={section} />;
}
