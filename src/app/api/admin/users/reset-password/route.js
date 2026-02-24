import { NextResponse } from 'next/server';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { connectToCentralDB } from '@/lib/db';
import { getSession, invalidateSessionCache } from '@/lib/auth';
import { validatePassword } from '@/lib/password-rules';

// Admin reset password for any user (no old password required)
export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { userId, newPassword } = await request.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุ userId และรหัสผ่านใหม่' }, { status: 400 });
        }

        // Password complexity check
        const pwCheck = validatePassword(newPassword);
        if (!pwCheck.valid) {
            return NextResponse.json({ success: false, message: 'รหัสผ่านไม่ผ่านเกณฑ์: ' + pwCheck.errors.join(', ') }, { status: 400 });
        }

        const pool = await connectToCentralDB();
        const uid = parseInt(userId);

        // Check user exists
        const userResult = await pool.request()
            .input('UserId', sql.Int, uid)
            .query('SELECT Username, FullName FROM Users WHERE UserId = @UserId');

        if (userResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
        }

        const targetUser = userResult.recordset[0];

        // Hash and update password + increment TokenVersion to force re-login
        const hashedNew = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('UserId', sql.Int, uid)
            .input('PasswordHash', sql.NVarChar(255), hashedNew)
            .query(`
                UPDATE Users
                SET PasswordHash = @PasswordHash,
                    TokenVersion = ISNULL(TokenVersion, 0) + 1
                WHERE UserId = @UserId
            `);

        // Invalidate session cache so user must re-login
        invalidateSessionCache(uid);

        // Audit log
        try {
            await pool.request()
                .input('LogUserId', sql.Int, session.userId)
                .input('ActionType', sql.NVarChar(50), 'RESET_PASSWORD')
                .input('Details', sql.NVarChar(500), `รีเซ็ตรหัสผ่านผู้ใช้ #${uid} "${targetUser.FullName}" (${targetUser.Username})`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@LogUserId, @ActionType, @Details)`);
        } catch (e) { console.warn('Audit log failed:', e.message); }

        return NextResponse.json({ success: true, message: `รีเซ็ตรหัสผ่านของ "${targetUser.FullName}" สำเร็จ` });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
