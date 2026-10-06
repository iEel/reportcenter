import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.__rolesPut = { statements: [], failOn: null, failNumber: undefined, tx: null };

function makeReq() {
    const inputs = {};
    const req = {
        input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
        query: vi.fn(async text => {
            const s = globalThis.__rolesPut;
            s.statements.push({ text, inputs: { ...inputs } });
            if (s.failOn && text.includes(s.failOn)) throw Object.assign(new Error('statement failed'), { number: s.failNumber });
            return { recordset: [], rowsAffected: [1] };
        }),
    };
    return req;
}

function makePool() {
    const tx = {
        begin: vi.fn(async () => {}),
        commit: vi.fn(async () => {}),
        rollback: vi.fn(async () => {}),
        request: vi.fn(() => makeReq()),
    };
    globalThis.__rolesPut.tx = tx;
    return { request: vi.fn(() => makeReq()), transaction: vi.fn(() => tx) };
}

vi.mock('mssql', () => ({ default: { Int: 'Int', NVarChar: vi.fn(() => 'NVarChar') } }));
vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { PUT } from '../route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

const put = body => PUT({ json: async () => body });
const mappingStatements = () => globalThis.__rolesPut.statements.filter(s => s.text.includes('ReportRoleMapping'));

describe('PUT /api/admin/roles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(globalThis.__rolesPut, { statements: [], failOn: null, failNumber: undefined, tx: null });
        getSession.mockResolvedValue({ roleName: 'Admin' });
        connectToCentralDB.mockImplementation(async () => makePool());
    });

    it('rejects a non-admin before connecting to the database', async () => {
        getSession.mockResolvedValue({ roleName: 'Reviewers' });
        expect((await put({ roleId: 2, roleName: 'X' })).status).toBe(403);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('renames without touching the report assignments', async () => {
        const res = await put({ roleId: 2, roleName: 'Finance' });
        expect(res.status).toBe(200);
        expect(globalThis.__rolesPut.statements.some(s => s.text.includes('UPDATE Roles'))).toBe(true);
        expect(mappingStatements()).toEqual([]);
    });

    it('applies only the added and removed reports, inside one committed transaction', async () => {
        const res = await put({ roleId: 2, addReports: [12], removeReports: [10] });
        const s = globalThis.__rolesPut;
        expect(res.status).toBe(200);
        expect(s.tx.begin).toHaveBeenCalled();
        expect(s.tx.commit).toHaveBeenCalled();
        expect(s.statements.some(st => st.text.includes('UPDATE Roles'))).toBe(false);
        const deletes = mappingStatements().filter(st => st.text.includes('DELETE'));
        expect(deletes).toHaveLength(1);
        expect(deletes[0].text).toMatch(/ReportId\s*=\s*@ReportId/);
        expect(deletes[0].inputs.ReportId).toBe(10);
        const inserts = mappingStatements().filter(st => st.text.includes('INSERT'));
        expect(inserts).toHaveLength(1);
        expect(inserts[0].text).toMatch(/IF NOT EXISTS/);
        expect(inserts[0].inputs.ReportId).toBe(12);
    });

    it('rolls back and reports an error when a step fails', async () => {
        globalThis.__rolesPut.failOn = 'INSERT';
        const res = await put({ roleId: 2, addReports: [12], removeReports: [10] });
        expect(res.status).toBe(500);
        expect(globalThis.__rolesPut.tx.rollback).toHaveBeenCalled();
        expect(globalThis.__rolesPut.tx.commit).not.toHaveBeenCalled();
    });

    it('treats an assignment another admin just added as already done', async () => {
        Object.assign(globalThis.__rolesPut, { failOn: 'INSERT', failNumber: 2627 });
        const res = await put({ roleId: 2, addReports: [12] });
        expect(res.status).toBe(200);
        expect(globalThis.__rolesPut.tx.commit).toHaveBeenCalled();
    });

    it('answers 409 with a reload hint when a report was deleted since the page loaded', async () => {
        Object.assign(globalThis.__rolesPut, { failOn: 'INSERT', failNumber: 547 });
        const res = await put({ roleId: 2, addReports: [12] });
        const data = await res.json();
        expect(res.status).toBe(409);
        expect(data.message).toMatch(/โหลด/);
        expect(globalThis.__rolesPut.tx.rollback).toHaveBeenCalled();
    });

    it('renames and changes reports in one call, then commits', async () => {
        const res = await put({ roleId: 2, roleName: 'Finance', removeReports: [10] });
        expect(res.status).toBe(200);
        expect(globalThis.__rolesPut.statements.map(s => s.text.trim().split(/\s+/)[0])).toEqual(['UPDATE', 'DELETE']);
        expect(globalThis.__rolesPut.tx.commit).toHaveBeenCalled();
    });

    it('still supports replacing the full assignment list', async () => {
        const res = await put({ roleId: 2, assignedReports: [10, 12] });
        expect(res.status).toBe(200);
        const mapping = mappingStatements();
        expect(mapping[0].text).toMatch(/DELETE FROM ReportRoleMapping WHERE RoleId = @RoleId$/);
        expect(mapping.filter(s => s.text.includes('INSERT')).map(s => s.inputs.ReportId)).toEqual([10, 12]);
    });

    it('rejects a blank name and a request with nothing to change', async () => {
        expect((await put({ roleId: 2, roleName: '   ' })).status).toBe(400);
        expect((await put({ roleId: 2 })).status).toBe(400);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });
});
