import { Suspense } from 'react';
import TimesheetApprovalClient from '@/app/(hris)/hris/time-and-logs/timesheet-approval/TimesheetApprovalClient';

export default function TimesheetApprovalPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TimesheetApprovalClient />
    </Suspense>
  );
}
