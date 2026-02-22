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

        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json({ success: false, message: "ReportId is required" }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Authorization — check user's role has access
        const isAdmin = session.roleName?.toLowerCase() === 'admin';
        if (!isAdmin) {
            const accessCheck = await pool.request()
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('RoleId', sql.Int, session.roleId)
                .query('SELECT 1 FROM ReportRoleMapping WHERE ReportId = @ReportId AND RoleId = @RoleId');

            if (accessCheck.recordset.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' },
                    { status: 403 }
                );
            }
        }

        // Auto-add LookupQuery column if missing
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReportParameters' AND COLUMN_NAME = 'LookupQuery')
                ALTER TABLE ReportParameters ADD LookupQuery NVARCHAR(MAX) NULL;
            `);
        } catch (e) { console.warn('LookupQuery column check failed:', e.message); }

        const query = `
            SELECT ParameterId, ParameterName, DisplayLabel, InputType, DropdownQuery, LookupQuery, OrderIndex 
            FROM ReportParameters
            WHERE ReportId = @ReportId
            ORDER BY OrderIndex;
        `;

        const result = await pool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query(query);

        return NextResponse.json({ success: true, parameters: result.recordset });

    } catch (error) {
        console.error("Error fetching report parameters:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
