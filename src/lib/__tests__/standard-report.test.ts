import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    exportProblem, getRunBlocker, nextJobPoll, pickReportCompany, shouldConfirmEmptyConditions, startJobPolling,
} from '../standard-report';

describe('startJobPolling', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('never starts a status check while the previous one is still waiting', async () => {
        let release: (job: { status: string }) => void = () => {};
        const check = vi.fn(() => new Promise<{ status: string }>(resolve => { release = resolve; }));
        startJobPolling({ check, onJob: vi.fn(), onStop: vi.fn(), intervalMs: 3000 });
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(9000); // first check is slow
        expect(check).toHaveBeenCalledTimes(1);
        release({ status: 'running' });
        await vi.advanceTimersByTimeAsync(3000);
        expect(check).toHaveBeenCalledTimes(2);
    });

    it('reports the final state once and stops checking', async () => {
        const onStop = vi.fn();
        const check = vi.fn().mockResolvedValueOnce({ status: 'running' }).mockResolvedValue({ status: 'done', rowCount: 5 });
        startJobPolling({ check, onJob: vi.fn(), onStop, intervalMs: 3000 });
        await vi.advanceTimersByTimeAsync(15000);
        expect(check).toHaveBeenCalledTimes(2);
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(onStop).toHaveBeenCalledWith('done', { status: 'done', rowCount: 5 });
    });

    it('gives up as unknown after three failed checks in a row', async () => {
        const onStop = vi.fn();
        const check = vi.fn().mockRejectedValue(new Error('network'));
        startJobPolling({ check, onJob: vi.fn(), onStop, intervalMs: 3000 });
        await vi.advanceTimersByTimeAsync(20000);
        expect(check).toHaveBeenCalledTimes(3);
        expect(onStop).toHaveBeenCalledWith('unknown', null);
    });

    it('ignores a check that finishes after polling was stopped', async () => {
        let release: (job: { status: string }) => void = () => {};
        const onJob = vi.fn(), onStop = vi.fn();
        const check = vi.fn(() => new Promise<{ status: string }>(resolve => { release = resolve; }));
        const stop = startJobPolling({ check, onJob, onStop, intervalMs: 3000 });
        await vi.advanceTimersByTimeAsync(3000);
        stop(); // e.g. the page unmounted
        release({ status: 'done' });
        await vi.advanceTimersByTimeAsync(10000);
        expect(onJob).not.toHaveBeenCalled();
        expect(onStop).not.toHaveBeenCalled();
        expect(check).toHaveBeenCalledTimes(1);
    });
});

describe('empty condition confirmation', () => {
    it('asks before a fresh run when a condition is empty', () => {
        expect(shouldConfirmEmptyConditions({ from: '2026-01-01', to: '' }, 2, false)).toBe(true);
    });
    it('does not ask again when only moving between result pages', () => {
        expect(shouldConfirmEmptyConditions({ from: '2026-01-01', to: '' }, 2, true)).toBe(false);
    });
    it('does not ask for reports without conditions or when every value is filled', () => {
        expect(shouldConfirmEmptyConditions({}, 0, false)).toBe(false);
        expect(shouldConfirmEmptyConditions({ qty: '0', name: 'A' }, 2, false)).toBe(false);
    });
});

describe('report company choice', () => {
    const listed = [1, 2, 3];
    it('keeps a selected company that is allowed and listed', () => {
        expect(pickReportCompany('2', [1, 2], listed)).toBe('2');
    });
    it('falls back to the first allowed company that the list actually offers', () => {
        expect(pickReportCompany('', [9, 3, 1], listed)).toBe('3');
        expect(pickReportCompany('9', [9, 3], listed)).toBe('3');
    });
    it('returns no company when none of the allowed companies is listed', () => {
        expect(pickReportCompany('', [9], listed)).toBe('');
        expect(pickReportCompany('', [], listed)).toBe('');
    });
    it('uses the first allowed company while the company list is unavailable', () => {
        expect(pickReportCompany('', [9, 3], null)).toBe('9');
        expect(pickReportCompany('3', [9, 3], null)).toBe('3');
    });
});

describe('run blockers', () => {
    const ready = { reportId: '5', company: '1', isLoadingParams: false, paramsError: null, hasCompanyChoices: true };
    it('allows a run when report, conditions and company are ready', () => {
        expect(getRunBlocker(ready)).toBeNull();
    });
    it('blocks a run while conditions are missing because loading failed', () => {
        expect(getRunBlocker({ ...ready, paramsError: 'timeout' })).toMatch(/เงื่อนไข/);
    });
    it('blocks a run while conditions are still loading', () => {
        expect(getRunBlocker({ ...ready, isLoadingParams: true })).toMatch(/เงื่อนไข/);
    });
    it('blocks a run without a company and says why', () => {
        expect(getRunBlocker({ ...ready, company: '' })).toMatch(/บริษัท/);
        expect(getRunBlocker({ ...ready, company: '', hasCompanyChoices: false })).toMatch(/ไม่มีบริษัท/);
    });
    it('blocks a run without a report', () => {
        expect(getRunBlocker({ ...ready, reportId: '' })).toMatch(/เลือกรายงาน/);
    });
});

describe('export results', () => {
    it('reports a server failure as an error with the server message', () => {
        expect(exportProblem({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' }))
            .toEqual({ kind: 'error', message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' });
    });
    it('falls back to a generic error message', () => {
        expect(exportProblem({ success: false })).toEqual({ kind: 'error', message: 'ไม่สามารถส่งออกข้อมูลได้' });
    });
    it('reports an empty result separately from an error', () => {
        expect(exportProblem({ success: true, data: [] })).toEqual({ kind: 'empty' });
    });
    it('has no problem when rows came back', () => {
        expect(exportProblem({ success: true, data: [{ a: 1 }] })).toBeNull();
    });
});

describe('background job polling', () => {
    it('keeps polling a running job and clears earlier failures', () => {
        expect(nextJobPoll(2, { ok: true, status: 'running' })).toEqual({ failures: 0, stop: false });
    });
    it('stops on every finished state, including cancelled', () => {
        for (const status of ['done', 'failed', 'cancelled']) {
            expect(nextJobPoll(0, { ok: true, status })).toEqual({ failures: 0, stop: true, outcome: status });
        }
    });
    it('tolerates a single failed status check', () => {
        expect(nextJobPoll(0, { ok: false })).toEqual({ failures: 1, stop: false });
    });
    it('gives up after three failed checks in a row', () => {
        expect(nextJobPoll(2, { ok: false })).toEqual({ failures: 3, stop: true, outcome: 'unknown' });
    });
});
