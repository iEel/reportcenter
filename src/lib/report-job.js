import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { bindReportParameters } from '@/lib/report-run';
import { streamQueryToXlsx } from '@/lib/report-export-stream';
import { excelFileName, safeFileBase } from '@/lib/excel-export';

/**
 * Background export for IsHeavy reports: the file is kept 24 hours so users need not wait and can
 * download it later from job history. Rows stream into an .xlsx with bounded memory.
 */
export const JOBS_DIR = path.join(process.cwd(), 'tmp', 'jobs');
const BG_JOB_TIMEOUT = parseInt(process.env.BACKGROUND_JOB_TIMEOUT) || 900000; // 15 min default
const JOBS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PROGRESS_EVERY = 10000;

/** Delete job files older than 24 hours and mark their jobs expired. */
export async function cleanupOldJobFiles(dir = JOBS_DIR) {
    try {
        if (!fs.existsSync(dir)) return;

        const now = Date.now();
        let deleted = 0;
        for (const file of fs.readdirSync(dir)) {
            const filePath = path.join(dir, file);
            try {
                if (now - fs.statSync(filePath).mtimeMs > JOBS_MAX_AGE_MS) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            } catch { /* removed meanwhile */ }
        }

        if (deleted > 0) {
            try {
                const pool = await connectToCentralDB();
                await pool.request().query(`
                    UPDATE ReportJobs
                    SET FilePath = NULL, ErrorMessage = N'ไฟล์หมดอายุ (24 ชม.)'
                    WHERE Status = 'done' AND FilePath IS NOT NULL AND CreatedAt < DATEADD(HOUR, -24, GETDATE())
                `);
            } catch { /* the next cleanup retries */ }
            console.log(`[Cleanup] Deleted ${deleted} expired job file(s)`);
        }
    } catch (e) {
        console.warn('[Cleanup] Error:', e.message);
    }
}

/** Run a queued job to completion; never throws (failures are recorded on the job and notified). */
export async function runReportJob({ jobId, userId, companyId, reportName, tSqlQuery, expectedParams, parameters, jobsDir = JOBS_DIR }) {
    const fileName = excelFileName(`${safeFileBase(reportName)}_${new Date().toISOString().split('T')[0]}_job${jobId}`);
    const filePath = path.join(jobsDir, fileName);
    const cancelled = new AbortController();
    try {
        await cleanupOldJobFiles(jobsDir);
        await fs.promises.mkdir(jobsDir, { recursive: true });

        const companyPool = await connectToCompanyDB(parseInt(companyId));
        const sqlRequest = companyPool.request();
        sqlRequest.timeout = BG_JOB_TIMEOUT;
        bindReportParameters(sqlRequest, expectedParams, parameters);

        const rowCount = await streamQueryToXlsx({
            sqlRequest,
            query: tSqlQuery,
            filePath,
            signal: cancelled.signal,
            progressEvery: PROGRESS_EVERY,
            onProgress: rows => recordProgress(jobId, rows, cancelled),
        });

        const pool = await connectToCentralDB();
        await pool.request()
            .input('JobId', sql.Int, jobId)
            .input('FilePath', sql.NVarChar(500), filePath)
            .input('FileName', sql.NVarChar(200), fileName)
            .input('RowCount', sql.Int, rowCount)
            .query('UPDATE ReportJobs SET Status = \'done\', FilePath = @FilePath, FileName = @FileName, [RowCount] = @RowCount, CompletedAt = GETDATE() WHERE JobId = @JobId');
        try {
            await notify(pool, userId, `✅ รายงานเสร็จแล้ว: ${reportName}`, `สร้างเสร็จแล้ว ${rowCount.toLocaleString()} แถว — กดเพื่อดาวน์โหลด`, 'success');
        } catch { /* the job is done even if the bell cannot be updated */ }
        console.log(`[Job ${jobId}] Completed: ${rowCount} rows → ${fileName} (streamed)`);
    } catch (error) {
        await fs.promises.rm(filePath, { force: true }).catch(() => {});
        if (cancelled.signal.aborted) {
            // The user cancelled from job history; the job row already says so
            console.log(`[Job ${jobId}] Cancelled`);
            return;
        }
        console.error(`[Job ${jobId}] Failed:`, error.message);
        try {
            const pool = await connectToCentralDB();
            await pool.request()
                .input('JobId', sql.Int, jobId)
                .input('ErrorMessage', sql.NVarChar(500), error.message?.substring(0, 500))
                .query('UPDATE ReportJobs SET Status = \'failed\', ErrorMessage = @ErrorMessage WHERE JobId = @JobId');
            await notify(pool, userId, `❌ รายงานล้มเหลว: ${reportName}`, `${error.message?.substring(0, 300)}`, 'error');
        } catch (e) { console.warn('Activity log failed:', e.message); }
    }
}

/** Save the row count for the live progress display, and stop the export if the user cancelled the job. */
async function recordProgress(jobId, rowCount, cancelled) {
    const pool = await connectToCentralDB();
    pool.request()
        .input('JobId', sql.Int, jobId)
        .input('RowCount', sql.Int, rowCount)
        .query('UPDATE ReportJobs SET [RowCount] = @RowCount WHERE JobId = @JobId')
        .catch(() => { /* progress is best effort */ });
    const check = await pool.request()
        .input('JobId', sql.Int, jobId)
        .query('SELECT Status FROM ReportJobs WHERE JobId = @JobId');
    if (check.recordset[0]?.Status === 'cancelled') cancelled.abort();
}

function notify(pool, userId, title, message, type) {
    return pool.request()
        .input('UserId', sql.Int, userId)
        .input('Title', sql.NVarChar(200), title)
        .input('Message', sql.NVarChar(500), message)
        .input('Type', sql.NVarChar(20), type)
        .input('LinkUrl', sql.NVarChar(500), '/reports/job-history')
        .query('INSERT INTO Notifications (UserId, Title, Message, Type, LinkUrl) VALUES (@UserId, @Title, @Message, @Type, @LinkUrl)');
}
