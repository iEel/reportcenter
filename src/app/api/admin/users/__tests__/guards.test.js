import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server-side guards that the users page already enforces in the UI.

globalThis.__userGuards = { queries: [], users: {} };

function makePool() {
    const req = () => {
        const inputs = {};
        const r = {
            input: vi.fn((name, _type, value) => { inputs[name] = value; return r; }),
            query: vi.fn(async text => {
                const s = globalThis.__userGuards;
                s.queries.push({ text, inputs: { ...inputs } });
                if (text.includes('FROM Users WHERE UserId = @UserId') && text.trim().startsWith('SELECT')) {
                    const user = s.users[inputs.UserId];
                    return { recordset: user ? [user] : [] };
                }
                if (text.includes('INFORMATION_SCHEMA.COLUMNS')) return { recordset: [] };
                if (text.includes('OUTPUT INSERTED.UserId')) return { recordset: [{ UserId: 50 }] };
                return { recordset: [], rowsAffected: [1] };
            }),
        };
        return r;
    };
    return { request: vi.fn(req) };
}

vi.mock('mssql', () => ({ default: { Int: 'Int', Bit: 'Bit', NVarChar: vi.fn(() => 'NVarChar') } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed') } }));
vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn(), invalidateSessionCache: vi.fn() }));

import { POST, PUT } from '../route';
import { PUT as bulkPUT } from '../bulk/route';
import { POST as resetPassword } from '../reset-password/route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

const ADMIN = { userId: 1, roleId: 1, roleName: 'Admin' };
const call = (handler, body) => handler({ json: async () => body });
const writes = () => globalThis.__userGuards.queries.filter(q => /^\s*(UPDATE|INSERT|DELETE)/i.test(q.text));

describe('user management guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.__userGuards = { queries: [], users: {} };
        getSession.mockResolvedValue(ADMIN);
        connectToCentralDB.mockImplementation(async () => makePool());
    });

    describe('creating a Local account', () => {
        it('requires an initial password instead of falling back to a built-in one', async () => {
            const res = await call(POST, { Username: 'newbie', FullName: 'New User', RoleId: '2', IsActive: true, AuthType: 'local', allowedCompanies: [1] });
            expect(res.status).toBe(400);
            expect((await res.json()).message).toMatch(/รหัสผ่าน/);
            expect(writes()).toEqual([]);
        });

        it('still creates the account with a valid password', async () => {
            const res = await call(POST, { Username: 'newbie', FullName: 'New User', PasswordHash: 'Str0ng!Pass', RoleId: '2', IsActive: true, AuthType: 'local', allowedCompanies: [1] });
            expect(res.status).toBe(200);
        });

        it('does not ask AD accounts for a password', async () => {
            const res = await call(POST, { Username: 'ad.user', FullName: 'AD User', RoleId: '2', IsActive: true, AuthType: 'ldap', allowedCompanies: [1] });
            expect(res.status).toBe(200);
        });
    });

    describe('editing your own account', () => {
        it('cannot suspend yourself', async () => {
            const res = await call(PUT, { UserId: 1, FullName: 'Me', RoleId: '1', IsActive: false, allowedCompanies: [1] });
            expect(res.status).toBe(400);
            expect(writes()).toEqual([]);
        });

        it('cannot change your own group', async () => {
            const res = await call(PUT, { UserId: '1', FullName: 'Me', RoleId: '2', IsActive: true, allowedCompanies: [1] });
            expect(res.status).toBe(400);
            expect(writes()).toEqual([]);
        });

        it('can still change your own name and companies', async () => {
            const res = await call(PUT, { UserId: 1, FullName: 'Me Renamed', RoleId: '1', IsActive: true, allowedCompanies: [1, 2] });
            expect(res.status).toBe(200);
        });

        it('cannot suspend yourself through the bulk action', async () => {
            const res = await call(bulkPUT, { userIds: [5, 1], isActive: false });
            expect(res.status).toBe(400);
            expect(writes()).toEqual([]);
        });

        it('bulk action still works for other users', async () => {
            const res = await call(bulkPUT, { userIds: [5, 6], isActive: false });
            expect(res.status).toBe(200);
        });
    });

    describe('resetting a password', () => {
        it('refuses AD accounts, whose password lives in Active Directory', async () => {
            globalThis.__userGuards.users[7] = { Username: 'ad.user', FullName: 'AD User', AuthType: 'ldap' };
            const res = await call(resetPassword, { userId: 7, newPassword: 'Str0ng!Pass' });
            expect(res.status).toBe(400);
            expect((await res.json()).message).toMatch(/Active Directory|AD/);
            expect(writes()).toEqual([]);
        });

        it('still resets a Local account', async () => {
            globalThis.__userGuards.users[8] = { Username: 'local.user', FullName: 'Local User', AuthType: 'local' };
            const res = await call(resetPassword, { userId: 8, newPassword: 'Str0ng!Pass' });
            expect(res.status).toBe(200);
        });
    });
});
