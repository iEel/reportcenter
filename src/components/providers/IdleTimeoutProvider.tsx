"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthProvider';

interface IdleTimeoutContextType {
    /** Remaining seconds before logout (null = not warning yet) */
    remainingSeconds: number | null;
    /** Whether the warning modal is visible */
    isWarning: boolean;
    /** Call this to reset the idle timer (stay active) */
    stayActive: () => void;
}

const IdleTimeoutContext = createContext<IdleTimeoutContextType>({
    remainingSeconds: null,
    isWarning: false,
    stayActive: () => { },
});

const WARNING_SECONDS = 60; // Show warning 60 seconds before logout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
const THROTTLE_MS = 30_000; // Only update lastActivity every 30 sec to reduce overhead

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [timeoutMinutes, setTimeoutMinutes] = useState<number>(0); // 0 = disabled
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const [isWarning, setIsWarning] = useState(false);

    const lastActivityRef = useRef<number>(Date.now());
    const lastThrottleRef = useRef<number>(Date.now());
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch timeout setting from API
    useEffect(() => {
        if (!user) return;

        const fetchTimeout = async () => {
            try {
                const res = await fetch('/api/settings/idle-timeout');
                const data = await res.json();
                if (data.success && data.minutes > 0) {
                    setTimeoutMinutes(data.minutes);
                }
            } catch {
                // Silently fail — use default (disabled)
            }
        };
        fetchTimeout();
    }, [user]);

    // Reset idle timer
    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        // Clear any active warning/countdown
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setIsWarning(false);
        setRemainingSeconds(null);
    }, []);

    // User clicked "Stay Active" in warning modal
    const stayActive = useCallback(() => {
        resetTimer();
    }, [resetTimer]);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch { /* ignore */ }
        window.location.href = '/login?reason=idle';
    }, []);

    // Listen for user activity events
    useEffect(() => {
        if (!user || timeoutMinutes <= 0) return;

        const handleActivity = () => {
            const now = Date.now();
            // Throttle: only update if enough time passed
            if (now - lastThrottleRef.current > THROTTLE_MS) {
                lastThrottleRef.current = now;
                lastActivityRef.current = now;

                // If currently warning, dismiss it
                if (isWarning) {
                    resetTimer();
                }
            }
        };

        ACTIVITY_EVENTS.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            ACTIVITY_EVENTS.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [user, timeoutMinutes, isWarning, resetTimer]);

    // Main idle check interval
    useEffect(() => {
        if (!user || timeoutMinutes <= 0) return;

        const idleMs = timeoutMinutes * 60 * 1000;
        const warningMs = idleMs - (WARNING_SECONDS * 1000);

        const checkIdle = () => {
            const elapsed = Date.now() - lastActivityRef.current;

            if (elapsed >= idleMs) {
                // Time's up — logout immediately
                handleLogout();
            } else if (elapsed >= warningMs && !isWarning) {
                // Show warning
                setIsWarning(true);
                const remaining = Math.ceil((idleMs - elapsed) / 1000);
                setRemainingSeconds(remaining);

                // Start countdown
                countdownRef.current = setInterval(() => {
                    setRemainingSeconds(prev => {
                        if (prev === null || prev <= 1) {
                            handleLogout();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        };

        // Check every 10 seconds
        const interval = setInterval(checkIdle, 10_000);

        return () => {
            clearInterval(interval);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [user, timeoutMinutes, isWarning, handleLogout]);

    // Reset timer on initial load
    useEffect(() => {
        if (user && timeoutMinutes > 0) {
            resetTimer();
        }
    }, [user, timeoutMinutes, resetTimer]);

    return (
        <IdleTimeoutContext.Provider value={{ remainingSeconds, isWarning, stayActive }}>
            {children}

            {/* Idle Warning Modal */}
            {isWarning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center animate-in zoom-in-95 duration-300">
                        {/* Animated clock icon */}
                        <div className="w-20 h-20 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>

                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                            เซสชันกำลังหมดอายุ
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                            ไม่พบกิจกรรมการใช้งานมาสักพัก ระบบจะออกจากระบบอัตโนมัติ
                        </p>

                        {/* Countdown */}
                        <div className="mb-6">
                            <div className="text-5xl font-bold text-amber-500 tabular-nums">
                                {remainingSeconds}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">วินาที</p>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-6 overflow-hidden">
                            <div
                                className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${((remainingSeconds || 0) / WARNING_SECONDS) * 100}%` }}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleLogout()}
                                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
                            >
                                ออกจากระบบ
                            </button>
                            <button
                                onClick={stayActive}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-md shadow-blue-500/30"
                            >
                                ยังใช้งานอยู่
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </IdleTimeoutContext.Provider>
    );
}

export function useIdleTimeout() {
    return useContext(IdleTimeoutContext);
}
