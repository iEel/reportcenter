import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state ──────────────────────────────────────────

let queryResults = [];
let queryIndex = 0;

const mockInput = vi.fn(function () { return this; });

function createMockPool() {
    return {
        request: () => ({
            input: mockInput,
            timeout: 0,
            query: vi.fn(() => {
                const result = queryResults[queryIndex] || { recordset: [] };
                queryIndex++;
                return Promise.resolve(result);
            }),
        }),
    };
}

// ─── Module Mocks ───────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
    connectToCompanyDB: vi.fn(),
    getCompanyLabel: vi.fn(() => 'TestCompany'),
}));

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
}));

vi.mock('@/lib/sql-validator', () => ({
    validateQuery: vi.fn(() => ({ safe: true })),
}));

import { POST } from '@/app/api/reports/execute/route';
import { getSession } from '@/lib/auth';
import { validateQuery } from '@/lib/sql-validator';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';

// Helper
function createRequest(body) {
    return { json: () => Promise.resolve(body) };
}

describe('POST /api/reports/execute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryIndex = 0;
        queryResults = [];
        getSession.mockResolvedValue({ userId: 1, username: 'admin', roleId: 1, roleName: 'Admin' });
        validateQuery.mockReturnValue({ safe: true });
        connectToCentralDB.mockImplementation(() => Promise.resolve(createMockPool()));
        connectToCompanyDB.mockImplementation(() => Promise.resolve(createMockPool()));
    });

    // ─── Validation ─────────────────────────────────────────────

    it('returns 400 when reportId is missing', async () => {
        const res = await POST(createRequest({ companyId: 1 }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when companyId is missing', async () => {
        const res = await POST(createRequest({ reportId: 1 }));
        expect(res.status).toBe(400);
    });

    // ─── Report Not Found ───────────────────────────────────────

    it('returns 404 when report does not exist', async () => {
        queryResults = [{ recordset: [] }]; // report lookup

        const res = await POST(createRequest({ reportId: 999, companyId: 1 }));
        expect(res.status).toBe(404);
    });

    // ─── SQL Validator ──────────────────────────────────────────

    it('returns 403 when query contains blocked commands', async () => {
        queryResults = [
            { recordset: [{ TSqlQuery: 'DROP TABLE Users', ReportName: 'Evil' }] },
        ];
        validateQuery.mockReturnValue({ safe: false, reason: 'พบคำสั่งต้องห้าม: DROP', blockedTerm: 'DROP' });

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        const data = await res.json();
        expect(res.status).toBe(403);
        expect(data.message).toMatch(/บล็อก|ไม่อนุญาต/);
        expect(validateQuery).toHaveBeenCalledWith('DROP TABLE Users');
    });

    it('passes the report TSqlQuery to validateQuery', async () => {
        queryResults = [
            { recordset: [{ TSqlQuery: 'SELECT * FROM Orders', ReportName: 'Orders' }] },
            { recordset: [] }, // params
            { recordset: [{ col: 'val' }] }, // data result
            { recordset: [] }, // activity log
        ];

        await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(validateQuery).toHaveBeenCalledWith('SELECT * FROM Orders');
    });

    // ─── Authentication ─────────────────────────────────────────

    it('returns 401 when session is invalid', async () => {
        getSession.mockResolvedValue(null);
        queryResults = [
            { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'Test' }] },
        ];

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(401);
    });

    it('returns 403 when non-admin lacks role mapping', async () => {
        getSession.mockResolvedValue({ userId: 2, username: 'user', roleId: 2, roleName: 'User' });
        queryResults = [
            { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'Test' }] },
            { recordset: [] }, // access check fails
        ];

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(403);
    });

    // ─── Success ────────────────────────────────────────────────

    it('returns data on successful execution', async () => {
        const reportData = [{ id: 1 }, { id: 2 }];
        queryResults = [
            { recordset: [{ TSqlQuery: 'SELECT * FROM X', ReportName: 'Test' }] },
            { recordset: [] }, // params
            { recordset: reportData }, // data
            { recordset: [] }, // activity log
        ];

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(reportData);
        expect(data.totalRows).toBe(2);
    });

    it('admin bypasses role mapping check', async () => {
        queryResults = [
            { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'T' }] },
            { recordset: [] }, // params
            { recordset: [] }, // data
            { recordset: [] }, // activity log
        ];

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(200);
    });

    // ─── Server Error ───────────────────────────────────────────

    it('returns 500 on unexpected error', async () => {
        connectToCentralDB.mockRejectedValue(new Error('DB crash'));

        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(500);
    });
});
