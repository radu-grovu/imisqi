import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Hard gate: unless the gate cookie is present, redirect to /gate
 * for ALL routes except the gate page itself, the gate API, and static assets.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow these paths without a cookie
  const allow =
    pathname === '/gate' ||
    pathname.startsWith('/api/gate') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';

  if (allow) return NextResponse.next();

  // Require cookie for everything else
  const passed = req.cookies.get('gate_ok')?.value === '1';
  if (!passed) {
    const url = req.nextUrl.clone();
    url.pathname = '/gate';
    url.search = ''; // drop any query parameters
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Apply to ALL routes; filtering is done inside the middleware.
export const config = { matcher: '/:path*' };
