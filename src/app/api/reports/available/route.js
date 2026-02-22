import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
    try {
        // Get user's RoleId from JWT
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        let userRoleId = null;
        let isAdmin = false;

        if (token) {
            try {
                const payload = await verifyToken(token);
                userRoleId = payload.roleId;
                isAdmin = payload.roleName?.toLowerCase() === 'admin';
            } catch (e) {
                return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
            }
        } else {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // Auto-add IsHeavy column if missing
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'IsHeavy')
                ALTER TABLE Reports ADD IsHeavy BIT DEFAULT 0;
            `);
        } catch (e) { console.warn('Favorites fetch failed:', e.message); }

        let result;

        if (isAdmin) {
            // Admin sees all active reports
            result = await pool.request().query(`
                SELECT r.ReportId, r.ReportName, r.Description, r.ReportType, r.EmailTemplateContent, ISNULL(r.IsHeavy, 0) AS IsHeavy
                FROM Reports r
                WHERE r.IsActive = 1
                ORDER BY r.ReportType, r.ReportName
            `);
        } else {
            // Regular user: only reports assigned to their role
            result = await pool.request()
                .input('UserRoleId', sql.Int, userRoleId)
                .query(`
                    SELECT DISTINCT r.ReportId, r.ReportName, r.Description, r.ReportType, r.EmailTemplateContent, ISNULL(r.IsHeavy, 0) AS IsHeavy
                    FROM Reports r
                    INNER JOIN ReportRoleMapping m ON r.ReportId = m.ReportId
                    WHERE r.IsActive = 1 
                      AND m.RoleId = @UserRoleId
                    ORDER BY r.ReportType, r.ReportName
                `);
        }

        return NextResponse.json({ success: true, reports: result.recordset });

    } catch (error) {
        console.error("Error fetching reports:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
