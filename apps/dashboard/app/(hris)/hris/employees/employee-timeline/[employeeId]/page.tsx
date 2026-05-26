import EmployeeTimelineClient from '../EmployeeTimelineClient';

export default async function EmployeeTimelineByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmployeeTimelineClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

