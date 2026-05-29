import { NextResponse } from 'next/server';
import { getCompanyStructureData } from '@/lib/organization-data';

export async function GET() {
  return NextResponse.json({ status: 'success', data: getCompanyStructureData() });
}
