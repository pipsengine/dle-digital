import { NextResponse } from 'next/server';
import { updateEmployeeDailyRatePayInDb } from '@/lib/dle-enterprise-db';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';
import { normalizePaidWorkHours, readTimesheetData, readTimesheetPayrollUpdates } from '@/lib/timesheet-entry-store';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';

type Role = 'Super Admin' | 'HR Director' | 'HR Manager' | 'Payroll Officer' | 'Finance Controller' | 'Executive Management' | 'Auditor' | 'Employee';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const round2 = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const compact = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getRole = (request: Request): Role => {
  const value = request.headers.get('x-hris-role');
  const roles: Role[] = ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor', 'Employee'];
  return roles.includes(value as Role) ? (value as Role) : 'Payroll Officer';
};

const permissions = (role: Role) => ({
  canViewMoney: ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Finance Controller', 'Executive Management', 'Auditor'].includes(role),
  canUpdateRates: ['Super Admin', 'HR Director', 'Payroll Officer', 'Finance Controller'].includes(role),
  canExport: role !== 'Employee',
});

const statusFromIssues = (issues: string[]) => {
  if (issues.some((issue) => issue.includes('rate') || issue.includes('timesheet'))) return 'Blocked';
  if (issues.length) return 'Review';
  return 'Ready';
};

const buildPayload = async (request: Request) => {
  const role = getRole(request);
  const perms = permissions(role);
  const employeeSource = await readPayrollEmployees();
  const employees = employeeSource.employees;
  const dailyEmployees = employees.filter((employee) => employee.employmentType === 'Daily Rate' || employee.employeeCode.startsWith('C'));
  const { lines } = await readTimesheetData();
  const payrollUpdates = await readTimesheetPayrollUpdates();

  const attendanceByKey = new Map<string, { daysWorked: number; attendanceHours: number; bookedHours: number; idleHours: number; payrollReadyDays: number; payrollReadyHours: number; latestPayrollUpdate: string | null }>();

  const addAttendance = (key: string, item: { daysWorked: number; attendanceHours: number; bookedHours: number; idleHours: number; payrollReady?: boolean; updateAt?: string | null }) => {
    if (!key) return;
    const current = attendanceByKey.get(key) || { daysWorked: 0, attendanceHours: 0, bookedHours: 0, idleHours: 0, payrollReadyDays: 0, payrollReadyHours: 0, latestPayrollUpdate: null };
    current.daysWorked += item.daysWorked;
    current.attendanceHours += item.attendanceHours;
    current.bookedHours += item.bookedHours;
    current.idleHours += item.idleHours;
    if (item.payrollReady) {
      current.payrollReadyDays += item.daysWorked;
      current.payrollReadyHours += item.attendanceHours;
      current.latestPayrollUpdate = item.updateAt || current.latestPayrollUpdate;
    }
    attendanceByKey.set(key, current);
  };

  for (const line of lines) {
    const payload = {
      daysWorked: line.clockIn ? 1 : 0,
      attendanceHours: normalizePaidWorkHours(num(line.attendanceDuration)),
      bookedHours: normalizePaidWorkHours(num(line.totalHours)),
      idleHours: num(line.idleHours),
      payrollReady: false,
      updateAt: null,
    };
    [line.employeeId, line.employeeNo, line.employeeName].map(normalizePayrollMatchKey).forEach((key) => addAttendance(key, payload));
  }

  for (const update of payrollUpdates) {
    for (const employee of update.employeeAttendance) {
      const payload = {
        daysWorked: num(employee.daysWorked),
        attendanceHours: num(employee.attendanceHours),
        bookedHours: num(employee.bookedHours),
        idleHours: num(employee.idleHours),
        payrollReady: true,
        updateAt: update.acknowledgedAt,
      };
      [employee.employeeId, employee.employeeName].map(normalizePayrollMatchKey).forEach((key) => addAttendance(key, payload));
    }
  }

  const records = dailyEmployees.map((employee) => {
    const keys = [employee.employeeId, employee.employeeCode, employee.fullName].map(normalizePayrollMatchKey).filter(Boolean);
    const attendance = keys.map((key) => attendanceByKey.get(key)).find(Boolean) || { daysWorked: 0, attendanceHours: 0, bookedHours: 0, idleHours: 0, payrollReadyDays: 0, payrollReadyHours: 0, latestPayrollUpdate: null };
    const hoursPerDay = 8;
    const ratePerDay = num(employee.ratePerDay) || num(employee.periodSalary);
    const ratePerHour = num(employee.ratePerHour) || (ratePerDay && hoursPerDay ? ratePerDay / hoursPerDay : 0);
    const payMode = ratePerHour > 0 && ratePerDay <= 0 ? 'Hourly' : 'Daily';
    const payableDays = attendance.payrollReadyDays || attendance.daysWorked;
    const payableHours = attendance.payrollReadyHours || attendance.attendanceHours;
    const grossPay = payMode === 'Hourly' ? payableHours * ratePerHour : payableDays * ratePerDay;
    const issues: string[] = [];
    if (!ratePerDay && !ratePerHour) issues.push('Daily or hourly rate is missing');
    if (!attendance.daysWorked && !attendance.attendanceHours) issues.push('No daily timesheet found');
    if (!attendance.payrollReadyDays && !attendance.payrollReadyHours) issues.push('Timesheet is not yet payroll-ready');
    if (!employee.setupAssignedToPayroll) issues.push('Employee is not assigned to payroll setup');
    return {
      employeeDbId: employee.employeeDbId,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      department: employee.department,
      jobTitle: employee.jobTitle,
      location: employee.location,
      payrollGroup: employee.payrollGroup || 'Daily Rate',
      salaryGrade: employee.salaryGrade || employee.jobGrade || 'Daily Rate',
      payCurrency: employee.payCurrency || 'NGN',
      paymentRun: employee.paymentRun || 'Daily Timesheet',
      paymentType: employee.paymentType || 'Timesheet Rate',
      payMode,
      ratePerDay: roundMoney(ratePerDay),
      ratePerHour: roundMoney(ratePerHour),
      hoursPerDay: round2(hoursPerDay),
      daysWorked: round2(attendance.daysWorked),
      attendanceHours: round2(attendance.attendanceHours),
      bookedHours: round2(attendance.bookedHours),
      idleHours: round2(attendance.idleHours),
      payrollReadyDays: round2(attendance.payrollReadyDays),
      payrollReadyHours: round2(attendance.payrollReadyHours),
      grossPay: roundMoney(grossPay),
      latestPayrollUpdate: attendance.latestPayrollUpdate,
      setupAssignedToPayroll: employee.setupAssignedToPayroll,
      status: statusFromIssues(issues),
      issues,
    };
  });

  const visibleRecords = perms.canViewMoney ? records : records.map((record) => ({ ...record, ratePerDay: null, ratePerHour: null, grossPay: null }));
  const totals = records.reduce(
    (sum, record) => ({
      daysWorked: sum.daysWorked + record.daysWorked,
      attendanceHours: sum.attendanceHours + record.attendanceHours,
      payrollReadyDays: sum.payrollReadyDays + record.payrollReadyDays,
      grossPay: sum.grossPay + record.grossPay,
      ready: sum.ready + (record.status === 'Ready' ? 1 : 0),
      review: sum.review + (record.status === 'Review' ? 1 : 0),
      blocked: sum.blocked + (record.status === 'Blocked' ? 1 : 0),
    }),
    { daysWorked: 0, attendanceHours: 0, payrollReadyDays: 0, grossPay: 0, ready: 0, review: 0, blocked: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    source: `${employeeSource.source} and Daily Timesheet Payroll Updates`,
    dataSource: payrollDataSourceInfo(employeeSource),
    role,
    permissions: perms,
    summary: {
      dailyRateEmployees: dailyEmployees.length,
      daysWorked: round2(totals.daysWorked),
      attendanceHours: round2(totals.attendanceHours),
      payrollReadyDays: round2(totals.payrollReadyDays),
      grossPay: roundMoney(totals.grossPay),
      ready: totals.ready,
      review: totals.review,
      blocked: totals.blocked,
      missingRates: records.filter((record) => !record.ratePerDay && !record.ratePerHour).length,
      missingTimesheets: records.filter((record) => !record.daysWorked && !record.attendanceHours).length,
    },
    records: visibleRecords,
  };
};

const csv = (records: any[]) => {
  const headers = ['Employee ID', 'Name', 'Department', 'Mode', 'Day Rate', 'Hourly Rate', 'Days Worked', 'Hours', 'Payroll Ready Days', 'Gross Pay', 'Status', 'Issues'];
  const lines = records.map((record) =>
    [record.employeeId, record.employeeName, record.department, record.payMode, record.ratePerDay, record.ratePerHour, record.daysWorked, record.attendanceHours, record.payrollReadyDays, record.grossPay, record.status, record.issues.join('; ')]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
};

export async function GET(request: Request) {
  try {
    const payload = await buildPayload(request);
    const { searchParams } = new URL(request.url);
    if (searchParams.get('format') === 'csv') {
      if (!payload.permissions.canExport) return err(403, 'Permission denied');
      return new Response(csv(payload.records), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="daily-rate-pay.csv"',
        },
      });
    }
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load daily rate pay.');
  }
}

