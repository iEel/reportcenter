import { NextResponse } from 'next/server';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { attachmentHeader } from '@/lib/content-disposition';
import { EXCEL_MIME } from '@/lib/excel-export';

function contentTypeFor(fileName) {
    if (fileName?.endsWith('.csv')) return 'text/csv; charset=utf-8';
    if (fileName?.endsWith('.xlsx')) return EXCEL_MIME;
    return 'application/octet-stream';
}

/** The job file the signed-in user may download, or the status explaining why not. */
async function findJobFile(request, props) {
    const session = await getSession(request);
    if (!session) return { status: 401, message: 'Unauthorized' };

    const { id } = await props.params;
    const pool = await connectToCentralDB();
    const result = await pool.request()
        .input('JobId', sql.Int, parseInt(id))
        .input('UserId', sql.Int, session.userId)
        .query('SELECT FilePath, FileName, Status FROM ReportJobs WHERE JobId = @JobId AND UserId = @UserId');
    if (result.recordset.length === 0) return { status: 404, message: 'Job not found' };

    const job = result.recordset[0];
    if (job.Status !== 'done' || !job.FilePath) return { status: 400, message: 'File not ready' };
    try {
        const stat = await fs.promises.stat(job.FilePath);
        return { status: 200, job, stat };
    } catch {
        return { status: 410, message: 'File expired or deleted' };
    }
}

function fileHeaders(job, stat) {
    const fileName = job.FileName || path.basename(job.FilePath);
    return {
        'Content-Type': contentTypeFor(fileName),
        'Content-Length': String(stat.size),
        'Content-Disposition': attachmentHeader(fileName),
    };
}

export async function GET(request, props) {
    try {
        const found = await findJobFile(request, props);
        if (found.status !== 200) {
            return NextResponse.json({ success: false, message: found.message }, { status: found.status });
        }
        // Stream from disk: a heavy report's file can be hundreds of MB
        return new Response(Readable.toWeb(fs.createReadStream(found.job.FilePath)), { headers: fileHeaders(found.job, found.stat) });
    } catch (error) {
        console.error('Job download error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}

/** Lets the page check a file before handing the URL to the browser's download manager. */
export async function HEAD(request, props) {
    try {
        const found = await findJobFile(request, props);
        if (found.status !== 200) return new Response(null, { status: found.status });
        return new Response(null, { headers: fileHeaders(found.job, found.stat) });
    } catch (error) {
        console.error('Job download check error:', error);
        return new Response(null, { status: 500 });
    }
}
