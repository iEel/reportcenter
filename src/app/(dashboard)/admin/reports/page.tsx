"use client"

import Link from "next/link";
import { Plus, Search, Edit, Trash2, FileText, Database, Shield, RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";

export default function AdminReportsPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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
            title: 'ลบรายงาน',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายงาน "${name}"?`,
            confirmLabel: 'ลบ',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast('ลบรายงานสำเร็จ', 'success');
                fetchReports();
            } else {
                toast('เกิดข้อผิดพลาดในการลบ: ' + data.message, 'error');
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        }
    };

    const filteredReports = reports.filter(r =>
        r.ReportName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.Description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        fetchReports();
    }, []);

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
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
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
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
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
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                                            กำลังโหลดข้อมูล...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">{searchQuery ? 'ไม่พบรายงานที่ค้นหา' : 'ไม่พบข้อมูลรายงานในระบบ'}</td>
                                </tr>
                            ) : filteredReports.map((report) => (
                                <tr key={report.ReportId} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-slate-500">RID-{report.ReportId.toString().padStart(4, '0')}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{report.ReportName}</span>
                                            <span className="text-xs text-slate-500 truncate max-w-xs">{report.Description}</span>
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
                                            <button onClick={() => handleDelete(report.ReportId, report.ReportName)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="ลบ">
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
        </div>
    );
}
