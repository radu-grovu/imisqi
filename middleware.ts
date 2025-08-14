import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// We’ll *exclude* only the assets and the two gate endpoints.
// Everything else must have the gate cookie.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If you already passed the gate, allow through
  const cookie = req.cookies.get('gate_ok')?.value;
  if (cookie === '1') return NextResponse.next();

  // No cookie yet → force /gate
  const url = req.nextUrl.clone();
  url.pathname = '/gate';
  return NextResponse.redirect(url);
}

// Run on every path *except* the ones we explicitly allow
export const config = {
  matcher: [
    // everything except: _next assets, images, favicon, robots, sitemap, and the gate endpoints
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|gate|api/gate).*)',
  ],
};
