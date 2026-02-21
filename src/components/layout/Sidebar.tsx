"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, FileText, Database, Settings, LayoutTemplate, Users, LogOut, Lock, Menu, X, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useState, useEffect } from 'react';

const menus = [
    { title: 'หน้าหลัก', path: '/', icon: Home, role: 'all' },
    { title: 'รายงานมาตรฐาน', path: '/reports/standard', icon: FileText, role: 'all' },
    { title: 'รายงานส่งอีเมล', path: '/reports/templates', icon: LayoutTemplate, role: 'all' },

    // Admin Only
    { title: 'จัดการรายงาน', path: '/admin/reports', icon: Database, role: 'admin' },
    { title: 'จัดการผู้ใช้ & สิทธิ์', path: '/admin/users', icon: Users, role: 'admin' },
    { title: 'ดูประวัติการใช้งาน', path: '/admin/audit-logs', icon: FileText, role: 'admin' },
    { title: 'ตั้งค่าระบบ', path: '/admin/settings', icon: Settings, role: 'admin' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    const isAdmin = user?.roleName?.toLowerCase() === 'admin';

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Dark mode toggle
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

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const renderMenuLink = (menu: typeof menus[0], isAdminSection: boolean = false) => {
        const isActive = pathname === menu.path || (menu.path !== '/' && pathname.startsWith(menu.path + '/'));
        const Icon = menu.icon;
        return (
            <Link key={menu.path} href={menu.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'hover:bg-slate-800 hover:text-white'
                    }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : isAdminSection ? 'text-slate-400 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-blue-400'}`} />
                <span className="font-medium">{menu.title}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
            </Link>
        );
    };

    const sidebarContent = (
        <>
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/50">
                    RC
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white tracking-widest">ReportCenter</h1>
                    <p className="text-xs text-slate-400">Sonic Group</p>
                </div>
                {/* Mobile close button */}
                <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">เมนูหลัก</p>
                {menus.filter(m => m.role === 'all').map(m => renderMenuLink(m))}

                {isAdmin && (
                    <div className="mt-8 mb-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">ผู้ดูแลระบบ</p>
                        {menus.filter(m => m.role === 'admin').map(m => renderMenuLink(m, true))}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-800 space-y-2">
                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm w-full hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span className="font-medium">{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
                </button>

                <Link href="/change-password" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-sm ${pathname === '/change-password' ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                    }`}>
                    <Lock className="w-4 h-4" />
                    <span className="font-medium">เปลี่ยนรหัสผ่าน</span>
                </Link>

                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user?.fullName || 'Loading...'}</p>
                        <p className="text-xs text-slate-500">{user?.roleName || ''}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                        title="ออกจากระบบ"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                {sidebarContent}
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex w-64 bg-slate-900 text-slate-300 h-screen flex-col shadow-2xl relative z-10 transition-all duration-300">
                {sidebarContent}
            </div>
        </>
    );
}
