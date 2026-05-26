import EmployeeStatusClient from '../EmployeeStatusClient';

export default async function EmployeeStatusByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmployeeStatusClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

