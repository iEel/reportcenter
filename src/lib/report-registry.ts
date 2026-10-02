export function toggleVisibleReportSelection(selected: number[], visible: number[]): number[] {
    if (!visible.length) return selected;
    const shown = new Set(visible);
    return visible.every(id => selected.includes(id))
        ? selected.filter(id => !shown.has(id))
        : [...new Set([...selected, ...visible])];
}

export function matchesReportSearch(report: { ReportId: number; ReportName: string; Description?: string | null }, query: string) {
    const content = `${report.ReportName} ${report.Description || ''} RID-${String(report.ReportId).padStart(4, '0')} RID-${report.ReportId}`;
    return content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
