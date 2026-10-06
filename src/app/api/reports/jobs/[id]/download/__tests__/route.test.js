import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { GET, HEAD } from '@/app/api/reports/jobs/[id]/download/route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

let jobRow;
const props = { params: Promise.resolve({ id: '12' }) };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-download-'));

function job(fileName, contents = 'a,b\n1,2\n') {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, contents);
    return { FilePath: filePath, FileName: fileName, Status: 'done' };
}

beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: 7 });
    jobRow = job('ยอดขาย_2026-10-06_job12.csv');
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const req = { input: vi.fn(() => req), query: vi.fn(async () => ({ recordset: jobRow ? [jobRow] : [] })) };
            return req;
        },
    });
});

describe('job file download', () => {
    it('streams a CSV with its content type, length and Thai file name', async () => {
        const res = await GET({}, props);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
        expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength('a,b\n1,2\n')));
        expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('ยอดขาย_2026-10-06_job12.csv')}`);
        expect(await res.text()).toBe('a,b\n1,2\n');
    });

    it('labels an .xlsx job file as Excel', async () => {
        jobRow = job('r_job12.xlsx', 'PK');
        expect((await GET({}, props)).headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('answers HEAD with the same headers and no body', async () => {
        const res = await HEAD({}, props);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength('a,b\n1,2\n')));
        expect(res.body).toBeNull();
    });

    it.each([
        ['no session', () => getSession.mockResolvedValue(null), 401],
        ['unknown job', () => { jobRow = null; }, 404],
        ['job still running', () => { jobRow = { ...jobRow, Status: 'running' }; }, 400],
        ['file already cleaned up', () => { jobRow = { ...jobRow, FilePath: path.join(dir, 'gone.csv') }; }, 410],
    ])('answers GET and HEAD with the matching status for: %s', async (_name, arrange, status) => {
        arrange();
        expect((await GET({}, props)).status).toBe(status);
        const head = await HEAD({}, props);
        expect(head.status).toBe(status);
        expect(head.body).toBeNull();
    });
});
