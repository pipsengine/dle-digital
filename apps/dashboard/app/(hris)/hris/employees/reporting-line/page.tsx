import ReportingLineClient from './ReportingLineClient';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';

export const dynamic = 'force-dynamic';

export default async function ReportingLinePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const fromQuery = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  const employees = (await readPayrollEmployees()).employees;
  const employeeId = fromQuery || employees[0]?.employeeId || employees[0]?.employeeCode || '';
  return <ReportingLineClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
