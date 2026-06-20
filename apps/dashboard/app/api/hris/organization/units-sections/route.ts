import { NextResponse } from 'next/server';
import { readLiveUnitsSections } from '@/lib/organization-units-sections-store';

export async function GET() {
  try {
    return NextResponse.json({ status: 'success', data: await readLiveUnitsSections() });
  } catch (error) {
    console.error('Units and sections load error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unable to load units and sections' },
      { status: 500 },
    );
  }
}
