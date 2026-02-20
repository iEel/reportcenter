import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    try {
        const body = await request.json();
        const { reportId, companyId, parameters } = body;

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

        // 4. Prepare and Execute the Query securely
        const requestToExecute = companyPool.request();

        // Bind parameters safely based on the expected types
        if (parameters && expectedParams.length > 0) {
            for (const expectedParam of expectedParams) {
                const paramName = expectedParam.ParameterName.replace('@', '');
                let value = parameters[expectedParam.ParameterName];

                if (value !== undefined && value !== '') {
                    switch (expectedParam.InputType) {
                        case 'date':
                            requestToExecute.input(paramName, sql.Date, value);
                            break;
                        case 'number':
                            requestToExecute.input(paramName, sql.Decimal, parseFloat(value));
                            break;
                        default:
                            requestToExecute.input(paramName, sql.NVarChar(sql.MAX), value);
                    }
                } else {
                    requestToExecute.input(paramName, sql.NVarChar(sql.MAX), null);
                }
            }
        }

        // Execute the actual report query
        const dataResult = await requestToExecute.query(tSqlQuery);

        // 5. Log Activity (non-blocking, don't fail if table doesn't exist)
        try {
            const session = await getSession(request);
            if (session) {
                await centralPool.request()
                    .input('UserId', sql.Int, session.userId)
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .input('CompanyId', sql.Int, parseInt(companyId))
                    .input('ActionType', sql.NVarChar(50), 'EXECUTE_REPORT')
                    .input('Details', sql.NVarChar(500), `รัน "${reportName}" (บริษัท ${companyId}) ได้ ${dataResult.recordset.length} แถว`)
                    .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details)`);
            }
        } catch (logErr) {
            // Silently fail — logging should never break execution
            console.warn('Activity log failed (table may not exist):', logErr.message);
        }

        return NextResponse.json({ success: true, data: dataResult.recordset });

    } catch (error) {
        console.error("Error executing report:", error);
        return NextResponse.json({ success: false, message: "Failed to execute report query", error: error.message }, { status: 500 });
    }
}
