import { NextResponse } from 'next/server';
import { readLiveJobTitles } from '@/lib/job-titles-store';

export async function GET() {
  try {
    return NextResponse.json({ status: 'success', data: await readLiveJobTitles() });
  } catch (error) {
    console.error('Job titles load error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unable to load job titles' },
      { status: 500 },
    );
  }
}
