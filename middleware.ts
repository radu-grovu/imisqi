import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/gate',        // the gate page
  '/api/gate',    // gate endpoint
  '/_next',       // Next.js assets
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow public paths (gate + static)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // require the gate cookie for everything else
  const cookie = req.cookies.get('gate_ok')?.value;
  if (cookie !== '1') {
    const url = req.nextUrl.clone();
    url.pathname = '/gate';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
