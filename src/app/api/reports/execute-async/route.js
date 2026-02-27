import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateQuery } from '@/lib/sql-validator';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = path.join(process.cwd(), 'tmp', 'jobs');
const BG_JOB_TIMEOUT = parseInt(process.env.BACKGROUND_JOB_TIMEOUT) || 900000; // 15 min default

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

        // Background execution (non-blocking)
        setImmediate(async () => {
            try {
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

                // Execute query (no timeout limit for heavy jobs)
                req.timeout = BG_JOB_TIMEOUT;
                const dataResult = await req.query(tSqlQuery);
                const data = dataResult.recordset;

                // Prepare output directory
                if (!fs.existsSync(JOBS_DIR)) {
                    fs.mkdirSync(JOBS_DIR, { recursive: true });
                }

                const dateStr = new Date().toISOString().split('T')[0];

                // CSV Stream Export — memory-efficient for large datasets
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

                if (data.length > 0) {
                    // Write header row
                    const columns = Object.keys(data[0]);
                    writeStream.write(columns.map(escapeCSV).join(',') + '\n');

                    // Write data rows — streamed one at a time (constant memory)
                    for (let i = 0; i < data.length; i++) {
                        const row = columns.map(col => {
                            const val = data[i][col];
                            // Format dates as readable strings
                            if (val instanceof Date) {
                                return escapeCSV(val.toISOString().replace('T', ' ').substring(0, 19));
                            }
                            return escapeCSV(val);
                        });
                        writeStream.write(row.join(',') + '\n');
                    }
                }

                // Wait for write to finish
                await new Promise((resolve, reject) => {
                    writeStream.end(() => resolve());
                    writeStream.on('error', reject);
                });

                // Update job: done
                const pool2 = await connectToCentralDB();
                await pool2.request()
                    .input('JobId', sql.Int, jobId)
                    .input('FilePath', sql.NVarChar(500), filePath)
                    .input('FileName', sql.NVarChar(200), fileName)
                    .input('RowCount', sql.Int, data.length)
                    .query('UPDATE ReportJobs SET Status = \'done\', FilePath = @FilePath, FileName = @FileName, [RowCount] = @RowCount WHERE JobId = @JobId');

                console.log(`[Job ${jobId}] Completed: ${data.length} rows → ${fileName} (CSV stream)`);

            } catch (error) {
                console.error(`[Job ${jobId}] Failed:`, error.message);
                try {
                    const pool2 = await connectToCentralDB();
                    await pool2.request()
                        .input('JobId', sql.Int, jobId)
                        .input('ErrorMessage', sql.NVarChar(500), error.message?.substring(0, 500))
                        .query('UPDATE ReportJobs SET Status = \'failed\', ErrorMessage = @ErrorMessage WHERE JobId = @JobId');
                } catch (e) { console.warn('Activity log failed:', e.message); }
            }
        });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Execute-async error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
