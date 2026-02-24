import { NextResponse } from 'next/server';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { connectToCentralDB } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearAttempts, configure } from '@/lib/rate-limit';
import { ldapBind } from '@/lib/ldap';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอก Username และ Password' },
                { status: 400 }
            );
        }

        // Load rate limit config from DB
        try {
            const pool = await connectToCentralDB();
            const cfgResult = await pool.request().query(`
                SELECT SettingKey, SettingValue FROM SystemSettings
                WHERE SettingKey IN ('rate_limit_max_attempts', 'rate_limit_window_minutes')
            `);
            const cfg = {};
            for (const row of cfgResult.recordset) {
                if (row.SettingKey === 'rate_limit_max_attempts') cfg.maxAttempts = parseInt(row.SettingValue) || 5;
                if (row.SettingKey === 'rate_limit_window_minutes') cfg.windowMinutes = parseInt(row.SettingValue) || 15;
            }
            if (Object.keys(cfg).length > 0) configure(cfg);
        } catch (e) { console.warn('Rate limit config load failed:', e.message); }

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

        // Auto-migrate: ensure AuthType column exists
        try {
            const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'AuthType'`);
            if (cols.recordset.length === 0) {
                await pool.request().query(`ALTER TABLE Users ADD AuthType NVARCHAR(10) DEFAULT 'local'`);
            }
        } catch (e) { /* column might already exist */ }

        const result = await pool.request()
            .input('Username', sql.NVarChar(50), username)
            .query(`
                SELECT u.UserId, u.Username, u.PasswordHash, u.FullName, u.CompanyId, u.RoleId, u.IsActive, u.TokenVersion, u.AuthType, r.RoleName
                FROM Users u
                LEFT JOIN Roles r ON u.RoleId = r.RoleId
                WHERE u.Username = @Username
            `);

        if (result.recordset.length === 0) {
            recordFailedAttempt(ip);
            // Audit: failed login
            try {
                await pool.request()
                    .input('ActionType', sql.NVarChar(50), 'LOGIN_FAIL')
                    .input('Details', sql.NVarChar(500), `Login ล้มเหลว: username="${username}" IP=${ip} (ไม่พบผู้ใช้)`)
                    .query(`INSERT INTO ActivityLogs (ActionType, Details) VALUES (@ActionType, @Details)`);
            } catch (e) { /* ignore */ }
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

        // Authenticate based on AuthType
        const authType = (user.AuthType || 'local').toLowerCase();
        let isValid = false;

        if (authType === 'ldap') {
            // LDAP authentication
            const ldapResult = await ldapBind(username, password);
            isValid = ldapResult.success;
            if (!isValid) {
                recordFailedAttempt(ip);
                const remaining = rateCheck.remaining - 1;
                try {
                    await pool.request()
                        .input('UserId', sql.Int, user.UserId)
                        .input('ActionType', sql.NVarChar(50), 'LOGIN_FAIL')
                        .input('Details', sql.NVarChar(500), `Login AD ล้มเหลว: username="${username}" IP=${ip} (${ldapResult.error || 'รหัสผ่านผิด'})`)
                        .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
                } catch (e) { /* ignore */ }
                return NextResponse.json(
                    { success: false, message: `${ldapResult.error || 'Username หรือ Password ไม่ถูกต้อง'}${remaining <= 2 ? ` (เหลืออีก ${remaining} ครั้ง)` : ''}` },
                    { status: 401 }
                );
            }
        } else {
            // Local authentication (bcrypt)
            isValid = await bcrypt.compare(password, user.PasswordHash);
            if (!isValid) {
                recordFailedAttempt(ip);
                const remaining = rateCheck.remaining - 1;
                try {
                    await pool.request()
                        .input('UserId', sql.Int, user.UserId)
                        .input('ActionType', sql.NVarChar(50), 'LOGIN_FAIL')
                        .input('Details', sql.NVarChar(500), `Login ล้มเหลว: username="${username}" IP=${ip} (รหัสผ่านผิด, เหลือ ${remaining} ครั้ง)`)
                        .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
                } catch (e) { /* ignore */ }
                return NextResponse.json(
                    { success: false, message: `Username หรือ Password ไม่ถูกต้อง${remaining <= 2 ? ` (เหลืออีก ${remaining} ครั้ง)` : ''}` },
                    { status: 401 }
                );
            }
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
            tokenVersion: user.TokenVersion ?? 0,
        };

        const token = await signToken(tokenPayload);

        // Log login activity
        try {
            await pool.request()
                .input('UserId', sql.Int, user.UserId)
                .input('ActionType', sql.NVarChar(50), 'LOGIN')
                .input('Details', sql.NVarChar(500), `${user.FullName} เข้าสู่ระบบ`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
        } catch (e) { console.warn('Login activity log failed:', e.message); }

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
