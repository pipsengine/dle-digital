import { NextResponse } from 'next/server';

import { readEmployeePromotionFromDb } from '@/lib/employee-promotion-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await readEmployeePromotionFromDb();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unable to read employee promotion records from the system database.',
      },
      { status: 500 },
    );
  }
}
