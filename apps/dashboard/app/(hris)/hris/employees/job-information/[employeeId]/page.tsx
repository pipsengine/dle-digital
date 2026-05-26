import JobInformationClient from '../JobInformationClient';

export default async function JobInformationByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <JobInformationClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

