import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { ldapLookup } from '@/lib/ldap';

const CRON_SECRET = process.env.CRON_SECRET;

// GET: called by external cron job
// Usage: GET /api/cron/sync-ad?secret=your-cron-secret
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (secret !== CRON_SECRET) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // Get all LDAP users
        const result = await pool.request().query(`
            SELECT UserId, Username, FullName, IsActive
            FROM Users
            WHERE AuthType = 'ldap'
        `);

        const ldapUsers = result.recordset;

        if (ldapUsers.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No LDAP users to sync',
                summary: { total: 0, disabled: 0, reactivated: 0 }
            });
        }

        let disabled = 0;
        let reactivated = 0;

        for (const user of ldapUsers) {
            try {
                const adResult = await ldapLookup(user.Username);

                if (adResult.success) {
                    // Found in AD — reactivate if was disabled
                    if (!user.IsActive) {
                        await pool.request()
                            .input('UserId', sql.Int, user.UserId)
                            .query('UPDATE Users SET IsActive = 1 WHERE UserId = @UserId');
                        reactivated++;
                    }
                } else {
                    // NOT found in AD — disable if active
                    if (user.IsActive) {
                        await pool.request()
                            .input('UserId', sql.Int, user.UserId)
                            .query('UPDATE Users SET IsActive = 0 WHERE UserId = @UserId');
                        disabled++;
                    }
                }
            } catch (err) {
                console.warn(`[Cron AD Sync] Error checking ${user.Username}:`, err.message);
            }
        }

        // Audit log
        try {
            await pool.request()
                .input('ActionType', sql.NVarChar(50), 'AD_SYNC_CRON')
                .input('Details', sql.NVarChar(500),
                    `[Cron] AD Sync: ตรวจสอบ ${ldapUsers.length} คน — Disable ${disabled}, Reactivate ${reactivated}`)
                .query('INSERT INTO ActivityLogs (ActionType, Details) VALUES (@ActionType, @Details)');
        } catch { }

        console.log(`[Cron AD Sync] Total: ${ldapUsers.length}, Disabled: ${disabled}, Reactivated: ${reactivated}`);

        return NextResponse.json({
            success: true,
            message: `Synced ${ldapUsers.length} users — Disabled: ${disabled}, Reactivated: ${reactivated}`,
            summary: { total: ldapUsers.length, disabled, reactivated }
        });

    } catch (error) {
        console.error('Cron AD Sync error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
