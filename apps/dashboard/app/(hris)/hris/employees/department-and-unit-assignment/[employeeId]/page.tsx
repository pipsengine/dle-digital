import DepartmentAndUnitAssignmentClient from '../DepartmentAndUnitAssignmentClient';

export default async function DepartmentAndUnitAssignmentByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <DepartmentAndUnitAssignmentClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

