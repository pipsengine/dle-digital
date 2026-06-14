import { NextRequest, NextResponse } from 'next/server';
import { auditWorkforceAction, readWorkforceManagementPayload, validateWorkforceAction, type WorkforceActionId } from '@/lib/workforce-management-store';

const ok = (data: any) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const section = request.nextUrl.searchParams.get('section') || 'attendance';
    const tab = request.nextUrl.searchParams.get('tab');
    const payload = await readWorkforceManagementPayload(section, tab, role);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const rows = payload.records.map((item) => [item.employeeId, item.employeeName, item.department, item.site, item.shift, item.attendanceStatus, item.timeStatus, item.approvalStatus, item.payrollStatus, item.hoursWorked, item.overtimeHours, item.exceptions.join('; ')]);
      const csv = [['Employee ID', 'Employee', 'Department', 'Site', 'Shift', 'Attendance', 'Time', 'Approval', 'Payroll', 'Hours', 'Overtime', 'Exceptions'], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="workforce-management.csv"' } });
    }
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load Workforce Management.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || 'HR Manager';
    const body = await request.json().catch(() => ({}));
    const section = String(body.section || 'attendance');
    const tab = String(body.tab || 'dashboard');
    const action = String(body.action || '') as WorkforceActionId;
    const payload = await readWorkforceManagementPayload(section, tab, role);
    const validation = validateWorkforceAction(action, role, payload, body);
    if (!validation.ok) return err(validation.status, validation.message);
    await auditWorkforceAction({
      user: String(body.actor || role),
      role: payload.role,
      action,
      record: String(body.record || section),
      oldValue: body.oldValue ? String(body.oldValue) : null,
      newValue: body.newValue ? String(body.newValue) : validation.message,
      reason: body.reason ? String(body.reason) : undefined,
      comments: body.comments ? String(body.comments) : undefined,
    });
    return ok({ message: validation.message, payload: await readWorkforceManagementPayload(section, tab, role) });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to process Workforce Management action.');
  }
}
