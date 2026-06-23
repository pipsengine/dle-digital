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

const permissionsFromRequest = (request: NextRequest) =>
  (request.headers.get('x-auth-permissions') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const hasPermission = (permissions: string[], required: string) => {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const [module] = required.split('.');
  return permissions.includes(`${module}.*`);
};

const hasAnyPermission = (request: NextRequest, required: string[]) => {
  if (request.headers.get('x-auth-global-admin') === '1') return true;
  return required.some((permission) => hasPermission(permissionsFromRequest(request), permission));
};

const canUseOvertimeOverride = (request: NextRequest) => hasAnyPermission(request, ['overtime.authorization.override.override']);

const canActOnAuthorization = (request: NextRequest, decision: 'approve' | 'reject') =>
  canUseOvertimeOverride(request) ||
  hasAnyPermission(request, [
    `overtime.authorization.${decision}`,
    `overtime.authorization.project-manager.${decision}`,
    `overtime.authorization.md.${decision}`,
    'workforce.manage',
  ]);

const applyAccessToPayload = <T extends { permissions: Record<string, boolean> }>(payload: T, request: NextRequest): T => ({
  ...payload,
  permissions: {
    ...payload.permissions,
    canSubmit: payload.permissions.canSubmit && hasAnyPermission(request, ['overtime.authorization.create', 'overtime.authorization.submit', 'workforce.manage', 'operations.timesheets.submit']),
    canSupervisorApprove: payload.permissions.canSupervisorApprove && hasAnyPermission(request, ['overtime.authorization.approve', 'overtime.authorization.project-manager.approve', 'workforce.manage', 'operations.timesheets.approve']),
    canHrApprove: payload.permissions.canHrApprove && hasAnyPermission(request, ['overtime.authorization.approve', 'overtime.authorization.md.approve', 'workforce.manage', 'operations.timesheets.approve']),
    canPayroll: payload.permissions.canPayroll && hasAnyPermission(request, ['overtime.authorization.release', 'overtime.authorization.post', 'workforce.manage', 'operations.timesheets.approve']),
    canExport: payload.permissions.canExport && hasAnyPermission(request, ['overtime.authorization.export', 'workforce.manage', 'operations.timesheets.export']),
    canViewMoney: payload.permissions.canViewMoney && hasAnyPermission(request, ['overtime.authorization.view', 'payroll.view', 'workforce.manage']),
    canAudit: payload.permissions.canAudit && hasAnyPermission(request, ['overtime.authorization.audit', 'workforce.manage']),
  },
});

export async function GET(request: NextRequest) {
  try {
    const role = normalizeOvertimeRole(request.headers.get('x-hris-role') || request.nextUrl.searchParams.get('role'));
    const [payload, authorizationRequests] = await Promise.all([
      readOvertimeManagementPayload(role),
      listOvertimeAuthorizationRequests().catch(() => []),
    ]);
    const data = applyAccessToPayload({ ...payload, authorizationRequests }, request);
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      if (!hasAnyPermission(request, ['overtime.authorization.export', 'workforce.manage', 'operations.timesheets.export'])) return err(403, 'Permission denied.');
      if (!data.permissions.canExport) return err(403, 'Permission denied.');
      return new Response(overtimeCsv(data.records, data.permissions.canViewMoney), {
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
      if (!hasAnyPermission(request, ['overtime.authorization.create', 'overtime.authorization.submit', 'workforce.manage', 'operations.timesheets.submit'])) return err(403, 'Permission denied.');
      await createOvertimeAuthorizationRequest({ ...body, portalBaseUrl: baseUrl }, body.actor ? String(body.actor) : 'Production Manager');
      const [payload, authorizationRequests] = await Promise.all([readOvertimeManagementPayload(role), listOvertimeAuthorizationRequests()]);
      return ok(applyAccessToPayload({ ...payload, authorizationRequests }, request));
    }
    if (String(body.action || '').trim() === 'approve-authorization' || String(body.action || '').trim() === 'reject-authorization') {
      if (!id) return err(400, 'Overtime authorization request is required.');
      const decision = String(body.action).startsWith('approve') ? 'approve' : 'reject';
      if (!canActOnAuthorization(request, decision)) return err(403, 'Permission denied.');
      const actor = canUseOvertimeOverride(request) && role === 'Super Administrator' ? 'Super Administrator' : body.actor ? String(body.actor) : role;
      await actOnOvertimeAuthorizationRequest(
        id,
        decision,
        actor,
        body.comment ? String(body.comment) : null,
        baseUrl,
      );
      const [payload, authorizationRequests] = await Promise.all([readOvertimeManagementPayload(role), listOvertimeAuthorizationRequests()]);
      return ok(applyAccessToPayload({ ...payload, authorizationRequests }, request));
    }
    if (String(body.action || '').trim() === 'create-request') {
      if (!hasAnyPermission(request, ['overtime.authorization.create', 'overtime.authorization.submit', 'workforce.manage', 'operations.timesheets.submit'])) return err(403, 'Permission denied.');
      const payload = await createOvertimeRequest(body, role, body.actor ? String(body.actor) : role);
      const authorizationRequests = await listOvertimeAuthorizationRequests().catch(() => []);
      return ok(applyAccessToPayload({ ...payload, authorizationRequests }, request));
    }
    if (!id) return err(400, 'Overtime record is required.');
    if (!action) return err(400, 'Overtime action is required.');
    if (action === 'submit' && !hasAnyPermission(request, ['overtime.authorization.submit', 'workforce.manage', 'operations.timesheets.submit'])) return err(403, 'Permission denied.');
    if (['approve-supervisor', 'approve-hr', 'reject', 'return', 'reopen'].includes(action) && !hasAnyPermission(request, ['overtime.authorization.approve', 'overtime.authorization.reject', 'workforce.manage', 'operations.timesheets.approve'])) return err(403, 'Permission denied.');
    if (['mark-payroll-ready', 'post-payroll'].includes(action) && !hasAnyPermission(request, ['overtime.authorization.release', 'overtime.authorization.post', 'workforce.manage', 'operations.timesheets.approve'])) return err(403, 'Permission denied.');
    const payload = await applyOvertimeAction(id, action, role, body.actor ? String(body.actor) : role, body.comment ? String(body.comment) : null);
    const authorizationRequests = await listOvertimeAuthorizationRequests().catch(() => []);
    return ok(applyAccessToPayload({ ...payload, authorizationRequests }, request));
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to process overtime action.');
  }
}
