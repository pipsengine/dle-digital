import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import { readLiveDailyAttendance } from '@/lib/biometric-live-attendance-store';
import HROperationsDashboardClient from './HROperationsDashboardClient';

export const dynamic = 'force-dynamic';

export default async function HROperationsDashboard() {
  const employees = (await readPayrollEmployees()).employees;
  const attendance = await readLiveDailyAttendance().catch(() => null);
  return <HROperationsDashboardClient employees={employees} attendanceRecords={attendance?.records || []} attendanceDate={attendance?.attendanceDate || null} generatedAt={new Date().toISOString()} />;
}
