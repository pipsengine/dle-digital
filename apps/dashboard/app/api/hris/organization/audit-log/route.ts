import { NextResponse } from 'next/server';
import { readOrganizationAuditLog } from '@/lib/organization-audit-store';
import { hasPermission, resolveAccessContext } from '@/lib/hris-access';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

export async function GET(request: Request) {
  const access = resolveAccessContext(request);
  if (!hasPermission(access, 'audit.view')) return err(403, 'You do not have permission to view the organization audit log.');

  const { searchParams } = new URL(request.url);
  const moduleFilter = searchParams.get('module');
  const entityIdFilter = searchParams.get('entityId');
  const entityTypeFilter = searchParams.get('entityType');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 200);

  const events = await readOrganizationAuditLog();
  const filtered = events
    .filter((event) => (moduleFilter ? event.module === moduleFilter : true))
    .filter((event) => (entityIdFilter ? event.entityId === entityIdFilter : true))
    .filter((event) => (entityTypeFilter ? event.entityType === entityTypeFilter : true))
    .slice(0, limit);

  return ok({
    actor: access.actor,
    role: access.role,
    total: filtered.length,
    events: filtered,
  });
}
