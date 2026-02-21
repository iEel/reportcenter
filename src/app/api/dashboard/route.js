import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        let currentUser = null;

        if (token) {
            try {
                currentUser = await verifyToken(token);
            } catch (e) {
                // Token invalid — continue as guest
            }
        }

        const pool = await connectToCentralDB();
        const isAdmin = currentUser?.roleName?.toLowerCase() === 'admin';
        const userId = currentUser?.userId;

        // 1. Reports the user can access (admin sees all, user sees their role's)
        let totalReportsQuery;
        let standardCount = 0;
        let templateCount = 0;

        if (isAdmin) {
            const reportsResult = await pool.request().query(
                `SELECT COUNT(*) AS total FROM Reports WHERE IsActive = 1`
            );
            const byTypeResult = await pool.request().query(
                `SELECT ReportType, COUNT(*) AS total FROM Reports WHERE IsActive = 1 GROUP BY ReportType`
            );
            totalReportsQuery = reportsResult.recordset[0].total;
            standardCount = byTypeResult.recordset.find(r => r.ReportType === 1)?.total || 0;
            templateCount = byTypeResult.recordset.find(r => r.ReportType === 2)?.total || 0;
        } else if (currentUser?.roleId) {
            // User sees only reports assigned to their role
            const reportsResult = await pool.request()
                .input('RoleId', sql.Int, currentUser.roleId)
                .query(`
                    SELECT COUNT(DISTINCT r.ReportId) AS total
                    FROM Reports r
                    INNER JOIN ReportRoleMapping rrm ON r.ReportId = rrm.ReportId
                    WHERE r.IsActive = 1 AND rrm.RoleId = @RoleId
                `);
            const byTypeResult = await pool.request()
                .input('RoleId', sql.Int, currentUser.roleId)
                .query(`
                    SELECT r.ReportType, COUNT(DISTINCT r.ReportId) AS total
                    FROM Reports r
                    INNER JOIN ReportRoleMapping rrm ON r.ReportId = rrm.ReportId
                    WHERE r.IsActive = 1 AND rrm.RoleId = @RoleId
                    GROUP BY r.ReportType
                `);
            totalReportsQuery = reportsResult.recordset[0].total;
            standardCount = byTypeResult.recordset.find(r => r.ReportType === 1)?.total || 0;
            templateCount = byTypeResult.recordset.find(r => r.ReportType === 2)?.total || 0;
        } else {
            totalReportsQuery = 0;
        }

        // 2. Admin-only stats
        let totalUsers = null;
        let totalRoles = null;

        if (isAdmin) {
            const usersResult = await pool.request().query(
                `SELECT COUNT(*) AS total FROM Users WHERE IsActive = 1`
            );
            const rolesResult = await pool.request().query(
                `SELECT COUNT(*) AS total FROM Roles`
            );
            totalUsers = usersResult.recordset[0].total;
            totalRoles = rolesResult.recordset[0].total;
        }

        // 3. Activity Logs — admin sees all, user sees only their own
        let recentLogs = [];
        try {
            let logQuery;
            if (isAdmin) {
                logQuery = await pool.request().query(`
                    SELECT TOP 10 
                        al.LogId, al.ActionType, al.Details, al.CreatedAt, al.CompanyId,
                        u.FullName AS UserName,
                        r.ReportName
                    FROM ActivityLogs al
                    LEFT JOIN Users u ON al.UserId = u.UserId
                    LEFT JOIN Reports r ON al.ReportId = r.ReportId
                    ORDER BY al.CreatedAt DESC
                `);
            } else {
                logQuery = await pool.request()
                    .input('UserId', sql.Int, userId)
                    .query(`
                    SELECT TOP 10 
                        al.LogId, al.ActionType, al.Details, al.CreatedAt, al.CompanyId,
                        u.FullName AS UserName,
                        r.ReportName
                    FROM ActivityLogs al
                    LEFT JOIN Users u ON al.UserId = u.UserId
                    LEFT JOIN Reports r ON al.ReportId = r.ReportId
                    WHERE al.UserId = @UserId
                    ORDER BY al.CreatedAt DESC
                `);
            }
            recentLogs = logQuery.recordset;
        } catch (e) {
            console.warn('ActivityLogs table not found, skipping...');
        }

        return NextResponse.json({
            success: true,
            isAdmin,
            stats: {
                totalReports: totalReportsQuery,
                standardReports: standardCount,
                templateReports: templateCount,
                // Admin-only stats (null for non-admin)
                totalUsers,
                totalRoles,
            },
            recentLogs: recentLogs,
            scheduleStats: isAdmin ? await getScheduleStats(pool) : null,
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

async function getScheduleStats(pool) {
    try {
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN LastStatus = 'FAILED' AND IsActive = 1 THEN 1 ELSE 0 END) AS failed,
                MIN(CASE WHEN IsActive = 1 AND NextRunAt > GETDATE() THEN NextRunAt END) AS nextRun
            FROM ReportSchedules
        `);
        const row = result.recordset[0];
        return {
            total: row.total || 0,
            active: row.active || 0,
            failed: row.failed || 0,
            nextRun: row.nextRun || null,
        };
    } catch {
        return null;
    }
}
