import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Temporary files for ordinary-report exports: `<uuid>.xlsx` plus `<uuid>.json` metadata.
 * Deleted after the single download; anything left behind is swept after 15 minutes.
 * (Background-job files for IsHeavy reports live in tmp/jobs and are kept 24 hours.)
 */
export const EXPORTS_DIR = path.join(process.cwd(), 'tmp', 'exports');
export const EXPORT_MAX_AGE_MS = 15 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isExportId(id) {
    return typeof id === 'string' && ID_PATTERN.test(id);
}

export function exportFilePaths(id, dir = EXPORTS_DIR) {
    return { dataPath: path.join(dir, `${id}.xlsx`), metaPath: path.join(dir, `${id}.json`) };
}

export async function createExportFile(dir = EXPORTS_DIR) {
    await fs.promises.mkdir(dir, { recursive: true });
    const id = randomUUID();
    return { id, ...exportFilePaths(id, dir) };
}

export async function writeExportMeta(id, meta, dir = EXPORTS_DIR) {
    await fs.promises.writeFile(exportFilePaths(id, dir).metaPath, JSON.stringify(meta), 'utf8');
}

/** Metadata of an export, or null when the id is malformed or the export no longer exists. */
export async function readExportMeta(id, dir = EXPORTS_DIR) {
    if (!isExportId(id)) return null;
    try {
        return JSON.parse(await fs.promises.readFile(exportFilePaths(id, dir).metaPath, 'utf8'));
    } catch {
        return null;
    }
}

export async function deleteExportFile(id, dir = EXPORTS_DIR) {
    const { dataPath, metaPath } = exportFilePaths(id, dir);
    await Promise.all([fs.promises.rm(dataPath, { force: true }), fs.promises.rm(metaPath, { force: true })]);
}

/** Delete export files older than `maxAgeMs`; returns how many were removed. */
export async function sweepExportFiles({ maxAgeMs = EXPORT_MAX_AGE_MS, now = Date.now(), dir = EXPORTS_DIR } = {}) {
    let names;
    try {
        names = await fs.promises.readdir(dir);
    } catch {
        return 0;
    }
    let deleted = 0;
    for (const name of names) {
        const filePath = path.join(dir, name);
        try {
            const stat = await fs.promises.stat(filePath);
            if (now - stat.mtimeMs > maxAgeMs) {
                await fs.promises.rm(filePath, { force: true });
                deleted++;
            }
        } catch { /* removed meanwhile */ }
    }
    return deleted;
}
