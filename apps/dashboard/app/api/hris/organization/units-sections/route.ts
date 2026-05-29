import { NextResponse } from 'next/server';
import { getUnitsSectionsData } from '@/lib/organization-data';

export async function GET() {
  return NextResponse.json({ status: 'success', data: getUnitsSectionsData() });
}
