"use client";

import { Bell, X, Check, CheckCheck, Moon, Sun } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { timeAgo } from '@/lib/dateUtils';

interface Notification {
    NotificationId: number;
    Title: string;
    Message: string;
    Type: string;
    IsRead: boolean;
    CreatedAt: string;
}

export default function Header() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showPanel, setShowPanel] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Dark mode init
    useEffect(() => {
        const saved = localStorage.getItem('rc_dark_mode');
        if (saved === 'true') {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        const next = !darkMode;
        setDarkMode(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('rc_dark_mode', next.toString());
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (err) {
            // Silent fail
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setShowPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const markAllRead = async () => {
        await fetch('/api/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId: 'all' }),
        });
        fetchNotifications();
    };



    return (
        <header className="h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 flex items-center justify-end px-6 shadow-sm">
            <div className="flex items-center gap-2" ref={panelRef}>
                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    title={darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Notification Bell */}
                <div className="relative">
                    <button
                        onClick={() => setShowPanel(!showPanel)}
                        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {showPanel && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">การแจ้งเตือน</h3>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                                        <CheckCheck className="w-3 h-3" />
                                        อ่านทั้งหมด
                                    </button>
                                )}
                            </div>

                            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                {notifications.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                                        ไม่มีการแจ้งเตือน
                                    </div>
                                ) : notifications.map(n => (
                                    <div key={n.NotificationId} className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.IsRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <div className="flex items-start gap-2">
                                            <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!n.IsRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">{n.Title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.Message}</p>
                                                <p className="text-xs text-slate-400 mt-1">{timeAgo(n.CreatedAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
