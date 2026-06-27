import { NextRequest, NextResponse } from 'next/server';
import { applyBenefitsManagementAction, formatBenefitMoney, readBenefitsManagementPayload } from '@/lib/benefits-management-store';

const ok = (data: unknown) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role');
    const payload = await readBenefitsManagementPayload(role);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const rows = payload.enrollments.map((item) => [
        item.employeeId,
        item.employeeName,
        item.planName,
        item.planType,
        item.dependents,
        item.enrolledOn,
        item.status,
      ]);
      const csv = [['Employee ID', 'Employee', 'Plan', 'Type', 'Dependents', 'Enrolled On', 'Status'], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return new NextResponse(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="benefits-management.csv"',
        },
      });
    }
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load Benefits Management.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-hris-role') || 'Benefits Administrator';
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const message = await applyBenefitsManagementAction(action, body);
    const payload = await readBenefitsManagementPayload(role);
    return ok({ message, payload });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to process Benefits Management action.');
  }
}
