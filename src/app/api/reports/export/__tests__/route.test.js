import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
    connectToCompanyDB: vi.fn(),
    getCompanyLabel: vi.fn(() => 'Sonic Interfreight (SNI)'),
}));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/report-run', () => ({ prepareReportRun: vi.fn(), bindReportParameters: vi.fn() }));
vi.mock('@/lib/export-files', () => ({
    sweepExportFiles: vi.fn(async () => 0),
    createExportFile: vi.fn(async () => ({ id: 'export-1', dataPath: '/tmp/export-1.xlsx', metaPath: '/tmp/export-1.json' })),
    writeExportMeta: vi.fn(async () => {}),
    deleteExportFile: vi.fn(async () => {}),
}));
vi.mock('@/lib/report-export-stream', () => ({ streamQueryToXlsx: vi.fn() }));

import { POST } from '@/app/api/reports/export/route';
import { getSession } from '@/lib/auth';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';

let logged;
let companyRequest;
const today = () => new Date().toISOString().split('T')[0];
const params = [{ ParameterName: '@from', InputType: 'date' }];
const createRequest = (body, signal) => ({ json: async () => body, signal });

beforeEach(() => {
    vi.clearAllMocks();
    logged = [];
    companyRequest = { timeout: 0 };
    getSession.mockResolvedValue({ userId: 7, roleName: 'User', roleId: 3, allowedCompanies: [1] });
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => { logged.push({ text, inputs }); return { recordset: [] }; }),
            };
            return req;
        },
    });
    connectToCompanyDB.mockResolvedValue({ request: () => companyRequest });
    prepareReportRun.mockResolvedValue({ ok: true, tSqlQuery: 'SELECT 1', reportName: 'ยอดขาย A/B: "Q"', expectedParams: params });
    streamQueryToXlsx.mockResolvedValue(3);
});

describe('POST /api/reports/export', () => {
    it('returns 400 without reportId or companyId', async () => {
        expect((await POST(createRequest({ companyId: 1 }))).status).toBe(400);
        expect((await POST(createRequest({ reportId: 1 }))).status).toBe(400);
    });

    it('returns 401 without a session', async () => {
        getSession.mockResolvedValue(null);
        expect((await POST(createRequest({ reportId: 1, companyId: 1 }))).status).toBe(401);
        expect(createExportFile).not.toHaveBeenCalled();
    });

    it('passes the helper refusal through and creates no file', async () => {
        prepareReportRun.mockResolvedValue({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
        expect(createExportFile).not.toHaveBeenCalled();
    });

    it('streams the query into the export file and answers with a download id', async () => {
        const signal = new AbortController().signal;
        const parameters = { '@from': '2026-01-01' };
        const res = await POST(createRequest({ reportId: 5, companyId: 1, parameters }, signal));
        const data = await res.json();

        const fileName = `ยอดขาย A_B_ _Q__${today()}.xlsx`;
        expect(data).toEqual({ success: true, downloadId: 'export-1', fileName, rowCount: 3 });
        expect(sweepExportFiles.mock.invocationCallOrder[0]).toBeLessThan(createExportFile.mock.invocationCallOrder[0]);
        expect(companyRequest.timeout).toBe(120000);
        expect(bindReportParameters).toHaveBeenCalledWith(companyRequest, params, parameters);
        expect(streamQueryToXlsx).toHaveBeenCalledWith({ sqlRequest: companyRequest, query: 'SELECT 1', filePath: '/tmp/export-1.xlsx', signal });
        expect(writeExportMeta).toHaveBeenCalledWith('export-1', { userId: 7, fileName, createdAt: expect.any(String) });
        expect(deleteExportFile).not.toHaveBeenCalled();
    });

    it('logs EXPORT_EXCEL with the row count and parameters', async () => {
        await POST(createRequest({ reportId: 5, companyId: 1, parameters: { '@from': '2026-01-01' } }));
        const log = logged.find(entry => /INSERT INTO ActivityLogs/.test(entry.text));
        expect(log.inputs.ActionType).toBe('EXPORT_EXCEL');
        expect(log.inputs.Details).toBe('Export Excel "ยอดขาย A/B: "Q"" (Sonic Interfreight (SNI)) ได้ 3 แถว | @from=2026-01-01');
        expect(log.inputs.ChangeData).toBe(JSON.stringify({ parameters: { '@from': '2026-01-01' } }));
    });

    it('deletes the file and offers no download when there are no rows', async () => {
        streamQueryToXlsx.mockResolvedValue(0);
        const data = await (await POST(createRequest({ reportId: 5, companyId: 1 }))).json();
        expect(data).toEqual({ success: true, rowCount: 0 });
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
        expect(writeExportMeta).not.toHaveBeenCalled();
        expect(logged.some(entry => entry.inputs.ActionType === 'EXPORT_EXCEL')).toBe(true);
    });

    it('removes the partial file and answers 500 when streaming fails', async () => {
        streamQueryToXlsx.mockRejectedValue(new Error('Invalid column name'));
        const res = await POST(createRequest({ reportId: 5, companyId: 1 }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ success: false, message: 'ไม่สามารถส่งออกข้อมูลได้' });
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
        expect(writeExportMeta).not.toHaveBeenCalled();
    });
});
