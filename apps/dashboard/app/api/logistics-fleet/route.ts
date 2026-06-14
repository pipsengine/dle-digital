import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session';
import {
  createLogisticsFleetRecord,
  performFleetAction,
  readLogisticsFleetData,
  updateFleetWorkflow,
  type LogisticsEntity,
} from '@/lib/logistics-fleet-store';

const entities = new Set<LogisticsEntity>(['vehicle', 'driver', 'trip', 'maintenance', 'fuel', 'compliance', 'request']);
const workflowEntities = new Set(['driver', 'trip', 'maintenance', 'request']);
const workflowActions = new Set(['approve', 'reject', 'close', 'dispatch', 'complete', 'request-correction', 'escalate']);
const operationalActions = new Set(['assign-vehicle', 'reassign-vehicle', 'unassign-vehicle', 'suspend-driver', 'reactivate-driver', 'verify-document', 'reject-document', 'assign-trip-driver']);

const actorFrom = async (request: NextRequest) => {
  const session = await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  return session?.fullName || session?.username || 'System';
};

export async function GET() {
  const data = await readLogisticsFleetData();
  return NextResponse.json({ status: 'success', data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    entity?: LogisticsEntity;
    record?: Record<string, unknown>;
    action?: string;
    id?: string;
  };
  const actor = await actorFrom(request);

  if (body.action) {
    if (operationalActions.has(body.action)) {
      try {
        const data = await performFleetAction(body.action as Parameters<typeof performFleetAction>[0], body as Record<string, unknown>, actor);
        return NextResponse.json({ status: 'success', data });
      } catch (error) {
        return NextResponse.json({ status: 'error', error: error instanceof Error ? error.message : 'Action failed' }, { status: 400 });
      }
    }
    if (!body.entity || !workflowEntities.has(body.entity) || !body.id || !workflowActions.has(body.action)) {
      return NextResponse.json({ status: 'error', error: 'Valid workflow entity, action, and id are required' }, { status: 400 });
    }
    try {
      const data = await updateFleetWorkflow(body.entity as 'driver' | 'trip' | 'maintenance' | 'request', body.id, body.action as Parameters<typeof updateFleetWorkflow>[2], actor);
      return NextResponse.json({ status: 'success', data });
    } catch (error) {
      return NextResponse.json({ status: 'error', error: error instanceof Error ? error.message : 'Workflow update failed' }, { status: 404 });
    }
  }

  if (!body.entity || !entities.has(body.entity)) {
    return NextResponse.json({ status: 'error', error: 'Valid logistics fleet entity is required' }, { status: 400 });
  }
  try {
    const data = await createLogisticsFleetRecord(body.entity, body.record || {}, actor);
    return NextResponse.json({ status: 'success', data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error instanceof Error ? error.message : 'Unable to save record' }, { status: 400 });
  }
}
