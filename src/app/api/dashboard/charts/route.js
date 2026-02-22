import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // 1. Report usage per day (last 14 days)
        const usageResult = await pool.request().query(`
            SELECT CONVERT(VARCHAR(10), CreatedAt, 120) AS [date], COUNT(*) AS count
            FROM ActivityLogs
            WHERE ActionType IN ('EXECUTE_REPORT', 'EXPORT_EXCEL')
              AND CreatedAt >= DATEADD(DAY, -14, GETDATE())
            GROUP BY CONVERT(VARCHAR(10), CreatedAt, 120)
            ORDER BY [date]
        `);

        // 2. Top 5 reports (last 30 days)
        const topReportsResult = await pool.request().query(`
            SELECT TOP 5 r.ReportName, COUNT(*) AS count
            FROM ActivityLogs a
            LEFT JOIN Reports r ON a.ReportId = r.ReportId
            WHERE a.ActionType IN ('EXECUTE_REPORT', 'EXPORT_EXCEL')
              AND a.CreatedAt >= DATEADD(DAY, -30, GETDATE())
              AND r.ReportName IS NOT NULL
            GROUP BY r.ReportName
            ORDER BY count DESC
        `);

        // 3. Action type breakdown (last 30 days)
        const actionBreakdown = await pool.request().query(`
            SELECT ActionType, COUNT(*) AS count
            FROM ActivityLogs
            WHERE CreatedAt >= DATEADD(DAY, -30, GETDATE())
            GROUP BY ActionType
            ORDER BY count DESC
        `);

        // 4. Active users today
        const activeToday = await pool.request().query(`
            SELECT COUNT(DISTINCT UserId) AS count
            FROM ActivityLogs
            WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
        `);

        return NextResponse.json({
            success: true,
            usagePerDay: usageResult.recordset,
            topReports: topReportsResult.recordset,
            actionBreakdown: actionBreakdown.recordset,
            activeUsersToday: activeToday.recordset[0]?.count || 0,
        });

    } catch (error) {
        console.error('Dashboard charts error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
