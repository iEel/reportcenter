type LeaveGuard = () => Promise<boolean>;
const guards = new Set<LeaveGuard>();

export function registerPageLeaveGuard(guard: LeaveGuard) {
    guards.add(guard);
    return () => { guards.delete(guard); };
}

let forced = false;

/** Security exits (idle logout) must not be held back by a "Leave site?" prompt for drafts. */
export function forcePageLeave() { forced = true; }
export function isPageLeaveForced() { return forced; }

/** Explicit actions such as logout consult the same drafts as in-app links. */
export async function confirmPageLeave() {
    for (const guard of [...guards]) if (!(await guard())) return false;
    return true;
}
