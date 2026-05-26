import ReportingLineClient from '../ReportingLineClient';

export default async function ReportingLineByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <ReportingLineClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
