import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import fs from 'fs';

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
            .query('SELECT FilePath, FileName, Status FROM ReportJobs WHERE JobId = @JobId AND UserId = @UserId');

        if (result.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 });
        }

        const job = result.recordset[0];

        if (job.Status !== 'done' || !job.FilePath) {
            return NextResponse.json({ success: false, message: 'File not ready' }, { status: 400 });
        }

        if (!fs.existsSync(job.FilePath)) {
            return NextResponse.json({ success: false, message: 'File expired or deleted' }, { status: 410 });
        }

        const fileBuffer = fs.readFileSync(job.FilePath);

        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(job.FileName)}"`,
                'Content-Length': fileBuffer.length.toString(),
            }
        });

    } catch (error) {
        console.error('Job download error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
