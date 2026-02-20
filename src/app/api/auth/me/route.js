import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                { success: false, message: 'ไม่ได้เข้าสู่ระบบ' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                userId: session.userId,
                username: session.username,
                fullName: session.fullName,
                roleId: session.roleId,
                roleName: session.roleName,
                companyId: session.companyId,
            }
        });

    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาด' },
            { status: 500 }
        );
    }
}
