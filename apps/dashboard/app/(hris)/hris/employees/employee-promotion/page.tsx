import EmployeePromotionClient from './EmployeePromotionClient';
import { readEmployeePromotionFromDb, type EmployeePromotionPayload } from '@/lib/employee-promotion-store';

export const dynamic = 'force-dynamic';

export default async function EmployeePromotionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.employeeId;
  const employeeId = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;

  let initialPayload: EmployeePromotionPayload;
  let initialError: string | null = null;

  try {
    initialPayload = await readEmployeePromotionFromDb();
  } catch (error: any) {
    initialError = error?.message || 'Unable to read employee promotion records from the system database.';
    initialPayload = {
      generatedAt: new Date().toISOString(),
      source: 'DLE Enterprise HRIS database',
      records: [],
      summary: {
        totalMonitored: 0,
        eligibleReview: 0,
        dueReview: 0,
        ready: 0,
        incomplete: 0,
        highRisk: 0,
        activeEmployees: 0,
      },
      filterOptions: {
        departments: [],
        locations: [],
        stages: ['Eligible Review', 'Due Review', 'Not Yet Due', 'Recently Confirmed', 'Needs Data'],
        risks: ['High', 'Medium', 'Low'],
        readiness: ['Ready', 'Needs Review', 'Incomplete'],
        grades: [],
      },
      insights: [
        {
          id: 'load-error',
          tone: 'High',
          title: 'Employee promotion records could not be loaded',
          detail: initialError || 'Unable to read employee promotion records from the system database.',
        },
      ],
    };
  }

  return <EmployeePromotionClient initialPayload={initialPayload} initialEmployeeId={employeeId} initialError={initialError} />;
}
