import { NextResponse } from 'next/server';
import { readLoginHistory, readSecurityAudit } from '@/lib/auth/auth-store';
import { AUTH_COOKIE, hasPermission, verifySessionToken } from '@/lib/auth/session';

export async function GET(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${AUTH_COOKIE}=`))?.split('=').slice(1).join('=');
  const session = await verifySessionToken(token ? decodeURIComponent(token) : '');
  if (!session) return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  if (!hasPermission(session.permissions, 'audit.view') && !hasPermission(session.permissions, 'admin.*')) return NextResponse.json({ status: 'error', error: 'Forbidden' }, { status: 403 });
  const [audit, loginHistory] = await Promise.all([readSecurityAudit(), readLoginHistory()]);
  return NextResponse.json({ status: 'success', data: { audit, loginHistory } });
}
