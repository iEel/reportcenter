"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

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
            {state.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${state.options.variant === 'danger' ? 'bg-red-100' : state.options.variant === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                                }`}>
                                <AlertTriangle className={`w-6 h-6 ${state.options.variant === 'danger' ? 'text-red-500' : state.options.variant === 'warning' ? 'text-amber-500' : 'text-blue-500'
                                    }`} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{state.options.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{state.options.message}</p>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium rounded-xl transition-colors"
                            >
                                {state.options.cancelLabel || "ยกเลิก"}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl transition-all active:scale-95 shadow-md ${variantColors[state.options.variant || 'default']}`}
                            >
                                {state.options.confirmLabel || "ยืนยัน"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
