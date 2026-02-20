import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';

export async function GET() {
    try {
        const pool = await connectToCentralDB();

        // 1. Total Reports (active)
        const reportsResult = await pool.request().query(
            `SELECT COUNT(*) AS total FROM Reports WHERE IsActive = 1`
        );

        // 2. Total Users (active)
        const usersResult = await pool.request().query(
            `SELECT COUNT(*) AS total FROM Users WHERE IsActive = 1`
        );

        // 3. Total Roles
        const rolesResult = await pool.request().query(
            `SELECT COUNT(*) AS total FROM Roles`
        );

        // 4. Reports by type
        const byTypeResult = await pool.request().query(
            `SELECT ReportType, COUNT(*) AS total FROM Reports WHERE IsActive = 1 GROUP BY ReportType`
        );

        // 5. Recent Activity Logs (last 10)
        let recentLogs = [];
        try {
            const logsResult = await pool.request().query(`
                SELECT TOP 10 
                    al.LogId, al.ActionType, al.Details, al.CreatedAt, al.CompanyId,
                    u.FullName AS UserName,
                    r.ReportName
                FROM ActivityLogs al
                LEFT JOIN Users u ON al.UserId = u.UserId
                LEFT JOIN Reports r ON al.ReportId = r.ReportId
                ORDER BY al.CreatedAt DESC
            `);
            recentLogs = logsResult.recordset;
        } catch (e) {
            // ActivityLogs table might not exist yet
            console.warn('ActivityLogs table not found, skipping...');
        }

        const standardCount = byTypeResult.recordset.find(r => r.ReportType === 1)?.total || 0;
        const templateCount = byTypeResult.recordset.find(r => r.ReportType === 2)?.total || 0;

        return NextResponse.json({
            success: true,
            stats: {
                totalReports: reportsResult.recordset[0].total,
                totalUsers: usersResult.recordset[0].total,
                totalRoles: rolesResult.recordset[0].total,
                standardReports: standardCount,
                templateReports: templateCount,
            },
            recentLogs: recentLogs,
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
