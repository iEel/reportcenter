import { describe, it, expect, vi } from 'vitest';

// Mock env-check to prevent startup errors
vi.mock('@/lib/env-check', () => ({}));

// Mock mssql
vi.mock('mssql', () => ({
    default: {
        ConnectionPool: vi.fn(),
        Int: 'Int',
        NVarChar: vi.fn(() => 'NVarChar'),
    },
}));

// Set required env vars before importing db
vi.stubEnv('DB_USER', 'testuser');
vi.stubEnv('DB_PASSWORD', 'testpass');
vi.stubEnv('DB_SERVER', 'localhost');
vi.stubEnv('DB_DATABASE', 'TestDB');
vi.stubEnv('DB_INSTANCE', 'TestInstance');
vi.stubEnv('DB_REQUEST_TIMEOUT', '15000');
vi.stubEnv('DB_CONNECTION_TIMEOUT', '5000');
vi.stubEnv('DB_POOL_MIN', '3');
vi.stubEnv('DB_POOL_MAX', '25');
vi.stubEnv('C1_DB_USER', 'c1user');
vi.stubEnv('C1_DB_PASSWORD', 'c1pass');
vi.stubEnv('C1_DB_SERVER', '192.168.1.1');
vi.stubEnv('C1_DB_DATABASE', 'Company1DB');
vi.stubEnv('C2_DB_USER', 'c2user');
vi.stubEnv('C2_DB_PASSWORD', 'c2pass');
vi.stubEnv('C2_DB_SERVER', '192.168.1.2');
vi.stubEnv('C2_DB_DATABASE', 'Company2DB');
vi.stubEnv('C3_DB_USER', 'c3user');
vi.stubEnv('C3_DB_PASSWORD', 'c3pass');
vi.stubEnv('C3_DB_SERVER', '192.168.1.3');
vi.stubEnv('C3_DB_DATABASE', 'Company3DB');

import { getCompanyLabel } from '@/lib/db';

describe('db.js', () => {
    describe('getCompanyLabel', () => {
        it('should return SNI for company 1', () => {
            expect(getCompanyLabel(1)).toBe('SNI');
        });

        it('should return GRL for company 2', () => {
            expect(getCompanyLabel(2)).toBe('GRL');
        });

        it('should return SALOG for company 3', () => {
            expect(getCompanyLabel(3)).toBe('SALOG');
        });

        it('should return fallback label for unknown company', () => {
            expect(getCompanyLabel(99)).toBe('บริษัท 99');
        });

        it('should handle string companyId', () => {
            expect(getCompanyLabel('1')).toBe('SNI');
        });
    });
});
