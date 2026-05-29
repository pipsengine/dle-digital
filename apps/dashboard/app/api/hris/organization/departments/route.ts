import { NextResponse } from 'next/server';
import { getDepartmentData } from '@/lib/organization-data';

export async function GET() {
  return NextResponse.json({ status: 'success', data: getDepartmentData() });
}
