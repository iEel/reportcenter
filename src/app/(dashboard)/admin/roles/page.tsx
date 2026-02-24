"use client"

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Shield, FileText, RefreshCw, X, Save, Loader2, Check, Users, ChevronRight } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";

interface Role {
    RoleId: number;
    RoleName: string;
    UserCount: number;
    assignedReports: number[];
}

interface Report {
    ReportId: number;
    ReportName: string;
    ReportType: number;
}

export default function AdminRolesPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [roles, setRoles] = useState<Role[]>([]);
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        RoleId: 0,
        RoleName: '',
        assignedReports: [] as number[],
    });

    // Expanded role card
    const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/roles');
            const data = await res.json();
            if (data.success) {
                setRoles(data.roles);
                setAllReports(data.allReports);
            }
        } catch (err) {
            toast('ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenAddModal = () => {
        setEditMode(false);
        setFormData({ RoleId: 0, RoleName: '', assignedReports: [] });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (role: Role) => {
        setEditMode(true);
        setFormData({
            RoleId: role.RoleId,
            RoleName: role.RoleName,
            assignedReports: [...role.assignedReports],
        });
        setIsModalOpen(true);
    };

    const toggleReport = (reportId: number) => {
        setFormData(prev => ({
            ...prev,
            assignedReports: prev.assignedReports.includes(reportId)
                ? prev.assignedReports.filter(id => id !== reportId)
                : [...prev.assignedReports, reportId],
        }));
    };

    const selectAllReports = () => {
        setFormData(prev => ({ ...prev, assignedReports: allReports.map(r => r.ReportId) }));
    };

    const deselectAllReports = () => {
        setFormData(prev => ({ ...prev, assignedReports: [] }));
    };

    const handleSave = async () => {
        if (!formData.RoleName.trim()) {
            toast('กรุณาระบุชื่อ Role', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/roles', {
                method: editMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roleId: formData.RoleId,
                    roleName: formData.RoleName,
                    assignedReports: formData.assignedReports,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast(editMode ? 'อัพเดท Role สำเร็จ' : 'เพิ่ม Role สำเร็จ', 'success');
                setIsModalOpen(false);
                fetchData();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch (err) {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        if (role.UserCount > 0) {
            toast(`ไม่สามารถลบ Role "${role.RoleName}" ได้ — มีผู้ใช้ ${role.UserCount} คนอยู่`, 'error');
            return;
        }
        const ok = await confirm({
            title: 'ลบ Role',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบ Role "${role.RoleName}"? การกระทำนี้ไม่สามารถย้อนกลับได้`,
            confirmLabel: 'ลบ Role',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/admin/roles?roleId=${role.RoleId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast('ลบ Role สำเร็จ', 'success');
                fetchData();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch (err) {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const filteredRoles = roles.filter(r =>
        r.RoleName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalUsers = roles.reduce((sum, r) => sum + r.UserCount, 0);
    const totalMappings = roles.reduce((sum, r) => sum + r.assignedReports.length, 0);

    const roleColors = [
        { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
        { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
        { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
        { bg: 'from-amber-500 to-orange-500', light: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
        { bg: 'from-rose-500 to-pink-500', light: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400' },
        { bg: 'from-cyan-500 to-teal-500', light: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400' },
    ];

    const getRoleColor = (idx: number) => roleColors[idx % roleColors.length];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">จัดการสิทธิ์ (Roles)</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">สร้าง Role แล้วกำหนดว่า Role ไหนเข้าถึงรายงานไหนได้</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchData} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        เพิ่ม Role ใหม่
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{roles.length}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Roles ทั้งหมด</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalUsers}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ผู้ใช้ทั้งหมด</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalMappings}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">การ assign รายงาน</p>
                    </div>
                </div>
            </div>

            {/* Role Cards */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
                {/* Search Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหา Role..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white dark:bg-slate-700 dark:text-white font-medium"
                        />
                    </div>
                    {searchQuery && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-3 whitespace-nowrap">
                            พบ {filteredRoles.length} จาก {roles.length}
                        </span>
                    )}
                </div>

                {/* List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {isLoading ? (
                        <div className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center text-slate-500 dark:text-slate-400">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-3" />
                                <p>กำลังโหลดข้อมูล...</p>
                            </div>
                        </div>
                    ) : filteredRoles.length === 0 ? (
                        <div className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                            {searchQuery ? 'ไม่พบ Role ที่ค้นหา' : 'ยังไม่มี Role ในระบบ — กดปุ่ม "เพิ่ม Role ใหม่" เพื่อเริ่มต้น'}
                        </div>
                    ) : filteredRoles.map((role, idx) => {
                        const color = getRoleColor(idx);
                        const isExpanded = expandedRoleId === role.RoleId;
                        return (
                            <div key={role.RoleId} className="group">
                                <div
                                    className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                                    onClick={() => setExpandedRoleId(isExpanded ? null : role.RoleId)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Role Icon */}
                                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center text-white shadow-sm`}>
                                                <Shield className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-base">{role.RoleName}</h3>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <Users className="w-3 h-3" />
                                                        {role.UserCount} ผู้ใช้
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <FileText className="w-3 h-3" />
                                                        {role.assignedReports.length} รายงาน
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenEditModal(role); }}
                                                className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                                                className={`p-2 rounded-lg transition-colors ${role.UserCount > 0
                                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'
                                                    }`}
                                                title={role.UserCount > 0 ? `มีผู้ใช้ ${role.UserCount} คน — ลบไม่ได้` : 'ลบ Role'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded: assigned reports */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className="ml-15 pl-4 border-l-2 border-slate-200 dark:border-slate-600">
                                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                รายงานที่เข้าถึงได้ ({role.assignedReports.length})
                                            </p>
                                            {role.assignedReports.length === 0 ? (
                                                <p className="text-sm text-slate-400 dark:text-slate-500 italic">ยังไม่ได้กำหนดรายงานใดๆ</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {role.assignedReports.map(reportId => {
                                                        const report = allReports.find(r => r.ReportId === reportId);
                                                        if (!report) return null;
                                                        return (
                                                            <span key={reportId} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${report.ReportType === 1
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                                                : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                                                }`}>
                                                                <FileText className="w-3 h-3" />
                                                                {report.ReportName}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                {editMode ? 'แก้ไข Role' : 'เพิ่ม Role ใหม่'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Role Name */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">ข้อมูล Role</h4>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    ชื่อ Role <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.RoleName}
                                    onChange={e => setFormData(prev => ({ ...prev, RoleName: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                                    placeholder="เช่น Sales, Accountant, Manager..."
                                />
                            </div>

                            {/* Report Access */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        สิทธิ์เข้าถึงรายงาน
                                    </h4>
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        {formData.assignedReports.length}/{allReports.length}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={selectAllReports} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                                        เลือกทั้งหมด
                                    </button>
                                    <button onClick={deselectAllReports} className="text-xs text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                        ยกเลิกทั้งหมด
                                    </button>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                    {allReports.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">ไม่มีรายงานในระบบ</p>
                                    ) : allReports.map(report => {
                                        const isChecked = formData.assignedReports.includes(report.ReportId);
                                        return (
                                            <label
                                                key={report.ReportId}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-all ${isChecked ? 'bg-blue-50/60 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'
                                                    }`}>
                                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <FileText className={`w-4 h-4 flex-shrink-0 ${isChecked ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{report.ReportName}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${report.ReportType === 1
                                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                                                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                                                    }`}>
                                                    {report.ReportType === 1 ? 'STD' : 'TPL'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleReport(report.ReportId)}
                                                    className="sr-only"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all active:scale-95 disabled:opacity-70 shadow-md shadow-blue-500/30"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
