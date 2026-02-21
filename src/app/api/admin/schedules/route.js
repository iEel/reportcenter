import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Auto-create ReportSchedules table with email fields
async function ensureTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID('ReportSchedules') IS NULL
        CREATE TABLE ReportSchedules (
            ScheduleId INT IDENTITY(1,1) PRIMARY KEY,
            ReportId INT NOT NULL,
            ScheduleName NVARCHAR(200) NOT NULL,
            Frequency NVARCHAR(20) NOT NULL,
            DayOfWeek INT NULL,
            DayOfMonth INT NULL,
            RunTime NVARCHAR(5) NOT NULL,
            CompanyId INT NOT NULL,
            Parameters NVARCHAR(MAX) NULL,
            EmailTo NVARCHAR(500) NOT NULL,
            EmailCc NVARCHAR(500) NULL,
            EmailSubject NVARCHAR(300) NULL,
            IsActive BIT DEFAULT 1,
            LastRunAt DATETIME NULL,
            LastRunStatus NVARCHAR(20) NULL,
            NextRunAt DATETIME NULL,
            CreatedBy INT NOT NULL,
            CreatedAt DATETIME DEFAULT GETDATE(),
            UpdatedAt DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (ReportId) REFERENCES Reports(ReportId)
        )
    `);

    // Add email columns if table already exists but columns don't
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSchedules') AND name = 'EmailTo')
            ALTER TABLE ReportSchedules ADD EmailTo NVARCHAR(500) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSchedules') AND name = 'EmailCc')
            ALTER TABLE ReportSchedules ADD EmailCc NVARCHAR(500) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSchedules') AND name = 'EmailSubject')
            ALTER TABLE ReportSchedules ADD EmailSubject NVARCHAR(300) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ReportSchedules') AND name = 'LastRunStatus')
            ALTER TABLE ReportSchedules ADD LastRunStatus NVARCHAR(20) NULL;
        `);
    } catch (e) { /* columns may already exist */ }
}

