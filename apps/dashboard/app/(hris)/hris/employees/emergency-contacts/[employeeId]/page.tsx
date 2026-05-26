import EmergencyContactsClient from '../EmergencyContactsClient';

export default async function EmergencyContactsByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmergencyContactsClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

