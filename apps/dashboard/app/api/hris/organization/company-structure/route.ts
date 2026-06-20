import { NextResponse } from 'next/server';
import { readLiveCompanyStructure } from '@/lib/organization-company-structure-store';

export async function GET() {
  try {
    return NextResponse.json({ status: 'success', data: await readLiveCompanyStructure() });
  } catch (error) {
    console.error('Company structure load error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unable to load company structure' },
      { status: 500 },
    );
  }
}
