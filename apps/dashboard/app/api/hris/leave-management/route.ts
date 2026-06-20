import { NextRequest, NextResponse } from 'next/server';
import { auditLeaveAction, dormantLongPolicy, readLeaveManagementPayload, validateLeaveAction, type LeaveActionId } from '@/lib/leave-management-store';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { calculateAnnualLeaveAllowanceAmount, calculatePayrollEarnings } from '@/lib/payroll-earnings-engine';
import { syncSageLeaveAllowanceEvents, upsertApprovedLeaveAllowanceEvent } from '@/lib/payroll-leave-allowance-store';

const jsonOk = (data: any) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const section = request.nextUrl.searchParams.get('section') || 'dashboard';
    await syncSageLeaveAllowanceEvents();
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
    await syncSageLeaveAllowanceEvents();
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
      const period = String(body.payrollPeriod || body.period || application?.startDate?.slice(0, 7) || new Date().toISOString().slice(0, 7));
      const leaveYear = Number(body.leaveYear || application?.startDate?.slice(0, 4) || period.slice(0, 4) || new Date().getFullYear());
      if (leaveType === 'Annual Leave' && days >= dormantLongPolicy.allowanceMinimumAnnualDays) {
        const employeeSource = await readPayrollEmployees();
        const employee = employeeSource.employees.find((item) => item.employeeId === (application?.employeeId || bodyEmployeeId) || item.employeeCode === (application?.employeeId || bodyEmployeeId));
        if (employee) {
          const annualBenefit = calculatePayrollEarnings(employee).annualBenefitLines.find((line) => line.name.toLowerCase().includes('leave') || line.code.toUpperCase().includes('LEAVE'));
          const allowanceAmount = Number(annualBenefit?.amount || 0) || calculateAnnualLeaveAllowanceAmount(employee);
          if (allowanceAmount > 0) {
            try {
              const event = await upsertApprovedLeaveAllowanceEvent({
                employee,
                period,
                leaveYear,
                days,
                amount: allowanceAmount,
                taxableAmount: annualBenefit?.taxable === false ? 0 : allowanceAmount,
                source: 'HR Leave Approval',
                requestId: String(body.record || application?.id || ''),
                actor: String(body.actor || role),
                note: `Approved ${days} days Annual Leave; payable once for ${leaveYear}.`,
              });
              leaveAllowanceMessage = `Leave allowance ${event.code} posted to ${event.period} payroll.`;
            } catch (error) {
              leaveAllowanceMessage = error instanceof Error ? error.message : 'Leave allowance was not posted.';
            }
          }
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
    return jsonOk({ message: leaveAllowanceMessage || validation.message, payload: await readLeaveManagementPayload(section, role) });
  } catch (error) {
    return jsonErr(500, error instanceof Error ? error.message : 'Unable to process leave action.');
  }
}
