import EmployeeDocumentsClient from './EmployeeDocumentsClient';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';

async function getDefaultEmployeeId() {
  try {
    const employees = (await readPayrollEmployees()).employees;
    const first = employees?.find((employee: any) => employee?.employeeId || employee?.employeeCode);
    return String(first?.employeeId || first?.employeeCode || 'DLE-EMP-00001').trim();
  } catch {
    return 'DLE-EMP-00001';
  }
}

export default async function EmployeeDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : await getDefaultEmployeeId();
  return <EmployeeDocumentsClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
