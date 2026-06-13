import DepartmentsClient from './DepartmentsClient';
import { readSystemDepartmentsFromOrganizationDb } from '@/lib/organization-departments-store';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  let initialPayload = null;
  let initialError: string | null = null;

  try {
    initialPayload = await readSystemDepartmentsFromOrganizationDb();
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load departments';
  }

  return <DepartmentsClient initialPayload={initialPayload} initialError={initialError} />;
}
