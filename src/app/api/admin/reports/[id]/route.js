import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request, props) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;
        if (!id) return NextResponse.json({ success: false, message: "Report ID required" }, { status: 400 });

        const pool = await connectToCentralDB();

        // Fetch Report
        const reportResult = await pool.request()
            .input('ReportId', sql.Int, parseInt(id))
            .query('SELECT * FROM Reports WHERE ReportId = @ReportId');

        if (reportResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: "Report not found" }, { status: 404 });
        }

        const report = reportResult.recordset[0];

        // Fetch Parameters
        const paramResult = await pool.request()
            .input('ReportId', sql.Int, parseInt(id))
            .query('SELECT * FROM ReportParameters WHERE ReportId = @ReportId ORDER BY OrderIndex');

        // Fetch Role Mappings
        const rrmResult = await pool.request()
            .input('ReportId', sql.Int, parseInt(id))
            .query('SELECT RoleId FROM ReportRoleMapping WHERE ReportId = @ReportId');

        const roles = rrmResult.recordset.map(r => r.RoleId);

        return NextResponse.json({
            success: true,
            report: { ...report, Roles: roles },
            parameters: paramResult.recordset
        });

    } catch (error) {
        console.error("Error fetching report:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    let pool;
    let transaction;
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;
        const body = await request.json();
        const { report, parameters } = body;

        if (!id || !report || !report.ReportName || !report.TSqlQuery) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        pool = await connectToCentralDB();

        // Fetch old report for change comparison
        let oldReport = {};
        try {
            const oldResult = await pool.request()
                .input('OldReportId', sql.Int, parseInt(id))
                .query('SELECT ReportName, Description, ReportType, TSqlQuery, EmailTemplateContent, IsPublic, IsActive, IsHeavy FROM Reports WHERE ReportId = @OldReportId');
            if (oldResult.recordset.length > 0) oldReport = oldResult.recordset[0];
        } catch (e) { /* ignore */ }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Update Report
            const reportQuery = `
                UPDATE Reports 
                SET ReportName = @ReportName, 
                    Description = @Description, 
                    ReportType = @ReportType, 
                    TSqlQuery = @TSqlQuery, 
                    EmailTemplateContent = @EmailTemplateContent, 
                    IsPublic = @IsPublic, 
                    IsActive = @IsActive,
                    IsHeavy = @IsHeavy
                WHERE ReportId = @ReportId;
            `;

            await transaction.request()
                .input('ReportId', sql.Int, parseInt(id))
                .input('ReportName', sql.NVarChar(200), report.ReportName)
                .input('Description', sql.NVarChar(500), report.Description || null)
                .input('ReportType', sql.Int, report.ReportType || 1)
                .input('TSqlQuery', sql.NVarChar(sql.MAX), report.TSqlQuery)
                .input('EmailTemplateContent', sql.NVarChar(sql.MAX), report.EmailTemplateContent || null)
                .input('IsPublic', sql.Bit, report.IsPublic ? 1 : 0)
                .input('IsActive', sql.Bit, report.IsActive !== undefined ? (report.IsActive ? 1 : 0) : 1)
                .input('IsHeavy', sql.Bit, report.IsHeavy ? 1 : 0)
                .query(reportQuery);

            // 2. Delete Old Parameters
            await transaction.request()
                .input('ReportId', sql.Int, parseInt(id))
                .query('DELETE FROM ReportParameters WHERE ReportId = @ReportId');

            // 3. Auto-add LookupQuery column if missing
            try {
                await transaction.request().query(`
                    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReportParameters' AND COLUMN_NAME = 'LookupQuery')
                    ALTER TABLE ReportParameters ADD LookupQuery NVARCHAR(MAX) NULL;
                `);
            } catch (e) { console.warn('IsHeavy column check failed:', e.message); }

            // 4. Insert New Parameters
            if (parameters && parameters.length > 0) {
                const paramStmt = new sql.PreparedStatement(transaction);
                paramStmt.input('ReportId', sql.Int);
                paramStmt.input('ParameterName', sql.NVarChar(50));
                paramStmt.input('DisplayLabel', sql.NVarChar(100));
                paramStmt.input('InputType', sql.NVarChar(20));
                paramStmt.input('LookupQuery', sql.NVarChar(sql.MAX));
                paramStmt.input('OrderIndex', sql.Int);

                const paramQuery = `
                    INSERT INTO ReportParameters (ReportId, ParameterName, DisplayLabel, InputType, LookupQuery, OrderIndex)
                    VALUES (@ReportId, @ParameterName, @DisplayLabel, @InputType, @LookupQuery, @OrderIndex);
                `;

                await paramStmt.prepare(paramQuery);

                for (let i = 0; i < parameters.length; i++) {
                    const p = parameters[i];
                    await paramStmt.execute({
                        ReportId: parseInt(id),
                        ParameterName: p.ParameterName,
                        DisplayLabel: p.DisplayLabel || p.ParameterName,
                        InputType: p.InputType || 'text',
                        LookupQuery: p.LookupQuery || null,
                        OrderIndex: i + 1
                    });
                }
                await paramStmt.unprepare();
            }

            // 4. Update Role Mappings — only if Roles is explicitly provided
            if (report.Roles !== undefined) {
                await transaction.request()
                    .input('ReportId', sql.Int, parseInt(id))
                    .query('DELETE FROM ReportRoleMapping WHERE ReportId = @ReportId');

                if (report.Roles && report.Roles.length > 0) {
                    const roleStmt = new sql.PreparedStatement(transaction);
                    roleStmt.input('ReportId', sql.Int);
                    roleStmt.input('RoleId', sql.Int);

                    const roleQuery = `
                        INSERT INTO ReportRoleMapping (ReportId, RoleId)
                        VALUES (@ReportId, @RoleId);
                    `;

                    await roleStmt.prepare(roleQuery);

                    for (let i = 0; i < report.Roles.length; i++) {
                        await roleStmt.execute({
                            ReportId: parseInt(id),
                            RoleId: parseInt(report.Roles[i])
                        });
                    }
                    await roleStmt.unprepare();
                }
            }

            await transaction.commit();

            // Build change summary with old→new values
            const changes = [];
            if (oldReport.ReportName !== report.ReportName) changes.push(`ชื่อ: "${oldReport.ReportName}" → "${report.ReportName}"`);
            if ((oldReport.Description || '') !== (report.Description || '')) changes.push(`คำอธิบาย: "${oldReport.Description || '-'}" → "${report.Description || '-'}"`);
            if (oldReport.ReportType !== (report.ReportType || 1)) changes.push(`ประเภท: ${oldReport.ReportType} → ${report.ReportType || 1}`);
            if ((oldReport.TSqlQuery || '') !== (report.TSqlQuery || '')) changes.push(`SQL เปลี่ยน (${(oldReport.TSqlQuery || '').length}→${(report.TSqlQuery || '').length} ตัวอักษร)`);
            if ((oldReport.EmailTemplateContent || '') !== (report.EmailTemplateContent || '')) changes.push(`Email Template เปลี่ยน`);
            if (!!oldReport.IsPublic !== !!report.IsPublic) changes.push(`สาธารณะ: ${oldReport.IsPublic ? 'ใช่' : 'ไม่'} → ${report.IsPublic ? 'ใช่' : 'ไม่'}`);
            if (!!oldReport.IsActive !== !!(report.IsActive !== undefined ? report.IsActive : true)) changes.push(`สถานะ: ${oldReport.IsActive ? 'เปิด' : 'ปิด'} → ${report.IsActive ? 'เปิด' : 'ปิด'}`);
            if (!!oldReport.IsHeavy !== !!report.IsHeavy) changes.push(`รายงานหนัก: ${oldReport.IsHeavy ? 'ใช่' : 'ไม่'} → ${report.IsHeavy ? 'ใช่' : 'ไม่'}`);
            const changeSummary = changes.length > 0 ? ` | ${changes.join(', ')}` : '';

            // Log activity with full change data
            try {
                const session = await getSession(request);
                if (session) {
                    // Auto-add ChangeData column if missing
                    try {
                        await pool.request().query(`
                            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ActivityLogs' AND COLUMN_NAME = 'ChangeData')
                            ALTER TABLE ActivityLogs ADD ChangeData NVARCHAR(MAX) NULL;
                        `);
                    } catch (e) { /* ignore */ }

                    // Build change data JSON with old→new for each changed field
                    const changeData = {};
                    if (oldReport.ReportName !== report.ReportName) changeData['ชื่อรายงาน'] = { old: oldReport.ReportName, new: report.ReportName };
                    if ((oldReport.Description || '') !== (report.Description || '')) changeData['คำอธิบาย'] = { old: oldReport.Description || '', new: report.Description || '' };
                    if (oldReport.ReportType !== (report.ReportType || 1)) changeData['ประเภท'] = { old: oldReport.ReportType, new: report.ReportType || 1 };
                    if ((oldReport.TSqlQuery || '') !== (report.TSqlQuery || '')) changeData['คำสั่ง SQL'] = { old: oldReport.TSqlQuery || '', new: report.TSqlQuery || '' };
                    if ((oldReport.EmailTemplateContent || '') !== (report.EmailTemplateContent || '')) changeData['Email Template'] = { old: oldReport.EmailTemplateContent || '', new: report.EmailTemplateContent || '' };
                    if (!!oldReport.IsPublic !== !!report.IsPublic) changeData['สาธารณะ'] = { old: !!oldReport.IsPublic, new: !!report.IsPublic };
                    if (!!oldReport.IsActive !== !!(report.IsActive !== undefined ? report.IsActive : true)) changeData['สถานะ'] = { old: !!oldReport.IsActive, new: !!report.IsActive };
                    if (!!oldReport.IsHeavy !== !!report.IsHeavy) changeData['รายงานหนัก'] = { old: !!oldReport.IsHeavy, new: !!report.IsHeavy };

                    await pool.request()
                        .input('UserId', sql.Int, session.userId)
                        .input('ReportId', sql.Int, parseInt(id))
                        .input('ActionType', sql.NVarChar(50), 'UPDATE_REPORT')
                        .input('Details', sql.NVarChar(sql.MAX), `แก้ไขรายงาน "${report.ReportName}"${changeSummary}`)
                        .input('ChangeData', sql.NVarChar(sql.MAX), Object.keys(changeData).length > 0 ? JSON.stringify(changeData) : null)
                        .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @ActionType, @Details, @ChangeData)`);
                }
            } catch (e) { console.warn('Report activity log failed:', e.message); }

            return NextResponse.json({ success: true, message: "Report updated successfully" });

        } catch (dbError) {
            console.error("Transaction Error, Rolling back:", dbError);
            if (transaction) await transaction.rollback();
            throw dbError;
        }

    } catch (error) {
        console.error("Error updating report:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    try {
        const { id } = await props.params;
        if (!id) return NextResponse.json({ success: false, message: "Report ID required" }, { status: 400 });

        const pool = await connectToCentralDB();
        const reportId = parseInt(id);

        // Hard delete — remove related data first (FK constraints)
        await pool.request().input('ReportId', sql.Int, reportId)
            .query('DELETE FROM ReportParameters WHERE ReportId = @ReportId');

        try {
            await pool.request().input('ReportId', sql.Int, reportId)
                .query('DELETE FROM ReportRoleMapping WHERE ReportId = @ReportId');
        } catch (e) { /* table may not exist */ }

        try {
            await pool.request().input('ReportId', sql.Int, reportId)
                .query('DELETE FROM UserFavoriteReports WHERE ReportId = @ReportId');
        } catch (e) { /* table may not exist */ }

        // Delete the report itself
        await pool.request().input('ReportId', sql.Int, reportId)
            .query('DELETE FROM Reports WHERE ReportId = @ReportId');

        return NextResponse.json({ success: true, message: "Report deleted permanently" });

    } catch (error) {
        console.error("Error deleting report:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/reports/[id]
 * Toggle report IsActive status (enable/disable)
 */
export async function PATCH(request, props) {
    try {
        const { id } = await props.params;
        if (!id) return NextResponse.json({ success: false, message: "Report ID required" }, { status: 400 });

        const pool = await connectToCentralDB();
        const reportId = parseInt(id);

        // Toggle IsActive
        const result = await pool.request()
            .input('ReportId', sql.Int, reportId)
            .query(`
                UPDATE Reports SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END 
                WHERE ReportId = @ReportId;
                SELECT IsActive FROM Reports WHERE ReportId = @ReportId;
            `);

        const newStatus = result.recordset[0]?.IsActive;
        return NextResponse.json({
            success: true,
            isActive: !!newStatus,
            message: newStatus ? 'เปิดใช้งานรายงานแล้ว' : 'ปิดใช้งานรายงานแล้ว',
        });

    } catch (error) {
        console.error("Error toggling report status:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
