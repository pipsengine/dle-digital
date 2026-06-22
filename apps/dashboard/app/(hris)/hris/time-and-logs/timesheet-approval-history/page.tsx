import { Suspense } from 'react';
import TimesheetApprovalClient from '@/app/(hris)/hris/time-and-logs/timesheet-approval/TimesheetApprovalClient';

export default function TimesheetApprovalHistoryPage() {
  return (
    <Suspense fallback={<div>Loading timesheet approval history...</div>}>
      <TimesheetApprovalClient mode="history" />
    </Suspense>
  );
}
