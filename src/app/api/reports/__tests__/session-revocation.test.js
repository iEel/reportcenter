import { beforeEach, describe, expect, it, vi } from 'vitest';

// A token can keep a valid signature after the user is suspended or loses a company.
// These routes must use getSession (which checks TokenVersion + IsActive), not the signature alone.

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({ get: () => ({ value: 'signed-token' }) })),
}));

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
    verifyToken: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
    connectToCompanyDB: vi.fn(),
}));

vi.mock('mssql', () => ({
    default: { Int: 'Int', NVarChar: vi.fn(() => 'NVarChar') },
}));

import { GET as searchParam } from '@/app/api/reports/search-param/route';
import { GET as available } from '@/app/api/reports/available/route';
import { getSession, verifyToken } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

const signedPayload = { userId: 5, roleId: 1, roleName: 'Admin', allowedCompanies: [1] };

function makePool() {
    const req = { input: vi.fn(() => req), query: vi.fn(async () => ({ recordset: [] })) };
    return { request: () => req };
}

function request(url) {
    return { url, cookies: { get: () => ({ value: 'signed-token' }) }, headers: { get: () => null } };
}

describe('session revocation on report lookup routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        verifyToken.mockResolvedValue(signedPayload);
        getSession.mockResolvedValue(null); // revoked: suspended user or bumped TokenVersion
        connectToCentralDB.mockImplementation(async () => makePool());
    });

    it('search-param rejects a revoked session before touching any database', async () => {
        const res = await searchParam(request('http://localhost/api/reports/search-param?reportId=1&paramName=%40p&companyId=1&q=ab'));
        expect(res.status).toBe(401);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('available rejects a revoked session before touching any database', async () => {
        const res = await available(request('http://localhost/api/reports/available'));
        expect(res.status).toBe(401);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });

    it('available still lists reports for a valid session', async () => {
        getSession.mockResolvedValue(signedPayload);
        const res = await available(request('http://localhost/api/reports/available'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('search-param still checks the company list of a valid session', async () => {
        getSession.mockResolvedValue({ ...signedPayload, allowedCompanies: [2] });
        const res = await searchParam(request('http://localhost/api/reports/search-param?reportId=1&paramName=%40p&companyId=1&q=ab'));
        expect(res.status).toBe(403);
    });
});
