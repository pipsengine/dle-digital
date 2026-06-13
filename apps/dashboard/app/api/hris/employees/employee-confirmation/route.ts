import { NextResponse } from 'next/server';

import { readEmployeeConfirmationFromDb } from '@/lib/employee-confirmation-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await readEmployeeConfirmationFromDb();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unable to read employee confirmation records from the system database.',
      },
      { status: 500 },
    );
  }
}
