import ContractInformationClient from './ContractInformationClient';
import { readEmployeeDirectoryFromDb } from '@/lib/dle-enterprise-db';

export const dynamic = 'force-dynamic';

export default async function ContractInformationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employees = typeof raw === 'string' && raw.trim() ? [] : ((await readEmployeeDirectoryFromDb()) || []);
  const employeeId =
    typeof raw === 'string' && raw.trim()
      ? raw.trim()
      : employees.find((e) => e.contractEndDate || ['Lumpsum', 'Daily Rate', 'Contract'].includes(e.employmentType))?.employeeId || employees[0]?.employeeId || '';
  return <ContractInformationClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}
