import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB, getCompanyLabel } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';
import { excelFileName, safeFileBase } from '@/lib/excel-export';

// Same limit as /api/reports/execute; reports that need longer should be marked IsHeavy
const REPORT_TIMEOUT = parseInt(process.env.REPORT_REQUEST_TIMEOUT) || 120000;

/**
 * Export an ordinary report as .xlsx without holding it in memory: rows stream from SQL into a
 * temporary file, and the browser fetches it once from GET /api/reports/export/[id].
 * IsHeavy reports use /api/reports/execute-async instead (.xlsx kept 24 hours for later download).
 */
export async function POST(request) {
    let exportId = null;
    try {
        const { reportId, companyId, parameters } = await request.json();
        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: 'ReportId and CompanyId are required' }, { status: 400 });
        }

        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const centralPool = await connectToCentralDB();
        const run = await prepareReportRun({ session, reportId, companyId, centralPool });
        if (!run.ok) {
            return NextResponse.json({ success: false, message: run.message }, { status: run.status });
        }

        await sweepExportFiles();
        const file = await createExportFile();
        exportId = file.id;

        const companyPool = await connectToCompanyDB(companyId);
        const sqlRequest = companyPool.request();
        sqlRequest.timeout = REPORT_TIMEOUT;
        bindReportParameters(sqlRequest, run.expectedParams, parameters);

        const rowCount = await streamQueryToXlsx({ sqlRequest, query: run.tSqlQuery, filePath: file.dataPath, signal: request.signal });
        await logExport({ centralPool, session, reportId, companyId, reportName: run.reportName, rowCount, parameters });

        if (rowCount === 0) {
            await deleteExportFile(file.id);
            return NextResponse.json({ success: true, rowCount: 0 });
        }

        const fileName = excelFileName(`${safeFileBase(run.reportName)}_${new Date().toISOString().split('T')[0]}`);
        await writeExportMeta(file.id, { userId: session.userId, fileName, createdAt: new Date().toISOString() });
        return NextResponse.json({ success: true, downloadId: file.id, fileName, rowCount });
    } catch (error) {
        if (exportId) await deleteExportFile(exportId).catch(() => {});
        if (request.signal?.aborted) console.log('[Export] Cancelled by the client; SQL request cancelled');
        else console.error('Error exporting report:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถส่งออกข้อมูลได้' }, { status: 500 });
    }
}

async function logExport({ centralPool, session, reportId, companyId, reportName, rowCount, parameters }) {
    try {
        const paramParts = Object.entries(parameters || {})
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${k}=${v}`);
        const paramSummary = paramParts.length > 0 ? ` | ${paramParts.join(', ')}` : '';
        const changeData = parameters && Object.keys(parameters).length > 0 ? JSON.stringify({ parameters }) : null;

        await centralPool.request()
            .input('UserId', sql.Int, session.userId)
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('CompanyId', sql.Int, parseInt(companyId))
            .input('ActionType', sql.NVarChar(50), 'EXPORT_EXCEL')
            .input('Details', sql.NVarChar(sql.MAX), `Export Excel "${reportName}" (${getCompanyLabel(companyId)}) ได้ ${rowCount.toLocaleString()} แถว${paramSummary}`)
            .input('ChangeData', sql.NVarChar(sql.MAX), changeData)
            .query('INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details, @ChangeData)');
    } catch (error) {
        console.warn('Activity log failed (table may not exist):', error.message);
    }
}
