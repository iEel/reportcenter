import { describe, expect, it } from 'vitest';
import { getUserAccessSummary, hasUserDraftChanges, isAdAccount, isCurrentUser } from '../user-access';

const roles = [
    { RoleId: 1, RoleName: 'Admin', assignedReports: [] },
    { RoleId: 2, RoleName: 'Account', assignedReports: [10, 11, 12, 10, 99] },
    { RoleId: 3, RoleName: 'No reports', assignedReports: [] },
];
const reports = [
    { ReportId: 10, IsActive: true },
    { ReportId: 11, IsActive: false },
    { ReportId: 12, IsActive: 1 },
    { ReportId: 13, IsActive: 0 },
    { ReportId: 14, IsActive: true },
];
const companies = [
    { id: 7, code: 'REAL-A', name: 'Company A' },
    { id: 9, code: 'REAL-B', name: 'Company B' },
];

describe('getUserAccessSummary', () => {
    it('counts only distinct active reports assigned to the selected group', () => {
        expect(getUserAccessSummary('2', [9], roles, reports, companies)).toEqual({
            roleName: 'Account', isAdmin: false, activeReportCount: 2,
            companyCodes: ['REAL-B'], unknownCompanyIds: [],
        });
    });

    it('counts all active reports for Admin without requiring mappings', () => {
        const result = getUserAccessSummary(1, [7, 9], roles, reports, companies);
        expect(result.activeReportCount).toBe(3);
        expect(result.isAdmin).toBe(true);
    });

    it('distinguishes no selection or unavailable report metadata from a group with zero reports', () => {
        expect(getUserAccessSummary('', [], roles, reports, companies).activeReportCount).toBeNull();
        expect(getUserAccessSummary(2, [], roles, null, companies).activeReportCount).toBeNull();
        expect(getUserAccessSummary(3, [], roles, reports, companies).activeReportCount).toBe(0);
    });

    it('takes company codes only from selected IDs and exposes unavailable selected companies', () => {
        const result = getUserAccessSummary(2, [9, 42, 9], roles, reports, companies);
        expect(result.companyCodes).toEqual(['REAL-B']);
        expect(result.unknownCompanyIds).toEqual([42]);
        expect(getUserAccessSummary(2, [], roles, reports, companies).companyCodes).toEqual([]);
    });

    it('supports the old active-only roles response and case-insensitive admin role names', () => {
        const result = getUserAccessSummary(1, [], [{ RoleId: 1, RoleName: 'ADMIN' }], [{ ReportId: 8 }], []);
        expect(result.activeReportCount).toBe(1);
    });
});

describe('user draft and action guards', () => {
    const baseline = { FullName: 'Test User', RoleId: '2', IsActive: true, allowedCompanies: [7, 9], ADCompany: 'Affiliation' };

    it('does not prompt when company selection was only reordered', () => {
        expect(hasUserDraftChanges(baseline, { ...baseline, allowedCompanies: [9, 7] })).toBe(false);
    });

    it.each([
        { FullName: 'Changed' }, { RoleId: '3' }, { IsActive: false },
        { allowedCompanies: [7] }, { ADCompany: 'Changed affiliation' },
    ])('detects a changed field before closing a user form: %j', change => {
        expect(hasUserDraftChanges(baseline, { ...baseline, ...change })).toBe(true);
    });

    it('matches self by user ID and never matches an unavailable session or empty ID', () => {
        expect(isCurrentUser('23', 23)).toBe(true);
        expect(isCurrentUser(24, 23)).toBe(false);
        expect(isCurrentUser('', undefined)).toBe(false);
        expect(isCurrentUser(0, null)).toBe(false);
    });

    it('identifies LDAP accounts without reclassifying local or missing auth type', () => {
        expect(isAdAccount('LDAP')).toBe(true);
        expect(isAdAccount('local')).toBe(false);
        expect(isAdAccount(undefined)).toBe(false);
    });
});
