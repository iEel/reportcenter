export interface DailyUsage { date: string; count: number }

const DAY_MS = 86400000;

/** The local calendar date as YYYY-MM-DD (the charts API groups by the server's local date). */
export function localDateKey(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The last `days` calendar days up to `today` (YYYY-MM-DD), with 0 for days without activity.
 * The API only returns days that had activity, so without this the axis skips quiet days.
 */
export function fillDailyUsage(rows: DailyUsage[], today: string, days = 14): DailyUsage[] {
    const counts = new Map(rows.map(row => [row.date, Number(row.count) || 0]));
    const end = Date.parse(`${today}T00:00:00Z`);
    return Array.from({ length: days }, (_, i) => {
        const date = new Date(end - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);
        return { date, count: counts.get(date) ?? 0 };
    });
}

/** Bar height as % of the busiest day; days with activity get at least 4% so they stay visible. */
export function barHeightPercent(count: number, max: number) {
    if (count <= 0 || max <= 0) return 0;
    return Math.max((count / max) * 100, 4);
}

/** Total, rounded daily average and busiest day of a filled window (peak is null when nothing happened). */
export function summarizeUsage(days: DailyUsage[]) {
    const total = days.reduce((sum, day) => sum + day.count, 0);
    const peak = days.reduce<DailyUsage | null>((best, day) => (day.count > (best?.count ?? 0) ? day : best), null);
    return { total, average: days.length ? Math.round(total / days.length) : 0, peak };
}

/** "2026-10-02" → "2 ต.ค." */
export function shortThaiDate(dateKey: string) {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
