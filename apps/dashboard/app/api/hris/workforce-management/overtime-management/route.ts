import { NextRequest, NextResponse } from 'next/server';
import {
  applyOvertimeAction,
  createOvertimeRequest,
  normalizeOvertimeRole,
  overtimeCsv,
  readOvertimeManagementPayload,
  type OvertimeAction,
} from '@/lib/overtime-management-store';
import {
  actOnOvertimeAuthorizationRequest,
  createOvertimeAuthorizationRequest,
  listOvertimeAuthorizationRequests,
} from '@/lib/overtime-approval-workflow-store';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: NextRequest) {
  try {
    const role = normalizeOvertimeRole(request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role'));
    const [payload, authorizationRequests] = await Promise.all([
      readOvertimeManagementPayload(role),
      listOvertimeAuthorizationRequests().catch(() => []),
    ]);
    const data = { ...payload, authorizationRequests };
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      if (!payload.permissions.canExport) return err(403, 'Permission denied.');
      return new Response(overtimeCsv(payload.records, payload.permissions.canViewMoney), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="overtime-management.csv"',
        },
      });
    }
    return ok(data);
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
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    if (String(body.action || '').trim() === 'create-authorization') {
      await createOvertimeAuthorizationRequest({ ...body, portalBaseUrl: baseUrl }, body.actor ? String(body.actor) : 'Production Manager');
      const [payload, authorizationRequests] = await Promise.all([readOvertimeManagementPayload(role), listOvertimeAuthorizationRequests()]);
      return ok({ ...payload, authorizationRequests });
    }
    if (String(body.action || '').trim() === 'approve-authorization' || String(body.action || '').trim() === 'reject-authorization') {
      if (!id) return err(400, 'Overtime authorization request is required.');
      await actOnOvertimeAuthorizationRequest(
        id,
        String(body.action).startsWith('approve') ? 'approve' : 'reject',
        body.actor ? String(body.actor) : role,
        body.comment ? String(body.comment) : null,
        baseUrl,
      );
      const [payload, authorizationRequests] = await Promise.all([readOvertimeManagementPayload(role), listOvertimeAuthorizationRequests()]);
      return ok({ ...payload, authorizationRequests });
    }
    if (String(body.action || '').trim() === 'create-request') {
      const payload = await createOvertimeRequest(body, role, body.actor ? String(body.actor) : role);
      const authorizationRequests = await listOvertimeAuthorizationRequests().catch(() => []);
      return ok({ ...payload, authorizationRequests });
    }
    if (!id) return err(400, 'Overtime record is required.');
    if (!action) return err(400, 'Overtime action is required.');
    const payload = await applyOvertimeAction(id, action, role, body.actor ? String(body.actor) : role, body.comment ? String(body.comment) : null);
    const authorizationRequests = await listOvertimeAuthorizationRequests().catch(() => []);
    return ok({ ...payload, authorizationRequests });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to process overtime action.');
  }
}
