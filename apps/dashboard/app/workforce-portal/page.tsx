import { Suspense } from 'react';
import WorkforcePortalClient from './workforce-portal-client';

export default function WorkforcePortalPage() {
  return (
    <Suspense fallback={null}>
      <WorkforcePortalClient initialNow={new Date().toISOString()} />
    </Suspense>
  );
}
