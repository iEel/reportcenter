"use client"

import Link from "next/link";
import { Plus, Search, Edit, Trash2, FileText, Database, Shield, RefreshCw, Star, Power, Tag, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";

const CATEGORY_COLORS: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200',
};

export default function AdminReportsPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [categories, setCategories] = useState<{ CategoryId: number; CategoryName: string; ColorTag: string }[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/reports');
            const data = await res.json();
            if (data.success) setReports(data.reports);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleDelete = async (id: number, name: string) => {
        const ok = await confirm({
            title: 'ลบรายงานถาวร',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายงาน "${name}" ออกจากระบบถาวร? ข้อมูลตัวแปร, สิทธิ์, และรายการโปรดที่เกี่ยวข้องจะถูกลบทั้งหมด`,
            confirmLabel: 'ลบถาวร',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast('ลบรายงานถาวรสำเร็จ', 'success');
                fetchReports();
            } else {
                toast('เกิดข้อผิดพลาดในการลบ: ' + data.message, 'error');
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const handleToggleActive = async (id: number, name: string, currentlyActive: boolean) => {
        const action = currentlyActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
        const ok = await confirm({
            title: `${action}รายงาน`,
            message: `ต้องการ${action}รายงาน "${name}" หรือไม่?`,
            confirmLabel: action,
            variant: currentlyActive ? 'danger' : 'default',
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/admin/reports/${id}`, { method: 'PATCH' });
            const data = await res.json();
            if (data.success) {
                toast(data.message, 'success');
                fetchReports();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const filteredReports = reports.filter(r => {
        const matchesSearch = r.ReportName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.Description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all'
            || (filterCategory === 'none' && !r.CategoryId)
            || (r.CategoryId && r.CategoryId.toString() === filterCategory);
        return matchesSearch && matchesCategory;
    });

    useEffect(() => {
        fetchReports();
        // Fetch categories for filter
        fetch('/api/admin/categories')
            .then(r => r.json())
            .then(d => { if (d.success) setCategories(d.categories || []); })
            .catch(() => { });
    }, []);

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const ok = await confirm({
            title: `ลบรายงาน ${selectedIds.length} รายการ`,
            message: `คุณแน่ใจหรือ? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
            confirmLabel: `ลบ ${selectedIds.length} รายการ`,
            variant: 'danger',
        });
        if (!ok) return;
        try {
            const res = await fetch('/api/admin/reports/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportIds: selectedIds }),
            });
            const data = await res.json();
            if (data.success) {
                toast(`ลบ ${data.deleted} รายการเรียบร้อย`, 'success');
                setSelectedIds([]);
                fetchReports();
            } else {
                toast(data.message || 'ไม่สามารถลบได้', 'error');
            }
        } catch { toast('เกิดข้อผิดพลาด', 'error'); }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredReports.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredReports.map(r => r.ReportId));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">จัดการรายงาน (Manage Reports)</h1>
                    <p className="text-sm text-slate-500 mt-1">ตั้งค่าคำสั่ง T-SQL, ตัวแปร และกำหนดสิทธิ์การเข้าถึงรายงานของระบบ</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchReports} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <Link
                        href="/admin/reports/new"
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        สร้างรายงานใหม่
                    </Link>
                </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative w-full max-w-sm">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อรายงาน..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white font-medium"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className={`pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white font-medium appearance-none cursor-pointer ${filterCategory !== 'all' ? 'border-violet-300 bg-violet-50 text-violet-700' : ''}`}
                            >
                                <option value="all">ทุกหมวดหมู่</option>
                                <option value="none">ไม่ระบุหมวดหมู่</option>
                                {categories.map(c => (
                                    <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {selectedIds.length > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm shrink-0">
                            <Trash2 className="w-4 h-4" /> ลบที่เลือก ({selectedIds.length})
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-4 w-10">
                                    <input type="checkbox" checked={selectedIds.length === filteredReports.length && filteredReports.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300" />
                                </th>
                                <th className="px-6 py-4">ข้ออ้างอิง (ID)</th>
                                <th className="px-6 py-4">ชื่อรายงาน</th>
                                <th className="px-6 py-4">ประเภท</th>
                                <th className="px-6 py-4">การเข้าถึง</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                                            กำลังโหลดข้อมูล...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">{searchQuery ? 'ไม่พบรายงานที่ค้นหา' : 'ไม่พบข้อมูลรายงานในระบบ'}</td>
                                </tr>
                            ) : filteredReports.map((report) => (
                                <tr key={report.ReportId} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(report.ReportId) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="px-3 py-4">
                                        <input type="checkbox" checked={selectedIds.includes(report.ReportId)} onChange={() => toggleSelect(report.ReportId)} className="w-4 h-4 rounded border-slate-300" />
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-500">RID-{report.ReportId.toString().padStart(4, '0')}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{report.ReportName}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 truncate max-w-xs">{report.Description}</span>
                                                {report.CategoryName && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${CATEGORY_COLORS[report.CategoryColor] || CATEGORY_COLORS.slate}`}>
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {report.CategoryName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {report.ReportType === 1
                                                ? <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md"><FileText className="w-4 h-4" /></div>
                                                : <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md"><Database className="w-4 h-4" /></div>
                                            }
                                            <span className="font-medium text-slate-600">{report.ReportType === 1 ? 'Standard' : 'Template'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {report.IsPublic ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                Public
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                                                <Shield className="w-3 h-3" />
                                                Role Based
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {report.IsActive ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                ใช้งาน
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-slate-400">
                                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                                ปิดใช้งาน
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/reports/${report.ReportId}/edit`} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="แก้ไข">
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleToggleActive(report.ReportId, report.ReportName, report.IsActive)}
                                                className={`p-2 rounded-lg transition-colors ${report.IsActive
                                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                                    }`}
                                                title={report.IsActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(report.ReportId, report.ReportName)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="ลบถาวร">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