export async function POST(request: Request) {
  try {
    const role = getRole(request);
    const perms = permissions(role);
    if (!perms.canUpdateRates) return err(403, 'Permission denied');
    const body = await request.json().catch(() => ({}));
    const employeeDbId = Number(body.employeeDbId);
    if (!employeeDbId) return err(400, 'employeeDbId is required');
    const ratePerDay = body.payMode === 'Hourly' ? null : num(body.ratePerDay);
    const ratePerHour = body.payMode === 'Hourly' ? num(body.ratePerHour) : null;
    const hoursPerDay = 8;
    if (!ratePerDay && !ratePerHour) return err(400, 'Provide either a daily rate or hourly rate');
    await updateEmployeeDailyRatePayInDb({
      employeeDbId,
      payrollGroup: compact(body.payrollGroup) || 'Daily Rate',
      salaryGrade: compact(body.salaryGrade) || 'Daily Rate',
      payCurrency: compact(body.payCurrency) || 'NGN',
      paymentRun: compact(body.paymentRun) || 'Daily Timesheet',
      paymentType: body.payMode === 'Hourly' ? 'Hourly Timesheet Rate' : 'Daily Timesheet Rate',
      periodSalary: ratePerDay || ratePerHour,
      ratePerDay,
      ratePerHour,
      hoursPerDay,
    });
    return ok({ updated: true });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to update daily rate pay.');
  }
}
