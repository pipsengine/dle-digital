import DepartmentAndUnitAssignmentClient from './DepartmentAndUnitAssignmentClient';

export default async function DepartmentAndUnitAssignmentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'DLE-EMP-00001';
  return <DepartmentAndUnitAssignmentClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

