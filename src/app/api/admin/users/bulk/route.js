import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// PUT: Bulk toggle user active status
export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { userIds, isActive } = await request.json();

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ success: false, message: 'No user IDs provided' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        for (const id of userIds) {
            await pool.request()
                .input('UserId', sql.Int, parseInt(id))
                .input('IsActive', sql.Bit, isActive ? 1 : 0)
                .query('UPDATE Users SET IsActive = @IsActive WHERE UserId = @UserId');
        }

        return NextResponse.json({ success: true, updated: userIds.length });

    } catch (error) {
        console.error('Bulk user update error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
