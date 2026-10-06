import sql from 'mssql';

const MAX_KEYWORD = 100;

/** "%text%" for LIKE, with the LIKE wildcards in the text matched literally. */
export function likeContains(text) {
    return `%${text.replace(/[[%_]/g, ch => `[${ch}]`)}%`;
}

function toInt(value) {
    const number = parseInt(value);
    return Number.isInteger(number) ? number : null;
}

/**
 * WHERE clause and parameters for the audit trail filters. The keyword clause reads `u.*`, so every
 * query that uses `where` must LEFT JOIN Users u. Call `bind(request)` on each request that runs it.
 */
export function buildAuditFilter({ q, actionType, userId, reportId, companyId, dateFrom, dateTo } = {}) {
    const clauses = [];
    const inputs = [];
    const add = (clause, name, type, value) => {
        clauses.push(clause);
        inputs.push([name, type, value]);
    };

    const keyword = String(q ?? '').trim().slice(0, MAX_KEYWORD);
    if (keyword) add('(a.Details LIKE @Q OR u.FullName LIKE @Q OR u.Username LIKE @Q)', 'Q', sql.NVarChar(4 * MAX_KEYWORD), likeContains(keyword));
    if (actionType) add('a.ActionType = @ActionType', 'ActionType', sql.NVarChar(50), actionType);
    if (toInt(userId) !== null) add('a.UserId = @FilterUserId', 'FilterUserId', sql.Int, toInt(userId));
    if (toInt(reportId) !== null) add('a.ReportId = @FilterReportId', 'FilterReportId', sql.Int, toInt(reportId));
    if (toInt(companyId) !== null) add('a.CompanyId = @FilterCompanyId', 'FilterCompanyId', sql.Int, toInt(companyId));
    if (dateFrom) add('a.CreatedAt >= @DateFrom', 'DateFrom', sql.Date, dateFrom);
    if (dateTo) add('a.CreatedAt < DATEADD(DAY, 1, @DateTo)', 'DateTo', sql.Date, dateTo);

    return {
        where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
        bind(request) {
            for (const [name, type, value] of inputs) request.input(name, type, value);
            return request;
        },
    };
}
