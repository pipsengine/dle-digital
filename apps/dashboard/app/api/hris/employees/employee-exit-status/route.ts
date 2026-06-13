import { NextResponse } from 'next/server';

import { readEmployeeExitStatusFromDb } from '@/lib/employee-exit-status-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await readEmployeeExitStatusFromDb();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unable to read employee exit status from the system database.',
      },
      { status: 500 },
    );
  }
}
