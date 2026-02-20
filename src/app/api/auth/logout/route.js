import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
    const response = NextResponse.json({
        success: true,
        message: 'ออกจากระบบสำเร็จ',
    });

    response.cookies.set(COOKIE_NAME, '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
    });

    return response;
}
