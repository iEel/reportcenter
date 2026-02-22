import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// DELETE: Bulk delete reports
export async function DELETE(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { reportIds } = await request.json();

        if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
            return NextResponse.json({ success: false, message: 'No report IDs provided' }, { status: 400 });
        }

        const pool = await connectToCentralDB();
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            for (const id of reportIds) {
                const req = transaction.request();
                req.input('ReportId', sql.Int, parseInt(id));

                // Delete params first (FK)
                await req.query('DELETE FROM ReportParameters WHERE ReportId = @ReportId');

                // Delete role mappings
                const req2 = transaction.request();
                req2.input('ReportId', sql.Int, parseInt(id));
                await req2.query('DELETE FROM ReportRoleMapping WHERE ReportId = @ReportId');

                // Delete report
                const req3 = transaction.request();
                req3.input('ReportId', sql.Int, parseInt(id));
                await req3.query('DELETE FROM Reports WHERE ReportId = @ReportId');
            }

            await transaction.commit();

            return NextResponse.json({ success: true, deleted: reportIds.length });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Bulk delete error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
