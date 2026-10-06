import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { randomUUID } from 'crypto';

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/export-files', async (importOriginal) => {
    const actual = await importOriginal();
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'rc-export-get-'));
    return {
        ...actual,
        exportFilePaths: id => actual.exportFilePaths(id, dir),
        readExportMeta: id => actual.readExportMeta(id, dir),
        deleteExportFile: id => actual.deleteExportFile(id, dir),
        writeExportMeta: (id, meta) => actual.writeExportMeta(id, meta, dir),
    };
});

import { GET } from '@/app/api/reports/export/[id]/route';
import { getSession } from '@/lib/auth';
import { exportFilePaths, writeExportMeta } from '@/lib/export-files';
import { EXCEL_MIME } from '@/lib/excel-export';

const fileName = 'ยอดขาย_2026-10-06.xlsx';
const bytes = Buffer.from('xlsx-bytes-for-test');
const props = id => ({ params: Promise.resolve({ id }) });

async function createExport(userId = 7) {
    const id = randomUUID();
    fs.writeFileSync(exportFilePaths(id).dataPath, bytes);
    await writeExportMeta(id, { userId, fileName, createdAt: new Date().toISOString() });
    return id;
}

beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: 7 });
});

describe('GET /api/reports/export/[id]', () => {
    it('returns 401 without a session', async () => {
        getSession.mockResolvedValue(null);
        expect((await GET({}, props(await createExport()))).status).toBe(401);
    });

    it('returns 404 for an id that is not an export id', async () => {
        expect((await GET({}, props('../../etc/passwd'))).status).toBe(404);
    });

    it("returns 404 for another user's export and leaves it in place", async () => {
        const id = await createExport(99);
        expect((await GET({}, props(id))).status).toBe(404);
        expect(fs.existsSync(exportFilePaths(id).dataPath)).toBe(true);
    });

    it('streams the file once with download headers, deletes it, then answers 404', async () => {
        const id = await createExport();
        const res = await GET({}, props(id));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe(EXCEL_MIME);
        expect(res.headers.get('content-length')).toBe(String(bytes.length));
        expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent(fileName)}`);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
        await vi.waitFor(() => {
            expect(fs.existsSync(exportFilePaths(id).dataPath)).toBe(false);
            expect(fs.existsSync(exportFilePaths(id).metaPath)).toBe(false);
        });
        expect((await GET({}, props(id))).status).toBe(404);
    });
});
