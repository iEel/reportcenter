import { describe, expect, it, vi } from 'vitest';
import { confirmPageLeave, registerPageLeaveGuard } from '../page-leave-guard';

describe('forced page leave', () => {
    it('is not forced until a security exit asks for it', async () => {
        vi.resetModules();
        const guard = await import('../page-leave-guard');
        expect(guard.isPageLeaveForced()).toBe(false);
        guard.forcePageLeave();
        expect(guard.isPageLeaveForced()).toBe(true);
    });
});

describe('explicit page leave actions', () => {
    it('can leave with no edited forms', async () => {
        expect(await confirmPageLeave()).toBe(true);
    });
    it('cancels logout while any form keeps its draft', async () => {
        const remove = registerPageLeaveGuard(async () => false);
        try { expect(await confirmPageLeave()).toBe(false); } finally { remove(); }
    });
    it('does not consult unmounted drafts', async () => {
        const remove = registerPageLeaveGuard(async () => false);
        remove();
        const removeCurrent = registerPageLeaveGuard(async () => true);
        try { expect(await confirmPageLeave()).toBe(true); } finally { removeCurrent(); }
    });
});
