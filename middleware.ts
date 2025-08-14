import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let through gate page and API endpoint without redirect
  if (pathname.startsWith('/gate') || pathname.startsWith('/api/gate')) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next();
  }

  // If no gate cookie, force redirect to /gate
  const cookie = req.cookies.get('gate_ok')?.value;
  if (cookie !== '1') {
    const url = req.nextUrl.clone();
    url.pathname = '/gate';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Apply to all routes
};
