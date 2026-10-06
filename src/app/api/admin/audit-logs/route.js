import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, getCompanyList } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildAuditFilter } from '@/lib/audit-log-filter';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const filter = buildAuditFilter({
            q: searchParams.get('q'),
            actionType: searchParams.get('actionType'),
            userId: searchParams.get('userId'),
            reportId: searchParams.get('reportId'),
            companyId: searchParams.get('companyId'),
            dateFrom: searchParams.get('dateFrom'),
            dateTo: searchParams.get('dateTo'),
        });

        const pool = await connectToCentralDB();

        // Auto-add ChangeData column if missing
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ActivityLogs' AND COLUMN_NAME = 'ChangeData')
                ALTER TABLE ActivityLogs ADD ChangeData NVARCHAR(MAX) NULL;
            `);
        } catch (e) { /* ignore */ }

        // The keyword filter searches user names too, so both queries join Users
        const countResult = await filter.bind(pool.request()).query(`
            SELECT COUNT(*) AS total
            FROM ActivityLogs a
            LEFT JOIN Users u ON a.UserId = u.UserId
            ${filter.where}
        `);
        const totalRows = countResult.recordset[0].total;

        const offset = (page - 1) * pageSize;
        const result = await filter.bind(pool.request())
            .input('Offset', sql.Int, offset)
            .input('PageSize', sql.Int, pageSize)
            .query(`
            SELECT a.LogId, a.UserId, a.ReportId, a.CompanyId, a.ActionType, a.Details, a.ChangeData, a.CreatedAt,
                   u.FullName AS UserName
            FROM ActivityLogs a
            LEFT JOIN Users u ON a.UserId = u.UserId
            ${filter.where}
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

        // Reports and companies for the report/company filters
        const reportsResult = await pool.request().query(`
            SELECT ReportId, ReportName FROM Reports ORDER BY ReportName
        `);
        const companies = (await getCompanyList()).map(({ companyId, label, name }) => ({ companyId, label, name }));

        return NextResponse.json({
            success: true,
            logs: result.recordset,
            totalRows,
            page,
            pageSize,
            actionTypes: typesResult.recordset.map(r => r.ActionType),
            users: usersResult.recordset,
            reports: reportsResult.recordset,
            companies,
        });

    } catch (error) {
        console.error('Audit logs error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/audit-logs
 * Bulk delete logs older than a specified date
 * Query: ?before=YYYY-MM-DD
 */
export async function DELETE(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const before = searchParams.get('before');

        if (!before) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุวันที่ (before)' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Count first
        const countResult = await pool.request()
            .input('Before', sql.DateTime, new Date(before + 'T23:59:59'))
            .query('SELECT COUNT(*) AS cnt FROM ActivityLogs WHERE CreatedAt <= @Before');

        const count = countResult.recordset[0].cnt;

        if (count === 0) {
            return NextResponse.json({ success: true, deleted: 0, message: 'ไม่พบ log ในช่วงเวลาที่เลือก' });
        }

        // Delete
        await pool.request()
            .input('Before', sql.DateTime, new Date(before + 'T23:59:59'))
            .query('DELETE FROM ActivityLogs WHERE CreatedAt <= @Before');

        return NextResponse.json({ success: true, deleted: count, message: `ลบ log ${count} รายการสำเร็จ` });

    } catch (error) {
        console.error('Delete audit logs error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
