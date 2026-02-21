import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Auto-create ReportSchedules table
async function ensureTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID('ReportSchedules') IS NULL
        CREATE TABLE ReportSchedules (
            ScheduleId INT IDENTITY(1,1) PRIMARY KEY,
            ReportId INT NOT NULL,
            ScheduleName NVARCHAR(200) NOT NULL,
            Frequency NVARCHAR(20) NOT NULL,  -- 'daily', 'weekly', 'monthly'
            DayOfWeek INT NULL,               -- 0=Sun..6=Sat (for weekly)
            DayOfMonth INT NULL,              -- 1-31 (for monthly)
            RunTime NVARCHAR(5) NOT NULL,     -- 'HH:mm' e.g. '08:00'
            CompanyId INT NOT NULL,
            Parameters NVARCHAR(MAX) NULL,    -- JSON string of param values
            IsActive BIT DEFAULT 1,
            LastRunAt DATETIME NULL,
            NextRunAt DATETIME NULL,
            CreatedBy INT NOT NULL,
            CreatedAt DATETIME DEFAULT GETDATE(),
            UpdatedAt DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (ReportId) REFERENCES Reports(ReportId)
        )
    `);
}

// Helper: calculate next run datetime
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
        const { reportId, scheduleName, frequency, dayOfWeek, dayOfMonth, runTime, companyId, parameters } = body;

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
            .input('NextRunAt', sql.DateTime, nextRun)
            .input('CreatedBy', sql.Int, user.userId)
            .query(`
                INSERT INTO ReportSchedules (ReportId, ScheduleName, Frequency, DayOfWeek, DayOfMonth, RunTime, CompanyId, Parameters, NextRunAt, CreatedBy)
                VALUES (@ReportId, @ScheduleName, @Frequency, @DayOfWeek, @DayOfMonth, @RunTime, @CompanyId, @Parameters, @NextRunAt, @CreatedBy)
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
        const { scheduleId, scheduleName, frequency, dayOfWeek, dayOfMonth, runTime, companyId, parameters, isActive } = body;

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
            .input('NextRunAt', sql.DateTime, nextRun)
            .query(`
                UPDATE ReportSchedules SET
                    ScheduleName = @ScheduleName, Frequency = @Frequency,
                    DayOfWeek = @DayOfWeek, DayOfMonth = @DayOfMonth,
                    RunTime = @RunTime, CompanyId = @CompanyId,
                    Parameters = @Parameters, IsActive = @IsActive,
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
