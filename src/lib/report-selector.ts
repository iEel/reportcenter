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
        const category = report.CategoryName?.trim() || 'อื่น ๆ';
        groups.set(category, [...(groups.get(category) ?? []), report]);
    });

    return Array.from(groups, ([category, categoryReports]) => ({
        category,
        reports: [...categoryReports].sort((a, b) => a.ReportName.localeCompare(b.ReportName, 'th')),
    })).sort((a, b) => {
        if (a.category === 'อื่น ๆ') return 1;
        if (b.category === 'อื่น ๆ') return -1;
        return a.category.localeCompare(b.category, 'th');
    });
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
