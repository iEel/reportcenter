import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB, getCompanyLabel } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { orderedColumns } from '@/lib/report-columns';

// Report queries can be complex — allow longer timeout (default 120s)
const REPORT_TIMEOUT = parseInt(process.env.REPORT_REQUEST_TIMEOUT) || 120000;

export async function POST(request) {
    try {
        const body = await request.json();
        const { reportId, companyId, parameters, page, pageSize } = body;

        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: "ReportId and CompanyId are required" }, { status: 400 });
        }

        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const centralPool = await connectToCentralDB();
        const run = await prepareReportRun({ session, reportId, companyId, centralPool });
        if (!run.ok) {
            return NextResponse.json({ success: false, message: run.message }, { status: run.status });
        }
        const { tSqlQuery, reportName, expectedParams } = run;

        const companyPool = await connectToCompanyDB(companyId);

        // Bind parameters to a request + set report timeout
        const bindParams = (req) => {
            req.timeout = REPORT_TIMEOUT;
            bindReportParameters(req, expectedParams, parameters);
        };

        // 4. Execute — with or without pagination
        let usePagination = page && pageSize;
        let dataResult;
        let totalRows = 0;

        // Track column order from SQL — must capture BEFORE .slice() strips metadata
        let capturedColumns = null;
        const captureColumns = (result) => {
            if (capturedColumns) return; // already captured
            const meta = result?.recordset?.columns;
            if (meta) capturedColumns = orderedColumns(meta);
        };

        if (usePagination) {
            // Detect CTE queries (start with ;WITH or WITH)
            const isCTE = /^\s*;?\s*WITH\b/i.test(tSqlQuery.trim());

            // Find the FINAL ORDER BY (not ones inside OVER(), subqueries, or CTEs)
            // Strategy: find the last ORDER BY that is NOT inside parentheses
            let finalOrderByIndex = -1;
            let parenDepth = 0;
            const upperQuery = tSqlQuery.toUpperCase();
            for (let i = 0; i < upperQuery.length; i++) {
                if (upperQuery[i] === '(') parenDepth++;
                else if (upperQuery[i] === ')') parenDepth--;
                else if (parenDepth === 0 && upperQuery.substring(i).match(/^ORDER\s+BY\b/i)) {
                    finalOrderByIndex = i;
                }
            }

            let queryWithoutOrderBy, orderByClause;
            if (finalOrderByIndex >= 0) {
                queryWithoutOrderBy = tSqlQuery.substring(0, finalOrderByIndex).trim().replace(/;\s*$/, '');
                orderByClause = tSqlQuery.substring(finalOrderByIndex).trim().replace(/;\s*$/, '');
            } else {
                queryWithoutOrderBy = tSqlQuery.replace(/;\s*$/, '');
                orderByClause = 'ORDER BY (SELECT NULL)';
            }

            // Count total rows — CTE needs different wrapping
            const countReq = companyPool.request();
            bindParams(countReq);
            let countSql;
            if (isCTE) {
                // For CTE: append a SELECT COUNT(*) as a new final query
                countSql = `${queryWithoutOrderBy.replace(/;\s*$/, '')}
                    SELECT COUNT(*) AS total FROM (${queryWithoutOrderBy.substring(queryWithoutOrderBy.lastIndexOf('SELECT'))}) AS _cq`;
                // Actually, simpler: wrap the whole CTE result in a count
                // Re-approach: use the full query without ORDER BY, wrap with count
                countSql = `SELECT COUNT(*) AS total FROM (${queryWithoutOrderBy}) AS _countQuery`;
            } else {
                countSql = `SELECT COUNT(*) AS total FROM (${queryWithoutOrderBy}) AS _countQuery`;
            }

            try {
                const countResult = await countReq.query(countSql);
                totalRows = countResult.recordset[0].total;
            } catch (countErr) {
                // If count fails (complex CTE), run full query and count client-side
                console.warn('Count query failed, falling back to full query:', countErr.message);
                const fallbackReq = companyPool.request();
                bindParams(fallbackReq);
                dataResult = await fallbackReq.query(tSqlQuery);
                captureColumns(dataResult); // capture BEFORE slicing
                totalRows = dataResult.recordset.length;

                // Apply client-side pagination
                const offset = (parseInt(page) - 1) * parseInt(pageSize);
                const paginatedData = dataResult.recordset.slice(offset, offset + parseInt(pageSize));
                dataResult = { recordset: paginatedData };

                // Skip the server-side pagination below
                usePagination = false;
            }

            if (usePagination) {
                // Paginated query — try ROW_NUMBER(), fallback to client-side if complex query fails
                const offset = (parseInt(page) - 1) * parseInt(pageSize);
                const endRow = offset + parseInt(pageSize);
                try {
                    const dataReq = companyPool.request();
                    bindParams(dataReq);
                    dataReq.input('_startRow', sql.Int, offset + 1);
                    dataReq.input('_endRow', sql.Int, endRow);
                    dataResult = await dataReq.query(
                        `SELECT * FROM (
                            SELECT *, ROW_NUMBER() OVER (${orderByClause}) AS _rowNum
                            FROM (${queryWithoutOrderBy}) AS _innerQuery
                        ) AS _pagedQuery
                        WHERE _rowNum BETWEEN @_startRow AND @_endRow
                        ORDER BY _rowNum`
                    );
                    captureColumns(dataResult);
                } catch (paginationErr) {
                    // Fallback: run original full query, paginate client-side
                    console.warn('ROW_NUMBER pagination failed, falling back to client-side:', paginationErr.message);
                    const fallbackReq = companyPool.request();
                    bindParams(fallbackReq);
                    dataResult = await fallbackReq.query(tSqlQuery);
                    captureColumns(dataResult); // capture BEFORE slicing
                    totalRows = dataResult.recordset.length;
                    const paginatedData = dataResult.recordset.slice(offset, offset + parseInt(pageSize));
                    dataResult = { recordset: paginatedData };
                }
            }
        } else {
            // Full query (no pagination or export mode)
            const req = companyPool.request();
            bindParams(req);
            dataResult = await req.query(tSqlQuery);
            captureColumns(dataResult);
            totalRows = dataResult.recordset.length;
        }

        // 5. Log Activity (non-blocking, don't fail if table doesn't exist)
        try {
            const companyLabel = getCompanyLabel(companyId);
            let paramSummary = '';
            if (parameters && Object.keys(parameters).length > 0) {
                const paramParts = Object.entries(parameters)
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => `${k}=${v}`);
                if (paramParts.length > 0) paramSummary = ` | ${paramParts.join(', ')}`;
            }
            const changeData = parameters && Object.keys(parameters).length > 0
                ? JSON.stringify({ parameters })
                : null;

            await centralPool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('CompanyId', sql.Int, parseInt(companyId))
                .input('ActionType', sql.NVarChar(50), 'EXECUTE_REPORT')
                .input('Details', sql.NVarChar(sql.MAX), `รัน "${reportName}" (${companyLabel}) ได้ ${totalRows.toLocaleString()} แถว${paramSummary}`)
                .input('ChangeData', sql.NVarChar(sql.MAX), changeData)
                .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details, @ChangeData)`);
        } catch (logErr) {
            // Silently fail — logging should never break execution
            console.warn('Activity log failed (table may not exist):', logErr.message);
        }

        // Use captured column order, fallback to Object.keys if metadata wasn't available
        const columns = capturedColumns
            || (dataResult.recordset.length > 0 ? Object.keys(dataResult.recordset[0]) : []);

        return NextResponse.json({
            success: true,
            data: dataResult.recordset,
            columns,
            totalRows,
            page: usePagination ? parseInt(page) : 1,
            pageSize: usePagination ? parseInt(pageSize) : totalRows,
        });

    } catch (error) {
        console.error("Error executing report:", error);
        return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาดในการรันรายงาน" }, { status: 500 });
    }
}
