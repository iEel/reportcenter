import { NextResponse } from 'next/server';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { connectToCentralDB } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/rate-limit';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอก Username และ Password' },
                { status: 400 }
            );
        }

        // Rate limiting — get IP from headers
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            const retryMin = Math.ceil(rateCheck.retryAfterMs / 60000);
            return NextResponse.json(
                { success: false, message: `เข้าสู่ระบบผิดพลาดเกินกำหนด กรุณารอ ${retryMin} นาที` },
                { status: 429 }
            );
        }

        const pool = await connectToCentralDB();

        const result = await pool.request()
            .input('Username', sql.NVarChar(50), username)
            .query(`
                SELECT u.UserId, u.Username, u.PasswordHash, u.FullName, u.CompanyId, u.RoleId, u.IsActive, r.RoleName
                FROM Users u
                LEFT JOIN Roles r ON u.RoleId = r.RoleId
                WHERE u.Username = @Username
            `);

        if (result.recordset.length === 0) {
            recordFailedAttempt(ip);
            return NextResponse.json(
                { success: false, message: 'Username หรือ Password ไม่ถูกต้อง' },
                { status: 401 }
            );
        }

        const user = result.recordset[0];

        if (!user.IsActive) {
            return NextResponse.json(
                { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' },
                { status: 403 }
            );
        }

        // Compare password with bcrypt hash
        const isValid = await bcrypt.compare(password, user.PasswordHash);
        if (!isValid) {
            recordFailedAttempt(ip);
            const remaining = rateCheck.remaining - 1;
            return NextResponse.json(
                { success: false, message: `Username หรือ Password ไม่ถูกต้อง${remaining <= 2 ? ` (เหลืออีก ${remaining} ครั้ง)` : ''}` },
                { status: 401 }
            );
        }

        // Success — clear rate limit
        clearAttempts(ip);

        // Fetch allowed companies
        const companyResult = await pool.request()
            .input('UserId', sql.Int, user.UserId)
            .query('SELECT CompanyId FROM UserCompanyMapping WHERE UserId = @UserId ORDER BY CompanyId');
        const allowedCompanies = companyResult.recordset.map(r => r.CompanyId);

        // Create JWT token
        const tokenPayload = {
            userId: user.UserId,
            username: user.Username,
            fullName: user.FullName,
            roleId: user.RoleId,
            roleName: user.RoleName,
            companyId: user.CompanyId,
            allowedCompanies: allowedCompanies,
        };

        const token = await signToken(tokenPayload);

        // Log login activity
        try {
            await pool.request()
                .input('UserId', sql.Int, user.UserId)
                .input('ActionType', sql.NVarChar(50), 'LOGIN')
                .input('Details', sql.NVarChar(500), `${user.FullName} เข้าสู่ระบบ`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
        } catch { }

        // Set cookie
        const response = NextResponse.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            user: tokenPayload,
        });

        response.cookies.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8, // 8 hours
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
            { status: 500 }
        );
    }
}
