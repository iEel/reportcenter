import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    try {
        const body = await request.json();
        const { reportId, companyId, parameters, page, pageSize, exportAll } = body;

        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: "ReportId and CompanyId are required" }, { status: 400 });
        }

        // 1. Fetch Report Query from Central Database
        const centralPool = await connectToCentralDB();
        const reportResult = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query('SELECT TSqlQuery, ReportName FROM Reports WHERE ReportId = @ReportId');

        if (reportResult.recordset.length === 0) {
            return NextResponse.json({ success: false, message: "Report not found" }, { status: 404 });
        }

        const tSqlQuery = reportResult.recordset[0].TSqlQuery;
        const reportName = reportResult.recordset[0].ReportName;

        // 2. Fetch Expected Parameters from Central Database to ensure type safety (basic protection)
        const paramResult = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');

        const expectedParams = paramResult.recordset;

        // 3. Get connection to the specified Company Database
        const companyPool = await connectToCompanyDB(companyId);

        // Helper: bind parameters to a request
        const bindParams = (req) => {
            if (parameters && expectedParams.length > 0) {
                for (const expectedParam of expectedParams) {
                    const paramName = expectedParam.ParameterName.replace('@', '');
                    let value = parameters[expectedParam.ParameterName];

                    if (value !== undefined && value !== '') {
                        switch (expectedParam.InputType) {
                            case 'date':
                                req.input(paramName, sql.Date, value);
                                break;
                            case 'number':
                                req.input(paramName, sql.Decimal, parseFloat(value));
                                break;
                            default:
                                req.input(paramName, sql.NVarChar(sql.MAX), value);
                        }
                    } else {
                        req.input(paramName, sql.NVarChar(sql.MAX), null);
                    }
                }
            }
        };

        // 4. Execute — with or without pagination
        const usePagination = page && pageSize && !exportAll;
        let dataResult;
        let totalRows = 0;

        if (usePagination) {
            // Count total rows first
            const countReq = companyPool.request();
            bindParams(countReq);
            const countResult = await countReq.query(`SELECT COUNT(*) AS total FROM (${tSqlQuery}) AS _countQuery`);
            totalRows = countResult.recordset[0].total;

            // Paginated query using OFFSET/FETCH
            const offset = (parseInt(page) - 1) * parseInt(pageSize);
            const dataReq = companyPool.request();
            bindParams(dataReq);
            dataReq.input('_offset', sql.Int, offset);
            dataReq.input('_pageSize', sql.Int, parseInt(pageSize));
            dataResult = await dataReq.query(
                `SELECT * FROM (${tSqlQuery}) AS _paged ORDER BY (SELECT NULL) OFFSET @_offset ROWS FETCH NEXT @_pageSize ROWS ONLY`
            );
        } else {
            // Full query (no pagination or export mode)
            const req = companyPool.request();
            bindParams(req);
            dataResult = await req.query(tSqlQuery);
            totalRows = dataResult.recordset.length;
        }

        // 5. Log Activity (non-blocking, don't fail if table doesn't exist)
        try {
            const session = await getSession(request);
            if (session) {
                const actionType = exportAll ? 'EXPORT_EXCEL' : 'EXECUTE_REPORT';
                const details = exportAll
                    ? `Export Excel "${reportName}" (บริษัท ${companyId}) ได้ ${totalRows} แถว`
                    : `รัน "${reportName}" (บริษัท ${companyId}) ได้ ${totalRows} แถว`;
                await centralPool.request()
                    .input('UserId', sql.Int, session.userId)
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .input('CompanyId', sql.Int, parseInt(companyId))
                    .input('ActionType', sql.NVarChar(50), actionType)
                    .input('Details', sql.NVarChar(500), details)
                    .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details)`);
            }
        } catch (logErr) {
            // Silently fail — logging should never break execution
            console.warn('Activity log failed (table may not exist):', logErr.message);
        }

        return NextResponse.json({
            success: true,
            data: dataResult.recordset,
            totalRows,
            page: usePagination ? parseInt(page) : 1,
            pageSize: usePagination ? parseInt(pageSize) : totalRows,
        });

    } catch (error) {
        console.error("Error executing report:", error);
        return NextResponse.json({ success: false, message: "Failed to execute report query", error: error.message }, { status: 500 });
    }
}
