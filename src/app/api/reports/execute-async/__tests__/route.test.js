import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state ──────────────────────────────────────────

let queryResults = [];
let queryIndex = 0;

function createMockPool() {
    return {
        request: () => {
            const req = {
                query: vi.fn(() => {
                    const result = queryResults[queryIndex] || { recordset: [] };
                    queryIndex++;
                    return Promise.resolve(result);
                }),
            };
            req.input = vi.fn(() => req);
            return req;
        },
    };
}

// ─── Module Mocks ───────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
    connectToCompanyDB: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
}));

vi.mock('@/lib/sql-validator', () => ({
    validateQuery: vi.fn(() => ({ safe: true })),
}));

// The background export is tested in src/lib/__tests__/report-job.test.js
vi.mock('@/lib/report-job', () => ({ runReportJob: vi.fn(async () => {}) }));

import { POST } from '@/app/api/reports/execute-async/route';
import { getSession } from '@/lib/auth';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { runReportJob } from '@/lib/report-job';

function createRequest(body) {
    return { json: () => Promise.resolve(body) };
}

describe('POST /api/reports/execute-async', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryIndex = 0;
        queryResults = [];
        getSession.mockResolvedValue({ userId: 2, username: 'user', roleId: 2, roleName: 'User', allowedCompanies: [1] });
        connectToCentralDB.mockImplementation(() => Promise.resolve(createMockPool()));
        connectToCompanyDB.mockImplementation(() => Promise.resolve(createMockPool()));
    });

    it('returns 401 when not logged in', async () => {
        getSession.mockResolvedValue(null);
        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(401);
    });

    it('returns 400 when companyId is missing', async () => {
        const res = await POST(createRequest({ reportId: 1 }));
        expect(res.status).toBe(400);
    });

    it('returns 403 and creates no job for a company the user is not allowed to read', async () => {
        const res = await POST(createRequest({ reportId: 1, companyId: 2 }));
        const data = await res.json();
        expect(res.status).toBe(403);
        expect(data.message).toMatch(/บริษัท/);
        expect(connectToCentralDB).not.toHaveBeenCalled();
        expect(connectToCompanyDB).not.toHaveBeenCalled();
    });

    it('applies the company check to admins too', async () => {
        getSession.mockResolvedValue({ userId: 1, username: 'admin', roleId: 1, roleName: 'Admin', allowedCompanies: [1] });
        const res = await POST(createRequest({ reportId: 1, companyId: '3' }));
        expect(res.status).toBe(403);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('returns 403 when the session carries no company list', async () => {
        getSession.mockResolvedValue({ userId: 1, username: 'admin', roleId: 1, roleName: 'Admin' });
        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(403);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('lets an allowed company continue to the report lookup', async () => {
        queryResults = [
            { recordset: [] }, // max_concurrent_jobs setting
            { recordset: [] }, // ReportJobs auto-create
            { recordset: [] }, // report lookup → not found
        ];
        const res = await POST(createRequest({ reportId: 99, companyId: '1' }));
        expect(res.status).toBe(404);
        expect(connectToCentralDB).toHaveBeenCalled();
    });

    it('queues the job and runs it in the background with the report details', async () => {
        queryResults = [
            { recordset: [] }, // max_concurrent_jobs setting
            { recordset: [] }, // ReportJobs auto-create
            { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'GL Data' }] },
            { recordset: [{ 1: 1 }] }, // role mapping
            { recordset: [{ ParameterName: '@from', InputType: 'date' }] },
            { recordset: [{ JobId: 27 }] }, // job insert
        ];
        const res = await POST(createRequest({ reportId: 5, companyId: '1', parameters: { '@from': '2026-09-01' } }));
        expect(await res.json()).toEqual({ success: true, jobId: 27 });
        await vi.waitFor(() => expect(runReportJob).toHaveBeenCalledWith({
            jobId: 27, userId: 2, companyId: '1', reportName: 'GL Data', tSqlQuery: 'SELECT 1',
            expectedParams: [{ ParameterName: '@from', InputType: 'date' }], parameters: { '@from': '2026-09-01' },
        }));
    });
});
