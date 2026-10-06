import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn(), getCompanyList: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/export-files', () => ({
    sweepExportFiles: vi.fn(async () => 0),
    createExportFile: vi.fn(async () => ({ id: 'export-1', dataPath: '/tmp/export-1.xlsx', metaPath: '/tmp/export-1.json' })),
    writeExportMeta: vi.fn(async () => {}),
    deleteExportFile: vi.fn(async () => {}),
}));
vi.mock('@/lib/report-export-stream', () => ({ streamQueryToXlsx: vi.fn() }));

import { POST } from '@/app/api/admin/audit-logs/export/route';
import { connectToCentralDB, getCompanyList } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';

let inputs;
const today = () => new Date().toISOString().split('T')[0];
const createRequest = (body, signal) => ({ json: async () => body, signal });

beforeEach(() => {
    vi.clearAllMocks();
    inputs = {};
    getSession.mockResolvedValue({ userId: 1, roleName: 'Admin' });
    getCompanyList.mockResolvedValue([{ companyId: 1, label: 'SNI', name: 'Sonic Interfreight' }]);
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const req = { timeout: 0, input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }) };
            return req;
        },
    });
    streamQueryToXlsx.mockResolvedValue(42);
});

describe('POST /api/admin/audit-logs/export', () => {
    it('refuses non-admins and creates no file', async () => {
        getSession.mockResolvedValue({ userId: 2, roleName: 'User' });
        expect((await POST(createRequest({}))).status).toBe(401);
        expect(createExportFile).not.toHaveBeenCalled();
    });

    it('streams every row matching the filters into the export file and answers with a download id', async () => {
        const signal = new AbortController().signal;
        const res = await POST(createRequest({ q: ' AP ', companyId: '1', userId: '', dateFrom: '' }, signal));
        const data = await res.json();

        const fileName = `audit_logs_${today()}.xlsx`;
        expect(data).toEqual({ success: true, downloadId: 'export-1', fileName, rowCount: 42 });
        expect(sweepExportFiles.mock.invocationCallOrder[0]).toBeLessThan(createExportFile.mock.invocationCallOrder[0]);

        const [{ sqlRequest, query, filePath, signal: passedSignal, sheetName }] = streamQueryToXlsx.mock.calls[0];
        expect(query).toMatch(/WHERE \(a\.Details LIKE @Q OR u\.FullName LIKE @Q OR u\.Username LIKE @Q\) AND a\.CompanyId = @FilterCompanyId/);
        expect(query).not.toMatch(/OFFSET|FETCH/);
        expect(inputs).toEqual({ Q: '%AP%', FilterCompanyId: 1, ExportCompany0: 1, ExportCompanyLabel0: 'SNI' });
        expect(sqlRequest.timeout).toBe(120000);
        expect(filePath).toBe('/tmp/export-1.xlsx');
        expect(passedSignal).toBe(signal);
        expect(sheetName).toBe('Audit Logs');
        expect(writeExportMeta).toHaveBeenCalledWith('export-1', expect.objectContaining({ userId: 1, fileName }));
        expect(deleteExportFile).not.toHaveBeenCalled();
    });

    it('deletes the file and offers no download when nothing matches', async () => {
        streamQueryToXlsx.mockResolvedValue(0);
        const data = await (await POST(createRequest({ q: 'nothing' }))).json();
        expect(data).toEqual({ success: true, rowCount: 0 });
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
        expect(writeExportMeta).not.toHaveBeenCalled();
    });

    it('deletes the partial file when the export fails', async () => {
        streamQueryToXlsx.mockRejectedValue(new Error('SQL timeout'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await POST(createRequest({}));
        expect(res.status).toBe(500);
        expect((await res.json()).success).toBe(false);
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
    });
});
