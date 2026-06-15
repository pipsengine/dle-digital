import SageMigrationReviewClient from './SageMigrationReviewClient';

export default function SageMigrationReviewPage() {
  return <SageMigrationReviewClient initialNow={new Date().toISOString()} />;
}
