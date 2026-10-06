import sql from 'mssql';
import { validateQuery } from '@/lib/sql-validator';

/**
 * Checks every route that runs a report for a signed-in user must make, in this order:
 * report exists → SQL is safe → company allowed (every role) → role mapped (non-admins).
 * Keeps the central-DB query order that `execute` has always used.
 */
export async function prepareReportRun({ session, reportId, companyId, centralPool }) {
    const reportResult = await centralPool.request()
        .input('ReportId', sql.Int, parseInt(reportId))
        .query('SELECT TSqlQuery, ReportName FROM Reports WHERE ReportId = @ReportId');
    if (reportResult.recordset.length === 0) return { ok: false, status: 404, message: 'Report not found' };
    const { TSqlQuery: tSqlQuery, ReportName: reportName } = reportResult.recordset[0];

    const validation = validateQuery(tSqlQuery);
    if (!validation.safe) {
        try {
            await centralPool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('ActionType', sql.NVarChar(50), 'BLOCKED_QUERY')
                .input('Details', sql.NVarChar(500), `ถูกบล็อก: "${reportName}" — ${validation.reason}`)
                .query('INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)');
        } catch { /* logging must never change the answer */ }
        return { ok: false, status: 403, message: `คำสั่ง SQL ถูกบล็อกเนื่องจากมีคำสั่งที่ไม่อนุญาต: ${validation.reason}` };
    }

    const allowed = session.allowedCompanies || [];
    if (!allowed.includes(parseInt(companyId))) {
        return { ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' };
    }

    if (session.roleName?.toLowerCase() !== 'admin') {
        const accessCheck = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('RoleId', sql.Int, session.roleId)
            .query('SELECT 1 FROM ReportRoleMapping WHERE ReportId = @ReportId AND RoleId = @RoleId');
        if (accessCheck.recordset.length === 0) return { ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' };
    }

    const paramResult = await centralPool.request()
        .input('ReportId', sql.Int, parseInt(reportId))
        .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');
    return { ok: true, tSqlQuery, reportName, expectedParams: paramResult.recordset };
}

const MAX_NUMBER_SCALE = 8;

/**
 * SQL type for a 'number' report parameter: decimal(18, s) with s = the decimals in the value, so 12.5 reaches
 * SQL Server as 12.5. A bare sql.Decimal is declared decimal(18, 0) by tedious, which rounded 12.5 to 13;
 * whole numbers keep exactly that declaration, so CAST(@n AS varchar) and friends behave as before.
 */
export function numberParameterType(value) {
    const text = String(parseFloat(value));
    const decimals = text.includes('e') ? MAX_NUMBER_SCALE : (text.split('.')[1] || '').length;
    return sql.Decimal(18, Math.min(decimals, MAX_NUMBER_SCALE));
}

/** Bind the report's declared parameters; values the user left empty are sent as NULL. */
export function bindReportParameters(request, expectedParams, parameters) {
    if (!parameters) return;
    for (const expectedParam of expectedParams) {
        const paramName = expectedParam.ParameterName.replace('@', '');
        const value = parameters[expectedParam.ParameterName];
        if (value === undefined || value === '') {
            request.input(paramName, sql.NVarChar(sql.MAX), null);
            continue;
        }
        switch (expectedParam.InputType) {
            case 'date':
                request.input(paramName, sql.Date, value);
                break;
            case 'number':
                request.input(paramName, numberParameterType(value), parseFloat(value));
                break;
            default:
                request.input(paramName, sql.NVarChar(sql.MAX), value);
        }
    }
}
