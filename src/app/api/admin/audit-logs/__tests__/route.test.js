import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn(), getCompanyList: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { GET } from '@/app/api/admin/audit-logs/route';
import { connectToCentralDB, getCompanyList } from '@/lib/db';
import { getSession } from '@/lib/auth';

let queries;

function answer(text) {
    if (/COUNT\(\*\) AS total/.test(text)) return { recordset: [{ total: 1 }] };
    if (/FROM ActivityLogs a/.test(text)) return { recordset: [{ LogId: 1, ActionType: 'EXPORT_EXCEL', Details: 'Export Excel "AP"' }] };
    if (/DISTINCT ActionType/.test(text)) return { recordset: [{ ActionType: 'EXPORT_EXCEL' }] };
    if (/FROM Users/.test(text)) return { recordset: [{ UserId: 7, FullName: 'System Admin' }] };
    if (/FROM Reports/.test(text)) return { recordset: [{ ReportId: 12, ReportName: 'AP Aged Balance' }] };
    return { recordset: [] };
}

const get = query => GET({ url: `http://localhost/api/admin/audit-logs?${query}` });

beforeEach(() => {
    vi.clearAllMocks();
    queries = [];
    getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
    getCompanyList.mockResolvedValue([{ companyId: 1, label: 'Sonic Interfreight (SNI)', name: 'SNI' }]);
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => { queries.push({ text, inputs }); return answer(text); }),
            };
            return req;
        },
    });
});

describe('GET /api/admin/audit-logs', () => {
    it('refuses non-admins', async () => {
        getSession.mockResolvedValue({ userId: 2, roleName: 'User' });
        expect((await get('page=1')).status).toBe(401);
    });

    it('searches the keyword in both the count and the page query, joining users in each', async () => {
        await get('page=1&pageSize=30&q=AP%2050%25');
        const count = queries.find(q => /COUNT\(\*\) AS total/.test(q.text));
        const page = queries.find(q => /OFFSET @Offset/.test(q.text));
        for (const q of [count, page]) {
            expect(q.text).toMatch(/LEFT JOIN Users u ON a\.UserId = u\.UserId/);
            expect(q.text).toMatch(/a\.Details LIKE @Q/);
            expect(q.inputs.Q).toBe('%AP 50[%]%');
        }
    });

    it('filters by report and company', async () => {
        await get('page=1&reportId=12&companyId=1');
        const page = queries.find(q => /OFFSET @Offset/.test(q.text));
        expect(page.text).toMatch(/a\.ReportId = @FilterReportId AND a\.CompanyId = @FilterCompanyId/);
        expect(page.inputs).toMatchObject({ FilterReportId: 12, FilterCompanyId: 1 });
    });

    it('returns the reports and companies the new filters offer', async () => {
        const data = await (await get('page=1')).json();
        expect(data.reports).toEqual([{ ReportId: 12, ReportName: 'AP Aged Balance' }]);
        expect(data.companies).toEqual([{ companyId: 1, label: 'Sonic Interfreight (SNI)' }]);
        expect(data.totalRows).toBe(1);
    });
});
