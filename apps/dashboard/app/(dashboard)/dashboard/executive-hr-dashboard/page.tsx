import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { readLiveDailyAttendance } from '@/lib/biometric-live-attendance-store';
import HRISDashboardLayout from '@hris/components/layout/dashboard-layout';
import ExecutiveHRDashboardClient from './ExecutiveHRDashboardClient';

export const dynamic = 'force-dynamic';

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export default async function ExecutiveHRDashboard() {
  const [employeeSource, attendance] = await Promise.all([
    readPayrollEmployees(),
    withTimeout(readLiveDailyAttendance().catch(() => null), Number(process.env.HRIS_DASHBOARD_ATTENDANCE_TIMEOUT_MS || 350)),
  ]);
  const employees = employeeSource.employees;
  return (
    <HRISDashboardLayout>
      <ExecutiveHRDashboardClient employees={employees} attendanceRecords={attendance?.records || []} attendanceDate={attendance?.attendanceDate || null} generatedAt={new Date().toISOString()} />
    </HRISDashboardLayout>
  );
}
