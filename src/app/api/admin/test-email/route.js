import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendMail } from '@/lib/email';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { email } = await request.json();
        const to = email || process.env.SMTP_USER;

        if (!to) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุ email ที่ต้องการทดสอบ' }, { status: 400 });
        }

        const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        await sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject: `[ReportCenter] ทดสอบ Email - ${now}`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                    <h2 style="color: #1e293b;">✅ ทดสอบ Email สำเร็จ!</h2>
                    <p style="color: #64748b;">Email นี้ถูกส่งจาก ReportCenter เพื่อทดสอบการตั้งค่า</p>
                    <p style="color: #64748b;">เวลา: <strong>${now}</strong></p>
                    <p style="color: #64748b;">ส่งโดย: <strong>${session.fullName}</strong></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                    <p style="color: #94a3b8; font-size: 12px;">ถ้าคุณได้รับ email นี้แสดงว่าการตั้งค่า Email ถูกต้อง 🎉</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true, message: `ส่ง email ทดสอบไปที่ ${to} สำเร็จ!` });

    } catch (error) {
        console.error('Test email error:', error);
        return NextResponse.json({
            success: false,
            message: `ส่ง email ไม่สำเร็จ: ${error.message}`,
        }, { status: 500 });
    }
}
