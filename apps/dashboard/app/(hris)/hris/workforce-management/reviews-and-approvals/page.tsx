import type { Metadata } from 'next';
import ReviewsApprovalsClient from './ReviewsApprovalsClient';

export const metadata: Metadata = {
  title: 'Reviews & Approvals | Workforce Management',
};

export default function ReviewsAndApprovalsPage() {
  return <ReviewsApprovalsClient />;
}
