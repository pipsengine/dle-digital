import type { Metadata } from 'next';
import { Suspense } from 'react';
import TimesheetReviewClient from './TimesheetReviewClient';

export const metadata: Metadata = {
  title: 'Timesheet Review',
};

export default function TimesheetReviewPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500">Loading timesheet review...</div>}>
      <TimesheetReviewClient />
    </Suspense>
  );
}
