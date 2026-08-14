import { describe, expect, it } from 'vitest';
import {
    filterReports,
    getNextActiveIndex,
    groupReports,
    type StandardReport,
} from '../report-selector';

const reports: StandardReport[] = [
    {
        ReportId: 2,
        ReportName: 'สรุปยอดขายประจำเดือน',
        Description: 'ยอดขายแยกตามสาขา',
        CategoryName: 'Sales',
    },
    {
        ReportId: 1,
        ReportName: 'Customer aging detail',
        Description: 'Outstanding invoices by customer',
        CategoryName: 'Account',
    },
    {
        ReportId: 3,
        ReportName: 'รายงานสินค้าคงเหลือ',
        Description: null,
        CategoryName: null,
    },
];

describe('filterReports', () => {
    it('returns every report when the query is blank', () => {
        expect(filterReports(reports, '   ')).toEqual(reports);
    });

    it('matches a report name without case sensitivity', () => {
        expect(filterReports(reports, 'CUSTOMER')).toEqual([reports[1]]);
    });

    it('matches a report description without case sensitivity', () => {
        expect(filterReports(reports, 'outstanding')).toEqual([reports[1]]);
    });

    it('matches a report category without case sensitivity', () => {
        expect(filterReports(reports, 'sales')).toEqual([reports[0]]);
    });
});

describe('groupReports', () => {
    it('groups reports by category and sorts groups and report names', () => {
        const grouped = groupReports([
            { ReportId: 4, ReportName: 'Zulu', CategoryName: 'Sales' },
            { ReportId: 2, ReportName: 'Beta', CategoryName: 'Account' },
            { ReportId: 1, ReportName: 'Alpha', CategoryName: 'Account' },
        ]);

        expect(grouped).toEqual([
            {
                category: 'Account',
                reports: [
                    { ReportId: 1, ReportName: 'Alpha', CategoryName: 'Account' },
                    { ReportId: 2, ReportName: 'Beta', CategoryName: 'Account' },
                ],
            },
            {
                category: 'Sales',
                reports: [{ ReportId: 4, ReportName: 'Zulu', CategoryName: 'Sales' }],
            },
        ]);
    });

    it('puts reports without a category in the fallback group', () => {
        expect(groupReports([reports[2]])).toEqual([
            { category: 'อื่น ๆ', reports: [reports[2]] },
        ]);
    });

    it('keeps the fallback group after named categories', () => {
        expect(groupReports([
            reports[2],
            { ReportId: 5, ReportName: 'Named report', CategoryName: 'Account' },
        ]).map((group) => group.category)).toEqual(['Account', 'อื่น ๆ']);
    });
});

describe('getNextActiveIndex', () => {
    it('moves to the first result when pressing down without an active result', () => {
        expect(getNextActiveIndex(-1, 3, 1)).toBe(0);
    });

    it('wraps from the last result to the first when moving down', () => {
        expect(getNextActiveIndex(2, 3, 1)).toBe(0);
    });

    it('wraps from the first result to the last when moving up', () => {
        expect(getNextActiveIndex(0, 3, -1)).toBe(2);
    });

    it('returns no active result when the result list is empty', () => {
        expect(getNextActiveIndex(0, 0, 1)).toBe(-1);
    });
});
