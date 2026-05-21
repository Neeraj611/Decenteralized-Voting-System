import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection middleware.
 * If a user tries to access /dashboard without the auth cookie, redirect to /.
 * If an authenticated user visits /, redirect to /dashboard.
 */
export function middleware(request: NextRequest) {
    const authCookie = request.cookies.get('decentravote-auth');
    const { pathname } = request.nextUrl;

    // Protect /dashboard and all sub-routes
    if (pathname.startsWith('/dashboard') && !authCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // If logged in and visiting the root, go to dashboard
    if (pathname === '/' && authCookie) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/', '/dashboard/:path*'],
};
