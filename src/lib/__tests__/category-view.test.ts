import { describe, expect, it } from 'vitest';
import { categoryDraftIsDirty, categoryNameConflict, categoryReportCounts, parseCategorySelection, resolveCategorySelection } from '../category-view';

describe('category view', () => {
    it('opens the category requested by a registry link, including uncategorized', () => {
        expect(parseCategorySelection('2')).toBe(2);
        expect(parseCategorySelection('uncategorized')).toBe('uncategorized');
        expect(parseCategorySelection('none')).toBe('uncategorized');
        expect(parseCategorySelection(null)).toBe(0);
        expect(parseCategorySelection('2invalid')).toBe(0);
        expect(parseCategorySelection('-2')).toBe(0);
        expect(resolveCategorySelection([{ CategoryId: 1 }, { CategoryId: 2 }], parseCategorySelection('2'))).toBe(2);
    });

    it('counts inactive reports in deletion impact while keeping the active count separate', () => {
        expect(categoryReportCounts([{ IsActive: true }, { IsActive: 1 }, { IsActive: false }, { IsActive: 0 }])).toEqual({ active: 2, inactive: 2, total: 4 });
        expect(categoryReportCounts([])).toEqual({ active: 0, inactive: 0, total: 0 });
    });

    it('preserves a selected category or the uncategorized view when data refreshes', () => {
        const categories = [{ CategoryId: 1 }, { CategoryId: 2 }];
        expect(resolveCategorySelection(categories, 2)).toBe(2);
        expect(resolveCategorySelection(categories, 'uncategorized')).toBe('uncategorized');
        expect(resolveCategorySelection(categories, 9)).toBe(1);
        expect(resolveCategorySelection([], 9)).toBe('uncategorized');
    });

    it('guards color-only edits, changed new drafts, and drafts whose category disappeared', () => {
        const categories = [{ CategoryId: 1, CategoryName: 'Finance', ColorTag: 'blue' }];
        expect(categoryDraftIsDirty(null, categories)).toBe(false);
        expect(categoryDraftIsDirty({ id: 1, name: 'Finance', color: 'blue' }, categories)).toBe(false);
        expect(categoryDraftIsDirty({ id: 1, name: 'Finance', color: 'rose' }, categories)).toBe(true);
        expect(categoryDraftIsDirty({ id: 'new', name: '', color: 'blue' }, categories)).toBe(false);
        expect(categoryDraftIsDirty({ id: 'new', name: 'New', color: 'blue' }, categories)).toBe(true);
        expect(categoryDraftIsDirty({ id: 9, name: 'Missing', color: 'blue' }, categories)).toBe(true);
    });

    it('detects a new duplicate after trimming and case folding, even with no active reports', () => {
        const categories = [{ CategoryId: 7, CategoryName: '  Account  ', ReportCount: 0, InactiveReportCount: 3 }];
        expect(categoryNameConflict({ id: 'new', name: ' ACCOUNT ' }, categories)?.CategoryId).toBe(7);
    });

    it('allows retaining the edited category name but rejects another category with that name', () => {
        const categories = [{ CategoryId: 1, CategoryName: 'Account' }, { CategoryId: 2, CategoryName: 'Finance' }];
        expect(categoryNameConflict({ id: 1, name: ' account ' }, categories)).toBeUndefined();
        expect(categoryNameConflict({ id: 1, name: 'FINANCE' }, categories)?.CategoryId).toBe(2);
        expect(categoryNameConflict({ id: 1, name: 'Account' }, [...categories, { CategoryId: 3, CategoryName: 'ACCOUNT' }])?.CategoryId).toBe(3);
    });

    it('keeps distinct names available and leaves blank-name validation to the form', () => {
        const categories = [{ CategoryId: 1, CategoryName: 'Account' }];
        expect(categoryNameConflict({ id: 'new', name: 'Account Summary' }, categories)).toBeUndefined();
        expect(categoryNameConflict({ id: 'new', name: '  ' }, categories)).toBeUndefined();
    });
});
