import { describe, expect, it } from 'vitest';
import { matchesReportSearch, toggleVisibleReportSelection } from '../report-registry';

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
