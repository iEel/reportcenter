import fs from 'fs';
import { finished } from 'stream/promises';
import { orderedColumns } from '@/lib/report-columns';
import { createXlsxStreamWriter } from '@/lib/xlsx-stream-writer';

/**
 * Run `query` on an mssql request in streaming mode and write its first recordset to `filePath`
 * as .xlsx, pausing the SQL stream whenever the writer falls behind. Resolves with the number of
 * data rows once the file is complete. Rejects on SQL, write or abort errors; the caller deletes
 * the file. Later recordsets are ignored, matching what `execute` shows.
 */
export function streamQueryToXlsx({ sqlRequest, query, filePath, signal }) {
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
                sqlRequest.pause();
                writer.once('drain', () => {
                    waitingForDrain = false;
                    sqlRequest.resume();
                });
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
