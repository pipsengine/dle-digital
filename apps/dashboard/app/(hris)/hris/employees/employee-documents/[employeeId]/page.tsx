import EmployeeDocumentsClient from '../EmployeeDocumentsClient';

export default async function EmployeeDocumentsByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmployeeDocumentsClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

