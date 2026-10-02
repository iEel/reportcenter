import { describe, expect, it } from 'vitest';
import { confirmPageLeave, registerPageLeaveGuard } from '../page-leave-guard';

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
