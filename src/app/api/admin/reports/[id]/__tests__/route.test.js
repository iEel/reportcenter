import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state (globalThis survives vi.mock hoisting) ─────

globalThis.__reportIdTest = {
    poolQueries: [],
    txQueries: [],
    failOn: null,
    failNumber: undefined,
    tx: null,
};

function makeReq(log) {
    const req = {
        input: vi.fn(() => req),
        query: vi.fn((text) => {
            const s = globalThis.__reportIdTest;
            log.push(text);
            if (s.failOn && text.includes(s.failOn)) {
                const err = new Error('statement failed');
                err.number = s.failNumber;
                return Promise.reject(err);
            }
            return Promise.resolve({ recordset: [{ IsActive: 0 }], rowsAffected: [1] });
        }),
    };
    return req;
}

function makePool() {
    const s = globalThis.__reportIdTest;
    const tx = {
        begin: vi.fn(() => Promise.resolve()),
        commit: vi.fn(() => Promise.resolve()),
        rollback: vi.fn(() => Promise.resolve()),
        request: vi.fn(() => makeReq(s.txQueries)),
    };
    s.tx = tx;
    return {
        request: vi.fn(() => makeReq(s.poolQueries)),
        transaction: vi.fn(() => tx),
    };
}

// ─── Module Mocks ───────────────────────────────────────────────

vi.mock('mssql', () => ({
    default: { Int: 'Int', NVarChar: vi.fn(() => 'NVarChar'), Bit: 'Bit', MAX: 'MAX' },
}));

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
}));

import { DELETE, PATCH } from '@/app/api/admin/reports/[id]/route';
import { getSession } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

const ADMIN = { userId: 1, roleName: 'Admin' };
const USER = { userId: 2, roleName: 'Sales' };
const props = (id = '12') => ({ params: Promise.resolve({ id }) });
const request = {};

describe('admin/reports/[id] route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(globalThis.__reportIdTest, { poolQueries: [], txQueries: [], failOn: null, failNumber: undefined, tx: null });
        connectToCentralDB.mockImplementation(() => Promise.resolve(makePool()));
        getSession.mockResolvedValue(ADMIN);
    });

    // ─── DELETE ─────────────────────────────────────────────────

    describe('DELETE /api/admin/reports/[id]', () => {
        it('returns 403 and touches no data when not logged in', async () => {
            getSession.mockResolvedValue(null);
            const res = await DELETE(request, props());
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('returns 403 and touches no data when user is not admin', async () => {
            getSession.mockResolvedValue(USER);
            const res = await DELETE(request, props());
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('deletes the report and its related rows inside one committed transaction', async () => {
            const res = await DELETE(request, props());
            const s = globalThis.__reportIdTest;
            expect(res.status).toBe(200);
            expect(s.tx.begin).toHaveBeenCalled();
            expect(s.tx.commit).toHaveBeenCalled();
            expect(s.tx.rollback).not.toHaveBeenCalled();
            expect(s.txQueries.some(q => q.includes('DELETE FROM ReportParameters'))).toBe(true);
            expect(s.txQueries.some(q => q.includes('DELETE FROM Reports'))).toBe(true);
            expect(s.poolQueries.some(q => /DELETE\s+FROM/i.test(q))).toBe(false);
        });

        it('removes child rows before the report row', async () => {
            await DELETE(request, props());
            const q = globalThis.__reportIdTest.txQueries;
            const parent = q.findIndex(s => s.includes('DELETE FROM Reports'));
            const children = ['DELETE FROM ReportParameters', 'DELETE FROM ReportRoleMapping', 'DELETE FROM UserFavorites']
                .map(text => q.findIndex(s => s.includes(text)));
            children.forEach(i => expect(i).toBeGreaterThan(-1));
            children.forEach(i => expect(i).toBeLessThan(parent));
        });

        it('removes favorites from the UserFavorites table', async () => {
            await DELETE(request, props());
            expect(globalThis.__reportIdTest.txQueries.some(q => q.includes('DELETE FROM UserFavorites'))).toBe(true);
        });

        it('rolls back everything when deleting the report row fails', async () => {
            globalThis.__reportIdTest.failOn = 'DELETE FROM Reports';
            const res = await DELETE(request, props());
            const s = globalThis.__reportIdTest;
            expect(res.status).toBe(500);
            expect(s.tx.rollback).toHaveBeenCalled();
            expect(s.tx.commit).not.toHaveBeenCalled();
        });

        it('returns 409 with a Thai message when other records still reference the report', async () => {
            Object.assign(globalThis.__reportIdTest, { failOn: 'DELETE FROM Reports', failNumber: 547 });
            const res = await DELETE(request, props());
            const data = await res.json();
            expect(res.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.message).toMatch(/อ้างอิง/);
            expect(globalThis.__reportIdTest.tx.rollback).toHaveBeenCalled();
        });

        it('409 message names usage history as a blocker and offers deactivation instead', async () => {
            Object.assign(globalThis.__reportIdTest, { failOn: 'DELETE FROM Reports', failNumber: 547 });
            const data = await (await DELETE(request, props())).json();
            expect(data.message).toMatch(/ประวัติการใช้งาน/);
            expect(data.message).toMatch(/ปิดใช้งาน/);
        });

        it('still answers 409 when SQL Server has already aborted the transaction', async () => {
            Object.assign(globalThis.__reportIdTest, { failOn: 'DELETE FROM Reports', failNumber: 547 });
            connectToCentralDB.mockImplementation(() => {
                const pool = makePool();
                globalThis.__reportIdTest.tx.rollback.mockRejectedValue(Object.assign(new Error('Transaction has been aborted.'), { code: 'EABORT' }));
                return Promise.resolve(pool);
            });
            const res = await DELETE(request, props());
            expect(res.status).toBe(409);
        });
    });

    // ─── PATCH ──────────────────────────────────────────────────

    describe('PATCH /api/admin/reports/[id]', () => {
        it('returns 403 and touches no data when not logged in', async () => {
            getSession.mockResolvedValue(null);
            const res = await PATCH(request, props());
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('returns 403 and touches no data when user is not admin', async () => {
            getSession.mockResolvedValue(USER);
            const res = await PATCH(request, props());
            expect(res.status).toBe(403);
            expect(connectToCentralDB).not.toHaveBeenCalled();
        });

        it('toggles the report status for an admin', async () => {
            const res = await PATCH(request, props());
            const data = await res.json();
            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.isActive).toBe(false);
            expect(globalThis.__reportIdTest.poolQueries.some(q => q.includes('UPDATE Reports SET IsActive'))).toBe(true);
        });
    });
});
