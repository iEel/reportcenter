import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateQuery } from '@/lib/sql-validator';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = path.join(process.cwd(), 'tmp', 'jobs');
const BG_JOB_TIMEOUT = parseInt(process.env.BACKGROUND_JOB_TIMEOUT) || 900000; // 15 min default
const JOBS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Auto-cleanup: delete job files older than 24 hours
async function cleanupOldJobFiles() {
    try {
        if (!fs.existsSync(JOBS_DIR)) return;

        const now = Date.now();
        const files = fs.readdirSync(JOBS_DIR);
        let deleted = 0;

        for (const file of files) {
            const filePath = path.join(JOBS_DIR, file);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > JOBS_MAX_AGE_MS) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            } catch { }
        }

        // Also clean old DB records (mark files as expired)
        if (deleted > 0) {
            try {
                const pool = await connectToCentralDB();
                await pool.request().query(`
                    UPDATE ReportJobs 
                    SET FilePath = NULL, ErrorMessage = N'ไฟล์หมดอายุ (24 ชม.)'
                    WHERE Status = 'done' AND FilePath IS NOT NULL AND CreatedAt < DATEADD(HOUR, -24, GETDATE())
                `);
            } catch { }
            console.log(`[Cleanup] Deleted ${deleted} expired job file(s)`);
        }
    } catch (e) {
        console.warn('[Cleanup] Error:', e.message);
    }
}

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { reportId, companyId, parameters } = await request.json();

        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: 'reportId and companyId required' }, { status: 400 });
        }

        const centralPool = await connectToCentralDB();

        // Auto-create ReportJobs table
        await centralPool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ReportJobs')
            CREATE TABLE ReportJobs (
                JobId INT IDENTITY PRIMARY KEY,
                UserId INT NOT NULL,
                ReportId INT NOT NULL,
                CompanyId INT NOT NULL,
                Status NVARCHAR(20) DEFAULT 'running',
                FilePath NVARCHAR(500) NULL,
                FileName NVARCHAR(200) NULL,
                ErrorMessage NVARCHAR(500) NULL,
                [RowCount] INT NULL,
                CreatedAt DATETIME DEFAULT GETDATE()
            );
        `);

        // Get report info
        const reportResult = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query('SELECT TSqlQuery, ReportName FROM Reports WHERE ReportId = @ReportId');

        if (reportResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'Report not found' }, { status: 404 });
        }

        // Authorization — check user's role has access to this report
        const isAdmin = session.roleName?.toLowerCase() === 'admin';
        if (!isAdmin) {
            const accessCheck = await centralPool.request()
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

        const { TSqlQuery: tSqlQuery, ReportName: reportName } = reportResult.recordset[0];

        // SQL Security Validation
        const validation = validateQuery(tSqlQuery);
        if (!validation.safe) {
            try {
                await centralPool.request()
                    .input('UserId', sql.Int, session.userId)
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .input('ActionType', sql.NVarChar(50), 'BLOCKED_QUERY')
                    .input('Details', sql.NVarChar(500), `ถูกบล็อก (async): "${reportName}" — ${validation.reason}`)
                    .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)`);
            } catch (e) { /* ignore */ }
            return NextResponse.json({
                success: false,
                message: `คำสั่ง SQL ถูกบล็อก: ${validation.reason}`
            }, { status: 403 });
        }

        // Get expected params
        const paramResult = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');

        const expectedParams = paramResult.recordset;

        // Create job record
        const jobResult = await centralPool.request()
            .input('UserId', sql.Int, session.userId)
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('CompanyId', sql.Int, parseInt(companyId))
            .query('INSERT INTO ReportJobs (UserId, ReportId, CompanyId) OUTPUT INSERTED.JobId VALUES (@UserId, @ReportId, @CompanyId)');

        const jobId = jobResult.recordset[0].JobId;

        // Return immediately — run query in background
        const responseData = { success: true, jobId };

        // Background execution (non-blocking) — uses STREAMING to avoid OOM on large datasets
        setImmediate(async () => {
            try {
                // Cleanup expired files before creating new ones
                await cleanupOldJobFiles();

                const companyPool = await connectToCompanyDB(parseInt(companyId));
                const req = companyPool.request();

                // Bind parameters
                if (parameters && expectedParams.length > 0) {
                    for (const ep of expectedParams) {
                        const paramName = ep.ParameterName.replace('@', '');
                        const value = parameters[ep.ParameterName];
                        if (value !== undefined && value !== '') {
                            switch (ep.InputType) {
                                case 'date':
                                    req.input(paramName, sql.Date, value);
                                    break;
                                case 'number':
                                    req.input(paramName, sql.Decimal, parseFloat(value));
                                    break;
                                default:
                                    req.input(paramName, sql.NVarChar(sql.MAX), value);
                            }
                        } else {
                            req.input(paramName, sql.NVarChar(sql.MAX), null);
                        }
                    }
                }

                // Prepare output directory & file
                if (!fs.existsSync(JOBS_DIR)) {
                    fs.mkdirSync(JOBS_DIR, { recursive: true });
                }
                const dateStr = new Date().toISOString().split('T')[0];
                const fileName = `${reportName}_${dateStr}_job${jobId}.csv`;
                const filePath = path.join(JOBS_DIR, fileName);

                // Helper: escape CSV values (RFC 4180 — handles commas, quotes, newlines, Thai text)
                const escapeCSV = (val) => {
                    if (val === null || val === undefined) return '';
                    const str = String(val);
                    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                };

                const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
                // UTF-8 BOM — ensures Thai characters display correctly in Excel
                writeStream.write('\uFEFF');

                // === STREAMING MODE ===
                // Process rows one-at-a-time — constant memory usage (~50MB) regardless of result size
                req.stream = true;
                req.timeout = BG_JOB_TIMEOUT;

                let columns = null;
                let rowCount = 0;
                let isCancelled = false;

                await new Promise((resolve, reject) => {
                    // Column metadata arrives first
                    req.on('recordset', (cols) => {
                        columns = Object.keys(cols);
                        writeStream.write(columns.map(escapeCSV).join(',') + '\n');
                    });

                    // Each row arrives individually — write to CSV immediately
                    req.on('row', (row) => {
                        if (isCancelled) return;
                        rowCount++;

                        const line = columns.map(col => {
                            const val = row[col];
                            if (val instanceof Date) {
                                return escapeCSV(val.toISOString().replace('T', ' ').substring(0, 19));
                            }
                            return escapeCSV(val);
                        }).join(',') + '\n';

                        const canContinue = writeStream.write(line);

                        // Back-pressure: pause SQL stream if file writer is overwhelmed
                        if (!canContinue) {
                            req.pause();
                            writeStream.once('drain', () => req.resume());
                        }

                        // Check for cancellation every 10,000 rows
                        if (rowCount % 10000 === 0) {
                            req.pause();
                            connectToCentralDB().then(checkPool => {
                                checkPool.request()
                                    .input('JobId', sql.Int, jobId)
                                    .query('SELECT Status FROM ReportJobs WHERE JobId = @JobId')
                                    .then(check => {
                                        if (check.recordset[0]?.Status === 'cancelled') {
                                            isCancelled = true;
                                            writeStream.destroy();
                                            try { fs.unlinkSync(filePath); } catch { }
                                            console.log(`[Job ${jobId}] Cancelled at row ${rowCount}`);
                                            resolve();
                                        } else {
                                            req.resume();
                                        }
                                    })
                                    .catch(() => req.resume());
                            }).catch(() => req.resume());
                        }
                    });

                    req.on('error', (err) => {
                        writeStream.destroy();
                        try { fs.unlinkSync(filePath); } catch { }
                        reject(err);
                    });

                    req.on('done', () => {
                        if (isCancelled) return;
                        writeStream.end(() => resolve());
                    });

                    // Start the streaming query
                    req.query(tSqlQuery);
                });

                if (isCancelled) return;

                // Update job: done
                const pool2 = await connectToCentralDB();
                await pool2.request()
                    .input('JobId', sql.Int, jobId)
                    .input('FilePath', sql.NVarChar(500), filePath)
                    .input('FileName', sql.NVarChar(200), fileName)
                    .input('RowCount', sql.Int, rowCount)
                    .query('UPDATE ReportJobs SET Status = \'done\', FilePath = @FilePath, FileName = @FileName, [RowCount] = @RowCount, CompletedAt = GETDATE() WHERE JobId = @JobId');

                // Notify user via bell 🔔
                try {
                    await pool2.request()
                        .input('UserId', sql.Int, session.userId)
                        .input('Title', sql.NVarChar(200), `✅ รายงานเสร็จแล้ว: ${reportName}`)
                        .input('Message', sql.NVarChar(500), `สร้างเสร็จแล้ว ${rowCount.toLocaleString()} แถว — กดเพื่อดาวน์โหลด`)
                        .input('Type', sql.NVarChar(20), 'success')
                        .input('LinkUrl', sql.NVarChar(500), '/reports/job-history')
                        .query(`INSERT INTO Notifications (UserId, Title, Message, Type, LinkUrl) VALUES (@UserId, @Title, @Message, @Type, @LinkUrl)`);
                } catch (e) { /* ignore */ }

                console.log(`[Job ${jobId}] Completed: ${rowCount} rows → ${fileName} (streamed)`);

            } catch (error) {
                console.error(`[Job ${jobId}] Failed:`, error.message);
                try {
                    const pool2 = await connectToCentralDB();
                    await pool2.request()
                        .input('JobId', sql.Int, jobId)
                        .input('ErrorMessage', sql.NVarChar(500), error.message?.substring(0, 500))
                        .query('UPDATE ReportJobs SET Status = \'failed\', ErrorMessage = @ErrorMessage WHERE JobId = @JobId');

                    // Notify user via bell 🔔
                    await pool2.request()
                        .input('UserId', sql.Int, session.userId)
                        .input('Title', sql.NVarChar(200), `❌ รายงานล้มเหลว: ${reportName}`)
                        .input('Message', sql.NVarChar(500), `${error.message?.substring(0, 300)}`)
                        .input('Type', sql.NVarChar(20), 'error')
                        .input('LinkUrl', sql.NVarChar(500), '/reports/job-history')
                        .query(`INSERT INTO Notifications (UserId, Title, Message, Type, LinkUrl) VALUES (@UserId, @Title, @Message, @Type, @LinkUrl)`);
                } catch (e) { console.warn('Activity log failed:', e.message); }
            }
        });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Execute-async error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
