import { describe, expect, it } from 'vitest';
import { categoryFilterLabel, matchesReportSearch, toggleVisibleReportSelection } from '../report-registry';

describe('category filter label', () => {
    const categories = [{ CategoryId: 3, CategoryName: 'บัญชี' }];
    it('names a known category and the uncategorized filter', () => {
        expect(categoryFilterLabel('3', categories, true)).toBe('บัญชี');
        expect(categoryFilterLabel('uncategorized', categories, true)).toBe('ยังไม่จัดหมวด');
        expect(categoryFilterLabel('none', categories, true)).toBe('ยังไม่จัดหมวด');
    });
    it('does not call an unknown category "uncategorized"', () => {
        expect(categoryFilterLabel('999', categories, true)).toBe('ไม่พบหมวด #999');
    });
    it('shows the raw id while categories are not available', () => {
        expect(categoryFilterLabel('3', [], false)).toBe('หมวด #3');
    });
    it('has no label when not filtering by category', () => {
        expect(categoryFilterLabel('all', categories, true)).toBeNull();
    });
});

describe('report registry search', () => {
    const report = { ReportId: 20, ReportName: 'Business File', Description: 'บัญชีรายวัน' };
    it('finds both displayed and unpadded report IDs', () => {
        expect(matchesReportSearch(report, 'RID-0020')).toBe(true);
        expect(matchesReportSearch(report, 'rid-20')).toBe(true);
        expect(matchesReportSearch(report, 'RID-0021')).toBe(false);
    });
    it('still finds names and Thai descriptions', () => {
        expect(matchesReportSearch(report, 'business')).toBe(true);
        expect(matchesReportSearch(report, 'บัญชี')).toBe(true);
    });
    it('treats whitespace-only searches as no filter', () => {
        expect(matchesReportSearch(report, '  ')).toBe(true);
    });
});

describe('filtered registry selection', () => {
    it('selects visible reports without discarding hidden selected reports', () => {
        expect(toggleVisibleReportSelection([7], [1, 2])).toEqual([7, 1, 2]);
    });
    it('unselects only visible reports when all of them are selected', () => {
        expect(toggleVisibleReportSelection([7, 1, 2], [1, 2])).toEqual([7]);
    });
    it('does not confuse equal counts with the same selected reports', () => {
        expect(toggleVisibleReportSelection([7, 8], [1, 2])).toEqual([7, 8, 1, 2]);
    });
    it('does not change selection when there are no results', () => {
        expect(toggleVisibleReportSelection([7], [])).toEqual([7]);
    });
});