function calculateNextRun(frequency, runTime, dayOfWeek, dayOfMonth) {
    const now = new Date();
    const [hour, minute] = runTime.split(':').map(Number);
    let next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    if (frequency === 'daily') {
        if (next <= now) next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
        const currentDay = now.getDay();
        let daysUntil = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntil === 0 && next <= now) daysUntil = 7;
        next.setDate(now.getDate() + daysUntil);
    } else if (frequency === 'monthly') {
        next.setDate(dayOfMonth);
        if (next <= now) {
            next.setMonth(next.getMonth() + 1);
            next.setDate(dayOfMonth);
        }
    }
    return next;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user || user.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const pool = await connectToCentralDB();
        await ensureTable(pool);

        const result = await pool.request().query(`
            SELECT s.*, r.ReportName, r.ReportType, u.FullName AS CreatedByName
            FROM ReportSchedules s
            JOIN Reports r ON s.ReportId = r.ReportId
            LEFT JOIN Users u ON s.CreatedBy = u.UserId
            ORDER BY s.IsActive DESC, s.NextRunAt ASC
        `);

        return NextResponse.json({ success: true, schedules: result.recordset });
    } catch (error) {
        console.error('Schedules GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user || user.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { reportId, scheduleName, frequency, dayOfWeek, dayOfMonth, runTime, companyId, parameters, emailTo, emailCc, emailSubject } = body;

        const pool = await connectToCentralDB();
        await ensureTable(pool);

        const nextRun = calculateNextRun(frequency, runTime, dayOfWeek, dayOfMonth);

        await pool.request()
            .input('ReportId', sql.Int, reportId)
            .input('ScheduleName', sql.NVarChar, scheduleName)
            .input('Frequency', sql.NVarChar, frequency)
            .input('DayOfWeek', sql.Int, dayOfWeek ?? null)
            .input('DayOfMonth', sql.Int, dayOfMonth ?? null)
            .input('RunTime', sql.NVarChar, runTime)
            .input('CompanyId', sql.Int, companyId)
            .input('Parameters', sql.NVarChar, parameters ? JSON.stringify(parameters) : null)
            .input('EmailTo', sql.NVarChar, emailTo)
            .input('EmailCc', sql.NVarChar, emailCc || null)
            .input('EmailSubject', sql.NVarChar, emailSubject || null)
            .input('NextRunAt', sql.DateTime, nextRun)
            .input('CreatedBy', sql.Int, user.userId)
            .query(`
                INSERT INTO ReportSchedules (ReportId, ScheduleName, Frequency, DayOfWeek, DayOfMonth, RunTime, CompanyId, Parameters, EmailTo, EmailCc, EmailSubject, NextRunAt, CreatedBy)
                VALUES (@ReportId, @ScheduleName, @Frequency, @DayOfWeek, @DayOfMonth, @RunTime, @CompanyId, @Parameters, @EmailTo, @EmailCc, @EmailSubject, @NextRunAt, @CreatedBy)
            `);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Schedules POST error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user || user.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { scheduleId, scheduleName, frequency, dayOfWeek, dayOfMonth, runTime, companyId, parameters, isActive, emailTo, emailCc, emailSubject } = body;

        const pool = await connectToCentralDB();
        const nextRun = calculateNextRun(frequency, runTime, dayOfWeek, dayOfMonth);

        await pool.request()
            .input('ScheduleId', sql.Int, scheduleId)
            .input('ScheduleName', sql.NVarChar, scheduleName)
            .input('Frequency', sql.NVarChar, frequency)
            .input('DayOfWeek', sql.Int, dayOfWeek ?? null)
            .input('DayOfMonth', sql.Int, dayOfMonth ?? null)
            .input('RunTime', sql.NVarChar, runTime)
            .input('CompanyId', sql.Int, companyId)
            .input('Parameters', sql.NVarChar, parameters ? JSON.stringify(parameters) : null)
            .input('IsActive', sql.Bit, isActive ? 1 : 0)
            .input('EmailTo', sql.NVarChar, emailTo)
            .input('EmailCc', sql.NVarChar, emailCc || null)
            .input('EmailSubject', sql.NVarChar, emailSubject || null)
            .input('NextRunAt', sql.DateTime, nextRun)
            .query(`
                UPDATE ReportSchedules SET
                    ScheduleName = @ScheduleName, Frequency = @Frequency,
                    DayOfWeek = @DayOfWeek, DayOfMonth = @DayOfMonth,
                    RunTime = @RunTime, CompanyId = @CompanyId,
                    Parameters = @Parameters, IsActive = @IsActive,
                    EmailTo = @EmailTo, EmailCc = @EmailCc, EmailSubject = @EmailSubject,
                    NextRunAt = @NextRunAt, UpdatedAt = GETDATE()
                WHERE ScheduleId = @ScheduleId
            `);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Schedules PUT error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user || user.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const scheduleId = parseInt(searchParams.get('scheduleId'));

        const pool = await connectToCentralDB();
        await pool.request()
            .input('ScheduleId', sql.Int, scheduleId)
            .query('DELETE FROM ReportSchedules WHERE ScheduleId = @ScheduleId');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Schedules DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Manual trigger — run a single schedule immediately
export async function PATCH(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user || user.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { scheduleId } = await request.json();
        if (!scheduleId) return NextResponse.json({ success: false, message: 'scheduleId is required' }, { status: 400 });

        const pool = await connectToCentralDB();

        // Fetch schedule + report info
        const schedResult = await pool.request()
            .input('ScheduleId', sql.Int, scheduleId)
            .query(`
                SELECT s.*, r.TSqlQuery, r.ReportName, r.EmailTemplateContent, r.ReportType
                FROM ReportSchedules s
                INNER JOIN Reports r ON s.ReportId = r.ReportId
                WHERE s.ScheduleId = @ScheduleId
            `);

        if (schedResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'Schedule not found' }, { status: 404 });
        }

        const sched = schedResult.recordset[0];

        // Import dependencies dynamically
        const { connectToCompanyDB } = await import('@/lib/db');
        const nodemailer = (await import('nodemailer')).default;
        const xlsx = await import('xlsx');

        // Execute SQL on company DB
        const companyPool = await connectToCompanyDB(sched.CompanyId);
        const reqExec = companyPool.request();

        // Bind parameters if any
        if (sched.Parameters) {
            try {
                const params = JSON.parse(sched.Parameters);
                const paramDefs = await pool.request()
                    .input('ReportId', sql.Int, sched.ReportId)
                    .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');

                for (const def of paramDefs.recordset) {
                    const paramName = def.ParameterName.replace('@', '');
                    let value = params[def.ParameterName];

                    // Resolve relative date presets
                    if (def.InputType === 'date' && typeof value === 'string') {
                        const now = new Date();
                        if (value === 'TODAY') value = now.toISOString().split('T')[0];
                        else if (value === 'YESTERDAY') { now.setDate(now.getDate() - 1); value = now.toISOString().split('T')[0]; }
                        else if (value === 'MONTH_START') value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                    }

                    if (value !== undefined && value !== '') {
                        if (def.InputType === 'date') reqExec.input(paramName, sql.Date, value);
                        else if (def.InputType === 'number') reqExec.input(paramName, sql.Decimal, parseFloat(value));
                        else reqExec.input(paramName, sql.NVarChar(sql.MAX), value);
                    } else {
                        reqExec.input(paramName, sql.NVarChar(sql.MAX), null);
                    }
                }
            } catch (e) {
                console.warn('Parameter binding error:', e.message);
            }
        }

        const dataResult = await reqExec.query(sched.TSqlQuery);
        const rows = dataResult.recordset;

        // Generate Excel
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Report Data');
        const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Send email
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.office365.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const dateStr = new Date().toISOString().split('T')[0];
        const subject = sched.EmailSubject || `[ReportCenter] ${sched.ReportName} - ${dateStr}`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: sched.EmailTo,
            cc: sched.EmailCc || undefined,
            subject: `${subject} (Manual)`,
            text: `รายงาน "${sched.ReportName}" ถูกรันด้วยตนเองโดย ${user.fullName}\nพบข้อมูล ${rows.length} รายการ`,
            attachments: [{
                filename: `${sched.ReportName}_${dateStr}.xlsx`,
                content: buffer,
            }],
        });

        // Update schedule status
        await pool.request()
            .input('ScheduleId', sql.Int, scheduleId)
            .input('Now', sql.DateTime, new Date())
            .query(`UPDATE ReportSchedules SET LastRunAt = @Now, LastStatus = 'SUCCESS' WHERE ScheduleId = @ScheduleId`);

        // Log activity
        try {
            await pool.request()
                .input('UserId', sql.Int, user.userId)
                .input('ReportId', sql.Int, sched.ReportId)
                .input('CompanyId', sql.Int, sched.CompanyId)
                .input('ActionType', sql.NVarChar(50), 'RUN_SCHEDULE')
                .input('Details', sql.NVarChar(500), `รัน "${sched.ScheduleName}" แบบ Manual ได้ ${rows.length} แถว → ส่ง ${sched.EmailTo}`)
                .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details)`);
        } catch { }

        return NextResponse.json({ success: true, rowCount: rows.length, message: `ส่ง ${rows.length} รายการ ไปที่ ${sched.EmailTo} เรียบร้อย` });

    } catch (error) {
        console.error('Manual trigger error:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถรัน Schedule ได้: ' + error.message }, { status: 500 });
    }
}

