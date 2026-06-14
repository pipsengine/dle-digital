import { Suspense } from 'react';
import TimesheetApprovalClient from '@/app/(hris)/hris/time-and-logs/timesheet-approval/TimesheetApprovalClient';

export default function WorkforceTimesheetApprovalPage() {
  return (
    <Suspense fallback={<div>Loading timesheet approval...</div>}>
      <TimesheetApprovalClient />
    </Suspense>
  );
}
