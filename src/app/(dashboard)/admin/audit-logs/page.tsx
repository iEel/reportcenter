"use client"

import { useState, useEffect } from "react";
import { FileText, RefreshCw, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

interface AuditLog {
    LogId: number;
    ActionType: string;
    Details: string;
    CreatedAt: string;
    Username: string;
    FullName: string;
    ReportName: string | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchLogs = async (page: number = 1) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=50`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ประวัติการใช้งาน (Audit Logs)</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        ติดตามกิจกรรมทั้งหมดในระบบ — พบทั้งหมด <span className="font-bold text-blue-600">{pagination.total}</span> รายการ
                    </p>
                </div>
                <button onClick={() => fetchLogs(pagination.page)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-600">
                            <tr>
                                <th className="px-6 py-4 w-12">#</th>
                                <th className="px-6 py-4">ผู้ใช้</th>
                                <th className="px-6 py-4">รายงาน</th>
                                <th className="px-6 py-4">การกระทำ</th>
                                <th className="px-6 py-4">รายละเอียด</th>
                                <th className="px-6 py-4">วันเวลา</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                                        กำลังโหลด...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">ยังไม่มีข้อมูลประวัติการใช้งาน</td>
                                </tr>
                            ) : logs.map((log, idx) => (
                                <tr key={log.LogId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                                        {(pagination.page - 1) * pagination.limit + idx + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                {log.FullName?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{log.FullName}</p>
                                                <p className="text-xs text-slate-400">@{log.Username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.ReportName ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                <FileText className="w-3 h-3" />
                                                {log.ReportName}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                            {log.ActionType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={log.Details}>
                                        {log.Details || '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(log.CreatedAt)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800">
                        <p className="text-sm text-slate-500">
                            หน้า {pagination.page} จาก {pagination.totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchLogs(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (pagination.totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.totalPages - 2) {
                                    pageNum = pagination.totalPages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => fetchLogs(pageNum)}
                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === pagination.page
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => fetchLogs(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
