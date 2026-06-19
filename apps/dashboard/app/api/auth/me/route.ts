import { NextResponse } from 'next/server';
import { effectivePermissionsForUser } from '@/lib/auth/access-control-store';
import {
  AUTH_COOKIE,
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
  shouldUseSecureAuthCookie,
  verifySessionToken,
  type SessionUser,
} from '@/lib/auth/session';

const readAuthToken = (request: Request) => {
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${AUTH_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return raw ? decodeURIComponent(raw) : '';
};

const sessionUserFromPayload = (session: Awaited<ReturnType<typeof verifySessionToken>>, permissions: string[]): SessionUser | null => {
  if (!session) return null;
  return {
    userId: session.sub,
    username: session.username,
    employeeId: session.employeeId,
    employeeCode: session.employeeCode,
    fullName: session.fullName,
    department: session.department,
    unit: session.unit,
    roles: session.roles,
    permissions,
    status: session.status,
    firstLoginRequired: session.firstLoginRequired,
    passwordResetRequired: session.passwordResetRequired,
    isGlobalAdmin: session.isGlobalAdmin,
  };
};

export async function GET(request: Request) {
  const session = await verifySessionToken(readAuthToken(request));
  if (!session) return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });

  const permissions = session.isGlobalAdmin || session.sub === 'global-admin'
    ? ['*']
    : await effectivePermissionsForUser(session.sub, session.roles);
  const data = { ...session, permissions };
  const response = NextResponse.json({ status: 'success', data });
  const refreshedUser = sessionUserFromPayload(session, permissions);

  if (refreshedUser) {
    response.cookies.set(AUTH_COOKIE, await createSessionToken(refreshedUser), {
      httpOnly: true,
      sameSite: 'lax',
      secure: shouldUseSecureAuthCookie(request),
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }

  return response;
}
