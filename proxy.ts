import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, URLS } from '@/content/site';

/**
 * Return visitors skip the voyage: if the cross-subdomain Helix session cookie
 * (set by app.helixlabs.pro on .helixlabs.pro) is present, go to the dashboard.
 * `?voyage=1` or an explicit `?mode=` forces the landing page anyway.
 * Nobody wants the origin of the universe every single morning.
 */
export function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (searchParams.has('voyage') || searchParams.has('mode')) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(URLS.dashboard, 307);
  return NextResponse.next();
}

export const config = { matcher: '/' };
