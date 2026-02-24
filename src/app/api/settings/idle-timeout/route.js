import { NextResponse } from 'next/server';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET /api/settings/idle-timeout
 * Public endpoint (any logged-in user) — returns idle timeout in minutes.
 * Reads from SystemSettings table. Returns 0 if disabled/not set.
 */
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // Try to read the setting
        const result = await pool.request()
            .query("SELECT SettingValue FROM SystemSettings WHERE SettingKey = 'session_idle_timeout_minutes'");

        const minutes = result.recordset.length > 0
            ? parseInt(result.recordset[0].SettingValue) || 0
            : 0;

        return NextResponse.json({ success: true, minutes });

    } catch (error) {
        console.error('Idle timeout GET error:', error);
        return NextResponse.json({ success: true, minutes: 0 }); // Fail-safe: disabled
    }
}
