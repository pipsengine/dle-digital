import { NextRequest, NextResponse } from 'next/server';
import { auditTimeAction, readTimeAndLogsPayload, validateTimeAction, type TimeActionId } from '@/lib/time-and-logs-management-store';

const jsonOk = (data: any) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const section = request.nextUrl.searchParams.get('section') || 'timesheet-entry';
    const payload = await readTimeAndLogsPayload(section, role);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const rows = payload.records.map((item) => [item.id, item.employeeId, item.employeeName, item.department, item.projectCode, item.site, item.hoursWorked, item.overtimeHours, item.status, item.validationStatus, item.payrollStatus]);
      const csv = [['Record ID', 'Employee ID', 'Employee', 'Department', 'Project', 'Site', 'Hours', 'Overtime', 'Status', 'Validation', 'Payroll'], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="time-and-logs.csv"' } });
    }
    return jsonOk(payload);
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to load Time & Logs.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || 'HR Manager';
    const body = await request.json().catch(() => ({}));
    const section = String(body.section || 'timesheet-entry');
    const action = String(body.action || '') as TimeActionId;
    const payload = await readTimeAndLogsPayload(section, role);
    const validation = validateTimeAction(action, role, payload, body);
    if (!validation.ok) return jsonErr(validation.status, validation.message);
    auditTimeAction({
      user: String(body.actor || role),
      role: payload.role,
      action,
      record: String(body.record || section),
      oldValue: body.oldValue ? String(body.oldValue) : null,
      newValue: body.newValue ? String(body.newValue) : validation.message,
      comments: body.comments ? String(body.comments) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
    });
    return jsonOk({ message: validation.message, payload: await readTimeAndLogsPayload(section, role) });
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to process Time & Logs action.');
  }
}
