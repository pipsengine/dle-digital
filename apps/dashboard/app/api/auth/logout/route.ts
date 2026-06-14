import { NextResponse } from 'next/server';
import { logoutAudit } from '@/lib/auth/auth-store';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function POST(request: Request) {
  const raw = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${AUTH_COOKIE}=`))?.split('=').slice(1).join('=');
  const session = await verifySessionToken(raw ? decodeURIComponent(raw) : '');
  if (session) await logoutAudit(session.username, session.sub, request.headers);
  const response = NextResponse.json({ status: 'success', data: { loggedOut: true } });
  response.cookies.set(AUTH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set(AUTH_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
