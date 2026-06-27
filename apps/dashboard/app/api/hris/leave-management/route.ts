import { NextRequest, NextResponse } from 'next/server';
import { formatLeaveAllowanceAmount } from '@/lib/leave-allowance-policy';
import { auditLeaveAction, dormantLongPolicy, readLeaveManagementPayload, validateLeaveAction, type LeaveActionId } from '@/lib/leave-management-store';
import { activePayrollPeriod } from '@/lib/payroll-periods';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { postLeaveAllowanceOnAnnualLeaveApproval } from '@/lib/payroll-leave-allowance-store';

const jsonOk = (data: any) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const section = request.nextUrl.searchParams.get('section') || 'dashboard';
    const format = request.nextUrl.searchParams.get('format');
    const payload = await readLeaveManagementPayload(section, role, format === 'allowance-exceptions-csv' ? { forceSync: true } : undefined);
    if (format === 'allowance-exceptions-csv') {
      const rows = payload.allowanceExceptions.map((item) => [
        item.severity,
        item.employeeId,
        item.fullName,
        item.department,
        item.leaveYear,
        item.payrollPeriod,
        item.requestDays,
        item.approvedAnnualLeaveDays,
        formatLeaveAllowanceAmount(item.allowanceAmount),
        item.allowanceStatus,
        item.eventStatus,
        item.linkedRequestId || '',
        item.recommendation,
      ]);
      const csv = [['Severity', 'Employee ID', 'Employee', 'Department', 'Leave Year', 'Payroll Period', 'Request Days', 'Approved Annual Days', 'Allowance Amount', 'Allowance Status', 'Event Status', 'Linked Request', 'Recommendation'], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="leave-allowance-exceptions.csv"' } });
    }
    if (format === 'csv') {
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
    let leaveAllowanceMessage: string | null = null;
    if (['approve', 'bulk-approve', 'post-to-payroll'].includes(action)) {
      const bodyEmployeeId = String(body.employeeId || body.employeeCode || '').trim();
      const application = body.record
        ? payload.applications.find((item) => item.id === String(body.record))
        : bodyEmployeeId
          ? payload.applications.find((item) => item.employeeId === bodyEmployeeId)
          : null;
      const leaveType = String(body.leaveType || application?.leaveType || 'Annual Leave');
      const days = Number(body.days || application?.days || 0);
      const period = String(body.payrollPeriod || body.period || activePayrollPeriod() || application?.startDate?.slice(0, 7) || new Date().toISOString().slice(0, 7));
      const leaveYear = Number(body.leaveYear || application?.startDate?.slice(0, 4) || period.slice(0, 4) || new Date().getFullYear());
      if (leaveType === 'Annual Leave' && days >= dormantLongPolicy.allowanceMinimumAnnualDays) {
        const employeeSource = await readPayrollEmployees();
        const employee = employeeSource.employees.find((item) => item.employeeId === (application?.employeeId || bodyEmployeeId) || item.employeeCode === (application?.employeeId || bodyEmployeeId));
        if (employee && application) {
          const result = await postLeaveAllowanceOnAnnualLeaveApproval({
            employee,
            applications: payload.applications,
            leaveType,
            days,
            startDate: application.startDate,
            period,
            leaveYear,
            requestId: String(body.record || application.id || ''),
            source: 'HR Leave Approval',
            actor: String(body.actor || role),
          });
          leaveAllowanceMessage = result.message;
        }
      }
    }
    await auditLeaveAction({
      user: String(body.actor || role),
      role: payload.role,
      action,
      record: String(body.record || section),
      oldValue: body.oldValue ? String(body.oldValue) : null,
      newValue: body.newValue ? String(body.newValue) : leaveAllowanceMessage || validation.message,
      comments: body.comments ? String(body.comments) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
    });
    return jsonOk({ message: leaveAllowanceMessage || validation.message, payload: await readLeaveManagementPayload(section, role, { forceSync: true }) });
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to process leave action.');
  }
}
