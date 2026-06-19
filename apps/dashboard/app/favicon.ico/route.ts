import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

export async function GET() {
  const icon = await readFile(path.join(resolveDashboardRoot(), 'public', 'favicon.ico'));
  return new NextResponse(icon, {
    headers: {
      'content-type': 'image/x-icon',
      'cache-control': 'public, max-age=86400',
    },
  });
}
