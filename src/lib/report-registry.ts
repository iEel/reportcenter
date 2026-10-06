export function toggleVisibleReportSelection(selected: number[], visible: number[]): number[] {
    if (!visible.length) return selected;
    const shown = new Set(visible);
    return visible.every(id => selected.includes(id))
        ? selected.filter(id => !shown.has(id))
        : [...new Set([...selected, ...visible])];
}

/** Chip label for the category filter in the URL; an unknown id must not read as "uncategorized". */
export function categoryFilterLabel(filter: string, categories: { CategoryId: number; CategoryName: string }[], categoriesLoaded: boolean) {
    if (filter === 'all') return null;
    if (filter === 'uncategorized' || filter === 'none') return 'ยังไม่จัดหมวด';
    const category = categories.find(item => String(item.CategoryId) === filter);
    if (category) return category.CategoryName;
    return categoriesLoaded ? `ไม่พบหมวด #${filter}` : `หมวด #${filter}`;
}

export function matchesReportSearch(report: { ReportId: number; ReportName: string; Description?: string | null }, query: string) {
    const content = `${report.ReportName} ${report.Description || ''} RID-${String(report.ReportId).padStart(4, '0')} RID-${report.ReportId}`;
    return content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
