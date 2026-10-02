export interface RoleAccessRole {
    RoleId: number;
    RoleName: string;
    assignedReports: number[];
}

export interface RoleAccessReport {
    ReportId: number;
    ReportName: string;
    IsActive: boolean | number;
    CategoryId: number | null;
}

export interface RoleAccessDraft {
    roleId: number;
    roleName: string;
    originalReports: number[];
    selectedReports: number[];
}

export const isAdminRole = (role: RoleAccessRole) => role.RoleName.toLowerCase() === 'admin';
export const isReportActive = (report: RoleAccessReport) => !!report.IsActive;

export function reportsForRole<T extends RoleAccessReport>(role: RoleAccessRole, reports: T[]): T[] {
    if (isAdminRole(role)) return reports.filter(isReportActive);
    const assigned = new Set(role.assignedReports);
    return reports.filter(report => assigned.has(report.ReportId));
}

export function reportCounts(reports: RoleAccessReport[]) {
    const active = reports.filter(isReportActive).length;
    return { active, inactive: reports.length - active };
}

export function createRoleDraft(role: RoleAccessRole): RoleAccessDraft {
    return {
        roleId: role.RoleId,
        roleName: role.RoleName,
        originalReports: [...role.assignedReports],
        selectedReports: [...role.assignedReports],
    };
}

export function editReports<T extends RoleAccessReport>(reports: T[], draft: RoleAccessDraft, query: string): T[] {
    const original = new Set(draft.originalReports);
    const search = query.trim().toLowerCase();
    return reports.filter(report => (isReportActive(report) || original.has(report.ReportId))
        && (!search || report.ReportName.toLowerCase().includes(search)));
}

export function setDraftReports(draft: RoleAccessDraft, reportIds: number[], selected: boolean): RoleAccessDraft {
    const next = new Set(draft.selectedReports);
    reportIds.forEach(id => selected ? next.add(id) : next.delete(id));
    return { ...draft, selectedReports: [...next] };
}

export function draftChanges(draft: RoleAccessDraft) {
    const original = new Set(draft.originalReports), selected = new Set(draft.selectedReports);
    const added = [...selected].filter(id => !original.has(id));
    const removed = [...original].filter(id => !selected.has(id));
    return { added, removed, dirty: added.length + removed.length > 0 };
}

export function draftPayload(draft: RoleAccessDraft) {
    return { roleId: draft.roleId, roleName: draft.roleName, assignedReports: [...draft.selectedReports] };
}

export function compareRoleReports(a: RoleAccessRole, b: RoleAccessRole, reports: RoleAccessReport[]) {
    const left = new Set(reportsForRole(a, reports).filter(isReportActive).map(r => r.ReportId));
    const right = new Set(reportsForRole(b, reports).filter(isReportActive).map(r => r.ReportId));
    return {
        both: [...left].filter(id => right.has(id)),
        onlyA: [...left].filter(id => !right.has(id)),
        onlyB: [...right].filter(id => !left.has(id)),
        union: new Set([...left, ...right]).size,
    };
}
