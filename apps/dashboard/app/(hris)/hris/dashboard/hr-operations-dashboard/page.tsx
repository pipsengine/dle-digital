import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { readLiveDailyAttendance } from '@/lib/biometric-live-attendance-store';
import HROperationsDashboardClient from './HROperationsDashboardClient';

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

export default async function HROperationsDashboard() {
  const [employeeSource, attendance] = await Promise.all([
    readPayrollEmployees(),
    withTimeout(readLiveDailyAttendance().catch(() => null), Number(process.env.HRIS_DASHBOARD_ATTENDANCE_TIMEOUT_MS || 350)),
  ]);
  const employees = employeeSource.employees;
  return <HROperationsDashboardClient employees={employees} attendanceRecords={attendance?.records || []} attendanceDate={attendance?.attendanceDate || null} generatedAt={new Date().toISOString()} />;
}
