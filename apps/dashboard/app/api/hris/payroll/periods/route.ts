import { NextResponse } from 'next/server';
import {
  activatePayrollPeriod,
  closePayrollPeriodRecord,
  createPayrollPeriod,
  listPayrollPeriods,
  openPayrollPeriod,
  reopenPayrollPeriodRecord,
} from '@/lib/payroll-period-store';
import { assertPayrollCutoverBackupBeforeOpen } from '@/lib/payroll-cutover-backup-service';
import { payrollSessionContext, managementPermissions } from '@/lib/payroll-session';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const compact = (value: unknown) => String(value || '').trim();

export async function GET() {
  try {
    const data = await listPayrollPeriods();
    return ok(data);
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to load payroll periods.');
  }
}

export async function POST(request: Request) {
  try {
    const { role, actor } = await payrollSessionContext(request);
    const perms = managementPermissions(role);
    const body = await request.json().catch(() => ({}));
    const action = compact(body.action);
    const period = compact(body.period);
    const reason = compact(body.reason);

    if (!period) return err(400, 'Period is required.');
    if (!perms.canManageRun && !perms.canConfigure) return err(403, 'Permission denied');

    if (action === 'create') {
      const record = await createPayrollPeriod(period, actor, body.paymentDate || null);
      return ok({ record });
    }
    if (action === 'open' || action === 'activate') {
      await assertPayrollCutoverBackupBeforeOpen(period);
      const record = action === 'activate' ? await activatePayrollPeriod(period, actor) : await openPayrollPeriod(period, actor);
      return ok({ record, activePeriod: period });
    }
    if (action === 'close') {
      if (!perms.canApprove && !perms.canManageRun) return err(403, 'Permission denied');
      const record = await closePayrollPeriodRecord(period, actor, reason || undefined);
      return ok({ record });
    }
    if (action === 'reopen') {
      if (!perms.canReopen) return err(403, 'Only CFO, Executive Director, or Super Admin can reopen closed payroll periods.');
      if (!reason) return err(400, 'Reopening requires a reason.');
      const record = await reopenPayrollPeriodRecord(period, actor, reason);
      return ok({ record, activePeriod: period });
    }

    return err(400, 'Unsupported payroll period action.');
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to update payroll period.');
  }
}
