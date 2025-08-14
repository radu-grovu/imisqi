import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOW_LIST = [
  '/',              // landing (shows gate form or login after gate)
  '/api/gate',     // gate endpoint
  '/_next',        // Next.js assets
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // allow static and landing
  if (ALLOW_LIST.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // enforce gate for auth-related pages
  const needGate = pathname.startsWith('/login') || pathname.startsWith('/register');
  if (needGate) {
    const cookie = req.cookies.get('gate_ok')?.value;
    if (cookie !== '1') {
      // bounce to landing (which shows the gate)
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
