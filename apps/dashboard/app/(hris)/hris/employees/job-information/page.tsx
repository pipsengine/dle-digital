import JobInformationClient from './JobInformationClient';
import { readEmployeeDirectoryFromDb } from '@/lib/dle-enterprise-db';

export const dynamic = 'force-dynamic';

export default async function JobInformationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const fromQuery = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  const employees = await readEmployeeDirectoryFromDb().catch(() => null);
  const employeeId = fromQuery || employees?.[0]?.employeeId || employees?.[0]?.employeeCode || '';
  return <JobInformationClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
