import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Admin group decides who is an administrator, so the API must protect it too (not only the page).

globalThis.__adminRole = { writes: [], roles: { 1: 'Admin', 2: 'Reviewers' } };

function makeReq() {
    const inputs = {};
    const req = {
        input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
        query: vi.fn(async text => {
            const s = globalThis.__adminRole;
            if (text.includes('SELECT RoleName FROM Roles')) {
                const name = s.roles[inputs.RoleId];
                return { recordset: name ? [{ RoleName: name }] : [] };
            }
            if (text.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
            if (/^\s*SELECT RoleId FROM Roles WHERE RoleName/.test(text)) return { recordset: [] };
            if (/^\s*(UPDATE|INSERT|DELETE|IF NOT EXISTS)/.test(text)) s.writes.push(text);
            return { recordset: [{ RoleId: 9 }], rowsAffected: [1] };
        }),
    };
    return req;
}

function makePool() {
    const tx = { begin: vi.fn(async () => {}), commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}), request: vi.fn(() => makeReq()) };
    return { request: vi.fn(() => makeReq()), transaction: vi.fn(() => tx) };
}

vi.mock('mssql', () => ({ default: { Int: 'Int', NVarChar: vi.fn(() => 'NVarChar') } }));
vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { DELETE, POST, PUT } from '../route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

const json = (handler, body) => handler({ json: async () => body });

describe('Admin group protection in the roles API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.__adminRole.writes = [];
        getSession.mockResolvedValue({ roleName: 'Admin' });
        connectToCentralDB.mockImplementation(async () => makePool());
    });

    it('refuses to rename the Admin group', async () => {
        const res = await json(PUT, { roleId: 1, roleName: 'Super users' });
        expect(res.status).toBe(400);
        expect(globalThis.__adminRole.writes).toEqual([]);
    });

    it('refuses to change report access of the Admin group', async () => {
        const res = await json(PUT, { roleId: 1, addReports: [12] });
        expect(res.status).toBe(400);
        expect(globalThis.__adminRole.writes).toEqual([]);
    });

    it('refuses to rename another group to "admin"', async () => {
        const res = await json(PUT, { roleId: 2, roleName: ' ADMIN ' });
        expect(res.status).toBe(400);
        expect(globalThis.__adminRole.writes).toEqual([]);
    });

    it('answers 404 for a group that does not exist', async () => {
        const res = await json(PUT, { roleId: 99, roleName: 'Ghost' });
        expect(res.status).toBe(404);
    });

    it('refuses to create a group named "admin"', async () => {
        const res = await json(POST, { roleName: 'admin', assignedReports: [] });
        expect(res.status).toBe(400);
        expect(globalThis.__adminRole.writes).toEqual([]);
    });

    it('refuses to delete the Admin group', async () => {
        const res = await DELETE({ url: 'http://localhost/api/admin/roles?roleId=1' });
        expect(res.status).toBe(400);
        expect(globalThis.__adminRole.writes).toEqual([]);
    });

    it('still renames an ordinary group', async () => {
        const res = await json(PUT, { roleId: 2, roleName: 'Finance' });
        expect(res.status).toBe(200);
    });
});
