import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = path.join(process.cwd(), 'tmp', 'jobs');

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
                RowCount INT NULL,
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

        const { TSqlQuery: tSqlQuery, ReportName: reportName } = reportResult.recordset[0];

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
                req.timeout = 900000; // 15 minutes
                const dataResult = await req.query(tSqlQuery);
                const data = dataResult.recordset;

                // Generate xlsb file
                if (!fs.existsSync(JOBS_DIR)) {
                    fs.mkdirSync(JOBS_DIR, { recursive: true });
                }

                const dateStr = new Date().toISOString().split('T')[0];
                const fileName = `${reportName}_${dateStr}_job${jobId}.xlsb`;
                const filePath = path.join(JOBS_DIR, fileName);

                const ws = xlsx.utils.json_to_sheet(data);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Report');
                xlsx.writeFile(wb, filePath, { bookType: 'xlsb' });

                // Update job: done
                const pool2 = await connectToCentralDB();
                await pool2.request()
                    .input('JobId', sql.Int, jobId)
                    .input('FilePath', sql.NVarChar(500), filePath)
                    .input('FileName', sql.NVarChar(200), fileName)
                    .input('RowCount', sql.Int, data.length)
                    .query('UPDATE ReportJobs SET Status = \'done\', FilePath = @FilePath, FileName = @FileName, [RowCount] = @RowCount WHERE JobId = @JobId');

                console.log(`[Job ${jobId}] Completed: ${data.length} rows → ${fileName}`);

            } catch (error) {
                console.error(`[Job ${jobId}] Failed:`, error.message);
                try {
                    const pool2 = await connectToCentralDB();
                    await pool2.request()
                        .input('JobId', sql.Int, jobId)
                        .input('ErrorMessage', sql.NVarChar(500), error.message?.substring(0, 500))
                        .query('UPDATE ReportJobs SET Status = \'failed\', ErrorMessage = @ErrorMessage WHERE JobId = @JobId');
                } catch { }
            }
        });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Execute-async error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
