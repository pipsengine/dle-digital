import ReportingLineClient from './ReportingLineClient';
import { readEmployeeDirectoryFromDb } from '@/lib/dle-enterprise-db';

export const dynamic = 'force-dynamic';

export default async function ReportingLinePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const fromQuery = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  const employees = await readEmployeeDirectoryFromDb().catch(() => null);
  const employeeId = fromQuery || employees?.[0]?.employeeId || employees?.[0]?.employeeCode || '';
  return <ReportingLineClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
