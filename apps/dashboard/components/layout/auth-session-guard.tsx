'use client';

import { useEffect } from 'react';

const PUBLIC_PREFIXES = ['/login', '/change-password', '/access-denied'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function AuthSessionGuard() {
  useEffect(() => {
    const verifySession = async () => {
      if (isPublicPath(window.location.pathname)) return;
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
        if (response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          const loginUrl = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
          window.location.replace(loginUrl);
        }
      } catch {
        // Network errors should not force logout; middleware protects server routes.
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void verifySession();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void verifySession();
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
