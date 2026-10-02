export type CategorySelection = number | 'uncategorized';
export interface CategoryDraft { id: number | 'new'; name: string; color: string }

/** Draft feedback from the loaded list; the API remains authoritative when saving. */
export function categoryNameConflict(draft: Pick<CategoryDraft, 'id' | 'name'>, categories: ReadonlyArray<{ CategoryId: number; CategoryName: string }>) {
    const name = draft.name.trim().toLowerCase();
    if (!name) return undefined;
    return categories.find(category => category.CategoryId !== draft.id && category.CategoryName.trim().toLowerCase() === name);
}

export function parseCategorySelection(value: string | null): CategorySelection {
    if (value === 'uncategorized' || value === 'none') return 'uncategorized';
    const id = value && /^\d+$/.test(value) ? Number(value) : 0;
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function categoryReportCounts(reports: ReadonlyArray<{ IsActive: boolean | number }>) {
    const active = reports.filter(report => report.IsActive === true || report.IsActive === 1).length;
    return { active, inactive: reports.length - active, total: reports.length };
}

export function resolveCategorySelection(categories: ReadonlyArray<{ CategoryId: number }>, selected: CategorySelection): CategorySelection {
    return selected === 'uncategorized' || categories.some(category => category.CategoryId === selected)
        ? selected : categories[0]?.CategoryId ?? 'uncategorized';
}

export function categoryDraftIsDirty(draft: CategoryDraft | null, categories: ReadonlyArray<{ CategoryId: number; CategoryName: string; ColorTag: string | null }>) {
    if (!draft) return false;
    const original = draft.id === 'new'
        ? { CategoryName: '', ColorTag: 'blue' }
        : categories.find(category => category.CategoryId === draft.id);
    return !original || draft.name !== original.CategoryName || draft.color !== (original.ColorTag || 'slate');
}
