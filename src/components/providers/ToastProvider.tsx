"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => { } });

export function useToast() {
    return useContext(ToastContext);
}

let toastId = 0;

export default function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = "success") => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3500);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const icons = {
        success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    };

    const colors = {
        success: "border-emerald-200 bg-emerald-50",
        error: "border-red-200 bg-red-50",
        info: "border-blue-200 bg-blue-50",
    };

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 fade-in duration-300 max-w-sm ${colors[t.type]}`}
                    >
                        {icons[t.type]}
                        <p className="text-sm font-medium text-slate-800 flex-1">{t.message}</p>
                        <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
