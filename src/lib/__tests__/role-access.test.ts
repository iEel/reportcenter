import { describe, expect, it } from 'vitest';
import {
    createRoleDraft, draftChanges, draftPayload, editReports, setDraftReports,
    reportsForRole, reportCounts, compareRoleReports,
} from '../role-access';

const reports = [
    { ReportId: 10, ReportName: 'AP detail', IsActive: true, CategoryId: 1 },
    { ReportId: 11, ReportName: 'AP old', IsActive: false, CategoryId: 1 },
    { ReportId: 12, ReportName: 'GL detail', IsActive: true, CategoryId: 1 },
    { ReportId: 13, ReportName: 'Unassigned old', IsActive: false, CategoryId: null },
];
const role = { RoleId: 2, RoleName: 'Reviewers', assignedReports: [10, 11] };

describe('role permission drafts', () => {
    it('copies every assignment including inactive reports and pins the original role', () => {
        const source = { ...role, assignedReports: [10, 11] };
        const draft = createRoleDraft(source);
        source.assignedReports.push(12);
        expect(draftPayload(draft)).toEqual({ roleId: 2, roleName: 'Reviewers', assignedReports: [10, 11] });
    });

    it('offers active reports and only the inactive reports already assigned to this role', () => {
        expect(editReports(reports, createRoleDraft(role), '').map(r => r.ReportId)).toEqual([10, 11, 12]);
        expect(editReports(reports, createRoleDraft(role), '  AP  ').map(r => r.ReportId)).toEqual([10, 11]);
    });

    it('changes only the displayed selection while retaining reports hidden by a search', () => {
        const original = createRoleDraft(role);
        const added = setDraftReports(original, [12], true);
        const changed = setDraftReports(added, [10], false);
        expect(draftPayload(changed)).toEqual({ roleId: 2, roleName: 'Reviewers', assignedReports: [11, 12] });
        expect(draftChanges(changed)).toEqual({ added: [12], removed: [10], dirty: true });
        expect(draftPayload(original).assignedReports).toEqual([10, 11]);
    });

    it('restoring the initial assignment clears the dirty state without duplicating ids', () => {
        const changed = setDraftReports(createRoleDraft(role), [12, 12], true);
        const restored = setDraftReports(changed, [12], false);
        expect(draftChanges(restored)).toEqual({ added: [], removed: [], dirty: false });
        expect(draftPayload(restored).assignedReports).toEqual([10, 11]);
    });

    it('counts inactive assignments separately and Admin automatically sees all active reports', () => {
        expect(reportCounts(reportsForRole(role, reports))).toEqual({ active: 1, inactive: 1 });
        const admin = { RoleId: 1, RoleName: 'ADMIN', assignedReports: [] };
        expect(reportsForRole(admin, reports).map(r => r.ReportId)).toEqual([10, 12]);
    });

    it('compares active reports without interpreting retained inactive mappings as visible access', () => {
        const other = { RoleId: 3, RoleName: 'Other', assignedReports: [10, 12, 13] };
        expect(compareRoleReports(role, other, reports)).toEqual({ both: [10], onlyA: [], onlyB: [12], union: 2 });
    });
});
