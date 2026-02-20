import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'rc-super-secret-key-2026');
const COOKIE_NAME = 'rc_token';

const publicPaths = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public assets and API auth routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        publicPaths.some(p => pathname === p)
    ) {
        return NextResponse.next();
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        // Not logged in → redirect to login
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.next();
    } catch (error) {
        // Token expired or invalid → clear cookie and redirect
        const loginUrl = new URL('/login', request.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
        return response;
    }
}

export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - _next/static, _next/image, favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
