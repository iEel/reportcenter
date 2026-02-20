"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, FileText, Database, Settings, LayoutTemplate, Users, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

const menus = [
    { title: 'หน้าหลัก', path: '/', icon: Home, role: 'all' },
    { title: 'รายงานมาตรฐาน', path: '/reports/standard', icon: FileText, role: 'all' },
    { title: 'รายงานส่งอีเมล', path: '/reports/templates', icon: LayoutTemplate, role: 'all' },

    // Admin Only
    { title: 'จัดการรายงาน (Admin)', path: '/admin/reports', icon: Database, role: 'admin' },
    { title: 'จัดการผู้ใช้ & สิทธิ์', path: '/admin/users', icon: Users, role: 'admin' },
    { title: 'ตั้งค่าระบบ', path: '/admin/settings', icon: Settings, role: 'admin' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();

    const isAdmin = user?.roleName?.toLowerCase() === 'admin';

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col shadow-2xl relative z-10 transition-all duration-300">
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/50">
                    RC
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-widest">ReportCenter</h1>
                    <p className="text-xs text-slate-400">Sonic Group</p>
                </div>
            </div>

            <div className="flex-1 px-4 py-6 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">เมนูหลัก</p>
                {menus.filter(m => m.role === 'all').map((menu) => {
                    const isActive = pathname === menu.path || pathname.startsWith(menu.path + '/');
                    const Icon = menu.icon;
                    return (
                        <Link key={menu.path} href={menu.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-blue-600/10 text-blue-400'
                                : 'hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`} />
                            <span className="font-medium">{menu.title}</span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </Link>
                    )
                })}

                {isAdmin && (
                    <div className="mt-8 mb-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">ผู้ดูแลระบบ</p>
                        {menus.filter(m => m.role === 'admin').map((menu) => {
                            const isActive = pathname === menu.path || pathname.startsWith(menu.path + '/');
                            const Icon = menu.icon;
                            return (
                                <Link key={menu.path} href={menu.path}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-blue-600/10 text-blue-400'
                                        : 'hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-amber-400'}`} />
                                    <span className="font-medium">{menu.title}</span>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-800">
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
        </div>
    );
}
