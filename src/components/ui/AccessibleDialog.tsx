"use client";

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface AccessibleDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
    variant?: 'dialog' | 'drawer';
}

/** Native modal semantics keep focus inside the top dialog, including confirmations. */
export default function AccessibleDialog({ open, onClose, title, description, children, footer, wide, variant = 'dialog' }: AccessibleDialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const wantOpen = useRef(open);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = ref.current;
        wantOpen.current = open;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        // Chrome/Edge make a repeated Esc non-cancelable and close the dialog themselves. Then the page still
        // thinks it is open, so put it back and run the normal (possibly guarded) close instead.
        onCancel={event => { if (!event.cancelable) return; event.preventDefault(); onClose(); }}
        onClose={() => {
            const dialog = ref.current;
            if (!wantOpen.current || !dialog || dialog.open) return;
            dialog.showModal();
            onClose();
        }}
        onClick={event => { if (event.target === ref.current) onClose(); }}
        className={`rc-dialog overflow-hidden border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-white ${variant === 'drawer' ? 'rc-drawer' : `m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}`}>
        <div className={`flex flex-col ${variant === 'drawer' ? 'max-h-full' : 'max-h-[calc(100dvh-2rem-2px)]'}`} onClick={event => event.stopPropagation()}>
            <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <div className="min-w-0 flex-1"><h2 id={titleId} className="text-lg font-semibold">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}</div>
                <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-700"><X className="h-5 w-5" aria-hidden="true" /></button>
            </header>
            <div className="min-h-0 overflow-y-auto p-5">{children}</div>
            {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900">{footer}</footer>}
        </div>
    </dialog>;
}
