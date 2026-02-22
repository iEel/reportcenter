import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jose for JWT operations
vi.mock('jose', () => {
    class MockSignJWT {
        constructor() { }
        setProtectedHeader() { return this; }
        setIssuedAt() { return this; }
        setExpirationTime() { return this; }
        async sign() { return 'mock.jwt.token'; }
    }
    return {
        SignJWT: MockSignJWT,
        jwtVerify: vi.fn(),
    };
});

// Mock next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

// Mock db module
vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
}));

// Mock env
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing-only-32chars');

import { signToken, verifyToken, COOKIE_NAME } from '@/lib/auth';
import { jwtVerify } from 'jose';

describe('auth.js', () => {
    describe('signToken', () => {
        it('should return a JWT string', async () => {
            const payload = {
                userId: 1,
                username: 'admin',
                fullName: 'Admin User',
                roleId: 1,
                roleName: 'Admin',
                tokenVersion: 0,
            };
            const token = await signToken(payload);
            expect(token).toBe('mock.jwt.token');
            expect(typeof token).toBe('string');
        });
    });

    describe('verifyToken', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should return payload for valid token', async () => {
            const mockPayload = { userId: 1, username: 'admin', tokenVersion: 0 };
            jwtVerify.mockResolvedValue({ payload: mockPayload });

            const result = await verifyToken('valid.jwt.token');
            expect(result).toEqual(mockPayload);
        });

        it('should return null for invalid token', async () => {
            jwtVerify.mockRejectedValue(new Error('Token expired'));

            const result = await verifyToken('invalid.token');
            expect(result).toBeNull();
        });

        it('should return null for empty token', async () => {
            jwtVerify.mockRejectedValue(new Error('Invalid token'));

            const result = await verifyToken('');
            expect(result).toBeNull();
        });
    });

    describe('COOKIE_NAME', () => {
        it('should be rc_token', () => {
            expect(COOKIE_NAME).toBe('rc_token');
        });
    });
});
