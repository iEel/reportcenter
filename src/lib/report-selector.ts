export interface StandardReport {
    ReportId: number;
    ReportName: string;
    Description?: string | null;
    CategoryName?: string | null;
    CategoryColor?: string | null;
    IsHeavy?: boolean;
}

export interface ReportGroup {
    category: string;
    reports: StandardReport[];
}

const normalize = (value?: string | null) => value?.trim().toLocaleLowerCase() ?? '';

/** Return text fragments for React to render; report text is never interpreted as HTML. */
export function splitSearchMatches(text: string, query: string): { text: string; matched: boolean }[] {
    const term = query.trim();
    if (!term) return [{ text, matched: false }];
    const expression = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const parts: { text: string; matched: boolean }[] = [];
    let cursor = 0;
    for (const match of text.matchAll(expression)) {
        if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), matched: false });
        parts.push({ text: match[0], matched: true });
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), matched: false });
    return parts;
}

export function filterReports(reports: StandardReport[], query: string): StandardReport[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return reports;

    return reports.filter((report) =>
        [report.ReportName, report.Description, report.CategoryName]
            .some((value) => normalize(value).includes(normalizedQuery))
    );
}

export function groupReports(reports: StandardReport[]): ReportGroup[] {
    const groups = new Map<string, StandardReport[]>();

    reports.forEach((report) => {
        const category = report.CategoryName?.trim() || 'ยังไม่จัดหมวด';
        groups.set(category, [...(groups.get(category) ?? []), report]);
    });

    return Array.from(groups, ([category, categoryReports]) => ({
        category,
        reports: [...categoryReports].sort((a, b) => a.ReportName.localeCompare(b.ReportName, 'th')),
    })).sort((a, b) => {
        if (a.category === 'ยังไม่จัดหมวด') return 1;
        if (b.category === 'ยังไม่จัดหมวด') return -1;
        return a.category.localeCompare(b.category, 'th');
    });
}

/** After typing, highlight the first match so Enter opens it (the list footer promises "Enter เปิดรายงาน"). */
export function activeIndexForQuery(query: string, resultCount: number) {
    return query.trim() && resultCount > 0 ? 0 : -1;
}

export function getNextActiveIndex(
    currentIndex: number,
    resultCount: number,
    direction: 1 | -1,
): number {
    if (resultCount === 0) return -1;
    if (currentIndex < 0) return direction === 1 ? 0 : resultCount - 1;
    return (currentIndex + direction + resultCount) % resultCount;
}
