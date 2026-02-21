import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { createMailTransporter } from '@/lib/email';
import * as xlsx from 'xlsx';

// Secret key to protect the cron endpoint from unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'rc-cron-secret-2026';

// Resolve relative date presets to actual dates
function resolveRelativeDate(preset) {
    const now = new Date();
    const fmt = (d) => d.toISOString().split('T')[0]; // YYYY-MM-DD

    switch (preset) {
        case 'TODAY': return fmt(now);
        case 'YESTERDAY': { const d = new Date(now); d.setDate(d.getDate() - 1); return fmt(d); }
        case 'MONTH_START': return fmt(new Date(now.getFullYear(), now.getMonth(), 1));
        case 'MONTH_END': return fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        case 'PREV_MONTH_START': return fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        case 'PREV_MONTH_END': return fmt(new Date(now.getFullYear(), now.getMonth(), 0));
        case 'YEAR_START': return fmt(new Date(now.getFullYear(), 0, 1));
        default: return preset; // Return as-is if not a preset
    }
}

// GET: called by external cron job (e.g. Windows Task Scheduler, curl)
// Usage: GET /api/cron/execute-schedules?secret=rc-cron-secret-2026
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (secret !== CRON_SECRET) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();
        const now = new Date();

        // Find schedules that are due (NextRunAt <= now AND IsActive = 1)
        const dueSchedules = await pool.request()
            .input('Now', sql.DateTime, now)
            .query(`
                SELECT s.*, r.ReportName, r.TSqlQuery, r.ReportType
                FROM ReportSchedules s
                JOIN Reports r ON s.ReportId = r.ReportId
                WHERE s.IsActive = 1 AND s.NextRunAt <= @Now
            `);

        if (dueSchedules.recordset.length === 0) {
            return NextResponse.json({ success: true, message: 'No schedules due', executed: 0 });
        }

        const transporter = await createMailTransporter();
        const results = [];


        for (const schedule of dueSchedules.recordset) {
            try {
                // 1. Execute the report query on company DB
                const companyPool = await connectToCompanyDB(schedule.CompanyId);
                const request = companyPool.request();

                // Parse, resolve relative dates, and apply parameters
                if (schedule.Parameters) {
                    try {
                        const params = JSON.parse(schedule.Parameters);
                        for (const [key, value] of Object.entries(params)) {
                            // Resolve relative date presets (TODAY, MONTH_START, etc.)
                            const resolved = resolveRelativeDate(value);
                            request.input(key, resolved);
                        }
                    } catch (e) {
                        console.warn(`Schedule ${schedule.ScheduleId}: invalid params JSON`);
                    }
                }

                const queryResult = await request.query(schedule.TSqlQuery);
                const data = queryResult.recordset;

                // 2. Generate Excel buffer
                const ws = xlsx.utils.json_to_sheet(data);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Report');
                const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

                // 3. Send email
                const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const subject = schedule.EmailSubject
                    ? schedule.EmailSubject.replace('{date}', dateStr).replace('{report}', schedule.ReportName)
                    : `[ReportCenter] ${schedule.ReportName} - ${dateStr}`;

                const mailOptions = {
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: schedule.EmailTo,
                    cc: schedule.EmailCc || undefined,
                    subject,
                    html: `
                        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                            <h2 style="color: #1e293b;">📊 ${schedule.ReportName}</h2>
                            <p style="color: #64748b;">กำหนดการ: <strong>${schedule.ScheduleName}</strong></p>
                            <p style="color: #64748b;">สร้างเมื่อ: ${dateStr}</p>
                            <p style="color: #64748b;">จำนวนข้อมูล: <strong>${data.length} แถว</strong></p>
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                            <p style="color: #94a3b8; font-size: 12px;">ส่งอัตโนมัติจาก ReportCenter</p>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: `${schedule.ReportName}_${dateStr.replace(/\//g, '-')}.xlsx`,
                            content: excelBuffer,
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        },
                    ],
                };

                await transporter.sendMail(mailOptions);

                // 4. Update schedule: LastRunAt, LastRunStatus, NextRunAt
                const nextRun = calculateNextRun(schedule.Frequency, schedule.RunTime, schedule.DayOfWeek, schedule.DayOfMonth);

                await pool.request()
                    .input('ScheduleId', sql.Int, schedule.ScheduleId)
                    .input('LastRunAt', sql.DateTime, now)
                    .input('LastRunStatus', sql.NVarChar, 'success')
                    .input('NextRunAt', sql.DateTime, nextRun)
                    .query(`
                        UPDATE ReportSchedules SET
                            LastRunAt = @LastRunAt, LastRunStatus = @LastRunStatus,
                            NextRunAt = @NextRunAt, UpdatedAt = GETDATE()
                        WHERE ScheduleId = @ScheduleId
                    `);

                results.push({ scheduleId: schedule.ScheduleId, name: schedule.ScheduleName, status: 'success', rows: data.length });

            } catch (err) {
                console.error(`Schedule ${schedule.ScheduleId} failed:`, err);

                // Mark as failed
                await pool.request()
                    .input('ScheduleId', sql.Int, schedule.ScheduleId)
                    .input('LastRunAt', sql.DateTime, now)
                    .input('LastRunStatus', sql.NVarChar, 'failed')
                    .query(`
                        UPDATE ReportSchedules SET
                            LastRunAt = @LastRunAt, LastRunStatus = @LastRunStatus, UpdatedAt = GETDATE()
                        WHERE ScheduleId = @ScheduleId
                    `);

                results.push({ scheduleId: schedule.ScheduleId, name: schedule.ScheduleName, status: 'failed', error: err.message });
            }
        }

        return NextResponse.json({ success: true, executed: results.length, results });

    } catch (error) {
        console.error('Cron execution error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

function calculateNextRun(frequency, runTime, dayOfWeek, dayOfMonth) {
    const now = new Date();
    const [hour, minute] = runTime.split(':').map(Number);
    let next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    if (frequency === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
        const currentDay = now.getDay();
        let daysUntil = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntil === 0) daysUntil = 7;
        next.setDate(now.getDate() + daysUntil);
    } else if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);
    }
    return next;
}
