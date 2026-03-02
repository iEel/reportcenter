import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state ──────────────────────────────────────────

let queryResults = [];
let queryIndex = 0;

const mockInput = vi.fn(function () { return this; });

function createMockPool() {
    return {
        request: () => ({
            input: mockInput,
            query: vi.fn(() => {
                const result = queryResults[queryIndex] || { recordset: [] };
                queryIndex++;
                return Promise.resolve(result);
            }),
        }),
    };
}

// ─── Module Mocks ───────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    signToken: vi.fn(() => Promise.resolve('mock.jwt.token')),
    COOKIE_NAME: 'rc_token',
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 5, retryAfterMs: 0 })),
    recordFailedAttempt: vi.fn(),
    clearAttempts: vi.fn(),
    configure: vi.fn(),
}));

vi.mock('@/lib/ldap', () => ({
    ldapBind: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('bcryptjs', () => ({
    default: { compare: vi.fn(() => Promise.resolve(true)) },
}));

import { POST } from '@/app/api/auth/login/route';
import { connectToCentralDB } from '@/lib/db';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

// Helper
function createRequest(body, ip = '127.0.0.1') {
    return {
        json: () => Promise.resolve(body),
        headers: { get: (name) => name === 'x-forwarded-for' ? ip : null },
    };
}

// Standard active user record
const ACTIVE_USER = {
    UserId: 1, Username: 'admin', PasswordHash: '$2a$10$xxx',
    FullName: 'Admin User', CompanyId: 1, RoleId: 1,
    RoleName: 'Admin', IsActive: true, TokenVersion: 0, AuthType: 'local',
};

describe('POST /api/auth/login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryIndex = 0;
        queryResults = [];
        checkRateLimit.mockReturnValue({ allowed: true, remaining: 5, retryAfterMs: 0 });
        bcrypt.compare.mockResolvedValue(true);
        connectToCentralDB.mockImplementation(() => Promise.resolve(createMockPool()));
    });

    // ─── Validation ─────────────────────────────────────────────

    it('returns 400 when username is missing', async () => {
        const res = await POST(createRequest({ password: 'test123' }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
        const res = await POST(createRequest({ username: 'admin' }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when both are empty strings', async () => {
        const res = await POST(createRequest({ username: '', password: '' }));
        expect(res.status).toBe(400);
    });

    // ─── Rate Limiting ──────────────────────────────────────────

    it('returns 429 when rate limited', async () => {
        checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 600000 });
        // Query results for rate limit config load
        queryResults = [{ recordset: [] }];

        const res = await POST(createRequest({ username: 'admin', password: 'test' }));
        expect(res.status).toBe(429);
    });

    // ─── User Not Found ─────────────────────────────────────────

    it('returns 401 when user not found and records failed attempt', async () => {
        // 1: rate limit config, 2: AuthType schema check, 3: user lookup (empty), 4: audit log
        queryResults = [
            { recordset: [] },
            { recordset: [{ COLUMN_NAME: 'AuthType' }] },
            { recordset: [] }, // user not found
            { recordset: [] }, // audit log
        ];

        const res = await POST(createRequest({ username: 'nobody', password: 'test' }));
        expect(res.status).toBe(401);
        expect(recordFailedAttempt).toHaveBeenCalledWith('127.0.0.1');
    });

    // ─── Inactive User ──────────────────────────────────────────

    it('returns 403 when user is inactive', async () => {
        queryResults = [
            { recordset: [] }, // rate limit config
            { recordset: [{ COLUMN_NAME: 'AuthType' }] }, // schema
            { recordset: [{ ...ACTIVE_USER, IsActive: false }] }, // user inactive
        ];

        const res = await POST(createRequest({ username: 'admin', password: 'test' }));
        expect(res.status).toBe(403);
    });

    // ─── Wrong Password ─────────────────────────────────────────

    it('returns 401 when password is incorrect', async () => {
        bcrypt.compare.mockResolvedValue(false);
        queryResults = [
            { recordset: [] }, // rate limit config
            { recordset: [{ COLUMN_NAME: 'AuthType' }] }, // schema
            { recordset: [ACTIVE_USER] }, // user found
            { recordset: [] }, // audit log
        ];

        const res = await POST(createRequest({ username: 'admin', password: 'wrong' }));
        expect(res.status).toBe(401);
        expect(recordFailedAttempt).toHaveBeenCalledWith('127.0.0.1');
    });

    // ─── Successful Login ───────────────────────────────────────

    it('returns 200 with user data on successful login', async () => {
        bcrypt.compare.mockResolvedValue(true);
        queryResults = [
            { recordset: [] }, // rate limit config
            { recordset: [{ COLUMN_NAME: 'AuthType' }] }, // schema
            { recordset: [ACTIVE_USER] }, // user found
            { recordset: [{ CompanyId: 1 }, { CompanyId: 2 }] }, // companies
            { recordset: [] }, // activity log
        ];

        const res = await POST(createRequest({ username: 'admin', password: 'correct' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.username).toBe('admin');
        expect(data.user.allowedCompanies).toEqual([1, 2]);
        expect(clearAttempts).toHaveBeenCalledWith('127.0.0.1');
    });

    // ─── Server Error ───────────────────────────────────────────

    it('returns 500 on database connection error', async () => {
        connectToCentralDB.mockRejectedValue(new Error('DB down'));

        const res = await POST(createRequest({ username: 'admin', password: 'test' }));
        expect(res.status).toBe(500);
    });
});
