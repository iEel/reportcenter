import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    let pool;
    let transaction;
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { report, parameters } = body;

        // Basic Validation
        if (!report || !report.ReportName || !report.TSqlQuery) {
            return NextResponse.json({ success: false, message: "Missing required report fields" }, { status: 400 });
        }

        pool = await connectToCentralDB();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Insert Report
            const reportQuery = `
                INSERT INTO Reports (ReportName, Description, ReportType, TSqlQuery, EmailTemplateContent, IsPublic, IsActive, IsHeavy)
                OUTPUT INSERTED.ReportId
                VALUES (@ReportName, @Description, @ReportType, @TSqlQuery, @EmailTemplateContent, @IsPublic, @IsActive, @IsHeavy);
            `;

            const reportResult = await transaction.request()
                .input('ReportName', sql.NVarChar(200), report.ReportName)
                .input('Description', sql.NVarChar(500), report.Description || null)
                .input('ReportType', sql.Int, report.ReportType || 1)
                .input('TSqlQuery', sql.NVarChar(sql.MAX), report.TSqlQuery)
                .input('EmailTemplateContent', sql.NVarChar(sql.MAX), report.EmailTemplateContent || null)
                .input('IsPublic', sql.Bit, report.IsPublic ? 1 : 0)
                .input('IsActive', sql.Bit, 1)
                .input('IsHeavy', sql.Bit, report.IsHeavy ? 1 : 0)
                .query(reportQuery);

            const newReportId = reportResult.recordset[0].ReportId;

            // 2. Auto-add LookupQuery column if missing
            try {
                await transaction.request().query(`
                    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReportParameters' AND COLUMN_NAME = 'LookupQuery')
                    ALTER TABLE ReportParameters ADD LookupQuery NVARCHAR(MAX) NULL;
                `);
            } catch (e) { console.warn('IsHeavy column check failed:', e.message); }

            // 3. Insert Parameters if any
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
                        ReportId: newReportId,
                        ParameterName: p.ParameterName,
                        DisplayLabel: p.DisplayLabel || p.ParameterName,
                        InputType: p.InputType || 'text',
                        LookupQuery: p.LookupQuery || null,
                        OrderIndex: i + 1
                    });
                }
                await paramStmt.unprepare();
            }

            // 3. Insert Roles Mapping if not public
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
                        ReportId: newReportId,
                        RoleId: parseInt(report.Roles[i])
                    });
                }
                await roleStmt.unprepare();
            }

            // Commit the transaction since everything succeeded
            await transaction.commit();

            // Log activity (non-blocking)
            try {
                const session = await getSession(request);
                if (session) {
                    await pool.request()
                        .input('UserId', sql.Int, session.userId)
                        .input('ReportId', sql.Int, newReportId)
                        .input('ActionType', sql.NVarChar(50), 'CREATE_REPORT')
                        .input('Details', sql.NVarChar(500), `สร้างรายงาน "${report.ReportName}"`)
                        .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)`);
                }
            } catch (e) { console.warn('Report activity log failed:', e.message); }

            return NextResponse.json({
                success: true,
                message: "Report saved successfully",
                reportId: newReportId
            });

        } catch (dbError) {
            console.error("Transaction Error, Rolling back:", dbError);
            if (transaction) await transaction.rollback();
            throw dbError; // Bubble up to the outer catch
        }

    } catch (error) {
        console.error("Error creating report:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const pool = await connectToCentralDB();
        const query = `
            SELECT ReportId, ReportName, Description, ReportType, IsPublic, IsActive
            FROM Reports
            ORDER BY ReportId DESC;
        `;
        const result = await pool.request().query(query);

        return NextResponse.json({ success: true, reports: result.recordset });
    } catch (error) {
        console.error("Error fetching admin reports:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
