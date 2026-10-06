import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    createExportFile, deleteExportFile, EXPORT_MAX_AGE_MS, exportFilePaths, isExportId,
    readExportMeta, sweepExportFiles, writeExportMeta,
} from '@/lib/export-files';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-export-files-')); });

describe('export files', () => {
    it('creates a UUID id with paths inside the directory', async () => {
        const file = await createExportFile(dir);
        expect(isExportId(file.id)).toBe(true);
        expect(file.dataPath).toBe(path.join(dir, `${file.id}.xlsx`));
        expect(file.metaPath).toBe(path.join(dir, `${file.id}.json`));
    });

    it('round-trips metadata', async () => {
        const { id } = await createExportFile(dir);
        const meta = { userId: 7, fileName: 'ยอดขาย_2026-10-06.xlsx', createdAt: '2026-10-06T00:00:00.000Z' };
        await writeExportMeta(id, meta, dir);
        expect(await readExportMeta(id, dir)).toEqual(meta);
    });

    it('returns null for ids that are not UUIDs or have no metadata', async () => {
        expect(await readExportMeta('../../etc/passwd', dir)).toBeNull();
        expect(await readExportMeta('00000000-0000-4000-8000-000000000000', dir)).toBeNull();
    });

    it('deletes both files and tolerates files already gone', async () => {
        const { id, dataPath, metaPath } = await createExportFile(dir);
        fs.writeFileSync(dataPath, 'x');
        await writeExportMeta(id, { userId: 1, fileName: 'a.xlsx', createdAt: '' }, dir);
        await deleteExportFile(id, dir);
        await deleteExportFile(id, dir);
        expect(fs.existsSync(dataPath) || fs.existsSync(metaPath)).toBe(false);
    });

    it('sweeps files older than the limit and keeps recent ones', async () => {
        const oldFile = exportFilePaths('11111111-1111-4111-8111-111111111111', dir).dataPath;
        const newFile = exportFilePaths('22222222-2222-4222-8222-222222222222', dir).dataPath;
        fs.writeFileSync(oldFile, 'old');
        fs.writeFileSync(newFile, 'new');
        const now = Date.now();
        const past = new Date(now - EXPORT_MAX_AGE_MS - 60000);
        fs.utimesSync(oldFile, past, past);
        expect(await sweepExportFiles({ dir, now })).toBe(1);
        expect(fs.existsSync(oldFile)).toBe(false);
        expect(fs.existsSync(newFile)).toBe(true);
    });

    it('sweeps nothing when the directory does not exist yet', async () => {
        expect(await sweepExportFiles({ dir: path.join(dir, 'missing') })).toBe(0);
    });
});
