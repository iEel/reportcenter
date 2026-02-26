import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB, getCompanyLabel } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateQuery } from '@/lib/sql-validator';

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

        // 1.1 SQL Security Validation — block dangerous queries
        const validation = validateQuery(tSqlQuery);
        if (!validation.safe) {
            // Log blocked attempt
            try {
                const sess = await getSession(request);
                if (sess) {
                    await centralPool.request()
                        .input('UserId', sql.Int, sess.userId)
                        .input('ReportId', sql.Int, parseInt(reportId))
                        .input('ActionType', sql.NVarChar(50), 'BLOCKED_QUERY')
                        .input('Details', sql.NVarChar(500), `ถูกบล็อก: "${reportName}" — ${validation.reason}`)
                        .query(`INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)`);
                }
            } catch (e) { /* ignore log errors */ }
            return NextResponse.json({
                success: false,
                message: `คำสั่ง SQL ถูกบล็อกเนื่องจากมีคำสั่งที่ไม่อนุญาต: ${validation.reason}`
            }, { status: 403 });
        }

        // 1.5 Authorization — check user's role has access to this report
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = session.roleName?.toLowerCase() === 'admin';
        if (!isAdmin) {
            const accessCheck = await centralPool.request()
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('RoleId', sql.Int, session.roleId)
                .query('SELECT 1 FROM ReportRoleMapping WHERE ReportId = @ReportId AND RoleId = @RoleId');

            if (accessCheck.recordset.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' },
                    { status: 403 }
                );
            }
        }

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
        let usePagination = page && pageSize && !exportAll;
        let dataResult;
        let totalRows = 0;

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
                queryWithoutOrderBy = tSqlQuery.substring(0, finalOrderByIndex).trim();
                orderByClause = tSqlQuery.substring(finalOrderByIndex).trim();
            } else {
                queryWithoutOrderBy = tSqlQuery;
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
                totalRows = dataResult.recordset.length;

                // Apply client-side pagination
                const offset = (parseInt(page) - 1) * parseInt(pageSize);
                const paginatedData = dataResult.recordset.slice(offset, offset + parseInt(pageSize));
                dataResult = { recordset: paginatedData };

                // Skip the server-side pagination below
                usePagination = false;
            }

            if (usePagination) {
                // Paginated query — use ROW_NUMBER() for SQL Server 2005+ compatibility
                const offset = (parseInt(page) - 1) * parseInt(pageSize);
                const endRow = offset + parseInt(pageSize);
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
            }
        } else {
            // Full query (no pagination or export mode)
            const req = companyPool.request();
            bindParams(req);
            dataResult = await req.query(tSqlQuery);
            totalRows = dataResult.recordset.length;
        }

        // 5. Log Activity (non-blocking, don't fail if table doesn't exist)
        try {
            if (session) {
                const actionType = exportAll ? 'EXPORT_EXCEL' : 'EXECUTE_REPORT';
                const companyLabel = getCompanyLabel(companyId);

                // Build parameter summary for details
                let paramSummary = '';
                if (parameters && Object.keys(parameters).length > 0) {
                    const paramParts = Object.entries(parameters)
                        .filter(([, v]) => v !== undefined && v !== null && v !== '')
                        .map(([k, v]) => `${k}=${v}`);
                    if (paramParts.length > 0) paramSummary = ` | ${paramParts.join(', ')}`;
                }

                const details = exportAll
                    ? `Export Excel "${reportName}" (${companyLabel}) ได้ ${totalRows.toLocaleString()} แถว${paramSummary}`
                    : `รัน "${reportName}" (${companyLabel}) ได้ ${totalRows.toLocaleString()} แถว${paramSummary}`;

                // Store full parameter data in ChangeData for detailed audit
                const changeData = parameters && Object.keys(parameters).length > 0
                    ? JSON.stringify({ parameters })
                    : null;

                await centralPool.request()
                    .input('UserId', sql.Int, session.userId)
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .input('CompanyId', sql.Int, parseInt(companyId))
                    .input('ActionType', sql.NVarChar(50), actionType)
                    .input('Details', sql.NVarChar(sql.MAX), details)
                    .input('ChangeData', sql.NVarChar(sql.MAX), changeData)
                    .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details, @ChangeData)`);
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
        return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาดในการรันรายงาน" }, { status: 500 });
    }
}
