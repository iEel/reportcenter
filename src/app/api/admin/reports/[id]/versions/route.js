import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET /api/admin/reports/[id]/versions
 * Fetch version history for a report.
 * Query params:
 *   - versionId: (optional) fetch a single version's full snapshot
 */
export async function GET(request, props) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;
        if (!id) return NextResponse.json({ success: false, message: 'Report ID required' }, { status: 400 });

        const pool = await connectToCentralDB();

        // Check if table exists
        const tableCheck = await pool.request().query(`SELECT OBJECT_ID('ReportVersions') AS TableExists`);
        if (!tableCheck.recordset[0].TableExists) {
            return NextResponse.json({ success: true, versions: [], total: 0 });
        }

        const { searchParams } = new URL(request.url);
        const versionId = searchParams.get('versionId');

        // Single version fetch (for diff/preview)
        if (versionId) {
            const result = await pool.request()
                .input('VersionId', sql.Int, parseInt(versionId))
                .input('ReportId', sql.Int, parseInt(id))
                .query(`
                    SELECT * FROM ReportVersions 
                    WHERE VersionId = @VersionId AND ReportId = @ReportId
                `);

            if (result.recordset.length === 0) {
                return NextResponse.json({ success: false, message: 'Version not found' }, { status: 404 });
            }

            const version = result.recordset[0];
            // Parse ParametersJson
            try {
                version.Parameters = JSON.parse(version.ParametersJson || '[]');
            } catch { version.Parameters = []; }

            return NextResponse.json({ success: true, version });
        }

        // Full list
        const result = await pool.request()
            .input('ReportId', sql.Int, parseInt(id))
            .query(`
                SELECT VersionId, ReportId, VersionNumber, ReportName, ChangeSummary, ChangeNote, 
                       ChangedBy, ChangedByName, CreatedAt
                FROM ReportVersions 
                WHERE ReportId = @ReportId
                ORDER BY VersionNumber DESC
            `);

        return NextResponse.json({
            success: true,
            versions: result.recordset,
            total: result.recordset.length,
        });

    } catch (error) {
        console.error('Error fetching versions:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/reports/[id]/versions
 * Rollback: restore a version's snapshot back into the report.
 * Body: { versionId: number }
 * 
 * Strategy: Load the version snapshot, then update the report + parameters
 * within a transaction. A new version is automatically created by the 
 * PUT handler pattern (snapshot-before-update), so history is preserved.
 */
export async function POST(request, props) {
    let pool;
    let transaction;
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await props.params;
        const body = await request.json();
        const { versionId } = body;

        if (!id || !versionId) {
            return NextResponse.json({ success: false, message: 'Report ID and Version ID required' }, { status: 400 });
        }

        pool = await connectToCentralDB();

        // Fetch the version snapshot
        const versionResult = await pool.request()
            .input('VersionId', sql.Int, parseInt(versionId))
            .input('ReportId', sql.Int, parseInt(id))
            .query('SELECT * FROM ReportVersions WHERE VersionId = @VersionId AND ReportId = @ReportId');

        if (versionResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: 'Version not found' }, { status: 404 });
        }

        const snapshot = versionResult.recordset[0];
        let snapshotParams = [];
        try { snapshotParams = JSON.parse(snapshot.ParametersJson || '[]'); } catch { }

        // Fetch current report for version snapshot (snapshot BEFORE rollback)
        const currentReport = await pool.request()
            .input('CReportId', sql.Int, parseInt(id))
            .query('SELECT ReportName, Description, ReportType, TSqlQuery, EmailTemplateContent, IsPublic, IsActive, IsHeavy, CategoryId FROM Reports WHERE ReportId = @CReportId');

        const currentParams = await pool.request()
            .input('CReportId2', sql.Int, parseInt(id))
            .query('SELECT ParameterName, DisplayLabel, InputType, LookupQuery, OrderIndex FROM ReportParameters WHERE ReportId = @CReportId2 ORDER BY OrderIndex');

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Create version snapshot of CURRENT state before rollback
            if (currentReport.recordset.length > 0) {
                const cur = currentReport.recordset[0];
                const vNumResult = await transaction.request()
                    .input('VRId', sql.Int, parseInt(id))
                    .query('SELECT ISNULL(MAX(VersionNumber), 0) + 1 AS NextVersion FROM ReportVersions WHERE ReportId = @VRId');
                const nextVersion = vNumResult.recordset[0].NextVersion;

                await transaction.request()
                    .input('VRId2', sql.Int, parseInt(id))
                    .input('VNum', sql.Int, nextVersion)
                    .input('VName', sql.NVarChar(200), cur.ReportName)
                    .input('VDesc', sql.NVarChar(500), cur.Description || null)
                    .input('VType', sql.Int, cur.ReportType)
                    .input('VSQL', sql.NVarChar(sql.MAX), cur.TSqlQuery || null)
                    .input('VEmail', sql.NVarChar(sql.MAX), cur.EmailTemplateContent || null)
                    .input('VPub', sql.Bit, cur.IsPublic ? 1 : 0)
                    .input('VAct', sql.Bit, cur.IsActive ? 1 : 0)
                    .input('VHeavy', sql.Bit, cur.IsHeavy ? 1 : 0)
                    .input('VCat', sql.Int, cur.CategoryId || null)
                    .input('VParams', sql.NVarChar(sql.MAX), JSON.stringify(currentParams.recordset || []))
                    .input('VSummary', sql.NVarChar(500), `ย้อนกลับไป v${snapshot.VersionNumber}`)
                    .input('VNote', sql.NVarChar(500), null)
                    .input('VBy', sql.Int, session.userId)
                    .input('VByName', sql.NVarChar(100), session.fullName || session.username || null)
                    .query(`
                        INSERT INTO ReportVersions 
                            (ReportId, VersionNumber, ReportName, Description, ReportType, TSqlQuery, EmailTemplateContent, IsPublic, IsActive, IsHeavy, CategoryId, ParametersJson, ChangeSummary, ChangeNote, ChangedBy, ChangedByName)
                        VALUES 
                            (@VRId2, @VNum, @VName, @VDesc, @VType, @VSQL, @VEmail, @VPub, @VAct, @VHeavy, @VCat, @VParams, @VSummary, @VNote, @VBy, @VByName)
                    `);
            }

            // 2. Restore report from snapshot
            await transaction.request()
                .input('ReportId', sql.Int, parseInt(id))
                .input('ReportName', sql.NVarChar(200), snapshot.ReportName)
                .input('Description', sql.NVarChar(500), snapshot.Description || null)
                .input('ReportType', sql.Int, snapshot.ReportType)
                .input('TSqlQuery', sql.NVarChar(sql.MAX), snapshot.TSqlQuery)
                .input('EmailTemplateContent', sql.NVarChar(sql.MAX), snapshot.EmailTemplateContent || null)
                .input('IsPublic', sql.Bit, snapshot.IsPublic ? 1 : 0)
                .input('IsActive', sql.Bit, snapshot.IsActive ? 1 : 0)
                .input('IsHeavy', sql.Bit, snapshot.IsHeavy ? 1 : 0)
                .input('CategoryId', sql.Int, snapshot.CategoryId || null)
                .query(`
                    UPDATE Reports 
                    SET ReportName = @ReportName, Description = @Description, ReportType = @ReportType,
                        TSqlQuery = @TSqlQuery, EmailTemplateContent = @EmailTemplateContent,
                        IsPublic = @IsPublic, IsActive = @IsActive, IsHeavy = @IsHeavy, CategoryId = @CategoryId
                    WHERE ReportId = @ReportId
                `);

            // 3. Restore parameters from snapshot
            await transaction.request()
                .input('ReportId', sql.Int, parseInt(id))
                .query('DELETE FROM ReportParameters WHERE ReportId = @ReportId');

            if (snapshotParams.length > 0) {
                const paramStmt = new sql.PreparedStatement(transaction);
                paramStmt.input('ReportId', sql.Int);
                paramStmt.input('ParameterName', sql.NVarChar(50));
                paramStmt.input('DisplayLabel', sql.NVarChar(100));
                paramStmt.input('InputType', sql.NVarChar(20));
                paramStmt.input('LookupQuery', sql.NVarChar(sql.MAX));
                paramStmt.input('OrderIndex', sql.Int);

                await paramStmt.prepare(`
                    INSERT INTO ReportParameters (ReportId, ParameterName, DisplayLabel, InputType, LookupQuery, OrderIndex)
                    VALUES (@ReportId, @ParameterName, @DisplayLabel, @InputType, @LookupQuery, @OrderIndex)
                `);

                for (let i = 0; i < snapshotParams.length; i++) {
                    const p = snapshotParams[i];
                    await paramStmt.execute({
                        ReportId: parseInt(id),
                        ParameterName: p.ParameterName,
                        DisplayLabel: p.DisplayLabel || p.ParameterName,
                        InputType: p.InputType || 'text',
                        LookupQuery: p.LookupQuery || null,
                        OrderIndex: p.OrderIndex || (i + 1),
                    });
                }
                await paramStmt.unprepare();
            }

            await transaction.commit();

            // Log activity
            try {
                await pool.request()
                    .input('UserId', sql.Int, session.userId)
                    .input('ReportId', sql.Int, parseInt(id))
                    .input('ActionType', sql.NVarChar(50), 'ROLLBACK_REPORT')
                    .input('Details', sql.NVarChar(500), `ย้อนกลับรายงาน "${snapshot.ReportName}" ไป v${snapshot.VersionNumber}`)
                    .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)`);
            } catch (e) { console.warn('Rollback activity log failed:', e.message); }

            return NextResponse.json({
                success: true,
                message: `ย้อนกลับไป v${snapshot.VersionNumber} สำเร็จ`,
                versionNumber: snapshot.VersionNumber,
            });

        } catch (dbError) {
            console.error('Rollback transaction error:', dbError);
            if (transaction) await transaction.rollback();
            throw dbError;
        }

    } catch (error) {
        console.error('Error rolling back version:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
