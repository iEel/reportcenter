import { describe, it, expect, vi } from 'vitest';
import sql from 'mssql';
import { buildAuditFilter, likeContains } from '@/lib/audit-log-filter';

const bound = filter => {
    const req = { input: vi.fn(() => req) };
    filter.bind(req);
    return Object.fromEntries(req.input.mock.calls.map(([name, , value]) => [name, value]));
};

describe('likeContains', () => {
    it('matches LIKE wildcards literally', () => {
        expect(likeContains('AP 50%_[x]')).toBe('%AP 50[%][_][[]x]%');
    });
});

describe('buildAuditFilter', () => {
    it('adds nothing without filters', () => {
        const filter = buildAuditFilter({});
        expect(filter.where).toBe('');
        expect(bound(filter)).toEqual({});
    });

    it('searches the details and the user name and login for a trimmed keyword', () => {
        const filter = buildAuditFilter({ q: '  AP Aged  ' });
        expect(filter.where).toBe('WHERE (a.Details LIKE @Q OR u.FullName LIKE @Q OR u.Username LIKE @Q)');
        expect(bound(filter)).toEqual({ Q: '%AP Aged%' });
    });

    it('limits the keyword to 100 characters', () => {
        expect(bound(buildAuditFilter({ q: 'ก'.repeat(150) })).Q).toBe(`%${'ก'.repeat(100)}%`);
    });

    it('combines every filter with AND, binding ids as integers and dates as dates', () => {
        const filter = buildAuditFilter({
            q: 'x', actionType: 'EXPORT_EXCEL', userId: '7', reportId: '12', companyId: '2', dateFrom: '2026-10-01', dateTo: '2026-10-06',
        });
        expect(filter.where).toBe('WHERE (a.Details LIKE @Q OR u.FullName LIKE @Q OR u.Username LIKE @Q)'
            + ' AND a.ActionType = @ActionType AND a.UserId = @FilterUserId AND a.ReportId = @FilterReportId'
            + ' AND a.CompanyId = @FilterCompanyId AND a.CreatedAt >= @DateFrom AND a.CreatedAt < DATEADD(DAY, 1, @DateTo)');
        expect(bound(filter)).toEqual({
            Q: '%x%', ActionType: 'EXPORT_EXCEL', FilterUserId: 7, FilterReportId: 12, FilterCompanyId: 2, DateFrom: '2026-10-01', DateTo: '2026-10-06',
        });
    });

    it('ignores ids that are not numbers', () => {
        const filter = buildAuditFilter({ userId: 'abc', reportId: '', companyId: undefined });
        expect(filter.where).toBe('');
    });

    it('binds with the SQL types the columns use', () => {
        const req = { input: vi.fn(() => req) };
        buildAuditFilter({ userId: '7', dateFrom: '2026-10-01' }).bind(req);
        expect(req.input).toHaveBeenCalledWith('FilterUserId', sql.Int, 7);
        expect(req.input).toHaveBeenCalledWith('DateFrom', sql.Date, '2026-10-01');
    });
});
