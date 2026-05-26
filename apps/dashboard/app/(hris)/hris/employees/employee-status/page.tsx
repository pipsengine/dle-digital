import EmployeeStatusClient from './EmployeeStatusClient';

export default async function EmployeeStatusPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'DLE-EMP-00001';
  return <EmployeeStatusClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

