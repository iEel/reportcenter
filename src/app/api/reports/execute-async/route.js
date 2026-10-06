import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateQuery } from '@/lib/sql-validator';
import { runReportJob } from '@/lib/report-job';

/**
 * Queue a background export for an IsHeavy report: answers with the job id at once, then
 * runReportJob streams the rows into an .xlsx kept 24 hours for download from job history.
 */
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

        // Company access applies to every role, admins included (same rule as search-param)
        const allowed = session.allowedCompanies || [];
        if (!allowed.includes(parseInt(companyId))) {
            return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' }, { status: 403 });
        }

        const centralPool = await connectToCentralDB();

        // Check concurrent job limit per user
        try {
            const limitSetting = await centralPool.request().query(`
                SELECT SettingValue FROM SystemSettings WHERE SettingKey = 'max_concurrent_jobs'
            `);
            const maxJobs = parseInt(limitSetting.recordset?.[0]?.SettingValue || '0');
            if (maxJobs > 0) {
                const runningJobs = await centralPool.request()
                    .input('UserId', sql.Int, session.userId)
                    .query(`SELECT COUNT(*) AS cnt FROM ReportJobs WHERE UserId = @UserId AND Status = 'running'`);
                const currentRunning = runningJobs.recordset[0].cnt;
                if (currentRunning >= maxJobs) {
                    return NextResponse.json({
                        success: false,
                        message: `คุณมีรายงานที่กำลังสร้างอยู่ ${currentRunning} รายการ (สูงสุด ${maxJobs}) — กรุณารอให้เสร็จก่อน`
                    }, { status: 429 });
                }
            }
        } catch (e) { /* ignore — allow if setting doesn't exist yet */ }

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

        // Background execution (non-blocking); the job records its own result and notifies the user
        setImmediate(() => {
            void runReportJob({ jobId, userId: session.userId, companyId, reportName, tSqlQuery, expectedParams, parameters });
        });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Execute-async error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
