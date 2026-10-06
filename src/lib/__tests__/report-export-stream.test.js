import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as xlsx from 'xlsx';
import { streamQueryToXlsx } from '@/lib/report-export-stream';

/** A stand-in for an mssql streaming request; `script` emits the events once query() is called. */
function fakeSqlRequest(script) {
    const req = new EventEmitter();
    req.pause = vi.fn();
    req.resume = vi.fn();
    req.cancel = vi.fn();
    req.query = vi.fn(() => { setImmediate(() => script(req)); });
    return req;
}

let filePath;
beforeEach(() => {
    filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-export-stream-')), 'out.xlsx');
});

const readRows = () => xlsx.utils.sheet_to_json(xlsx.readFile(filePath).Sheets['Report Data'], { header: 1 });

describe('streamQueryToXlsx', () => {
    it('writes the first recordset in SELECT order and resolves with the row count', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { B: { index: 1 }, A: { index: 0 } });
            req.emit('row', { A: 1, B: 'หนึ่ง' });
            req.emit('row', { A: 2, B: 'สอง' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'SELECT 1', filePath })).resolves.toBe(2);
        expect(sqlRequest.stream).toBe(true);
        expect(sqlRequest.query).toHaveBeenCalledWith('SELECT 1');
        expect(readRows()).toEqual([['A', 'B'], [1, 'หนึ่ง'], [2, 'สอง']]);
    });

    it('ignores rows from later recordsets', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            req.emit('row', { A: 1 });
            req.emit('recordset', { Other: { index: 0 } });
            req.emit('row', { Other: 'x' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(1);
        expect(readRows()).toEqual([['A'], [1]]);
    });

    it('resolves 0 with a valid file when the query returns no recordset', async () => {
        const sqlRequest = fakeSqlRequest(req => req.emit('done', {}));
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(0);
        expect(xlsx.readFile(filePath).SheetNames).toEqual(['Report Data']);
    });

    it('rejects on a SQL error', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            req.emit('error', new Error('Invalid column name'));
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).rejects.toThrow('Invalid column name');
    });

    it('cancels the SQL request and rejects when aborted mid-stream, never resolving', async () => {
        const controller = new AbortController();
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            for (let i = 0; i < 100; i++) req.emit('row', { A: i });
            controller.abort();
            req.emit('row', { A: 'late' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, signal: controller.signal })).rejects.toBeDefined();
        expect(sqlRequest.cancel).toHaveBeenCalled();
    });

    it('rejects at once when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const sqlRequest = fakeSqlRequest(() => {});
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, signal: controller.signal })).rejects.toBeDefined();
        expect(sqlRequest.query).not.toHaveBeenCalled();
    });

    it('reports progress every N rows and holds the SQL stream until the callback settles', async () => {
        let sent = 0;
        let paused = false;
        let finished = false;
        const events = [];
        const sqlRequest = fakeSqlRequest(req => {
            const pump = () => {
                while (!paused && sent < 25) {
                    sent++;
                    req.emit('row', { N: sent });
                }
                if (!paused && sent === 25 && !finished) {
                    finished = true;
                    req.emit('done', {});
                }
            };
            req.pause.mockImplementation(() => { paused = true; events.push('pause'); });
            req.resume.mockImplementation(() => { paused = false; events.push('resume'); setImmediate(pump); });
            req.emit('recordset', { N: { index: 0 } });
            pump();
        });
        const onProgress = vi.fn(async rows => {
            events.push(`start ${rows}${paused ? ' (paused)' : ''}`);
            await new Promise(resolve => setTimeout(resolve, 5));
            events.push(`end ${rows}`);
        });

        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, onProgress, progressEvery: 10 })).resolves.toBe(25);
        expect(events).toEqual([
            'pause', 'start 10 (paused)', 'end 10', 'resume',
            'pause', 'start 20 (paused)', 'end 20', 'resume',
        ]);
        expect(readRows()).toHaveLength(26);
    });

    it('keeps exporting when a progress callback fails', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { N: { index: 0 } });
            for (let i = 1; i <= 3; i++) req.emit('row', { N: i });
            req.emit('done', {});
        });
        const onProgress = vi.fn(async () => { throw new Error('central DB down'); });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, onProgress, progressEvery: 1 })).resolves.toBe(3);
        expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('pauses the SQL stream under back-pressure and resumes after drain', async () => {
        // Like mssql, stop emitting rows while paused and carry on when resumed
        let sent = 0;
        let paused = false;
        let finished = false;
        const sqlRequest = fakeSqlRequest(req => {
            const pump = () => {
                while (!paused && sent < 2000) {
                    sent++;
                    req.emit('row', { Hex: randomBytes(1000).toString('hex') });
                }
                if (!paused && sent === 2000 && !finished) {
                    finished = true;
                    req.emit('done', {});
                }
            };
            req.pause.mockImplementation(() => { paused = true; });
            req.resume.mockImplementation(() => { paused = false; setImmediate(pump); });
            req.emit('recordset', { Hex: { index: 0 } });
            pump();
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(2000);
        expect(sqlRequest.pause).toHaveBeenCalled();
        expect(sqlRequest.resume).toHaveBeenCalled();
    });
});
