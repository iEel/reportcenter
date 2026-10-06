import { NextResponse } from 'next/server';
import { connectToCentralDB, getCompanyList } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildAuditFilter } from '@/lib/audit-log-filter';
import { auditExportQuery } from '@/lib/audit-log-export';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';
import { excelFileName } from '@/lib/excel-export';

const EXPORT_TIMEOUT = parseInt(process.env.REPORT_REQUEST_TIMEOUT) || 120000;

/**
 * Export every audit log row matching the page's filters (not just the page shown) as .xlsx.
 * Rows stream from SQL into a temporary file like report exports, and the browser fetches it
 * once from GET /api/reports/export/[id].
 */
export async function POST(request) {
    let exportId = null;
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const filters = await request.json().catch(() => ({}));
        const filter = buildAuditFilter(filters);
        const pool = await connectToCentralDB();
        const { query, bind } = auditExportQuery(filter.where, await getCompanyList());

        await sweepExportFiles();
        const file = await createExportFile();
        exportId = file.id;

        const sqlRequest = bind(filter.bind(pool.request()));
        sqlRequest.timeout = EXPORT_TIMEOUT;
        const rowCount = await streamQueryToXlsx({ sqlRequest, query, filePath: file.dataPath, signal: request.signal, sheetName: 'Audit Logs' });

        if (rowCount === 0) {
            await deleteExportFile(file.id);
            return NextResponse.json({ success: true, rowCount: 0 });
        }

        const fileName = excelFileName(`audit_logs_${new Date().toISOString().split('T')[0]}`);
        await writeExportMeta(file.id, { userId: session.userId, fileName, createdAt: new Date().toISOString() });
        return NextResponse.json({ success: true, downloadId: file.id, fileName, rowCount });
    } catch (error) {
        if (exportId) await deleteExportFile(exportId).catch(() => {});
        if (!request.signal?.aborted) console.error('Audit log export error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถส่งออกข้อมูลได้' }, { status: 500 });
    }
}
