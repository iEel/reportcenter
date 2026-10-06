import sql from 'mssql';

/**
 * The Audit Trail export query: every row matching `where` (from buildAuditFilter), newest first,
 * with Thai column headers. Company labels come from `companies` as bound parameters so the
 * sheet shows "SNI" rather than an id; an id missing from the list is shown as the number.
 */
export function auditExportQuery(where, companies = []) {
    const company = companies.length
        ? `CASE a.CompanyId ${companies.map((_, i) => `WHEN @ExportCompany${i} THEN @ExportCompanyLabel${i}`).join(' ')} ELSE CAST(a.CompanyId AS NVARCHAR(20)) END`
        : 'CAST(a.CompanyId AS NVARCHAR(20))';
    const query = `
        SELECT a.CreatedAt AS [วันที่], u.FullName AS [ผู้ใช้], a.ActionType AS [ประเภท],
               r.ReportName AS [รายงาน], ${company} AS [บริษัท], a.Details AS [รายละเอียด]
        FROM ActivityLogs a
        LEFT JOIN Users u ON a.UserId = u.UserId
        LEFT JOIN Reports r ON a.ReportId = r.ReportId
        ${where}
        ORDER BY a.CreatedAt DESC
    `;
    return {
        query,
        bind(request) {
            companies.forEach(({ companyId, label }, i) => {
                request.input(`ExportCompany${i}`, sql.Int, companyId);
                request.input(`ExportCompanyLabel${i}`, sql.NVarChar(100), label);
            });
            return request;
        },
    };
}
