import { NextResponse } from 'next/server';
import { getLocationsSitesData } from '@/lib/organization-data';

export async function GET() {
  return NextResponse.json({ status: 'success', data: getLocationsSitesData() });
}
