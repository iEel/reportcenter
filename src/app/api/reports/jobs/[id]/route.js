import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request, props) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;

        const pool = await connectToCentralDB();
        const result = await pool.request()
            .input('JobId', sql.Int, parseInt(id))
            .input('UserId', sql.Int, session.userId)
            .query('SELECT JobId, Status, FileName, [RowCount], ErrorMessage, CreatedAt FROM ReportJobs WHERE JobId = @JobId AND UserId = @UserId');

        if (result.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 });
        }

        const job = result.recordset[0];

        return NextResponse.json({
            success: true,
            job: {
                jobId: job.JobId,
                status: job.Status,
                fileName: job.FileName,
                rowCount: job.RowCount,
                error: job.ErrorMessage,
                createdAt: job.CreatedAt,
            }
        });

    } catch (error) {
        console.error('Job status error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}

// Cancel a running job
export async function PATCH(request, props) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;

        const pool = await connectToCentralDB();

        // Only cancel jobs that belong to the user and are still running
        const result = await pool.request()
            .input('JobId', sql.Int, parseInt(id))
            .input('UserId', sql.Int, session.userId)
            .query(`
                UPDATE ReportJobs 
                SET Status = 'cancelled', ErrorMessage = N'ถูกยกเลิกโดยผู้ใช้'
                WHERE JobId = @JobId AND UserId = @UserId AND Status = 'running'
            `);

        if (result.rowsAffected[0] === 0) {
            return NextResponse.json({ success: false, message: 'ไม่พบ Job ที่กำลังทำงาน' }, { status: 404 });
        }

        console.log(`[Job ${id}] Cancelled by user ${session.userId}`);

        return NextResponse.json({ success: true, message: 'ยกเลิก Job สำเร็จ' });

    } catch (error) {
        console.error('Job cancel error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
