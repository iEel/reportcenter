"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import AccessibleDialog from "@/components/ui/AccessibleDialog";

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "default";
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: async () => false });

export function useConfirm() {
    return useContext(ConfirmContext);
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<{
        open: boolean;
        options: ConfirmOptions;
        resolve: ((value: boolean) => void) | null;
    }>({
        open: false,
        options: { title: "", message: "" },
        resolve: null,
    });

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        state.resolve?.(true);
        setState(prev => ({ ...prev, open: false }));
    };

    const handleCancel = () => {
        state.resolve?.(false);
        setState(prev => ({ ...prev, open: false }));
    };

    const variantColors = {
        danger: "bg-red-600 hover:bg-red-700 shadow-red-500/30",
        warning: "bg-amber-600 hover:bg-amber-700 shadow-amber-500/30",
        default: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30",
    };

    return (
        <ConfirmContext.Provider value={{ confirm: showConfirm }}>
            {children}
            <AccessibleDialog open={state.open} onClose={handleCancel} title={state.options.title}
                footer={<>
                    <button type="button" data-autofocus onClick={handleCancel} className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">{state.options.cancelLabel || "ยกเลิก"}</button>
                    <button type="button" onClick={handleConfirm} className={`rounded-lg px-4 py-2 font-medium text-white ${variantColors[state.options.variant || 'default']}`}>{state.options.confirmLabel || "ยืนยัน"}</button>
                </>}>
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                    <p className="max-h-72 overflow-y-auto whitespace-pre-line break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{state.options.message}</p>
                </div>
            </AccessibleDialog>
        </ConfirmContext.Provider>
    );
}
