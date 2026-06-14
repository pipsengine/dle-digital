import WorkforceManagementClient from '../WorkforceManagementClient';

export default async function WorkforceManagementSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  return <WorkforceManagementClient initialNow={new Date().toISOString()} initialSection={section} initialTab={query.tab} />;
}
