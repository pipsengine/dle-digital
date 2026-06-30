import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session';
import {
  createEnterpriseNotification,
  listEnterpriseNotifications,
  updateEnterpriseNotifications,
  type EnterpriseNotification,
  type NotificationScope,
} from '@/lib/enterprise-notifications-store';
import { buildEssEmployeeLookupKeys } from '@/lib/ess-dashboard-store';
import { listLiveLeaveApprovalNotifications } from '@/lib/leave-workflow-service';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import {
  isLiveNotificationId,
  resolveNotificationHref,
  shouldUseEssNotificationRouting,
} from '@/lib/ess-notification-routing';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

const getSession = async (request: NextRequest) => verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);

const scopeFrom = (request: NextRequest): NotificationScope => {
  const scope = request.nextUrl.searchParams.get('scope');
  if (scope === 'messages' || scope === 'notifications' || scope === 'approvals') return scope;
  return 'all';
};

const resolveSessionEmployee = async (session: NonNullable<Awaited<ReturnType<typeof getSession>>>) => {
  const { employees } = await readPayrollEmployees();
  const identities = [session.employeeCode, session.employeeId, session.username]
    .map((value) => normalizePayrollMatchKey(value))
    .filter(Boolean);
  const employee = employees.find((item: DleEmployeeDirectoryRow) => {
    const keys = buildEssEmployeeLookupKeys(item).map((key: string) => normalizePayrollMatchKey(key)).filter(Boolean);
    return identities.some((identity) => keys.includes(identity));
  });
  return { employee, employees };
};

const mergeNotificationFeeds = (
  persisted: EnterpriseNotification[],
  live: Array<Omit<EnterpriseNotification, 'recipientUserId' | 'recipientUsername' | 'recipientEmployeeCode' | 'recipientRoles'>>,
) => {
  const seen = new Set(persisted.map((item) => item.id));
  const merged = [...persisted];
  for (const item of live) {
    if (seen.has(item.id)) continue;
    merged.unshift({
      ...item,
      recipientUserId: '',
      recipientUsername: '',
      recipientEmployeeCode: undefined,
      recipientRoles: [],
    });
  }
  return merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

const essContextFrom = (request: NextRequest) =>
  request.headers.get('x-ess-context') === 'workforce-portal';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });

  const essContext = essContextFrom(request);
  const scope = scopeFrom(request);
  const base = await listEnterpriseNotifications(session, scope).catch(() => ({
    notifications: [] as EnterpriseNotification[],
    counts: { unread: 0, notifications: 0, messages: 0, approvals: 0, critical: 0 },
  }));

  let notifications = base.notifications;
  try {
    const { employee, employees } = await resolveSessionEmployee(session);
    if (employee && (scope === 'all' || scope === 'approvals' || scope === 'notifications')) {
      const live = await listLiveLeaveApprovalNotifications({
        actor: employee,
        employees,
        roles: session.roles || [],
        isGlobalAdmin: session.isGlobalAdmin,
      });
      notifications = mergeNotificationFeeds(notifications, live).filter((item) => {
        if (scope === 'approvals') return item.kind === 'Approval' || item.kind === 'Workflow';
        if (scope === 'notifications') return item.kind !== 'Message';
        return true;
      });
    }
  } catch (error) {
    console.warn('[notifications] live leave feed unavailable', error);
  }

  const unread = notifications.filter((item) => item.status === 'Unread').length;
  notifications = notifications.map((item) => ({
    ...item,
    href: resolveNotificationHref(session, item.href, essContext),
  }));
  return NextResponse.json({
    status: 'success',
    data: {
      notifications,
      counts: {
        ...base.counts,
        unread,
        notifications: notifications.filter((item) => item.kind !== 'Message' && item.status === 'Unread').length,
        messages: notifications.filter((item) => item.kind === 'Message' && item.status === 'Unread').length,
        approvals: notifications.filter((item) => ['Approval', 'Workflow'].includes(item.kind) && item.status === 'Unread').length,
        critical: notifications.filter((item) => item.severity === 'critical' && item.status === 'Unread').length,
      },
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; ids?: string[] };
  if (body.action !== 'mark-read' && body.action !== 'archive' && body.action !== 'mark-all-read') {
    return NextResponse.json({ status: 'error', error: 'Unsupported notification action' }, { status: 400 });
  }
  const requestedIds = Array.isArray(body.ids) ? body.ids : [];
  const persistedIds = requestedIds.filter((id) => !isLiveNotificationId(id));
  if (body.action !== 'mark-all-read' && !persistedIds.length) {
    return NextResponse.json({ status: 'success', data: { notifications: [], counts: { unread: 0, notifications: 0, messages: 0, approvals: 0, critical: 0 } } });
  }
  const data = await updateEnterpriseNotifications(session, body.action === 'mark-all-read' ? [] : persistedIds, body.action);
  const essContext = essContextFrom(request);
  if (shouldUseEssNotificationRouting(session, essContext)) {
    data.notifications = data.notifications.map((item) => ({
      ...item,
      href: resolveNotificationHref(session, item.href, essContext),
    }));
  }
  return NextResponse.json({ status: 'success', data });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  if (!session.permissions.includes('*') && !session.permissions.some((permission) => permission.includes('admin') || permission.includes('workflow'))) {
    return NextResponse.json({ status: 'error', error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { title?: string; body?: string; module?: string };
  if (!body.title || !body.body || !body.module) {
    return NextResponse.json({ status: 'error', error: 'title, body, and module are required' }, { status: 400 });
  }
  const notification = await createEnterpriseNotification(session, body as Parameters<typeof createEnterpriseNotification>[1]);
  return NextResponse.json({ status: 'success', data: { notification } }, { status: 201 });
}
