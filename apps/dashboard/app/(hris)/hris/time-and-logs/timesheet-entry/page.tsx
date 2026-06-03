import { Suspense } from 'react';
import TimesheetEntryClient from '@/app/(hris)/hris/time-and-logs/timesheet-entry/TimesheetEntryClient';

export default function TimesheetEntryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TimesheetEntryClient />
    </Suspense>
  );
}
