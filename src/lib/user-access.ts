export interface UserAccessRole {
    RoleId: number;
    RoleName: string;
    assignedReports?: number[];
}

export interface UserAccessReport {
    ReportId: number;
    ReportName?: string;
    IsActive?: boolean | number;
}

export interface UserAccessCompany {
    id: number;
    code: string;
    name: string;
}

export function getUserAccessSummary(
    roleId: string | number,
    selectedCompanyIds: number[],
    roles: UserAccessRole[],
    reports: UserAccessReport[] | null,
    companies: UserAccessCompany[],
) {
    const role = roleId ? roles.find(item => String(item.RoleId) === String(roleId)) : undefined;
    const isAdmin = role?.RoleName.toLowerCase() === 'admin';
    const assigned = new Set(role?.assignedReports ?? []);
    // Older roles responses contain only active reports and omit IsActive.
    const activeReports = reports?.filter(report => report.IsActive !== false && report.IsActive !== 0);
    const activeReportCount = role && activeReports
        ? new Set(activeReports.filter(report => isAdmin || assigned.has(report.ReportId)).map(report => report.ReportId)).size
        : null;
    const selected = new Set(selectedCompanyIds);
    const availableIds = new Set(companies.map(company => company.id));
    return {
        roleName: role?.RoleName ?? null,
        isAdmin,
        activeReportCount,
        companyCodes: companies.filter(company => selected.has(company.id)).map(company => company.code),
        unknownCompanyIds: [...selected].filter(id => !availableIds.has(id)),
    };
}

export function hasUserDraftChanges<T extends { allowedCompanies: number[] }>(initial: T, current: T) {
    const normalize = (draft: T) => ({ ...draft, allowedCompanies: [...draft.allowedCompanies].sort((a, b) => a - b) });
    return JSON.stringify(normalize(initial)) !== JSON.stringify(normalize(current));
}

export function isCurrentUser(userId: string | number, sessionUserId: number | null | undefined) {
    return userId !== '' && sessionUserId != null && Number(userId) === sessionUserId;
}

export function isAdAccount(authType: string | null | undefined) {
    return authType?.toLowerCase() === 'ldap';
}

interface AdProfileDraft {
    Username: string; FullName: string; Email: string; EmployeeId: string;
    ADCompany: string; Department: string; Branch: string;
}

export interface AdProfile {
    fullName?: string; email?: string; employeeId?: string; company?: string; department?: string; branch?: string;
}

/** AD details belong to the username they were looked up for; typing another username drops them. */
export function changeAdUsername<T extends AdProfileDraft>(draft: T, username: string): T {
    if (draft.Username === username) return draft;
    if (draft.Username.trim() === username.trim()) return { ...draft, Username: username };
    return { ...draft, Username: username, FullName: '', Email: '', EmployeeId: '', ADCompany: '', Department: '', Branch: '' };
}

/** Apply a lookup result only if the form still shows the username that was looked up. */
export function applyAdProfile<T extends AdProfileDraft>(draft: T, lookedUp: string, profile: AdProfile): T {
    if (draft.Username.trim() !== lookedUp) return draft;
    return {
        ...draft,
        // Some AD accounts have no display name; the username keeps the account savable
        FullName: profile.fullName || lookedUp, Email: profile.email || '', EmployeeId: profile.employeeId || '',
        ADCompany: profile.company || '', Department: profile.department || '', Branch: profile.branch || '',
    };
}
