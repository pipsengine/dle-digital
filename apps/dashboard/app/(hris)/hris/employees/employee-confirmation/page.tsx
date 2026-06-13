import EmployeeConfirmationClient from './EmployeeConfirmationClient';
import { readEmployeeConfirmationFromDb, type EmployeeConfirmationPayload } from '@/lib/employee-confirmation-store';

export const dynamic = 'force-dynamic';

export default async function EmployeeConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;

  let initialPayload: EmployeeConfirmationPayload;
  let initialError: string | null = null;

  try {
    initialPayload = await readEmployeeConfirmationFromDb();
  } catch (error: any) {
    initialError = error?.message || 'Unable to read employee confirmation records from the system database.';
    initialPayload = {
      generatedAt: new Date().toISOString(),
      source: 'DLE Enterprise HRIS database',
      records: [],
      summary: {
        totalMonitored: 0,
        probationActive: 0,
        dueSoon: 0,
        overdue: 0,
        confirmed: 0,
        ready: 0,
        incomplete: 0,
        highRisk: 0,
      },
      filterOptions: {
        departments: [],
        locations: [],
        stages: ['Probation Active', 'Due Soon', 'Overdue', 'Confirmed', 'Review Required'],
        risks: ['High', 'Medium', 'Low'],
        readiness: ['Ready', 'Needs Review', 'Incomplete'],
      },
      insights: [
        {
          id: 'load-error',
          tone: 'High',
          title: 'Employee confirmation records could not be loaded',
          detail: initialError || 'Unable to read employee confirmation records from the system database.',
        },
      ],
    };
  }

  return <EmployeeConfirmationClient initialPayload={initialPayload} initialEmployeeId={employeeId} initialError={initialError} />;
}
