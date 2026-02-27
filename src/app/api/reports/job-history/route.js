import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // Auto-create ReportJobs table if not exists
        await pool.request().query(`
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
                CreatedAt DATETIME DEFAULT GETDATE(),
                CompletedAt DATETIME NULL
            );
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportJobs') AND name = 'CompletedAt')
            ALTER TABLE ReportJobs ADD CompletedAt DATETIME NULL;
        `);

        // Fetch user's recent jobs (last 24 hours)
        const result = await pool.request()
            .input('UserId', sql.Int, session.userId)
            .query(`
                SELECT j.JobId, j.ReportId, j.CompanyId, j.Status, j.FileName, j.[RowCount], j.ErrorMessage, j.CreatedAt,
                       j.CompletedAt, r.ReportName
                FROM ReportJobs j
                LEFT JOIN Reports r ON j.ReportId = r.ReportId
                WHERE j.UserId = @UserId AND j.CreatedAt >= DATEADD(HOUR, -24, GETDATE())
                ORDER BY j.CreatedAt DESC
            `);

        return NextResponse.json({
            success: true,
            jobs: result.recordset,
        });

    } catch (error) {
        console.error('Job history error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
