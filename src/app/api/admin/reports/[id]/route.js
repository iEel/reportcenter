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
            } catch { }

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

            // 4. Update Role Mappings
            await transaction.request()
                .input('ReportId', sql.Int, parseInt(id))
                .query('DELETE FROM ReportRoleMapping WHERE ReportId = @ReportId');

            if (!report.IsPublic && report.Roles && report.Roles.length > 0) {
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

            await transaction.commit();

            // Log activity
            try {
                const session = await getSession(request);
                if (session) {
                    await pool.request()
                        .input('UserId', sql.Int, session.userId)
                        .input('ReportId', sql.Int, parseInt(id))
                        .input('ActionType', sql.NVarChar(50), 'UPDATE_REPORT')
                        .input('Details', sql.NVarChar(500), `แก้ไขรายงาน "${report.ReportName}"`)
                        .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)`);
                }
            } catch { }

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

        // Soft delete
        await pool.request()
            .input('ReportId', sql.Int, parseInt(id))
            .query('UPDATE Reports SET IsActive = 0 WHERE ReportId = @ReportId');

        return NextResponse.json({ success: true, message: "Report soft-deleted successfully" });

    } catch (error) {
        console.error("Error deleting report:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
