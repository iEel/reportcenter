import { describe, it, expect, vi, beforeEach } from 'vitest';
import sql from 'mssql';

vi.mock('@/lib/sql-validator', () => ({ validateQuery: vi.fn(() => ({ safe: true })) }));

import TediousDecimal from 'tedious/lib/data-types/decimal';
import { prepareReportRun, bindReportParameters, numberParameterType } from '@/lib/report-run';
import { validateQuery } from '@/lib/sql-validator';

let results;
let queries;

function centralPool() {
    return {
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => { queries.push({ text, inputs }); return results.shift() || { recordset: [] }; }),
            };
            return req;
        },
    };
}

const admin = { userId: 1, roleId: 1, roleName: 'Admin', allowedCompanies: [1, 2] };
const user = { userId: 2, roleId: 5, roleName: 'User', allowedCompanies: [1] };
const report = { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'ยอดขาย' }] };

describe('prepareReportRun', () => {
    beforeEach(() => {
        results = [];
        queries = [];
        validateQuery.mockReturnValue({ safe: true });
    });

    it('returns 404 when the report does not exist', async () => {
        results = [{ recordset: [] }];
        expect(await prepareReportRun({ session: admin, reportId: 9, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: false, status: 404, message: 'Report not found' });
    });

    it('blocks unsafe SQL with 403 and logs BLOCKED_QUERY', async () => {
        results = [{ recordset: [{ TSqlQuery: 'DROP TABLE X', ReportName: 'Evil' }] }];
        validateQuery.mockReturnValue({ safe: false, reason: 'พบคำสั่งต้องห้าม: DROP' });
        const run = await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: centralPool() });
        expect(run).toEqual({ ok: false, status: 403, message: 'คำสั่ง SQL ถูกบล็อกเนื่องจากมีคำสั่งที่ไม่อนุญาต: พบคำสั่งต้องห้าม: DROP' });
        expect(queries[1].text).toMatch(/INSERT INTO ActivityLogs/);
        expect(queries[1].inputs.ActionType).toBe('BLOCKED_QUERY');
    });

    it('still answers 403 when the BLOCKED_QUERY log fails', async () => {
        const pool = centralPool();
        const original = pool.request;
        let calls = 0;
        pool.request = () => {
            const req = original();
            if (++calls === 2) req.query = vi.fn(async () => { throw new Error('no table'); });
            return req;
        };
        results = [{ recordset: [{ TSqlQuery: 'DROP TABLE X', ReportName: 'Evil' }] }];
        validateQuery.mockReturnValue({ safe: false, reason: 'DROP' });
        expect((await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: pool })).status).toBe(403);
    });

    it('refuses a company outside the session list for every role, before the role check', async () => {
        results = [report];
        const run = await prepareReportRun({ session: admin, reportId: 1, companyId: 3, centralPool: centralPool() });
        expect(run).toEqual({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' });
        expect(queries).toHaveLength(1);
    });

    it('accepts a companyId sent as a string', async () => {
        results = [report, { recordset: [] }];
        expect((await prepareReportRun({ session: admin, reportId: 1, companyId: '2', centralPool: centralPool() })).ok).toBe(true);
    });

    it('refuses a non-admin whose role is not mapped to the report', async () => {
        results = [report, { recordset: [] }];
        expect(await prepareReportRun({ session: user, reportId: 1, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
    });

    it('returns the query, name and parameter definitions for a mapped user', async () => {
        const params = [{ ParameterName: '@from', InputType: 'date' }];
        results = [report, { recordset: [{ 1: 1 }] }, { recordset: params }];
        expect(await prepareReportRun({ session: user, reportId: 1, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: true, tSqlQuery: 'SELECT 1', reportName: 'ยอดขาย', expectedParams: params });
    });

    it('skips the role query for admins', async () => {
        results = [report, { recordset: [] }];
        await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: centralPool() });
        expect(queries.map(q => q.text).some(text => /ReportRoleMapping/.test(text))).toBe(false);
    });
});

describe('bindReportParameters', () => {
    const expected = [
        { ParameterName: '@from', InputType: 'date' },
        { ParameterName: '@amount', InputType: 'number' },
        { ParameterName: '@name', InputType: 'text' },
        { ParameterName: '@blank', InputType: 'text' },
    ];

    it('binds by input type and sends empty values as NULL', () => {
        const req = { input: vi.fn() };
        bindReportParameters(req, expected, { '@from': '2026-01-01', '@amount': '12.5', '@name': 'ก', '@blank': '' });
        expect(req.input).toHaveBeenCalledWith('from', sql.Date, '2026-01-01');
        expect(req.input).toHaveBeenCalledWith('amount', expect.objectContaining({ type: sql.Decimal, precision: 18, scale: 1 }), 12.5);
        expect(req.input).toHaveBeenCalledWith('name', expect.objectContaining({ type: sql.NVarChar }), 'ก');
        expect(req.input).toHaveBeenCalledWith('blank', expect.objectContaining({ type: sql.NVarChar }), null);
    });

    it('binds nothing when no parameter values were sent', () => {
        const req = { input: vi.fn() };
        bindReportParameters(req, expected, undefined);
        expect(req.input).not.toHaveBeenCalled();
    });
});

describe('numberParameterType', () => {
    const scaleOf = value => numberParameterType(value).scale;

    it('keeps whole numbers as decimal(18, 0), exactly as before', () => {
        expect(numberParameterType('2026')).toEqual({ type: sql.Decimal, precision: 18, scale: 0 });
        expect(numberParameterType('-15')).toEqual({ type: sql.Decimal, precision: 18, scale: 0 });
    });

    it('keeps the decimals the user typed', () => {
        expect(scaleOf('12.5')).toBe(1);
        expect(scaleOf('0.125')).toBe(3);
        expect(scaleOf('-3.25')).toBe(2);
    });

    it('caps the scale at 8 decimals, including exponent notation', () => {
        expect(scaleOf('1.123456789')).toBe(8);
        expect(scaleOf('1e-7')).toBe(8);
    });

    it('makes SQL Server receive 12.5, not 13', () => {
        const type = numberParameterType('12.5');
        const parameter = { value: 12.5, precision: type.precision, scale: type.scale };
        expect(TediousDecimal.declaration(parameter)).toBe('decimal(18, 1)');
        const sent = Buffer.concat([...TediousDecimal.generateParameterData(parameter, {})]);
        expect(sent.readUInt32LE(1)).toBe(125); // unscaled integer: 125 × 10^-1 = 12.5
    });
});
