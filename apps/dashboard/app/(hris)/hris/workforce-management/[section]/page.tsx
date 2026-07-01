import WorkforceManagementClient from '../WorkforceManagementClient';
import ReviewsApprovalsClient from '../reviews-and-approvals/ReviewsApprovalsClient';
import WorkforceOperationsCommandCenter from '../reports-and-analytics/WorkforceOperationsCommandCenter';

export default async function WorkforceManagementSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (section === 'reviews-and-approvals') {
    return <ReviewsApprovalsClient />;
  }
  if (section === 'reports-and-analytics') {
    return <WorkforceOperationsCommandCenter role="HR Manager" />;
  }
  return <WorkforceManagementClient initialNow={new Date().toISOString()} initialSection={section} initialTab={query.tab} />;
}
