import { NextRequest, NextResponse } from 'next/server';
import { actOnOvertimeAuthorizationToken } from '@/lib/overtime-approval-workflow-store';

const html = (title: string, body: string, status = 200) => new NextResponse(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family:Arial,sans-serif;margin:40px;color:#0f172a">
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="/hris/workforce-management/overtime-management">Open Overtime Management</a></p>
  </body>
</html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    if (!token) return html('Invalid overtime approval link', 'The approval token is missing.', 400);
    const result = await actOnOvertimeAuthorizationToken(token);
    return html('Overtime request updated', `${result.projectCode} for ${result.workDate} is now ${result.status}.`);
  } catch (error) {
    return html('Overtime request could not be updated', error instanceof Error ? error.message : 'The approval link could not be processed.', 400);
  }
}
