import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('mssql', () => ({ default: { Int: 'Int', NVarChar: vi.fn(() => 'NVarChar') } }));

import { GET, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

const categories = [{ CategoryId: 1, CategoryName: 'Finance', ColorTag: 'blue', ReportCount: 1 }];
const reports = [
    { ReportId: 10, ReportName: 'Active', CategoryId: 1, IsActive: true, ReportType: 1, Description: 'Current report' },
    { ReportId: 11, ReportName: 'Inactive', CategoryId: 1, IsActive: false, ReportType: 2, Description: '' },
    { ReportId: 12, ReportName: 'No category', CategoryId: null, IsActive: true, ReportType: 1, Description: '' },
    { ReportId: 13, ReportName: 'Missing category', CategoryId: 99, IsActive: false, ReportType: 1, Description: '' },
];
let query;

beforeEach(() => {
    vi.resetAllMocks();
    getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
    query = vi.fn().mockImplementation(async statement => {
        if (statement.includes('FROM ReportCategories c')) return { recordset: categories };
        if (statement.includes('FROM Reports r')) {
            const selected = /WHERE r\.IsActive = 1/.test(statement)
                ? reports.filter(report => report.IsActive && report.CategoryId !== null)
                : reports;
            return { recordset: selected };
        }
        return { recordset: [] };
    });
    const request = { query, input: vi.fn().mockReturnThis() };
    connectToCentralDB.mockResolvedValue({ request: () => request });
});

describe('categories GET', () => {
    it('includes inactive reports and uncategorized reports for accurate admin detail and deletion counts', async () => {
        const response = await GET({});
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.categories[0]).toMatchObject({ ReportCount: 1, AllReportCount: 2, InactiveReportCount: 1 });
        expect(body.allReportsByCategory['1']).toEqual(reports.slice(0, 2));
        expect(body.allReportsByCategory.uncategorized).toEqual(reports.slice(2));
        expect(body.reportsByCategory['1']).toEqual([{ ReportId: 10, ReportName: 'Active' }]);
    });

    it('preserves the existing active-only response for a signed-in non-admin', async () => {
        getSession.mockResolvedValue({ userId: 2, roleName: 'User' });
        const body = await (await GET({})).json();
        expect(body.categories).toEqual(categories);
        expect(body.reportsByCategory).toEqual({ 1: [{ ReportId: 10, ReportName: 'Active' }] });
        expect(body.allReportsByCategory).toBeUndefined();
    });

    it('does not connect without a session', async () => {
        getSession.mockResolvedValue(null);
        expect((await GET({})).status).toBe(401);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('returns a failure instead of an empty successful list when loading fails', async () => {
        connectToCentralDB.mockRejectedValue(new Error('Test DB unavailable'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const response = await GET({});
        expect(response.status).toBe(500);
        expect((await response.json()).success).toBe(false);
        error.mockRestore();
    });
});

describe('category deletion compatibility', () => {
    it('unassigns all reports, including inactive ones, without deleting reports or their permissions', async () => {
        const response = await DELETE({ url: 'http://localhost/api/admin/categories?categoryId=1' });
        expect(response.status).toBe(200);
        expect(query.mock.calls.map(([statement]) => statement)).toEqual([
            'UPDATE Reports SET CategoryId = NULL WHERE CategoryId = @Id',
            'DELETE FROM ReportCategories WHERE CategoryId = @Id',
        ]);
    });
});
