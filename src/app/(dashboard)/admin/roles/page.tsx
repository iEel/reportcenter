"use client"

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Shield, FileText, RefreshCw, X, Save, Loader2, Check } from "lucide-react";
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
            console.error(err);
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
        setFormData(prev => ({
            ...prev,
            assignedReports: allReports.map(r => r.ReportId),
        }));
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
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบ Role "${role.RoleName}"?`,
            confirmLabel: 'ลบ',
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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">จัดการสิทธิ์ (Roles)</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">เพิ่ม/แก้ไข Role และกำหนดว่า Role ไหนเข้าถึงรายงานไหนได้</p>
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

            {/* Role Cards */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหา Role..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white dark:bg-slate-700 font-medium"
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {isLoading ? (
                        <div className="px-6 py-12 text-center text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                            กำลังโหลด...
                        </div>
                    ) : filteredRoles.length === 0 ? (
                        <div className="px-6 py-12 text-center text-slate-400">
                            {searchQuery ? 'ไม่พบ Role ที่ค้นหา' : 'ยังไม่มี Role ในระบบ'}
                        </div>
                    ) : filteredRoles.map(role => (
                        <div key={role.RoleId} className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{role.RoleName}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                👤 ผู้ใช้ {role.UserCount} คน
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                📊 เข้าถึง {role.assignedReports.length} รายงาน
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenEditModal(role)}
                                        className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                        title="แก้ไข"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(role)}
                                        className="p-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                        title="ลบ"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Report badges */}
                            {role.assignedReports.length > 0 && (
                                <div className="mt-3 ml-14 flex flex-wrap gap-1.5">
                                    {role.assignedReports.map(reportId => {
                                        const report = allReports.find(r => r.ReportId === reportId);
                                        return report ? (
                                            <span key={reportId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                <FileText className="w-3 h-3" />
                                                {report.ReportName}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editMode ? 'แก้ไข Role' : 'เพิ่ม Role ใหม่'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Role Name */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">ชื่อ Role</label>
                                <input
                                    type="text"
                                    value={formData.RoleName}
                                    onChange={e => setFormData(prev => ({ ...prev, RoleName: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white"
                                    placeholder="เช่น Sales, Accountant, Manager..."
                                />
                            </div>

                            {/* Report Access */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        สิทธิ์เข้าถึงรายงาน ({formData.assignedReports.length}/{allReports.length})
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={selectAllReports} className="text-xs text-blue-600 hover:text-blue-700 font-medium">เลือกทั้งหมด</button>
                                        <span className="text-slate-300">|</span>
                                        <button onClick={deselectAllReports} className="text-xs text-slate-500 hover:text-slate-600 font-medium">ยกเลิกทั้งหมด</button>
                                    </div>
                                </div>
                                <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                    {allReports.length === 0 ? (
                                        <p className="px-4 py-6 text-center text-sm text-slate-400">ไม่มีรายงานในระบบ</p>
                                    ) : allReports.map(report => {
                                        const isChecked = formData.assignedReports.includes(report.ReportId);
                                        return (
                                            <label
                                                key={report.ReportId}
                                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'
                                                    }`}>
                                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{report.ReportName}</p>
                                                </div>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${report.ReportType === 1
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                        : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                                    }`}>
                                                    {report.ReportType === 1 ? 'Standard' : 'Template'}
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

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all active:scale-95 disabled:opacity-70 shadow-md shadow-blue-500/30"
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
