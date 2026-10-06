import { describe, it, expect } from 'vitest';
import { barHeightPercent, fillDailyUsage, localDateKey } from '../dashboard-chart';

describe('fillDailyUsage', () => {
    it('returns the last 14 days ending today, with 0 for days without activity', () => {
        const rows = [
            { date: '2026-10-03', count: 12 },
            { date: '2026-10-05', count: 28 },
            { date: '2026-10-06', count: 25 },
        ];
        const days = fillDailyUsage(rows, '2026-10-06');
        expect(days).toHaveLength(14);
        expect(days[0]).toEqual({ date: '2026-09-23', count: 0 });
        expect(days.slice(-4)).toEqual([
            { date: '2026-10-03', count: 12 },
            { date: '2026-10-04', count: 0 },
            { date: '2026-10-05', count: 28 },
            { date: '2026-10-06', count: 25 },
        ]);
    });

    it('drops rows outside the window, such as the partial day the API can include', () => {
        const days = fillDailyUsage([{ date: '2026-09-22', count: 9 }, { date: '2026-09-23', count: 1 }], '2026-10-06');
        expect(days.some(d => d.date === '2026-09-22')).toBe(false);
        expect(days[0]).toEqual({ date: '2026-09-23', count: 1 });
    });

    it('crosses month and year ends', () => {
        const days = fillDailyUsage([], '2027-01-02', 4);
        expect(days.map(d => d.date)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    });
});

describe('barHeightPercent', () => {
    it('scales against the busiest day', () => {
        expect(barHeightPercent(36, 72)).toBe(50);
        expect(barHeightPercent(72, 72)).toBe(100);
    });

    it('keeps a small but visible bar for low days and none for empty days', () => {
        expect(barHeightPercent(1, 72)).toBe(4);
        expect(barHeightPercent(0, 72)).toBe(0);
        expect(barHeightPercent(0, 0)).toBe(0);
    });
});

describe('localDateKey', () => {
    it('formats the local calendar date as YYYY-MM-DD', () => {
        expect(localDateKey(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
        expect(localDateKey(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
    });
});
