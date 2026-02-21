import { NextResponse } from 'next/server';
import sql from 'mssql';
import { COOKIE_NAME, getSession } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

export async function POST(request) {
    // Log logout before clearing cookie
    try {
        const session = await getSession(request);
        if (session) {
            const pool = await connectToCentralDB();
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ActionType', sql.NVarChar(50), 'LOGOUT')
                .input('Details', sql.NVarChar(500), `${session.fullName} ออกจากระบบ`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
        }
    } catch { }

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

