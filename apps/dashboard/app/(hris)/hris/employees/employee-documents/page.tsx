import EmployeeDocumentsClient from './EmployeeDocumentsClient';

export default async function EmployeeDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'DLE-EMP-00001';
  return <EmployeeDocumentsClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

