import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { GET } from '../route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

describe('role access read contract', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns inactive assignments and report status so editing can retain them', async () => {
        getSession.mockResolvedValue({ roleName: 'Admin' });
        const queries = [];
        const reports = [
            { ReportId: 10, ReportName: 'Current', ReportType: 1, IsActive: true, CategoryId: 1, CategoryName: 'Finance', CategoryColor: 'blue' },
            { ReportId: 11, ReportName: 'Retained', ReportType: 1, IsActive: false, CategoryId: null, CategoryName: '', CategoryColor: '' },
        ];
        connectToCentralDB.mockResolvedValue({ request: () => ({ query: async text => {
            queries.push(text);
            if (text.includes('FROM Roles')) return { recordset: [{ RoleId: 2, RoleName: 'Reviewers', UserCount: 1 }] };
            const rows = /WHERE\s+(?:rpt|r)\.IsActive\s*=\s*1/i.test(text) ? reports.filter(r => r.IsActive) : reports;
            if (text.includes('FROM ReportRoleMapping')) return { recordset: rows.map(r => ({ RoleId: 2, ReportId: r.ReportId, ReportName: r.ReportName })) };
            return { recordset: rows };
        } }) });

        const response = await GET({});
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.roles[0].assignedReports).toEqual([10, 11]);
        expect(data.allReports.map(r => [r.ReportId, r.IsActive])).toEqual([[10, true], [11, false]]);
        expect(queries.find(q => q.includes('FROM Reports r'))).toMatch(/r\.IsActive/);
    });

    it('rejects a non-admin before connecting to the database', async () => {
        getSession.mockResolvedValue({ roleName: 'Reviewers' });
        const response = await GET({});
        expect(response.status).toBe(403);
        expect(connectToCentralDB).not.toHaveBeenCalled();
    });
});
