import { describe, expect, it } from 'vitest';
import {
    activeIndexForQuery,
    filterReports,
    getNextActiveIndex,
    groupReports,
    splitSearchMatches,
    type StandardReport,
} from '../report-selector';

describe('literal search highlighting', () => {
    it('highlights each match without changing the original casing', () => {
        expect(splitSearchMatches('AP report / ap detail', 'ap')).toEqual([
            { text: 'AP', matched: true }, { text: ' report / ', matched: false },
            { text: 'ap', matched: true }, { text: ' detail', matched: false },
        ]);
    });
    it('treats regex characters and HTML as literal text', () => {
        expect(splitSearchMatches('<b>A.*</b>', '.*')).toEqual([
            { text: '<b>A', matched: false }, { text: '.*', matched: true }, { text: '</b>', matched: false },
        ]);
    });
    it('keeps Thai text and blank searches intact', () => {
        expect(splitSearchMatches('หมวดบัญชี', 'บัญชี')).toEqual([{ text: 'หมวด', matched: false }, { text: 'บัญชี', matched: true }]);
        expect(splitSearchMatches('AP report', '  ')).toEqual([{ text: 'AP report', matched: false }]);
    });
});

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
            { category: 'ยังไม่จัดหมวด', reports: [reports[2]] },
        ]);
    });

    it('keeps the fallback group after named categories', () => {
        expect(groupReports([
            reports[2],
            { ReportId: 5, ReportName: 'Named report', CategoryName: 'Account' },
        ]).map((group) => group.category)).toEqual(['Account', 'ยังไม่จัดหมวด']);
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

describe('activeIndexForQuery', () => {
    it('highlights the first result after typing so Enter opens it', () => {
        expect(activeIndexForQuery('aged', 3)).toBe(0);
    });

    it('highlights nothing for a blank search or when nothing matches', () => {
        expect(activeIndexForQuery('   ', 3)).toBe(-1);
        expect(activeIndexForQuery('zzz', 0)).toBe(-1);
    });
});
