import { NextRequest, NextResponse } from 'next/server';
import {
  applyOvertimeAction,
  normalizeOvertimeRole,
  overtimeCsv,
  readOvertimeManagementPayload,
  type OvertimeAction,
} from '@/lib/overtime-management-store';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = normalizeOvertimeRole(request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role'));
    const payload = await readOvertimeManagementPayload(role);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      if (!payload.permissions.canExport) return err(403, 'Permission denied.');
      return new Response(overtimeCsv(payload.records, payload.permissions.canViewMoney), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="overtime-management.csv"',
        },
      });
    }
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load overtime management.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = normalizeOvertimeRole(request.headers.get('x-hris-role') || 'HR Manager');
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim() as OvertimeAction;
    if (!id) return err(400, 'Overtime record is required.');
    if (!action) return err(400, 'Overtime action is required.');
    const payload = await applyOvertimeAction(id, action, role, body.actor ? String(body.actor) : role, body.comment ? String(body.comment) : null);
    return ok(payload);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to process overtime action.');
  }
}
