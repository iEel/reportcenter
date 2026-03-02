import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ldapLookup } from '@/lib/ldap';

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Admin only' }, { status: 403 });
        }

        const pool = await connectToCentralDB();

        // Get all LDAP users that are currently active
        const result = await pool.request().query(`
            SELECT UserId, Username, FullName, IsActive
            FROM Users
            WHERE AuthType = 'ldap'
        `);

        const ldapUsers = result.recordset;

        if (ldapUsers.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'ไม่พบผู้ใช้ LDAP ในระบบ',
                summary: { total: 0, active: 0, disabled: 0, reactivated: 0 }
            });
        }

        let disabled = 0;
        let reactivated = 0;
        let alreadyDisabled = 0;
        const details = [];

        for (const user of ldapUsers) {
            try {
                const adResult = await ldapLookup(user.Username);

                if (adResult.success) {
                    // User found in AD — if was disabled in RC, reactivate
                    if (!user.IsActive) {
                        await pool.request()
                            .input('UserId', sql.Int, user.UserId)
                            .query('UPDATE Users SET IsActive = 1 WHERE UserId = @UserId');
                        reactivated++;
                        details.push({ username: user.Username, fullName: user.FullName, action: 'reactivated' });
                    }
                } else {
                    // User NOT found in AD — disable if currently active
                    if (user.IsActive) {
                        await pool.request()
                            .input('UserId', sql.Int, user.UserId)
                            .query('UPDATE Users SET IsActive = 0 WHERE UserId = @UserId');
                        disabled++;
                        details.push({ username: user.Username, fullName: user.FullName, action: 'disabled' });
                    } else {
                        alreadyDisabled++;
                    }
                }
            } catch (err) {
                console.warn(`[AD Sync] Error checking ${user.Username}:`, err.message);
                details.push({ username: user.Username, fullName: user.FullName, action: 'error', error: err.message });
            }
        }

        const active = ldapUsers.length - disabled - alreadyDisabled;

        // Audit log
        try {
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ActionType', sql.NVarChar(50), 'AD_SYNC')
                .input('Details', sql.NVarChar(500),
                    `AD Sync: ตรวจสอบ ${ldapUsers.length} คน — Disable ${disabled}, Reactivate ${reactivated}, Active ${active}`)
                .query('INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)');
        } catch { }

        console.log(`[AD Sync] Total: ${ldapUsers.length}, Disabled: ${disabled}, Reactivated: ${reactivated}`);

        return NextResponse.json({
            success: true,
            message: `ตรวจสอบ ${ldapUsers.length} คน — Disable ${disabled} คน${reactivated > 0 ? `, Reactivate ${reactivated} คน` : ''}`,
            summary: {
                total: ldapUsers.length,
                active,
                disabled,
                reactivated,
                alreadyDisabled,
            },
            details,
        });

    } catch (error) {
        console.error('AD Sync error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + error.message }, { status: 500 });
    }
}
