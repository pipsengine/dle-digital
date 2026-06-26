import WorkforceManagementClient from '../WorkforceManagementClient';
import ReviewsApprovalsClient from '../reviews-and-approvals/ReviewsApprovalsClient';

export default async function WorkforceManagementSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (section === 'reviews-and-approvals') {
    return <ReviewsApprovalsClient />;
  }
  return <WorkforceManagementClient initialNow={new Date().toISOString()} initialSection={section} initialTab={query.tab} />;
}
