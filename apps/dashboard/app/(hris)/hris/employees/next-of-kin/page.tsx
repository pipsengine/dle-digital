import NextOfKinClient from './NextOfKinClient';

export default async function NextOfKinPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : 'DLE-EMP-00001';
  return <NextOfKinClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

