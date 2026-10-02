"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { registerPageLeaveGuard } from '@/lib/page-leave-guard';

/** Protect edited forms when switching a local context, following a link or reloading. */
export default function useUnsavedChanges(dirty: boolean) {
    const router = useRouter();
    const { confirm } = useConfirm();
    const pending = useRef(false);
    const confirmDiscard = useCallback(async () => {
        if (!dirty) return true;
        if (pending.current) return false;
        pending.current = true;
        try {
            return await confirm({ title: 'ยังไม่ได้บันทึก', message: 'ต้องการทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่?', confirmLabel: 'ทิ้งการแก้ไข', cancelLabel: 'แก้ไขต่อ', variant: 'warning' });
        } finally { pending.current = false; }
    }, [confirm, dirty]);

    useEffect(() => {
        if (!dirty) return;
        const unregister = registerPageLeaveGuard(confirmDiscard);
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        const click = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            const destination = new URL(link.href, window.location.href);
            if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            void confirmDiscard().then(discard => { if (discard) router.push(destination.pathname + destination.search + destination.hash); });
        };
        window.addEventListener('beforeunload', beforeUnload);
        document.addEventListener('click', click, true);
        return () => { unregister(); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
    }, [dirty, confirmDiscard, router]);
    return { confirmDiscard };
}
