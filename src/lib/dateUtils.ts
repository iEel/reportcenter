/**
 * Date/Time utilities for ReportCenter
 * Timezone: Asia/Bangkok (UTC+7)
 * Format: 24-hour clock, Thai locale
 *
 * NOTE: MSSQL DATETIME columns have no timezone info.
 * The mssql driver may serialize them with a trailing "Z" (UTC marker),
 * but the actual values in the DB are already in Bangkok time.
 * We strip the "Z" so JavaScript interprets them as local time,
 * which avoids a double +7 offset.
 */

const LOCALE = 'th-TH';

/**
 * Normalize a date value from MSSQL.
 * - If it's a string ending with "Z", strip the Z so `new Date()` treats it as local time.
 * - If it's already a Date object, use as-is.
 */
function toDate(input: string | Date): Date {
    if (input instanceof Date) return input;
    // Strip trailing Z to prevent UTC interpretation
    const cleaned = typeof input === 'string' ? input.replace(/Z$/i, '') : input;
    return new Date(cleaned);
}

/** Format date+time: "21/02/2569 14:30" */
export function formatDateTime(dateStr: string | Date): string {
    const d = toDate(dateStr);
    return d.toLocaleString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

/** Format date only: "21/02/2569" */
export function formatDate(dateStr: string | Date): string {
    const d = toDate(dateStr);
    return d.toLocaleDateString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/** Format time only: "14:30" */
export function formatTime(dateStr: string | Date): string {
    const d = toDate(dateStr);
    return d.toLocaleTimeString(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

/** Format short date: "21 ก.พ." */
export function formatDateShort(dateStr: string | Date): string {
    const d = toDate(dateStr);
    return d.toLocaleDateString(LOCALE, {
        day: 'numeric',
        month: 'short',
    });
}

/** Relative time: "เมื่อสักครู่", "5 นาทีที่แล้ว", "3 ชั่วโมงที่แล้ว", "2 วันที่แล้ว", or date */
export function timeAgo(dateStr: string | Date): string {
    const d = toDate(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'เมื่อสักครู่';
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

    return formatDateTime(dateStr);
}
