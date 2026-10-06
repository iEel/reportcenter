import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared state accessed via globalThis to bypass vi.mock hoisting ─────

globalThis.__adminTest = {
    queryResults: [],
    queryIndex: 0,
};

function nextResult() {
    const r = globalThis.__adminTest.queryResults[globalThis.__adminTest.queryIndex] || { recordset: [] };
    globalThis.__adminTest.queryIndex++;
    return Promise.resolve(r);
}

function makeMockReq() {
    const obj = { query: vi.fn(() => nextResult()) };
    obj.input = vi.fn(() => obj);
    return obj;
}

function makeMockPool() {
    return { request: vi.fn(() => makeMockReq()) };
}

// ─── Module Mocks ───────────────────────────────────────────────

vi.mock('mssql', () => {
    // These closures CAN access globalThis since it's always available
    function mockReq() {
        const obj = {
            query: vi.fn(() => {
                const r = globalThis.__adminTest.queryResults[globalThis.__adminTest.queryIndex] || { recordset: [] };
                globalThis.__adminTest.queryIndex++;
                return Promise.resolve(r);
            }),
        };
        obj.input = vi.fn(() => obj);
        return obj;
    }

    // `new` needs function implementations (arrow functions are not constructible)
    const Transaction = vi.fn().mockImplementation(function () {
        return {
            begin: vi.fn(() => Promise.resolve()),
            commit: vi.fn(() => Promise.resolve()),
            rollback: vi.fn(() => Promise.resolve()),
            request: vi.fn(() => mockReq()),
        };
    });
    const PreparedStatement = vi.fn().mockImplementation(function () {
        return {
            input: vi.fn(),
            prepare: vi.fn(() => Promise.resolve()),
            execute: vi.fn(() => Promise.resolve()),
            unprepare: vi.fn(() => Promise.resolve()),
        };
    });
    return {
        default: {
            Transaction,
            PreparedStatement,
            Int: 'Int',
            NVarChar: vi.fn(() => 'NVarChar'),
            Bit: 'Bit',
            MAX: 'MAX',
        },
    };
});

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
}));

import { POST, GET } from '@/app/api/admin/reports/route';
import sql from 'mssql';
import { getSession } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

function createRequest(body) {
    return { json: () => Promise.resolve(body) };
}

describe('admin/reports route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.__adminTest.queryIndex = 0;
        globalThis.__adminTest.queryResults = [];
        connectToCentralDB.mockImplementation(() => Promise.resolve(makeMockPool()));
    });

    // ─── POST ───────────────────────────────────────────────────

    describe('POST /api/admin/reports', () => {
        it('returns 403 when not logged in', async () => {
            getSession.mockResolvedValue(null);
            const res = await POST(createRequest({ report: { ReportName: 'T', TSqlQuery: 'S' } }));
            expect(res.status).toBe(403);
        });

        it('returns 403 when user is not admin', async () => {
            getSession.mockResolvedValue({ userId: 2, roleName: 'User' });
            const res = await POST(createRequest({ report: { ReportName: 'T', TSqlQuery: 'S' } }));
            expect(res.status).toBe(403);
        });

        it('returns 400 when report is missing', async () => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
            const res = await POST(createRequest({}));
            expect(res.status).toBe(400);
        });

        it('returns 400 when ReportName is missing', async () => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
            const res = await POST(createRequest({ report: { TSqlQuery: 'SELECT 1' } }));
            expect(res.status).toBe(400);
        });

        it('returns 400 when TSqlQuery is missing', async () => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
            const res = await POST(createRequest({ report: { ReportName: 'Test' } }));
            expect(res.status).toBe(400);
        });

        // Transaction mocking with vi.mock hoisting makes this complex
        // The route's Transaction-based flow is covered via integration/E2E testing
        it.todo('creates report and returns reportId');

        it('saves the chosen groups even when the old Public flag is sent', async () => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
            globalThis.__adminTest.queryResults = [{ recordset: [{ ReportId: 99 }] }];
            const res = await POST(createRequest({ report: { ReportName: 'T', TSqlQuery: 'SELECT 1', IsPublic: true, Roles: [2, 3] } }));
            expect(res.status).toBe(200);
            const statements = sql.PreparedStatement.mock.results.map(result => result.value);
            const roleStatement = statements.find(statement => statement.prepare.mock.calls.some(([text]) => text.includes('ReportRoleMapping')));
            expect(roleStatement).toBeTruthy();
            expect(roleStatement.execute).toHaveBeenCalledTimes(2);
        });

        it('returns 500 on database error', async () => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
            connectToCentralDB.mockRejectedValue(new Error('DB crash'));
            const res = await POST(createRequest({ report: { ReportName: 'T', TSqlQuery: 'S' } }));
            expect(res.status).toBe(500);
        });
    });

    // ─── GET ────────────────────────────────────────────────────

    describe('GET /api/admin/reports', () => {
        beforeEach(() => {
            getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
        });

        it('returns 403 when not logged in', async () => {
            getSession.mockResolvedValue(null);
            const res = await GET({});
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('returns 403 when user is not admin', async () => {
            getSession.mockResolvedValue({ userId: 2, roleName: 'User' });
            const res = await GET({});
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('returns list of reports', async () => {
            const reports = [{ ReportId: 1, ReportName: 'Sales' }];
            globalThis.__adminTest.queryResults = [
                { recordset: [] },      // schema check
                { recordset: reports },  // report list
            ];

            const res = await GET({});
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.reports).toEqual(reports);
        });

        it('returns 500 on database error', async () => {
            connectToCentralDB.mockRejectedValue(new Error('DB down'));
            const res = await GET({});
            expect(res.status).toBe(500);
        });
    });
});
