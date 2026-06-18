import { NextResponse } from 'next/server';
import { readSystemTimesheetLocations } from '@/lib/timesheet-entry-store';

const clean = (value: unknown) => String(value ?? '').trim();

export async function GET() {
  const locations = await readSystemTimesheetLocations();
  const projectSites = Array.from(
    new Set(
      locations
        .flatMap((location) => [location.site, location.name])
        .map(clean)
        .filter((site) => site && site !== 'Unassigned Location'),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    status: 'success',
    data: {
      projectSites,
      locations,
      source: 'DLE_Enterprise.hris.TimesheetLocations',
    },
  });
}
