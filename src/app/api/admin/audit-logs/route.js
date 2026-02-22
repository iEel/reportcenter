import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const actionType = searchParams.get('actionType') || '';
        const userId = searchParams.get('userId') || '';
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';

        const pool = await connectToCentralDB();

        // Build WHERE clause
        let where = 'WHERE 1=1';
        const req = pool.request();

        if (actionType) {
            where += ' AND a.ActionType = @ActionType';
            req.input('ActionType', sql.NVarChar(50), actionType);
        }
        if (userId) {
            where += ' AND a.UserId = @FilterUserId';
            req.input('FilterUserId', sql.Int, parseInt(userId));
        }
        if (dateFrom) {
            where += ' AND a.CreatedAt >= @DateFrom';
            req.input('DateFrom', sql.Date, dateFrom);
        }
        if (dateTo) {
            where += ' AND a.CreatedAt < DATEADD(DAY, 1, @DateTo)';
            req.input('DateTo', sql.Date, dateTo);
        }

        // Count total
        const countResult = await req.query(`
            SELECT COUNT(*) AS total
            FROM ActivityLogs a
            ${where}
        `);
        const totalRows = countResult.recordset[0].total;

        // Fetch paginated
        const req2 = pool.request();
        if (actionType) req2.input('ActionType', sql.NVarChar(50), actionType);
        if (userId) req2.input('FilterUserId', sql.Int, parseInt(userId));
        if (dateFrom) req2.input('DateFrom', sql.Date, dateFrom);
        if (dateTo) req2.input('DateTo', sql.Date, dateTo);

        const offset = (page - 1) * pageSize;
        req2.input('Offset', sql.Int, offset);
        req2.input('PageSize', sql.Int, pageSize);

        const result = await req2.query(`
            SELECT a.LogId, a.UserId, a.ReportId, a.CompanyId, a.ActionType, a.Details, a.CreatedAt,
                   u.FullName AS UserName
            FROM ActivityLogs a
            LEFT JOIN Users u ON a.UserId = u.UserId
            ${where}
            ORDER BY a.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
        `);

        // Get distinct action types for filter
        const typesResult = await pool.request().query(`
            SELECT DISTINCT ActionType FROM ActivityLogs ORDER BY ActionType
        `);

        // Get users list for filter
        const usersResult = await pool.request().query(`
            SELECT UserId, FullName FROM Users ORDER BY FullName
        `);

        return NextResponse.json({
            success: true,
            logs: result.recordset,
            totalRows,
            page,
            pageSize,
            actionTypes: typesResult.recordset.map(r => r.ActionType),
            users: usersResult.recordset,
        });

    } catch (error) {
        console.error('Audit logs error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
