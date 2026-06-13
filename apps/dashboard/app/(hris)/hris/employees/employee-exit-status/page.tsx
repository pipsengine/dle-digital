import EmployeeExitStatusClient from './EmployeeExitStatusClient';
import { readEmployeeExitStatusFromDb, type EmployeeExitStatusPayload } from '@/lib/employee-exit-status-store';

export const dynamic = 'force-dynamic';

export default async function EmployeeExitStatusPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;

  let initialPayload: EmployeeExitStatusPayload;
  let initialError: string | null = null;

  try {
    initialPayload = await readEmployeeExitStatusFromDb();
  } catch (error: any) {
    initialError = error?.message || 'Unable to read employee exit status from the system database.';
    initialPayload = {
      generatedAt: new Date().toISOString(),
      source: 'DLE Enterprise HRIS database',
      records: [],
      summary: {
        totalMonitored: 0,
        exitedEmployees: 0,
        dueSoon: 0,
        pendingClearance: 0,
        finalSettlementDue: 0,
        overdueClearance: 0,
        closed: 0,
        highRisk: 0,
      },
      filterOptions: {
        departments: [],
        locations: [],
        categories: [],
        stages: ['Active Monitoring', 'Due Soon', 'In Clearance', 'Payroll Closure', 'Closed'],
        risks: ['High', 'Medium', 'Low'],
      },
      insights: [
        {
          id: 'load-error',
          tone: 'High',
          title: 'Employee exit status could not be loaded',
          detail: initialError || 'Unable to read employee exit status from the system database.',
        },
      ],
    };
  }

  return <EmployeeExitStatusClient initialPayload={initialPayload} initialEmployeeId={employeeId} initialError={initialError} />;
}
