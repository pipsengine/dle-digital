import { NextResponse } from 'next/server';
import { readTimesheetData, calculateTimesheetPeriod } from '@/lib/timesheet-entry-store';

const ok = <T,>(data: T, status = 200) => NextResponse.json({ status: 'success', data }, { status });
const round1 = (value: number) => Math.round(value * 10) / 10;

export async function GET() {
  try {
    const { headers, lines } = await readTimesheetData();
    
    // We only care about timesheets that have been submitted or further
    const nonDraftHeaders = headers.filter(h => h.status !== 'Draft');

    const pendingTimesheets = nonDraftHeaders.map(header => {
      const headerLines = lines.filter(l => l.headerId === header.id);
      const period = calculateTimesheetPeriod(new Date(header.timesheetDate));
      
      return {
        id: header.id,
        timesheetDate: header.timesheetDate,
        supervisorName: header.supervisorName,
        workCenterName: header.workCenterName,
        status: header.status,
        totalEmployees: headerLines.length,
        totalHours: round1(headerLines.reduce((sum, l) => sum + l.totalHours, 0)),
        submittedAt: header.submittedAt,
        lastSyncAt: header.lastSyncAt,
        periodName: period.name,
      };
    }).sort((a, b) => new Date(b.timesheetDate).getTime() - new Date(a.timesheetDate).getTime());

    const stats = {
      totalPending: nonDraftHeaders.filter(h => h.status !== 'Approved' && h.status !== 'Locked').length,
      hrReviewCount: nonDraftHeaders.filter(h => h.status === 'Submitted').length,
      projectControlCount: nonDraftHeaders.filter(h => h.status === 'HR_Reviewed').length,
      opsApprovalCount: nonDraftHeaders.filter(h => h.status === 'Project_Control_Reviewed').length,
    };

    const filterOptions = {
      workCenters: Array.from(new Set(headers.map(h => h.workCenterName))),
      periods: Array.from(new Set(pendingTimesheets.map(t => t.periodName))),
      supervisors: Array.from(new Set(headers.map(h => h.supervisorName))),
    };

    return ok({
      pendingTimesheets,
      stats,
      filterOptions
    });
  } catch (error) {
    console.error('Approval API Error:', error);
    return NextResponse.json({ status: 'error', error: 'Internal Server Error' }, { status: 500 });
  }
}
