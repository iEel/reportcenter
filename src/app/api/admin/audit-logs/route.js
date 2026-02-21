import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        const pool = await connectToCentralDB();

        // Get total count
        const countResult = await pool.request().query('SELECT COUNT(*) AS total FROM ActivityLogs');
        const total = countResult.recordset[0].total;

        // Get paginated logs with user and report info
        const logsResult = await pool.request()
            .input('Offset', sql.Int, offset)
            .input('Limit', sql.Int, limit)
            .query(`
                SELECT al.LogId, al.ActionType, al.Details, al.CreatedAt,
                       u.Username, u.FullName,
                       r.ReportName
                FROM ActivityLogs al
                LEFT JOIN Users u ON al.UserId = u.UserId
                LEFT JOIN Reports r ON al.ReportId = r.ReportId
                ORDER BY al.CreatedAt DESC
                OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
            `);

        return NextResponse.json({
            success: true,
            logs: logsResult.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Audit logs error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
