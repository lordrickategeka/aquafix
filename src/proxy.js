import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/constants';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { buildFlashCookie } from '@/lib/flash';

const AUTH_PAGES = ['/login', '/signup'];
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const STRICT_LIMIT_PATHS = new Set(['/api/auth/login', '/api/auth/signup']);
const STRICT_LIMIT = { limit: 10, windowSeconds: 5 * 60 };
const GENERAL_LIMIT = { limit: 100, windowSeconds: 60 };

// Same-origin check for state-changing requests, in place of a CSRF token.
// Modern browsers always send one of these headers on a cross-site POST/PUT/
// PATCH/DELETE, so their absence means the request isn't a browser navigation
// we need to guard against (e.g. a server-to-server call or curl).
function isSameOriginRequest(request) {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite) {
    return secFetchSite === 'same-origin' || secFetchSite === 'none';
  }

  const origin = request.headers.get('origin');
  if (origin) {
    return origin === request.nextUrl.origin;
  }

  return true;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
      return Response.json({ error: 'Cross-site request blocked' }, { status: 403 });
    }

    const limitConfig = STRICT_LIMIT_PATHS.has(pathname) ? STRICT_LIMIT : GENERAL_LIMIT;
    const rateLimitKey = `${pathname}:${getClientIp(request)}`;
    const { allowed, resetAt } = await checkRateLimit(rateLimitKey, limitConfig);

    if (!allowed) {
      const retryAfter = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
      return Response.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  const hasSession = request.cookies.has(COOKIE_NAME);

  if (!hasSession && pathname.startsWith('/dashboard')) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(buildFlashCookie('info', 'Please log in to continue.'));
    return response;
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/api/:path*'],
};
