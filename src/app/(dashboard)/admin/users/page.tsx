"use client"

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Shield, User, Building, RefreshCw, X, Save, Loader2, Check, Eye, EyeOff, UserCheck, UserX, Trash2, KeyRound, ChevronLeft, ChevronRight, Link2, Search as SearchIcon, XCircle } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";

const COMPANY_COLORS = ['blue', 'emerald', 'purple', 'amber', 'cyan', 'rose'];

const companyColorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
};

const avatarColors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-purple-500 to-purple-600',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-cyan-500 to-teal-500',
];

export default function AdminUsersPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const perPage = 10;

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Reset Password Modal
    const [isResetPwOpen, setIsResetPwOpen] = useState(false);
    const [resetPwUser, setResetPwUser] = useState<any>(null);
    const [resetPwValue, setResetPwValue] = useState('');
    const [showResetPw, setShowResetPw] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [formData, setFormData] = useState({
        UserId: '',
        Username: '',
        PasswordHash: '',
        FullName: '',
        CompanyId: '',
        RoleId: '',
        IsActive: true,
        allowedCompanies: [1, 2, 3] as number[],
        AuthType: 'local',
        Email: '',
        EmployeeId: '',
        ADCompany: '',
        Department: '',
        Branch: '',
    });

    // AD Lookup
    const [isAdUser, setIsAdUser] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [adLookupError, setAdLookupError] = useState('');
    const [adSuggestions, setAdSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchUsersAndRoles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
                setRoles(data.roles);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            toast('ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsersAndRoles();
        fetch('/api/companies').then(r => r.json()).then(d => {
            if (d.success) setCompanies(d.companies.map((c: any, i: number) => ({
                id: c.companyId, name: c.name, short: c.label, color: COMPANY_COLORS[i % COMPANY_COLORS.length],
            })));
        }).catch(() => { });
    }, []);

    const handleOpenAddModal = () => {
        setEditMode(false);
        setShowPassword(false);
        setIsAdUser(false);
        setAdLookupError('');
        setAdSuggestions([]);
        setShowSuggestions(false);
        setFormData({
            UserId: '', Username: '', PasswordHash: '',
            FullName: '', CompanyId: '', RoleId: '',
            IsActive: true, allowedCompanies: [1, 2, 3],
            AuthType: 'local', Email: '', EmployeeId: '',
            ADCompany: '', Department: '', Branch: '',
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: any) => {
        setEditMode(true);
        setShowPassword(false);
        const isAd = (user.AuthType || 'local').toLowerCase() === 'ldap';
        setIsAdUser(isAd);
        setAdLookupError('');
        setAdSuggestions([]);
        setShowSuggestions(false);
        setFormData({
            UserId: user.UserId,
            Username: user.Username,
            PasswordHash: '',
            FullName: user.FullName,
            CompanyId: user.CompanyId ? user.CompanyId.toString() : '',
            RoleId: user.RoleId ? user.RoleId.toString() : '',
            IsActive: user.IsActive,
            allowedCompanies: user.allowedCompanies || [],
            AuthType: user.AuthType || 'local',
            Email: user.Email || '',
            EmployeeId: user.EmployeeId || '',
            ADCompany: user.ADCompany || '',
            Department: user.Department || '',
            Branch: user.Branch || '',
        });
        setIsModalOpen(true);
    };

    const toggleCompany = (cid: number) => {
        setFormData(prev => ({
            ...prev,
            allowedCompanies: prev.allowedCompanies.includes(cid)
                ? prev.allowedCompanies.filter(c => c !== cid)
                : [...prev.allowedCompanies, cid].sort((a, b) => a - b)
        }));
    };

    const handleAdLookup = async () => {
        if (!formData.Username.trim()) {
            setAdLookupError('กรุณากรอก AD Username ก่อน');
            return;
        }
        setIsLookingUp(true);
        setAdLookupError('');
        try {
            const res = await fetch(`/api/admin/users/lookup-ad?username=${encodeURIComponent(formData.Username.trim())}`);
            const data = await res.json();
            if (data.success) {
                setFormData(prev => ({
                    ...prev,
                    FullName: data.fullName || prev.FullName,
                    Email: data.email || '',
                    EmployeeId: data.employeeId || '',
                    ADCompany: data.company || '',
                    Department: data.department || '',
                    Branch: data.branch || '',
                }));
            } else {
                setAdLookupError(data.error || 'ไม่พบ user ใน AD');
            }
        } catch {
            setAdLookupError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            setIsLookingUp(false);
        }
    };

    // Debounced AD search for autocomplete
    const handleAdSearch = (value: string) => {
        setFormData(prev => ({ ...prev, Username: value }));
        setAdLookupError('');

        // Clear previous timer
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (value.trim().length < 2) {
            setAdSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Debounce 300ms
        searchTimerRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/admin/users/lookup-ad?search=${encodeURIComponent(value.trim())}`);
                const data = await res.json();
                if (data.success && data.users) {
                    setAdSuggestions(data.users);
                    setShowSuggestions(data.users.length > 0);
                } else {
                    setAdSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch {
                setAdSuggestions([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    const handleSelectAdUser = (user: any) => {
        setFormData(prev => ({
            ...prev,
            Username: user.username,
            FullName: user.fullName || '',
            Email: user.email || '',
            EmployeeId: user.employeeId || '',
            ADCompany: user.company || '',
            Department: user.department || '',
            Branch: user.branch || '',
        }));
        setAdSuggestions([]);
        setShowSuggestions(false);
        setAdLookupError('');
    };

    const handleSaveUser = async () => {
        if (!formData.FullName.trim()) {
            toast('กรุณากรอกชื่อ-นามสกุล', 'error');
            return;
        }
        if (!editMode && !formData.Username.trim()) {
            toast('กรุณากรอก Username', 'error');
            return;
        }
        if (!formData.RoleId) {
            toast('กรุณาเลือกสิทธิ์การใช้งาน (Role)', 'error');
            return;
        }
        if (formData.allowedCompanies.length === 0) {
            toast('กรุณาเลือกบริษัทอย่างน้อย 1 บริษัท', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: editMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                toast(editMode ? 'อัปเดตข้อมูลผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้ใหม่สำเร็จ', 'success');
                setIsModalOpen(false);
                fetchUsersAndRoles();
            } else {
                toast('เกิดข้อผิดพลาด: ' + data.message, 'error');
            }
        } catch (error) {
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (user: any) => {
        const action = user.IsActive ? 'ระงับ' : 'เปิดใช้งาน';
        const ok = await confirm({
            title: `${action}ผู้ใช้`,
            message: `คุณต้องการ${action}ผู้ใช้ "${user.FullName}" หรือไม่?`,
            confirmLabel: action,
            variant: user.IsActive ? 'warning' : 'default',
        });
        if (!ok) return;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserId: user.UserId,
                    Username: user.Username,
                    FullName: user.FullName,
                    CompanyId: user.CompanyId?.toString() || '',
                    RoleId: user.RoleId?.toString() || '',
                    IsActive: !user.IsActive,
                    allowedCompanies: user.allowedCompanies || [],
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast(`${action}ผู้ใช้ "${user.FullName}" สำเร็จ`, 'success');
                fetchUsersAndRoles();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const getAvatarColor = (name: string) => {
        const idx = (name?.charCodeAt(0) || 0) % avatarColors.length;
        return avatarColors[idx];
    };

    const handleDeleteUser = async (user: any) => {
        const ok = await confirm({
            title: 'ลบผู้ใช้',
            message: `คุณต้องการลบผู้ใช้ "${user.FullName}" (@${user.Username}) ออกจากระบบหรือไม่?\n\nข้อมูลการตั้งค่าและสิทธิ์ของผู้ใช้จะถูกลบทั้งหมด การกระทำนี้ไม่สามารถย้อนกลับได้`,
            confirmLabel: 'ลบผู้ใช้',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/admin/users?userId=${user.UserId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast('ลบผู้ใช้สำเร็จ', 'success');
                fetchUsersAndRoles();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const handleOpenResetPw = (user: any) => {
        setResetPwUser(user);
        setResetPwValue('');
        setShowResetPw(false);
        setIsResetPwOpen(true);
    };

    const handleResetPassword = async () => {
        if (!resetPwValue.trim()) {
            toast('กรุณากรอกรหัสผ่านใหม่', 'error');
            return;
        }
        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: resetPwUser.UserId, newPassword: resetPwValue })
            });
            const data = await res.json();
            if (data.success) {
                toast(data.message || 'รีเซ็ตรหัสผ่านสำเร็จ', 'success');
                setIsResetPwOpen(false);
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        } finally {
            setIsResetting(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const q = searchQuery.toLowerCase();
        const matchSearch = u.Username?.toLowerCase().includes(q) ||
            u.FullName?.toLowerCase().includes(q) ||
            u.EmployeeId?.toLowerCase().includes(q);
        const matchRole = !filterRole || u.RoleId?.toString() === filterRole;
        const matchStatus = !filterStatus ||
            (filterStatus === 'active' && u.IsActive) ||
            (filterStatus === 'inactive' && !u.IsActive);
        return matchSearch && matchRole && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / perPage));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * perPage, safePage * perPage);

    // Reset page when filters change
    const resetPage = () => setCurrentPage(1);

    const activeCount = users.filter(u => u.IsActive).length;
    const inactiveCount = users.filter(u => u.IsActive === false).length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">จัดการผู้ใช้</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">เพิ่มลบผู้ใช้งาน และกำหนดสิทธิ์เพื่อควบคุมการเข้าถึงรายงาน</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchUsersAndRoles} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        เพิ่มผู้ใช้ใหม่
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ผู้ใช้ทั้งหมด</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ใช้งานอยู่</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <UserX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{inactiveCount}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ถูกระงับ</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3 bg-slate-50/50 dark:bg-slate-800">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อผู้ใช้ / รหัสพนักงาน..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white dark:bg-slate-700 dark:text-white font-medium"
                        />
                    </div>
                    <select
                        value={filterRole}
                        onChange={e => { setFilterRole(e.target.value); resetPage(); }}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white"
                    >
                        <option value="">ทุก Role</option>
                        {roles.map(r => (
                            <option key={r.RoleId} value={r.RoleId}>{r.RoleName}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => { setFilterStatus(e.target.value); resetPage(); }}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white"
                    >
                        <option value="">ทุกสถานะ</option>
                        <option value="active">ใช้งานอยู่</option>
                        <option value="inactive">ถูกระงับ</option>
                    </select>
                    {(searchQuery || filterRole || filterStatus) && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                            แสดง {filteredUsers.length} จาก {users.length} รายการ
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-600">
                            <tr>
                                <th className="px-6 py-3.5">ผู้ใช้</th>
                                <th className="px-6 py-3.5">บริษัทที่เข้าถึง</th>
                                <th className="px-6 py-3.5">สิทธิ์ (Role)</th>
                                <th className="px-6 py-3.5">สถานะ</th>
                                <th className="px-6 py-3.5 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-3" />
                                            <p>กำลังโหลดข้อมูลผู้ใช้...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                                        {searchQuery || filterRole || filterStatus ? 'ไม่พบผู้ใช้ตามเงื่อนไข' : 'ยังไม่มีผู้ใช้ในระบบ'}
                                    </td>
                                </tr>
                            ) : paginatedUsers.map((user) => (
                                <tr key={user.UserId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(user.FullName)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                                {user.FullName?.charAt(0)?.toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.FullName}</p>
                                                <p className="text-xs text-slate-400 font-mono">@{user.Username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {(user.allowedCompanies || []).length > 0 ? (
                                                user.allowedCompanies.map((cid: number) => {
                                                    const comp = companies.find(c => c.id === cid);
                                                    const colors = companyColorMap[comp?.color || 'blue'];
                                                    return (
                                                        <span key={cid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                            <Building className="w-3 h-3" />
                                                            {comp?.short || cid}
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 italic text-xs">ไม่มีสิทธิ์</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.RoleName ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                <Shield className="w-3 h-3" />
                                                {user.RoleName}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">ไม่ได้กำหนด</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 ${user.IsActive
                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                                                }`}
                                            title={user.IsActive ? 'คลิกเพื่อระงับ' : 'คลิกเพื่อเปิดใช้งาน'}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${user.IsActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {user.IsActive ? 'ใช้งาน' : 'ถูกระงับ'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenResetPw(user)}
                                                className="p-2 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg transition-colors"
                                                title="รีเซ็ตรหัสผ่าน"
                                            >
                                                <KeyRound className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditModal(user)}
                                                className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-lg transition-colors"
                                                title="ลบผู้ใช้"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredUsers.length > perPage && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            แสดง {(safePage - 1) * perPage + 1}-{Math.min(safePage * perPage, filteredUsers.length)} จาก {filteredUsers.length} รายการ
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) =>
                                    typeof p === 'string' ? (
                                        <span key={`dot-${i}`} className="px-1 text-slate-400 text-xs">...</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${p === safePage
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                            {/* Modal Header — gradient changes for AD vs local */}
                            <div className={`px-6 py-4 border-b flex items-center justify-between ${isAdUser
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 border-indigo-500'
                                : 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500'
                                }`}>
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    {isAdUser ? <Link2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                    {editMode ? 'แก้ไขข้อมูลผู้ใช้' : isAdUser ? 'เพิ่มผู้ใช้ AD' : 'เพิ่มผู้ใช้ใหม่'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">

                                {/* AD Toggle (only for new users) */}
                                {!editMode && (
                                    <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${isAdUser
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAdUser
                                                ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                                : 'bg-slate-200 dark:bg-slate-600'
                                                }`}>
                                                <Link2 className={`w-4 h-4 ${isAdUser ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                                            </div>
                                            <div>
                                                <span className={`text-sm font-semibold ${isAdUser ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    บัญชี Active Directory
                                                </span>
                                                <p className="text-xs text-slate-400">เชื่อมต่อกับ AD ไม่ต้องตั้งรหัสผ่าน</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newVal = !isAdUser;
                                                setIsAdUser(newVal);
                                                setFormData(prev => ({ ...prev, AuthType: newVal ? 'ldap' : 'local', Email: '', EmployeeId: '', ADCompany: '', Department: '', Branch: '', FullName: newVal ? '' : prev.FullName }));
                                                setAdLookupError('');
                                                setAdSuggestions([]);
                                                setShowSuggestions(false);
                                            }}
                                            className={`relative w-12 h-7 rounded-full transition-all duration-300 ${isAdUser ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${isAdUser ? 'left-5.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                )}

                                {/* Section: Account */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center">
                                            <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ข้อมูลบัญชี</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {!editMode && (
                                            <div className="relative">
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                    {isAdUser ? 'ค้นหา AD Username' : 'Username'} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="text"
                                                            value={formData.Username}
                                                            onChange={e => isAdUser ? handleAdSearch(e.target.value) : setFormData({ ...formData, Username: e.target.value })}
                                                            onFocus={() => { if (isAdUser && adSuggestions.length > 0) setShowSuggestions(true); }}
                                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                                                            placeholder={isAdUser ? 'พิมพ์อย่างน้อย 2 ตัว เช่น veer, john...' : 'เช่น jsmith'}
                                                            onKeyDown={e => { if (isAdUser && e.key === 'Enter') { e.preventDefault(); handleAdLookup(); } }}
                                                            autoComplete="off"
                                                        />
                                                        {isAdUser && isSearching && (
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                                            </div>
                                                        )}

                                                        {/* Autocomplete Dropdown */}
                                                        {isAdUser && showSuggestions && adSuggestions.length > 0 && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                                                                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-600 border-b border-slate-200 dark:border-slate-500 rounded-t-xl">
                                                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">ผลการค้นหา ({adSuggestions.length} รายการ)</p>
                                                                </div>
                                                                {adSuggestions.map((user, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onMouseDown={(e) => { e.preventDefault(); handleSelectAdUser(user); }}
                                                                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-b border-slate-100 dark:border-slate-600 last:border-0 group"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition-colors">
                                                                                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.fullName || user.username}</p>
                                                                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">{user.username}</p>
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                {user.department && <p className="text-xs text-slate-500 dark:text-slate-400">{user.department}</p>}
                                                                                {user.email && <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{user.email}</p>}
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isAdUser && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAdLookup}
                                                            disabled={isLookingUp}
                                                            className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-70 flex items-center gap-1 whitespace-nowrap shadow-md shadow-indigo-500/20"
                                                            title="ค้นหาแบบ exact match"
                                                        >
                                                            {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                                {isAdUser && (
                                                    <p className="text-xs text-slate-400 mt-1">พิมพ์ชื่อบางส่วนแล้วเลือกจากรายการ หรือกด Enter เพื่อค้นหาแบบตรง</p>
                                                )}
                                                {adLookupError && (
                                                    <p className="text-xs text-red-500 mt-1">❌ {adLookupError}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* AD Info Display (read-only) */}
                                        {isAdUser && formData.FullName && (
                                            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-xl">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/40 rounded-md flex items-center justify-center">
                                                        <UserCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">ข้อมูลจาก Active Directory</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="col-span-2 bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">ชื่อ-นามสกุล</span>
                                                        <p className="font-semibold text-slate-800 dark:text-white">{formData.FullName}</p>
                                                    </div>
                                                    {formData.Email && (
                                                        <div className="col-span-2 bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs">Email</span>
                                                            <p className="font-medium text-slate-800 dark:text-white text-sm">{formData.Email}</p>
                                                        </div>
                                                    )}
                                                    {formData.EmployeeId && (
                                                        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs">รหัสพนักงาน</span>
                                                            <p className="font-medium text-slate-800 dark:text-white">{formData.EmployeeId}</p>
                                                        </div>
                                                    )}
                                                    {formData.ADCompany && (
                                                        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs">บริษัท</span>
                                                            <p className="font-medium text-slate-800 dark:text-white">{formData.ADCompany}</p>
                                                        </div>
                                                    )}
                                                    {formData.Department && (
                                                        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs">แผนก</span>
                                                            <p className="font-medium text-slate-800 dark:text-white">{formData.Department}</p>
                                                        </div>
                                                    )}
                                                    {formData.Branch && (
                                                        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400 text-xs">สาขา</span>
                                                            <p className="font-medium text-slate-800 dark:text-white">{formData.Branch}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* FullName (editable only for local users) */}
                                        {!isAdUser && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.FullName}
                                                    onChange={e => setFormData({ ...formData, FullName: e.target.value })}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                                                    placeholder="เช่น John Smith"
                                                />
                                            </div>
                                        )}

                                        {/* Password (only for local users, new only) */}
                                        {!editMode && !isAdUser && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">รหัสผ่านเริ่มต้น</label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={formData.PasswordHash}
                                                        onChange={e => setFormData({ ...formData, PasswordHash: e.target.value })}
                                                        className="w-full px-3 py-2.5 pr-10 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                                                        placeholder="(ค่าเริ่มต้น: P@ssw0rd123)"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">ขั้นต่ำ 8 ตัว, ต้องมี A-Z, ตัวเลข, อักขระพิเศษ</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-100 dark:border-slate-700" />

                                {/* Section: Permissions */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-md flex items-center justify-center">
                                            <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สิทธิ์การใช้งาน</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Role <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.RoleId}
                                                onChange={e => setFormData({ ...formData, RoleId: e.target.value })}
                                                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                                            >
                                                <option value="">-- เลือก Role --</option>
                                                {roles.map(r => (
                                                    <option key={r.RoleId} value={r.RoleId}>{r.RoleName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                บริษัทที่เข้าถึงได้ <span className="text-red-500">*</span>
                                            </label>
                                            <div className="grid gap-2">
                                                {companies.map(company => {
                                                    const isChecked = formData.allowedCompanies.includes(company.id);
                                                    const colors = companyColorMap[company.color];
                                                    return (
                                                        <label
                                                            key={company.id}
                                                            className={`flex items-center gap-3 cursor-pointer border rounded-xl p-3 transition-all ${isChecked
                                                                ? `${colors.bg} ${colors.border} ${colors.text} shadow-sm`
                                                                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-700'
                                                                }`}
                                                        >
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'
                                                                }`}>
                                                                {isChecked && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <Building className="w-4 h-4 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium dark:text-white">{company.id}. {company.name}</p>
                                                                <p className="text-xs opacity-70">{company.short}</p>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleCompany(company.id)}
                                                                className="sr-only"
                                                            />
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-100 dark:border-slate-700" />

                                {/* Section: Status */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${formData.IsActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                            {formData.IsActive ? <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <UserX className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สถานะ</h4>
                                    </div>
                                    <label className={`flex items-center gap-3 cursor-pointer border rounded-xl p-3.5 transition-all ${formData.IsActive
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                                        }`}>
                                        <div className={`w-11 h-6 rounded-full relative transition-all ${formData.IsActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${formData.IsActive ? 'left-[22px]' : 'left-0.5'}`}></div>
                                        </div>
                                        <div>
                                            <span className={`text-sm font-semibold ${formData.IsActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {formData.IsActive ? 'เปิดใช้งาน (Active)' : 'ระงับบัญชี (Inactive)'}
                                            </span>
                                            <p className="text-xs text-slate-400">
                                                {formData.IsActive ? 'ผู้ใช้สามารถเข้าสู่ระบบได้' : 'ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้'}
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={formData.IsActive}
                                            onChange={e => setFormData({ ...formData, IsActive: e.target.checked })}
                                            className="sr-only"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium rounded-xl transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleSaveUser}
                                    disabled={isSaving}
                                    className={`px-6 py-2.5 text-white font-medium rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 shadow-lg ${isAdUser
                                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                                        }`}
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isSaving ? 'กำลังบันทึก...' : isAdUser ? 'บันทึกผู้ใช้ AD' : 'บันทึกข้อมูล'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reset Password Modal */}
            {isResetPwOpen && resetPwUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <KeyRound className="w-5 h-5" />
                                รีเซ็ตรหัสผ่าน
                            </h3>
                            <button onClick={() => setIsResetPwOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-center">
                                <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${getAvatarColor(resetPwUser.FullName)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                                    {resetPwUser.FullName?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <p className="mt-2 font-semibold text-slate-900 dark:text-white">{resetPwUser.FullName}</p>
                                <p className="text-xs text-slate-400 font-mono">@{resetPwUser.Username}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    รหัสผ่านใหม่ <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showResetPw ? 'text' : 'password'}
                                        value={resetPwValue}
                                        onChange={e => setResetPwValue(e.target.value)}
                                        className="w-full px-3 py-2.5 pr-10 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white dark:bg-slate-700 dark:text-white text-sm"
                                        placeholder="ใส่รหัสผ่านใหม่"
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter') handleResetPassword(); }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowResetPw(!showResetPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-1.5">ขั้นต่ำ 8 ตัว, ต้องมี A-Z, ตัวเลข, อักขระพิเศษ</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsResetPwOpen(false)}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium rounded-xl transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={isResetting}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 shadow-md shadow-amber-500/30"
                            >
                                {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                {isResetting ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
