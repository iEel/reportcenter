"use client"

import { useState, useEffect } from "react";
import { Tag, Plus, Pencil, Trash2, Loader2, Save, X, GripVertical, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";

const COLOR_OPTIONS = [
    { value: 'blue', label: 'น้ำเงิน', class: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'emerald', label: 'เขียว', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'amber', label: 'เหลือง', class: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'rose', label: 'ชมพู', class: 'bg-rose-100 text-rose-700 border-rose-200' },
    { value: 'purple', label: 'ม่วง', class: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'cyan', label: 'ฟ้า', class: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    { value: 'orange', label: 'ส้ม', class: 'bg-orange-100 text-orange-700 border-orange-200' },
    { value: 'slate', label: 'เทา', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    { value: 'indigo', label: 'คราม', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { value: 'teal', label: 'เขียวน้ำทะเล', class: 'bg-teal-100 text-teal-700 border-teal-200' },
];

function getColorClass(tag: string): string {
    return COLOR_OPTIONS.find(c => c.value === tag)?.class || 'bg-slate-100 text-slate-700 border-slate-200';
}

interface Category {
    CategoryId: number;
    CategoryName: string;
    ColorTag: string;
    SortOrder: number;
    ReportCount: number;
}

export default function AdminCategoriesPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reportsByCategory, setReportsByCategory] = useState<Record<number, { ReportId: number; ReportName: string }[]>>({});
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Add/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [formName, setFormName] = useState('');
    const [formColor, setFormColor] = useState('blue');
    const [isSaving, setIsSaving] = useState(false);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/categories');
            const data = await res.json();
            if (data.success) {
                setCategories(data.categories);
                setReportsByCategory(data.reportsByCategory || {});
            }
        } catch { }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleAdd = () => {
        setEditId(null);
        setFormName('');
        setFormColor('blue');
        setShowForm(true);
    };

    const handleEdit = (cat: Category) => {
        setEditId(cat.CategoryId);
        setFormName(cat.CategoryName);
        setFormColor(cat.ColorTag || 'slate');
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) { toast('กรุณากรอกชื่อหมวดหมู่', 'error'); return; }
        setIsSaving(true);
        try {
            const body = editId
                ? { categoryId: editId, name: formName, colorTag: formColor }
                : { name: formName, colorTag: formColor };

            const res = await fetch('/api/admin/categories', {
                method: editId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                toast(editId ? 'แก้ไขหมวดหมู่สำเร็จ' : 'เพิ่มหมวดหมู่สำเร็จ', 'success');
                setShowForm(false);
                fetchCategories();
            } else {
                toast(data.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        } finally { setIsSaving(false); }
    };

    const handleDelete = async (cat: Category) => {
        const ok = await confirm({
            title: 'ลบหมวดหมู่',
            message: `ลบ "${cat.CategoryName}"? รายงาน ${cat.ReportCount} รายการจะถูกย้ายเป็น "ไม่ระบุหมวดหมู่"`,
            confirmLabel: 'ลบ',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            const res = await fetch(`/api/admin/categories?categoryId=${cat.CategoryId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast('ลบหมวดหมู่สำเร็จ', 'success');
                fetchCategories();
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">หมวดหมู่รายงาน</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">จัดกลุ่มรายงานเป็นหมวดหมู่เพื่อค้นหาได้ง่ายขึ้น</p>
                    </div>
                </div>
                <button onClick={handleAdd} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium shadow-lg shadow-violet-500/20 transition-all active:scale-95">
                    <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
                </button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                            {editId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ชื่อหมวดหมู่</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="เช่น การเงิน, ขนส่ง, HR"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 dark:text-white"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">สีแท็ก</label>
                            <div className="flex flex-wrap gap-2">
                                {COLOR_OPTIONS.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => setFormColor(c.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${c.class} ${formColor === c.value ? 'ring-2 ring-offset-1 ring-violet-500 scale-105' : 'opacity-60 hover:opacity-100'}`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium">ยกเลิก</button>
                        <button onClick={handleSave} disabled={isSaving || !formName.trim()} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-2 transition-colors">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editId ? 'บันทึก' : 'เพิ่ม'}
                        </button>
                    </div>
                </div>
            )}

            {/* Category List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">กำลังโหลดหมวดหมู่...</p>
                </div>
            ) : categories.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
                    <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">ยังไม่มีหมวดหมู่</p>
                    <p className="text-sm text-slate-400 mt-1">กดปุ่ม "เพิ่มหมวดหมู่" เพื่อเริ่มจัดกลุ่มรายงาน</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">หมวดหมู่</th>
                                    <th className="text-center px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">สี</th>
                                    <th className="text-center px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">จำนวนรายงาน</th>
                                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {categories.map(cat => {
                                    const isExpanded = expandedId === cat.CategoryId;
                                    const reports = reportsByCategory[cat.CategoryId] || [];
                                    return (
                                        <>
                                            <tr key={cat.CategoryId} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-700/30' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => setExpandedId(isExpanded ? null : cat.CategoryId)}
                                                            className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                                                            title={isExpanded ? 'ซ่อนรายการ' : 'ดูรายการ'}
                                                        >
                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClass(cat.ColorTag)}`}>
                                                            <Tag className="w-4 h-4" />
                                                        </div>
                                                        <span
                                                            className="font-semibold text-slate-900 dark:text-white cursor-pointer hover:text-violet-600 transition-colors"
                                                            onClick={() => setExpandedId(isExpanded ? null : cat.CategoryId)}
                                                        >
                                                            {cat.CategoryName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getColorClass(cat.ColorTag)}`}>
                                                        {COLOR_OPTIONS.find(c => c.value === cat.ColorTag)?.label || cat.ColorTag}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${cat.ReportCount > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-400'}`}
                                                        onClick={() => cat.ReportCount > 0 && setExpandedId(isExpanded ? null : cat.CategoryId)}
                                                    >
                                                        {cat.ReportCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleEdit(cat)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(cat)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`exp-${cat.CategoryId}`}>
                                                    <td colSpan={4} className="px-0 py-0">
                                                        <div className="bg-slate-50/80 dark:bg-slate-700/20 border-t border-b border-slate-100 dark:border-slate-700 px-6 py-3 animate-in slide-in-from-top-1 duration-200">
                                                            {reports.length === 0 ? (
                                                                <p className="text-sm text-slate-400 italic pl-12">ไม่มีรายงานในหมวดหมู่นี้</p>
                                                            ) : (
                                                                <div className="pl-12 space-y-1">
                                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">รายงาน ({reports.length})</p>
                                                                    {reports.map(r => (
                                                                        <div key={r.ReportId} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 py-1 px-3 rounded-lg hover:bg-white dark:hover:bg-slate-600/30 transition-colors">
                                                                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                            <span>{r.ReportName}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-600 flex items-center justify-between text-xs text-slate-500">
                        <span>ทั้งหมด {categories.length} หมวดหมู่</span>
                        <span>รายงานที่จัดหมวดแล้ว {categories.reduce((s, c) => s + c.ReportCount, 0)} รายการ</span>
                    </div>
                </div>
            )}

            {/* Tips */}
            <div className="p-4 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl text-sm text-violet-700 dark:text-violet-400 flex items-start gap-3">
                <Tag className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium">วิธีเพิ่มหมวดหมู่ให้รายงาน</p>
                    <p className="mt-1 text-violet-600 dark:text-violet-500">ไปที่หน้า <strong>จัดการรายงาน</strong> → แก้ไขรายงาน → เลือกหมวดหมู่จาก dropdown</p>
                </div>
            </div>
        </div>
    );
}
