import { NextResponse } from 'next/server';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, message: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Fetch current password hash
        const result = await pool.request()
            .input('UserId', sql.Int, session.userId)
            .query('SELECT PasswordHash FROM Users WHERE UserId = @UserId');

        if (result.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้ในระบบ' }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, result.recordset[0].PasswordHash);
        if (!isValid) {
            return NextResponse.json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 401 });
        }

        // Hash new password and update
        const hashedNew = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('UserId', sql.Int, session.userId)
            .input('PasswordHash', sql.NVarChar(255), hashedNew)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE UserId = @UserId');

        return NextResponse.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });

    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
