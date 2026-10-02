"use client"

import { useState, useEffect, useRef, useCallback, useId, type KeyboardEvent } from "react";
import { Plus, Search, Edit, Shield, User, Building, RefreshCw, Save, Loader2, Eye, EyeOff, Trash2, KeyRound, ChevronLeft, ChevronRight, ChevronDown, Check, FileText, CloudCog } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import useUnsavedChanges from "@/hooks/useUnsavedChanges";
import { getUserAccessSummary, hasUserDraftChanges, isAdAccount, isCurrentUser, type UserAccessRole, type UserAccessReport, type UserAccessCompany } from "@/lib/user-access";

interface ManagedUser {
    UserId: number; Username: string; FullName: string; RoleId: number | null;
    RoleName?: string; CompanyId: number | null; IsActive: boolean;
    AuthType?: string; allowedCompanies: number[]; Email?: string; EmployeeId?: string;
    ADCompany?: string; Department?: string; Branch?: string;
}
interface AdUser {
    username: string; fullName?: string; email?: string; employeeId?: string;
    company?: string; department?: string; branch?: string;
}
interface Company extends UserAccessCompany { color: string; }
interface RoleOption extends UserAccessRole { activeReportCount: number | null; }
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-700";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50";

function UserRoleSelector({ id, value, options, onChange, disabled }: {
    id: string; value: string; options: RoleOption[]; onChange: (value: string) => void; disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const selected = options.find(option => String(option.RoleId) === value);
    const filtered = options.filter(option => option.RoleName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const active = filtered[activeIndex];
    const isOpen = open && !disabled;
    const close = () => { setOpen(false); setQuery(''); setActiveIndex(-1); };
    const openList = () => {
        if (disabled || isOpen) return;
        setQuery('');
        setActiveIndex(Math.max(0, options.findIndex(option => String(option.RoleId) === value)));
        setOpen(true);
    };
    const selectRole = (option: RoleOption) => {
        onChange(String(option.RoleId));
        close();
        inputRef.current?.focus();
    };

    useEffect(() => {
        if (!isOpen) return;
        const outside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false); setQuery(''); setActiveIndex(-1);
            }
        };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && active) document.getElementById(`${listId}-${active.RoleId}`)?.scrollIntoView({ block: 'nearest' });
    }, [isOpen, active, listId]);

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) openList();
            else setActiveIndex(current => filtered.length ? (current + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : -1);
        } else if (isOpen && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault(); setActiveIndex(event.key === 'Home' ? 0 : filtered.length - 1);
        } else if (isOpen && event.key === 'Enter') {
            event.preventDefault(); if (active) selectRole(active);
        } else if (isOpen && event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); close();
        } else if (event.key === 'Tab') close();
    };

    return <div ref={rootRef} className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
        <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input ref={inputRef} id={id} role="combobox" aria-autocomplete="list" aria-expanded={isOpen} aria-controls={listId} aria-activedescendant={isOpen && active ? `${listId}-${active.RoleId}` : undefined} aria-describedby="user-role-hint" disabled={disabled} autoComplete="off" value={isOpen ? query : selected?.RoleName || ''} placeholder={isOpen ? 'ค้นหากลุ่มสิทธิ์...' : 'เลือกกลุ่มสิทธิ์'} onFocus={openList} onClick={openList} onChange={event => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={onKeyDown} className={`${inputClass} pl-9 pr-9`} />
            <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && <div id={listId} role="listbox" aria-label="กลุ่มสิทธิ์" className="absolute inset-x-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            {filtered.length === 0 ? <p role="status" className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">ไม่พบกลุ่มสิทธิ์</p> : filtered.map((option, index) => <div key={option.RoleId} id={`${listId}-${option.RoleId}`} role="option" aria-selected={String(option.RoleId) === value} onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => selectRole(option)} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${index === activeIndex ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100' : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700'}`}>
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{option.RoleName.toLowerCase() === 'admin' ? <Shield className="h-4 w-4" /> : option.RoleName.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{option.RoleName}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{option.activeReportCount === null ? 'ยังโหลดจำนวนรายงานไม่ได้' : `${option.activeReportCount} รายงานที่ใช้งาน`}{option.RoleName.toLowerCase() === 'admin' ? ' · ทุกรายงาน' : ''}</span></span>
                {String(option.RoleId) === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />}
            </div>)}
        </div>}
    </div>;
}

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
    const { user: signedInUser } = useAuth();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [roles, setRoles] = useState<UserAccessRole[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [allReports, setAllReports] = useState<UserAccessReport[] | null>(null);
    const [companyLoadError, setCompanyLoadError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterKind, setFilterKind] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const perPage = 10;

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isRolePreviewOpen, setIsRolePreviewOpen] = useState(false);

    // Reset Password Modal
    const [isResetPwOpen, setIsResetPwOpen] = useState(false);
    const [resetPwUser, setResetPwUser] = useState<ManagedUser | null>(null);
    const [resetPwValue, setResetPwValue] = useState('');
    const [showResetPw, setShowResetPw] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [formData, setFormData] = useState({
        UserId: '' as string | number,
        Username: '',
        PasswordHash: '',
        FullName: '',
        CompanyId: '',
        RoleId: '',
        IsActive: true,
        allowedCompanies: [] as number[],
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
    const [adSuggestions, setAdSuggestions] = useState<AdUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    const initialFormRef = useRef<typeof formData | null>(null);
    const formDirty = isModalOpen && initialFormRef.current !== null && hasUserDraftChanges(initialFormRef.current, formData);
    const { confirmDiscard } = useUnsavedChanges(formDirty || (isResetPwOpen && resetPwValue.length > 0));
    const accessSummary = getUserAccessSummary(formData.RoleId, formData.allowedCompanies, roles, allReports, companies);
    const editingSelf = editMode && isCurrentUser(formData.UserId, signedInUser?.userId);
    const roleOptions = roles.map(role => ({
        ...role,
        activeReportCount: getUserAccessSummary(role.RoleId, [], roles, allReports, []).activeReportCount,
    }));
    const selectedRoleReports = new Set(roles.find(role => String(role.RoleId) === formData.RoleId)?.assignedReports ?? []);
    const rolePreviewReports = (allReports ?? []).filter(report =>
        report.IsActive !== false && report.IsActive !== 0 && (accessSummary.isAdmin || selectedRoleReports.has(report.ReportId)));

    const fetchUsersAndRoles = useCallback(async () => {
        setIsLoading(true);
        const results = await Promise.allSettled([
            fetch('/api/admin/users').then(async response => {
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error('users');
                setUsers(data.users);
                return data.roles as UserAccessRole[];
            }),
            fetch('/api/admin/roles').then(async response => {
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error('roles');
                return { roles: data.roles as UserAccessRole[], allReports: data.allReports as UserAccessReport[] };
            }),
            fetch('/api/companies').then(async response => {
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error('companies');
                setCompanies(data.companies.map((company: { companyId: number; label: string; name: string }, index: number) => ({
                    id: company.companyId, name: company.name, code: company.label,
                    color: COMPANY_COLORS[index % COMPANY_COLORS.length],
                })));
                setCompanyLoadError(false);
            }),
        ]);
        if (results[0].status === 'rejected') toast('ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่', 'error');
        if (results[1].status === 'fulfilled') {
            setRoles(results[1].value.roles);
            setAllReports(results[1].value.allReports);
        } else {
            if (results[0].status === 'fulfilled') setRoles(results[0].value);
            setAllReports(null);
            toast('ไม่สามารถโหลดจำนวนรายงานของกลุ่มสิทธิ์ได้', 'error');
        }
        if (results[2].status === 'rejected') {
            setCompanyLoadError(true);
            toast('ไม่สามารถโหลดรายชื่อบริษัทได้ กรุณาลองใหม่', 'error');
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        void fetchUsersAndRoles();
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [fetchUsersAndRoles]);

    const closeUserForm = async () => {
        if (isSaving || !(await confirmDiscard())) return;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setIsRolePreviewOpen(false);
        setIsModalOpen(false);
        setShowSuggestions(false);
    };
    const closeResetPassword = async () => {
        if (!isResetting && await confirmDiscard()) setIsResetPwOpen(false);
    };

    const handleOpenAddModal = () => {
        setIsRolePreviewOpen(false);
        setEditMode(false);
        setShowPassword(false);
        setIsAdUser(false);
        setAdLookupError('');
        setAdSuggestions([]);
        setShowSuggestions(false);
        const nextForm = {
            UserId: '', Username: '', PasswordHash: '',
            FullName: '', CompanyId: '', RoleId: '',
            IsActive: true, allowedCompanies: [1, 2, 3].filter(id => companies.some(company => company.id === id)),
            AuthType: 'local', Email: '', EmployeeId: '',
            ADCompany: '', Department: '', Branch: '',
        };
        setFormData(nextForm);
        initialFormRef.current = nextForm;
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: ManagedUser) => {
        setIsRolePreviewOpen(false);
        setEditMode(true);
        setShowPassword(false);
        const isAd = isAdAccount(user.AuthType);
        setIsAdUser(isAd);
        setAdLookupError('');
        setAdSuggestions([]);
        setShowSuggestions(false);
        const nextForm = {
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
        };
        setFormData(nextForm);
        initialFormRef.current = nextForm;
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

    const handleSelectAdUser = (user: AdUser) => {
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
        if (isSaving || companyLoadError) return;
        if (!formData.FullName.trim()) {
            toast('กรุณากรอกชื่อ-นามสกุล', 'error');
            return;
        }
        if (!editMode && !formData.Username.trim()) {
            toast('กรุณากรอก Username', 'error');
            return;
        }
        if (!formData.RoleId) {
            toast('กรุณาเลือกกลุ่มสิทธิ์', 'error');
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
                setIsRolePreviewOpen(false);
                setIsModalOpen(false);
                fetchUsersAndRoles();
            } else {
                toast('เกิดข้อผิดพลาด: ' + data.message, 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (user: ManagedUser) => {
        if (isCurrentUser(user.UserId, signedInUser?.userId)) return;
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

    const handleDeleteUser = async (user: ManagedUser) => {
        if (isCurrentUser(user.UserId, signedInUser?.userId)) return;
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

    const handleOpenResetPw = (user: ManagedUser) => {
        if (isAdAccount(user.AuthType)) return;
        setResetPwUser(user);
        setResetPwValue('');
        setShowResetPw(false);
        setIsResetPwOpen(true);
    };

    const handleResetPassword = async () => {
        if (isResetting || !resetPwUser || isAdAccount(resetPwUser.AuthType)) return;
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
        const q = searchQuery.trim().toLowerCase();
        const matchSearch = u.Username?.toLowerCase().includes(q) ||
            u.FullName?.toLowerCase().includes(q) ||
            u.EmployeeId?.toLowerCase().includes(q);
        const matchRole = !filterRole || u.RoleId?.toString() === filterRole;
        const matchStatus = !filterStatus ||
            (filterStatus === 'active' && u.IsActive) ||
            (filterStatus === 'inactive' && !u.IsActive);
        const matchKind = !filterKind || (filterKind === 'ad' ? isAdAccount(u.AuthType) : !isAdAccount(u.AuthType));
        return matchSearch && matchRole && matchStatus && matchKind;
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / perPage));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * perPage, safePage * perPage);

    // Reset page when filters change
    const resetPage = () => setCurrentPage(1);

    const activeCount = users.filter(u => u.IsActive).length;
    const inactiveCount = users.length - activeCount;
    const adCount = users.filter(user => isAdAccount(user.AuthType)).length;

    // AD Sync
    const handleSyncAD = async () => {
        const ok = await confirm({ title: 'Sync AD', message: 'ต้องการ Sync กับ Active Directory หรือไม่?\n\nระบบจะตรวจสอบผู้ใช้ LDAP ทั้งหมดว่ายังอยู่ใน AD หรือไม่\nถ้าไม่พบใน AD จะถูก Disable อัตโนมัติ', confirmLabel: 'Sync AD' });
        if (!ok) return;

        setIsSyncing(true);
        try {
            const res = await fetch('/api/admin/users/sync-ad', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast(data.message, 'success');
                fetchUsersAndRoles();
            } else {
                toast(data.message || 'Sync ล้มเหลว', 'error');
            }
        } catch {
            toast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const clearFilters = () => {
        setSearchQuery(''); setFilterRole(''); setFilterStatus(''); setFilterKind(''); resetPage();
    };
    const switchAccountType = (ad: boolean) => {
        setIsAdUser(ad);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setFormData(prev => ({ ...prev, AuthType: ad ? 'ldap' : 'local', Email: '', EmployeeId: '', ADCompany: '', Department: '', Branch: '', FullName: ad ? '' : prev.FullName }));
        setAdLookupError(''); setAdSuggestions([]); setShowSuggestions(false);
    };
    const accessSummaryView = (
        <section aria-label="สรุปสิทธิ์ก่อนบันทึก" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Shield className="h-4 w-4 text-blue-600" />สรุปสิทธิ์ก่อนบันทึก</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">กลุ่มสิทธิ์</dt><dd className="mt-1 font-medium">{accessSummary.roleName || 'ยังไม่ได้เลือกกลุ่มสิทธิ์'}</dd></div>
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">รายงานที่ใช้งาน</dt><dd className="mt-1 font-medium">{!formData.RoleId ? 'รอเลือกกลุ่มสิทธิ์' : accessSummary.activeReportCount === null ? 'ยังโหลดจำนวนไม่ได้' : `${accessSummary.activeReportCount} รายงาน`}{accessSummary.isAdmin && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">ทุกรายงานที่ใช้งาน</span>}</dd></div>
                <div><dt className="text-xs text-slate-500 dark:text-slate-400">บริษัทที่เข้าถึง</dt><dd className="mt-1 break-words font-medium">{accessSummary.companyCodes.join(', ') || (formData.allowedCompanies.length ? 'ยังโหลดชื่อบริษัทไม่ได้' : 'ยังไม่ได้เลือกบริษัท')}{accessSummary.unknownCompanyIds.length > 0 && <span className="block text-xs font-normal text-amber-700 dark:text-amber-300">ไม่พบข้อมูลบริษัท #{accessSummary.unknownCompanyIds.join(', #')}</span>}</dd></div>
            </dl>
        </section>
    );

    return (
        <div className="space-y-5 text-slate-900 dark:text-slate-100">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div><h1 className="text-2xl font-semibold tracking-tight">ผู้ใช้</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">บัญชีผู้ใช้ กลุ่มสิทธิ์ และบริษัทที่เข้าถึงได้</p></div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={fetchUsersAndRoles} disabled={isLoading} className={secondaryButton} aria-label="รีเฟรชข้อมูลผู้ใช้"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
                    <button onClick={handleSyncAD} disabled={isSyncing} className={secondaryButton}>{isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudCog className="h-4 w-4" />}{isSyncing ? 'กำลังตรวจสอบ...' : 'ตรวจสอบกับ AD'}</button>
                    <button onClick={handleOpenAddModal} disabled={isLoading || companyLoadError} className={primaryButton}><Plus className="h-4 w-4" />เพิ่มผู้ใช้</button>
                </div>
            </header>
            {companyLoadError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">โหลดรายชื่อบริษัทไม่สำเร็จ กรุณารีเฟรชก่อนเพิ่มหรือบันทึกผู้ใช้</p>}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="grid grid-cols-1 items-center gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(9rem,12rem)_auto_minmax(8rem,10rem)_auto] dark:border-slate-700">
                    <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="ค้นหาผู้ใช้" placeholder="ชื่อ, username หรือรหัสพนักงาน" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); resetPage(); }} className={`${inputClass} pl-9`} /></div>
                    <select aria-label="กรองกลุ่มสิทธิ์" value={filterRole} onChange={event => { setFilterRole(event.target.value); resetPage(); }} className={`${inputClass} min-w-0`}><option value="">ทุกกลุ่มสิทธิ์</option>{roles.map(role => <option key={role.RoleId} value={role.RoleId}>{role.RoleName}</option>)}</select>
                    <div className="inline-flex w-fit whitespace-nowrap rounded-lg border border-slate-200 p-0.5 dark:border-slate-600" role="group" aria-label="ชนิดบัญชี">
                        {([['', 'ทุกบัญชี', users.length], ['ad', 'AD', adCount], ['local', 'Local', users.length - adCount]] as const).map(([value, label, count]) => <button key={value} aria-pressed={filterKind === value} onClick={() => { setFilterKind(value); resetPage(); }} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${filterKind === value ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{label} <span className="ml-1 opacity-70">{count}</span></button>)}
                    </div>
                    <select aria-label="กรองสถานะผู้ใช้" value={filterStatus} onChange={event => { setFilterStatus(event.target.value); resetPage(); }} className={`${inputClass} min-w-0`}><option value="">ทุกสถานะ ({users.length})</option><option value="active">ใช้งาน ({activeCount})</option><option value="inactive">ระงับ ({inactiveCount})</option></select>
                    {(searchQuery || filterRole || filterStatus || filterKind) && <button className="justify-self-start whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={clearFilters}>ล้างตัวกรอง</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">ผู้ใช้</th><th className="px-4 py-3 font-medium">บัญชี</th><th className="px-4 py-3 font-medium">กลุ่มสิทธิ์</th><th className="px-4 py-3 font-medium">บริษัทที่เข้าถึง</th><th className="px-4 py-3 font-medium">สถานะ</th><th className="px-4 py-3 text-right font-medium">จัดการ</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {isLoading ? <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />กำลังโหลดข้อมูลผู้ใช้...</td></tr> : paginatedUsers.length === 0 ? <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500">ไม่พบผู้ใช้ตามเงื่อนไข</td></tr> : paginatedUsers.map(user => {
                                const self = isCurrentUser(user.UserId, signedInUser?.userId);
                                const ad = isAdAccount(user.AuthType);
                                return <tr key={user.UserId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="min-w-56 px-4 py-3"><div className="flex items-center gap-3"><div aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(user.FullName)} text-sm font-semibold text-white`}>{user.FullName?.charAt(0)?.toUpperCase() || 'U'}</div><div><button onClick={() => handleOpenEditModal(user)} className="text-left font-medium hover:text-blue-600 hover:underline">{user.FullName}</button>{self && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">คุณ</span>}<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">@{user.Username}{user.EmployeeId ? ` · ${user.EmployeeId}` : ''}</p></div></div></td>
                                    <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs ${ad ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300' : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}>{ad ? 'AD' : 'Local'}</span></td>
                                    <td className="px-4 py-3"><span className="whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">{user.RoleName || 'ยังไม่กำหนดกลุ่ม'}</span></td>
                                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{user.allowedCompanies?.length ? user.allowedCompanies.map(id => { const company = companies.find(item => item.id === id); return <span key={id} title={company?.name} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs dark:border-slate-600">{company?.code || `#${id}`}</span>; }) : <span className="text-xs text-amber-700 dark:text-amber-300">ไม่มีบริษัท</span>}</div></td>
                                    <td className="px-4 py-3"><button onClick={() => handleToggleActive(user)} disabled={self} title={self ? 'เปลี่ยนสถานะบัญชีของตัวเองไม่ได้' : user.IsActive ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'} aria-label={`${user.IsActive ? 'ระงับ' : 'เปิดใช้งาน'} ${user.FullName}`} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs disabled:cursor-default ${user.IsActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${user.IsActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{user.IsActive ? 'ใช้งาน' : 'ระงับ'}</button></td>
                                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => handleOpenEditModal(user)} className="inline-flex items-center gap-1 rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={`แก้ไข ${user.FullName}`}><Edit className="h-4 w-4" /><span className="hidden xl:inline">แก้ไข</span></button>{!ad && <button onClick={() => handleOpenResetPw(user)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20" aria-label={`รีเซ็ตรหัสผ่านของ ${user.FullName}`} title="รีเซ็ตรหัสผ่าน"><KeyRound className="h-4 w-4" /></button>}{!self && <button onClick={() => handleDeleteUser(user)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`ลบ ${user.FullName}`} title="ลบผู้ใช้"><Trash2 className="h-4 w-4" /></button>}</div></td>
                                </tr>;
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><p>แสดง {filteredUsers.length ? (safePage - 1) * perPage + 1 : 0}–{Math.min(safePage * perPage, filteredUsers.length)} จาก {filteredUsers.length} คน</p><div className="flex items-center gap-3"><button onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} className={secondaryButton} aria-label="หน้าก่อน"><ChevronLeft className="h-4 w-4" /></button><span>หน้า {safePage} / {totalPages}</span><button onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} className={secondaryButton} aria-label="หน้าถัดไป"><ChevronRight className="h-4 w-4" /></button></div></div>
            </section>
            <AccessibleDialog
                open={isModalOpen}
                onClose={closeUserForm}
                title={editMode ? `แก้ไขผู้ใช้: ${formData.FullName}` : 'เพิ่มผู้ใช้'}
                description={editMode ? `@${formData.Username} · บัญชี ${isAdUser ? 'AD' : 'Local'}` : 'กำหนดบัญชี กลุ่มสิทธิ์ และบริษัทที่เข้าถึงได้'}
                variant={editMode ? 'drawer' : 'dialog'}
                wide={!editMode}
                footer={<><button onClick={closeUserForm} disabled={isSaving} className={secondaryButton}>ยกเลิก</button><button type="submit" form="user-editor-form" disabled={isSaving || companyLoadError} className={primaryButton}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSaving ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}</button></>}
            >
                <form id="user-editor-form" onSubmit={event => { event.preventDefault(); void handleSaveUser(); }} className="space-y-6">
                    {!editMode && <fieldset><legend className={labelClass}>ชนิดบัญชี</legend><div className="inline-flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-600">{([false, true] as const).map(ad => <button key={String(ad)} type="button" aria-pressed={isAdUser === ad} onClick={() => switchAccountType(ad)} className={`rounded-md px-4 py-2 text-sm ${isAdUser === ad ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{ad ? 'Active Directory' : 'Local'}</button>)}</div><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{isAdUser ? 'ค้นหาบัญชีจาก AD ไม่ต้องตั้งรหัสผ่านใน ReportCenter' : 'บัญชีและรหัสผ่านสำหรับ ReportCenter'}</p></fieldset>}
                    <section className="space-y-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4 text-slate-500" />ข้อมูลบัญชี</h3>
                        {!editMode && <div>
                            <label htmlFor="user-username" className={labelClass}>{isAdUser ? 'ค้นหา AD Username' : 'Username'} <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <input id="user-username" data-autofocus value={formData.Username} onChange={event => isAdUser ? handleAdSearch(event.target.value) : setFormData({ ...formData, Username: event.target.value })} onFocus={() => { if (isAdUser && adSuggestions.length) setShowSuggestions(true); }} onKeyDown={event => { if (isAdUser && event.key === 'Escape' && showSuggestions) { event.preventDefault(); event.stopPropagation(); setShowSuggestions(false); } else if (isAdUser && event.key === 'Enter') { event.preventDefault(); void handleAdLookup(); } }} autoComplete="off" className={inputClass} placeholder={isAdUser ? 'พิมพ์อย่างน้อย 2 ตัวอักษร' : 'ชื่อสำหรับเข้าสู่ระบบ'} />
                                    {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-blue-500" />}
                                </div>
                                {isAdUser && <button type="button" onClick={handleAdLookup} disabled={isLookingUp} className={secondaryButton} aria-label="ค้นหา AD Username แบบตรง">{isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>}
                            </div>
                            {isAdUser && showSuggestions && adSuggestions.length > 0 && <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600" aria-label="ผลค้นหาผู้ใช้ AD">{adSuggestions.map(user => <button key={user.username} type="button" onClick={() => handleSelectAdUser(user)} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-blue-50 focus-visible:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"><span className="font-medium">{user.fullName || user.username}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">@{user.username}</span>{user.department && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{user.department}</span>}</button>)}</div>}
                            {isAdUser && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">เลือกจากผลค้นหา หรือกด Enter เพื่อค้นหา username แบบตรง</p>}
                            {adLookupError && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{adLookupError}</p>}
                        </div>}
                        {isAdUser ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/30">
                            <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">ข้อมูลจาก Active Directory</p>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                <dt className="text-slate-500 dark:text-slate-400">ชื่อ-นามสกุล</dt><dd className="break-words">{formData.FullName || 'ยังไม่ได้เลือกผู้ใช้'}</dd>
                                <dt className="text-slate-500 dark:text-slate-400">อีเมล</dt><dd className="break-all">{formData.Email || '—'}</dd>
                                <dt className="text-slate-500 dark:text-slate-400">รหัสพนักงาน</dt><dd>{formData.EmployeeId || '—'}</dd>
                                <dt className="text-slate-500 dark:text-slate-400">ต้นสังกัด AD</dt><dd className="break-words">{formData.ADCompany || '—'}</dd>
                                <dt className="text-slate-500 dark:text-slate-400">แผนก / สาขา</dt><dd>{[formData.Department, formData.Branch].filter(Boolean).join(' / ') || '—'}</dd>
                            </dl>
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">ต้นสังกัด AD เป็นข้อมูลบัญชี บริษัทที่อนุญาตให้เข้าถึงต้องเลือกด้านล่าง</p>
                            {editMode && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">เปลี่ยนข้อมูลบัญชีและรหัสผ่านที่ Active Directory</p>}
                        </div> : <div><label htmlFor="user-full-name" className={labelClass}>ชื่อ-นามสกุล <span className="text-red-500">*</span></label><input id="user-full-name" data-autofocus={editMode || undefined} value={formData.FullName} onChange={event => setFormData({ ...formData, FullName: event.target.value })} className={inputClass} /></div>}
                        {!editMode && !isAdUser && <div>
                            <label htmlFor="user-password" className={labelClass}>รหัสผ่านเริ่มต้น</label>
                            <div className="relative"><input id="user-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={formData.PasswordHash} onChange={event => setFormData({ ...formData, PasswordHash: event.target.value })} className={`${inputClass} pr-11`} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute right-2 top-1 rounded p-2 text-slate-500">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">หากระบุรหัสผ่าน ใช้ขั้นต่ำ 8 ตัว พร้อม A–Z ตัวเลข และอักขระพิเศษ หากเว้นว่าง ระบบใช้ค่าเริ่มต้นเดิม</p>
                        </div>}
                    </section>
                    <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700">
                        <div>
                            <label htmlFor="user-role" className={labelClass}>กลุ่มสิทธิ์ <span className="text-red-500">*</span></label>
                            <UserRoleSelector id="user-role" value={formData.RoleId} options={roleOptions} disabled={editingSelf} onChange={value => setFormData({ ...formData, RoleId: value })} />
                            <p id="user-role-hint" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{editingSelf ? 'เปลี่ยนกลุ่มสิทธิ์ของบัญชีที่กำลังใช้งานไม่ได้' : 'ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม รายงานที่เห็นมาจากกลุ่มสิทธิ์นี้'}</p>
                            {formData.RoleId && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900/30">
                                <span className="text-slate-600 dark:text-slate-300">{accessSummary.activeReportCount === null ? 'ยังโหลดจำนวนรายงานไม่ได้' : `${accessSummary.activeReportCount} รายงานที่ใช้งาน`}{accessSummary.isAdmin ? ' · ทุกรายงาน' : ''}</span>
                                <button type="button" onClick={() => setIsRolePreviewOpen(true)} disabled={isSaving || allReports === null} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline disabled:text-slate-400 dark:text-blue-400"><FileText className="h-4 w-4" />ดูรายงานของกลุ่ม</button>
                            </div>}
                        </div>
                        <fieldset><legend className={`${labelClass} mb-2`}>บริษัทที่เข้าถึงได้ <span className="text-red-500">*</span></legend><div className={`grid gap-2 ${editMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>{companies.map(company => {
                            const checked = formData.allowedCompanies.includes(company.id);
                            const colors = companyColorMap[company.color];
                            return <label key={company.id} htmlFor={`user-company-${company.id}`} className={`flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${checked ? `${colors.bg} ${colors.border}` : 'border-slate-200 dark:border-slate-600'}`}><input id={`user-company-${company.id}`} type="checkbox" checked={checked} onChange={() => toggleCompany(company.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" />{editMode && <Building aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}<span className="min-w-0 text-sm"><span className="block font-semibold">{editMode ? company.name : company.code}</span><span className="block break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{editMode ? company.code : company.name}</span></span></label>;
                        })}</div>{companyLoadError && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">ยังโหลดรายชื่อบริษัทไม่ได้</p>}</fieldset>
                    </section>
                    <section className="border-t border-slate-200 pt-5 dark:border-slate-700"><label htmlFor="user-active" className="flex items-center gap-3"><input id="user-active" type="checkbox" checked={formData.IsActive} disabled={editingSelf} onChange={event => setFormData({ ...formData, IsActive: event.target.checked })} className="h-4 w-4 accent-blue-600" /><span className="text-sm font-medium">เปิดใช้งานบัญชี</span></label><p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{editingSelf ? 'ระงับบัญชีที่กำลังใช้งานไม่ได้' : formData.IsActive ? 'ผู้ใช้สามารถเข้าสู่ระบบได้' : 'ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้'}</p></section>
                    {accessSummaryView}
                </form>
            </AccessibleDialog>

            <AccessibleDialog open={isModalOpen && isRolePreviewOpen} onClose={() => setIsRolePreviewOpen(false)} title={`รายงานของกลุ่ม: ${accessSummary.roleName || 'ยังไม่เลือก'}`} description={`${accessSummary.activeReportCount ?? 0} รายงานที่ใช้งาน · ดูเพื่อประกอบการกำหนดสิทธิ์ผู้ใช้`} footer={<button type="button" data-autofocus onClick={() => setIsRolePreviewOpen(false)} className={secondaryButton}>กลับไปกรอกผู้ใช้</button>}>
                {rolePreviewReports.length > 0 ? <ul className="divide-y divide-slate-100 dark:divide-slate-700">{rolePreviewReports.map(report => <li key={report.ReportId} className="flex items-start gap-3 py-3"><FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 break-words text-sm">{report.ReportName || `รายงาน #${report.ReportId}`}</span></li>)}</ul> : <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">กลุ่มนี้ยังไม่มีรายงานที่ใช้งาน</p>}
            </AccessibleDialog>

            <AccessibleDialog open={isResetPwOpen && !!resetPwUser} onClose={closeResetPassword} title="รีเซ็ตรหัสผ่าน" description={resetPwUser ? `${resetPwUser.FullName} · @${resetPwUser.Username} · บัญชี Local` : undefined} footer={<><button onClick={closeResetPassword} disabled={isResetting} className={secondaryButton}>ยกเลิก</button><button type="submit" form="user-reset-password-form" disabled={isResetting} className={primaryButton}>{isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{isResetting ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}</button></>}>
                <form id="user-reset-password-form" onSubmit={event => { event.preventDefault(); void handleResetPassword(); }}><label htmlFor="user-reset-password" className={labelClass}>รหัสผ่านใหม่ <span className="text-red-500">*</span></label><div className="relative"><input id="user-reset-password" data-autofocus type={showResetPw ? 'text' : 'password'} value={resetPwValue} onChange={event => setResetPwValue(event.target.value)} autoComplete="new-password" className={`${inputClass} pr-11`} /><button type="button" onClick={() => setShowResetPw(!showResetPw)} aria-label={showResetPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute right-2 top-1 rounded p-2 text-slate-500">{showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">ขั้นต่ำ 8 ตัว พร้อม A–Z ตัวเลข และอักขระพิเศษ</p></form>
            </AccessibleDialog>
        </div>
    );
}
