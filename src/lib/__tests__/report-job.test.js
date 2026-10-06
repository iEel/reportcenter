import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn(), connectToCompanyDB: vi.fn() }));
vi.mock('@/lib/report-export-stream', () => ({ streamQueryToXlsx: vi.fn() }));
vi.mock('@/lib/report-run', () => ({ bindReportParameters: vi.fn() }));

import { cleanupOldJobFiles, runReportJob } from '@/lib/report-job';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { streamQueryToXlsx } from '@/lib/report-export-stream';
import { bindReportParameters } from '@/lib/report-run';

let jobsDir;
let queries;
let jobStatus;
let sqlRequest;
const today = () => new Date().toISOString().split('T')[0];
const params = [{ ParameterName: '@from', InputType: 'date' }];

function job(overrides = {}) {
    return {
        jobId: 27, userId: 7, companyId: 1, reportName: 'GL Data', tSqlQuery: 'SELECT 1',
        expectedParams: params, parameters: { '@from': '2026-09-01' }, jobsDir, ...overrides,
    };
}

const queriesMatching = pattern => queries.filter(q => pattern.test(q.text));

beforeEach(() => {
    vi.clearAllMocks();
    jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-jobs-'));
    queries = [];
    jobStatus = 'running';
    sqlRequest = { timeout: 0 };
    connectToCompanyDB.mockResolvedValue({ request: () => sqlRequest });
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => {
                    queries.push({ text, inputs });
                    return /SELECT Status/.test(text) ? { recordset: [{ Status: jobStatus }] } : { recordset: [], rowsAffected: [1] };
                }),
            };
            return req;
        },
    });
});

describe('runReportJob', () => {
    it('streams the report into an .xlsx job file and marks the job done', async () => {
        streamQueryToXlsx.mockResolvedValue(31480);
        await runReportJob(job());

        const fileName = `GL Data_${today()}_job27.xlsx`;
        expect(connectToCompanyDB).toHaveBeenCalledWith(1);
        expect(sqlRequest.timeout).toBe(900000);
        expect(bindReportParameters).toHaveBeenCalledWith(sqlRequest, params, { '@from': '2026-09-01' });
        expect(streamQueryToXlsx).toHaveBeenCalledWith(expect.objectContaining({
            sqlRequest, query: 'SELECT 1', filePath: path.join(jobsDir, fileName), progressEvery: 10000,
        }));
        const done = queriesMatching(/Status = 'done'/)[0];
        expect(done.inputs).toMatchObject({ JobId: 27, FileName: fileName, FilePath: path.join(jobsDir, fileName), RowCount: 31480 });
        const notice = queriesMatching(/INSERT INTO Notifications/)[0];
        expect(notice.inputs).toMatchObject({ UserId: 7, Type: 'success', Title: '✅ รายงานเสร็จแล้ว: GL Data' });
        expect(notice.inputs.Message).toBe('สร้างเสร็จแล้ว 31,480 แถว — กดเพื่อดาวน์โหลด');
    });

    it('replaces characters a file name cannot hold', async () => {
        streamQueryToXlsx.mockResolvedValue(1);
        await runReportJob(job({ reportName: 'GL A/B: "Q"' }));
        expect(streamQueryToXlsx.mock.calls[0][0].filePath).toBe(path.join(jobsDir, `GL A_B_ _Q__${today()}_job27.xlsx`));
    });

    it('records progress and stops quietly when the user has cancelled the job', async () => {
        jobStatus = 'cancelled';
        streamQueryToXlsx.mockImplementation(async ({ onProgress, signal, filePath }) => {
            fs.writeFileSync(filePath, 'partial');
            await onProgress(10000);
            expect(signal.aborted).toBe(true);
            throw signal.reason;
        });
        await runReportJob(job());

        expect(queriesMatching(/SET \[RowCount\] = @RowCount/)[0].inputs.RowCount).toBe(10000);
        expect(queriesMatching(/Status = 'failed'|Status = 'done'/)).toEqual([]);
        expect(queriesMatching(/INSERT INTO Notifications/)).toEqual([]);
        expect(fs.readdirSync(jobsDir)).toEqual([]);
    });

    it('keeps going when the job is still running at a progress check', async () => {
        streamQueryToXlsx.mockImplementation(async ({ onProgress, signal }) => {
            await onProgress(10000);
            expect(signal.aborted).toBe(false);
            return 12000;
        });
        await runReportJob(job());
        expect(queriesMatching(/Status = 'done'/)).toHaveLength(1);
    });

    it('marks the job failed, notifies the user and removes the partial file on a SQL error', async () => {
        streamQueryToXlsx.mockImplementation(async ({ filePath }) => {
            fs.writeFileSync(filePath, 'partial');
            throw new Error('Invalid column name');
        });
        await runReportJob(job());

        expect(queriesMatching(/Status = 'failed'/)[0].inputs.ErrorMessage).toBe('Invalid column name');
        const notice = queriesMatching(/INSERT INTO Notifications/)[0];
        expect(notice.inputs).toMatchObject({ Type: 'error', Title: '❌ รายงานล้มเหลว: GL Data', Message: 'Invalid column name' });
        expect(fs.readdirSync(jobsDir)).toEqual([]);
    });
});

describe('cleanupOldJobFiles', () => {
    it('deletes job files older than 24 hours and keeps newer ones', async () => {
        const oldFile = path.join(jobsDir, 'old_job1.csv');
        const newFile = path.join(jobsDir, 'new_job2.xlsx');
        fs.writeFileSync(oldFile, 'x');
        fs.writeFileSync(newFile, 'x');
        const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
        fs.utimesSync(oldFile, past, past);

        await cleanupOldJobFiles(jobsDir);
        expect(fs.readdirSync(jobsDir)).toEqual(['new_job2.xlsx']);
        expect(queriesMatching(/SET FilePath = NULL/)).toHaveLength(1);
    });
});
