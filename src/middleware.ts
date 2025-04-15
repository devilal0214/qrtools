import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // For admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('admin-token');
    const isAdmin = request.cookies.get('is-admin');

    // Allow access to login page if not authenticated
    if (request.nextUrl.pathname === '/admin/login') {
      if (adminToken && isAdmin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.next();
    }

    // Check admin authentication for other admin routes
    if (!adminToken || !isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // For regular protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const authToken = request.cookies.get('firebase-token');
    if (!authToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Handle short URL redirects
  if (request.nextUrl.pathname.startsWith('/go/')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/go/:path*'] // Add /go/* to matcher
};
