import WorkforcePortalClient from './workforce-portal-client';

export default function WorkforcePortalPage() {
  return <WorkforcePortalClient initialNow={new Date().toISOString()} />;
}
