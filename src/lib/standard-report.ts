/** Ask about empty conditions only for a fresh run, not when paging through results already fetched. */
export function shouldConfirmEmptyConditions(values: Record<string, string>, parameterCount: number, isPageChange: boolean) {
    if (isPageChange || parameterCount === 0) return false;
    return Object.values(values).some(value => !value && value !== '0');
}

/**
 * Pick a company the user may read and the selector can show.
 * `listedIds` is null while the company list is unavailable; then keep the old behaviour (first allowed id).
 */
export function pickReportCompany(current: string, allowedIds: number[], listedIds: number[] | null) {
    const choices = listedIds ? allowedIds.filter(id => listedIds.includes(id)) : allowedIds;
    if (current && choices.includes(Number(current))) return current;
    return choices.length ? String(choices[0]) : '';
}

export interface RunState {
    reportId: string;
    company: string;
    isLoadingParams: boolean;
    paramsError: string | null;
    hasCompanyChoices: boolean;
}

/** Why the report cannot run yet, or null when it can. */
export function getRunBlocker({ reportId, company, isLoadingParams, paramsError, hasCompanyChoices }: RunState) {
    if (!reportId) return 'กรุณาเลือกรายงานก่อนดึงข้อมูล';
    if (isLoadingParams) return 'กำลังโหลดเงื่อนไขรายงาน';
    if (paramsError) return 'โหลดเงื่อนไขรายงานไม่สำเร็จ กดลองใหม่ก่อนดึงข้อมูล';
    if (!company) return hasCompanyChoices ? 'กรุณาเลือกบริษัท' : 'ไม่มีบริษัทที่คุณได้รับสิทธิ์ให้เลือก';
    return null;
}

/** Tell a failed export apart from an export that found no rows. */
export function exportProblem(data: { success?: boolean; message?: string; data?: unknown[] }) {
    if (!data.success) return { kind: 'error' as const, message: data.message || 'ไม่สามารถส่งออกข้อมูลได้' };
    if (!data.data?.length) return { kind: 'empty' as const };
    return null;
}

const FINISHED = ['done', 'failed', 'cancelled'];
const MAX_POLL_FAILURES = 3;

export type JobPollResult = { ok: true; status: string } | { ok: false };

/** One background-job status check: keep polling, or stop with the final outcome. */
export function nextJobPoll(failures: number, result: JobPollResult) {
    if (!result.ok) {
        const next = failures + 1;
        return next >= MAX_POLL_FAILURES ? { failures: next, stop: true, outcome: 'unknown' } : { failures: next, stop: false };
    }
    return FINISHED.includes(result.status) ? { failures: 0, stop: true, outcome: result.status } : { failures: 0, stop: false };
}

interface PolledJob { status: string }

/**
 * Poll a background job one check at a time (the next check is scheduled only after the previous one
 * finishes, so a slow response can never overwrite a newer state). Returns a function that stops polling;
 * a check still in flight when stopped is ignored.
 */
export function startJobPolling<J extends PolledJob>({ check, onJob, onStop, intervalMs = 3000 }: {
    check: () => Promise<J | null>;
    onJob: (job: J) => void;
    onStop: (outcome: string, job: J | null) => void;
    intervalMs?: number;
}) {
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
        let job: J | null = null;
        try { job = await check(); } catch { job = null; }
        if (stopped) return;
        const step = nextJobPoll(failures, job ? { ok: true, status: job.status } : { ok: false });
        failures = step.failures;
        if (job) onJob(job);
        if (step.stop) { stopped = true; onStop(step.outcome!, job); return; }
        timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, intervalMs);
    return () => { stopped = true; if (timer) clearTimeout(timer); };
}
