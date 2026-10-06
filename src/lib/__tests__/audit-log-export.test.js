import { describe, it, expect, vi } from 'vitest';
import { auditExportQuery } from '@/lib/audit-log-export';

function fakeRequest() {
    const inputs = {};
    const req = { input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }) };
    return { req, inputs };
}

describe('auditExportQuery', () => {
    it('selects the export columns in sheet order under the filter, newest first', () => {
        const { query } = auditExportQuery('WHERE a.ActionType = @ActionType', []);
        const columns = [...query.matchAll(/AS \[([^\]]+)\]/g)].map(m => m[1]);
        expect(columns).toEqual(['วันที่', 'ผู้ใช้', 'ประเภท', 'รายงาน', 'บริษัท', 'รายละเอียด']);
        expect(query).toMatch(/LEFT JOIN Users u ON a\.UserId = u\.UserId/);
        expect(query).toMatch(/LEFT JOIN Reports r ON a\.ReportId = r\.ReportId/);
        expect(query).toMatch(/WHERE a\.ActionType = @ActionType\s+ORDER BY a\.CreatedAt DESC/);
    });

    it('shows company labels through bound parameters, falling back to the id', () => {
        const { query, bind } = auditExportQuery('', [
            { companyId: 1, label: 'SNI' },
            { companyId: 2, label: "O'Brien" },
        ]);
        const { req, inputs } = fakeRequest();
        expect(bind(req)).toBe(req);
        expect(query).toMatch(/CASE a\.CompanyId WHEN @ExportCompany0 THEN @ExportCompanyLabel0 WHEN @ExportCompany1 THEN @ExportCompanyLabel1 ELSE CAST\(a\.CompanyId AS NVARCHAR\(20\)\) END AS \[บริษัท\]/);
        expect(query).not.toContain("O'Brien");
        expect(inputs).toEqual({ ExportCompany0: 1, ExportCompanyLabel0: 'SNI', ExportCompany1: 2, ExportCompanyLabel1: "O'Brien" });
    });

    it('shows the company id when no company list is available', () => {
        const { query, bind } = auditExportQuery('', []);
        const { req, inputs } = fakeRequest();
        bind(req);
        expect(query).toMatch(/CAST\(a\.CompanyId AS NVARCHAR\(20\)\) AS \[บริษัท\]/);
        expect(inputs).toEqual({});
    });
});
