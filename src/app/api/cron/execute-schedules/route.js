import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { sendMail } from '@/lib/email';
import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

// Cleanup old job files (>24h)
async function cleanupOldJobs() {
    try {
        const jobsDir = path.join(process.cwd(), 'tmp', 'jobs');
        if (fs.existsSync(jobsDir)) {
            const files = fs.readdirSync(jobsDir);
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            let deleted = 0;
            for (const file of files) {
                const filePath = path.join(jobsDir, file);
                const stat = fs.statSync(filePath);
                if (stat.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            }
            if (deleted > 0) console.log(`[Cleanup] Deleted ${deleted} old job files`);
        }
        // Cleanup DB records older than 7 days
        const pool = await connectToCentralDB();
        await pool.request().query(`
            DELETE FROM ReportJobs WHERE CreatedAt < DATEADD(DAY, -7, GETDATE())
        `);
    } catch (err) {
        console.warn('[Cleanup] Error:', err.message);
    }
}

// Secret key to protect the cron endpoint from unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

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

// Helper: shift a Date so its UTC components represent Bangkok time (UTC+7).
// The mssql driver (useUTC: true by default) stores getUTC*() values,
// so the UTC components must equal the intended Bangkok time.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
function toBangkokDate(d = new Date()) {
    return new Date(d.getTime() + BANGKOK_OFFSET_MS);
}

// GET: called by external cron job (e.g. Windows Task Scheduler, curl)
// Usage: GET /api/cron/execute-schedules?secret=rc-cron-secret-2026
export async function GET(request) {
    try {
        // Cleanup old job files first
        await cleanupOldJobs();
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (secret !== CRON_SECRET) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();
        const now = toBangkokDate(); // Bangkok time for DB comparison

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

        const results = [];


        for (const schedule of dueSchedules.recordset) {
            try {
                // 1. Execute the report query on company DB
                const companyPool = await connectToCompanyDB(schedule.CompanyId);
                const request = companyPool.request();

                // Parse, resolve relative dates, and apply parameters
                const resolvedParams = {};
                if (schedule.Parameters) {
                    try {
                        const params = JSON.parse(schedule.Parameters);
                        const paramDefs = await pool.request()
                            .input('ReportId', sql.Int, schedule.ReportId)
                            .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');

                        for (const def of paramDefs.recordset) {
                            const paramName = def.ParameterName.replace('@', '');
                            let value = params[def.ParameterName];

                            // Resolve relative date presets
                            if (def.InputType === 'date' && typeof value === 'string') {
                                value = resolveRelativeDate(value);
                            }

                            resolvedParams[paramName] = value;

                            if (value !== undefined && value !== '') {
                                if (def.InputType === 'date') request.input(paramName, sql.Date, value);
                                else if (def.InputType === 'number') request.input(paramName, sql.Decimal, parseFloat(value));
                                else request.input(paramName, sql.NVarChar(sql.MAX), value);
                            } else {
                                request.input(paramName, sql.NVarChar(sql.MAX), null);
                            }
                        }
                    } catch (e) {
                        console.warn(`Schedule ${schedule.ScheduleId}: parameter binding error:`, e.message);
                    }
                }

                const queryResult = await request.query(schedule.TSqlQuery);
                const data = queryResult.recordset;

                // 2. Generate Excel buffer
                const ws = xlsx.utils.json_to_sheet(data);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Report');
                const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsb' });

                // 3. Send email
                const companyNames = { 1: 'Sonic Interfreight (SNI)', 2: 'Grandlink Logistics (GRL)', 3: 'Sonic Autologis (SALOG)' };
                const companyName = companyNames[schedule.CompanyId] || `Company ${schedule.CompanyId}`;
                const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const subject = schedule.EmailSubject
                    ? schedule.EmailSubject.replace('{date}', dateStr).replace('{report}', schedule.ReportName)
                    : `[ReportCenter] ${schedule.ReportName} - ${companyName} - ${dateStr}`;

                // Build parameters HTML
                const paramEntries = Object.entries(resolvedParams);
                const paramsHtml = paramEntries.length > 0
                    ? `<p style="color: #64748b;">ตัวแปร:</p>
                       <ul style="color: #64748b; margin: 4px 0 12px 20px; padding: 0;">
                           ${paramEntries.map(([k, v]) => `<li><strong>${k.replace('@', '')}</strong>: ${v}</li>`).join('')}
                       </ul>`
                    : '';

                const mailOptions = {
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: schedule.EmailTo,
                    cc: schedule.EmailCc || undefined,
                    subject,
                    html: `
                        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                            <h2 style="color: #1e293b;">📊 ${schedule.ReportName}</h2>
                            <p style="color: #64748b;">บริษัท: <strong>${companyName}</strong></p>
                            <p style="color: #64748b;">กำหนดการ: <strong>${schedule.ScheduleName}</strong></p>
                            <p style="color: #64748b;">สร้างเมื่อ: ${dateStr}</p>
                            ${paramsHtml}
                            <p style="color: #64748b;">จำนวนข้อมูล: <strong>${data.length} แถว</strong></p>
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                            <p style="color: #94a3b8; font-size: 12px;">ส่งอัตโนมัติจาก ReportCenter</p>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: `${schedule.ReportName}_${companyName.split('(')[1]?.replace(')', '') || schedule.CompanyId}_${dateStr.replace(/\//g, '-')}.xlsb`,
                            content: excelBuffer,
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        },
                    ],
                };

                await sendMail(mailOptions);

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

                // Create notification for admin users about the failure
                try {
                    await pool.request()
                        .input('Title', sql.NVarChar(200), `❌ Schedule ล้มเหลว: ${schedule.ScheduleName}`)
                        .input('Message', sql.NVarChar(500), `${err.message?.substring(0, 400)}`)
                        .input('Type', sql.NVarChar(20), 'error')
                        .query(`
                            INSERT INTO Notifications (UserId, Title, Message, Type)
                            SELECT u.UserId, @Title, @Message, @Type
                            FROM Users u
                            LEFT JOIN Roles r ON u.RoleId = r.RoleId
                            WHERE r.RoleName = 'Admin'
                        `);
                } catch (e) { console.warn('Schedule failure notification failed:', e.message); }
            }
        }

        return NextResponse.json({ success: true, executed: results.length, results });

    } catch (error) {
        console.error('Cron execution error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

function calculateNextRun(frequency, runTime, dayOfWeek, dayOfMonth) {
    const nowBangkok = toBangkokDate();

    const [hour, minute] = runTime.split(':').map(Number);

    // Build "next run" in Bangkok time (using UTC methods so server TZ doesn't interfere)
    let next = new Date(nowBangkok);
    next.setUTCHours(hour, minute, 0, 0);

    if (frequency === 'daily') {
        if (next <= nowBangkok) next.setUTCDate(next.getUTCDate() + 1);
    } else if (frequency === 'weekly') {
        const currentDay = nowBangkok.getUTCDay();
        let daysUntil = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntil === 0 && next <= nowBangkok) daysUntil = 7;
        next.setUTCDate(nowBangkok.getUTCDate() + daysUntil);
    } else if (frequency === 'monthly') {
        next.setUTCDate(dayOfMonth);
        if (next <= nowBangkok) {
            next.setUTCMonth(next.getUTCMonth() + 1);
            next.setUTCDate(dayOfMonth);
        }
    }

    // Return as-is — UTC components already represent Bangkok time
    return next;
}
