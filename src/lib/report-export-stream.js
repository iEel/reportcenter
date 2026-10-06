import fs from 'fs';
import { finished } from 'stream/promises';
import { orderedColumns } from '@/lib/report-columns';
import { createXlsxStreamWriter } from '@/lib/xlsx-stream-writer';

/**
 * Run `query` on an mssql request in streaming mode and write its first recordset to `filePath`
 * as .xlsx, pausing the SQL stream whenever the writer falls behind. Resolves with the number of
 * data rows once the file is complete. Rejects on SQL, write or abort errors; the caller deletes
 * the file. Later recordsets are ignored, matching what `execute` shows.
 * `onProgress(rowCount)` runs every `progressEvery` rows with the SQL stream held until it settles;
 * its failures are ignored (background jobs use it for best-effort progress and cancel checks).
 */
export function streamQueryToXlsx({ sqlRequest, query, filePath, signal, onProgress, progressEvery = 10000 }) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new Error('Export aborted'));
            return;
        }
        const file = fs.createWriteStream(filePath);
        let writer = null;
        let recordsets = 0;
        let rowCount = 0;
        let waitingForDrain = false;
        let settled = false;
        // The SQL stream may be held for back-pressure and for a progress callback at the same time
        let holds = 0;
        const hold = () => { if (holds++ === 0) sqlRequest.pause(); };
        const release = () => { if (--holds === 0 && !settled) sqlRequest.resume(); };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            try { sqlRequest.cancel(); } catch { /* request already finished */ }
            writer?.destroy();
            file.destroy();
            reject(error);
        };
        const onAbort = () => fail(signal.reason ?? new Error('Export aborted'));
        signal?.addEventListener('abort', onAbort, { once: true });

        const startWriter = (columns) => {
            writer = createXlsxStreamWriter(columns);
            writer.on('error', fail);
            writer.pipe(file);
        };

        file.on('error', fail);
        sqlRequest.stream = true;
        sqlRequest.on('recordset', (metadata) => {
            recordsets++;
            if (recordsets === 1 && !settled) startWriter(orderedColumns(metadata));
        });
        sqlRequest.on('row', (row) => {
            if (settled || recordsets !== 1) return;
            rowCount++;
            if (!writer.write(row) && !waitingForDrain) {
                waitingForDrain = true;
                hold();
                writer.once('drain', () => {
                    waitingForDrain = false;
                    release();
                });
            }
            if (onProgress && rowCount % progressEvery === 0) {
                hold();
                const rows = rowCount;
                Promise.resolve().then(() => onProgress(rows)).catch(() => { /* best effort */ }).finally(release);
            }
        });
        sqlRequest.on('error', fail);
        sqlRequest.on('done', () => {
            if (settled) return;
            if (!writer) startWriter([]);
            writer.end();
            finished(file).then(() => {
                if (settled) return;
                settled = true;
                signal?.removeEventListener('abort', onAbort);
                resolve(rowCount);
            }, fail);
        });
        sqlRequest.query(query);
    });
}
