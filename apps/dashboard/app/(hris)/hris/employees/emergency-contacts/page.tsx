import EmergencyContactsClient from './EmergencyContactsClient';

export default async function EmergencyContactsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'DLE-EMP-00001';
  return <EmergencyContactsClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

