import { NextRequest, NextResponse } from 'next/server';
import { auditLeaveAction, readLeaveManagementPayload, validateLeaveAction, type LeaveActionId } from '@/lib/leave-management-store';

const jsonOk = (data: any) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const section = request.nextUrl.searchParams.get('section') || 'dashboard';
    const payload = await readLeaveManagementPayload(section, role);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const rows = payload.applications.map((item) => [
        item.id,
        item.employeeId,
        item.fullName,
        item.leaveType,
        item.startDate,
        item.endDate,
        item.days,
        item.status,
        item.stage,
        item.policyComplianceStatus,
      ]);
      const csv = [['Request ID', 'Employee ID', 'Employee', 'Leave Type', 'Start', 'End', 'Days', 'Status', 'Stage', 'Compliance'], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="leave-management.csv"' } });
    }
    return jsonOk(payload);
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to load Leave Management.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || 'Leave Administrator';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '') as LeaveActionId;
    const section = String(body.section || 'dashboard');
    const payload = await readLeaveManagementPayload(section, role);
    const validation = validateLeaveAction(action, role, payload, body);
    if (!validation.ok) return jsonErr(validation.status, validation.message);
    auditLeaveAction({
      user: String(body.actor || role),
      role: payload.role,
      action,
      record: String(body.record || section),
      oldValue: body.oldValue ? String(body.oldValue) : null,
      newValue: body.newValue ? String(body.newValue) : validation.message,
      comments: body.comments ? String(body.comments) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
    });
    return jsonOk({ message: validation.message, payload: await readLeaveManagementPayload(section, role) });
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to process leave action.');
  }
}
