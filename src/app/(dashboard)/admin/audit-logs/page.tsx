"use client"

import { useState, useEffect } from "react";
import { Activity, Download, Filter, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import * as xlsx from 'xlsx';

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-100 text-blue-700',
    LOGOUT: 'bg-slate-100 text-slate-700',
    EXECUTE_REPORT: 'bg-emerald-100 text-emerald-700',
    EXPORT_EXCEL: 'bg-amber-100 text-amber-700',
    CREATE_REPORT: 'bg-purple-100 text-purple-700',
    UPDATE_REPORT: 'bg-indigo-100 text-indigo-700',
    RUN_SCHEDULE: 'bg-orange-100 text-orange-700',
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalRows, setTotalRows] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(30);

    // Filters
    const [actionType, setActionType] = useState('');
    const [userId, setUserId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [actionTypes, setActionTypes] = useState<string[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
            });
            if (actionType) params.set('actionType', actionType);
            if (userId) params.set('userId', userId);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const res = await fetch(`/api/admin/audit-logs?${params}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
                setTotalRows(data.totalRows);
                setActionTypes(data.actionTypes);
                setUsers(data.users);
            }
        } catch { }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchLogs(); }, [page]);

    const totalPages = Math.ceil(totalRows / pageSize);

    const handleExport = () => {
        if (logs.length === 0) return;
        const exportData = logs.map(l => ({
            'เวลา': l.CreatedAt,
            'ผู้ใช้': l.UserName,
            'ประเภท': l.ActionType,
            'รายละเอียด': l.Details,
            'บริษัท': l.CompanyId,
        }));
        const ws = xlsx.utils.json_to_sheet(exportData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Audit Logs');
        xlsx.writeFile(wb, `audit_logs_${new Date().toISOString().split('T')[0]}.xlsb`, { bookType: 'xlsb' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center dark:bg-violet-900/50">
                        <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">ประวัติกิจกรรมทั้งหมดในระบบ ({totalRows} รายการ)</p>
                    </div>
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm">
                    <Download className="w-4 h-4" /> Export Excel
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ตัวกรอง</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <select value={actionType} onChange={e => setActionType(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white">
                        <option value="">ทุกประเภท</option>
                        {actionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={userId} onChange={e => setUserId(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white">
                        <option value="">ทุกผู้ใช้</option>
                        {users.map(u => <option key={u.UserId} value={u.UserId}>{u.FullName}</option>)}
                    </select>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="จากวันที่" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white" />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="ถึงวันที่" className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white" />
                    <button onClick={() => { setPage(1); fetchLogs(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2">
                        <Search className="w-4 h-4" /> ค้นหา
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 dark:text-slate-400">ไม่พบข้อมูล</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">เวลา</th>
                                <th className="px-4 py-3 text-left font-medium">ผู้ใช้</th>
                                <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                                <th className="px-4 py-3 text-left font-medium">รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {logs.map(log => (
                                <tr key={log.LogId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(log.CreatedAt)}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{log.UserName || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[log.ActionType] || 'bg-slate-100 text-slate-600'}`}>
                                            {log.ActionType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-md truncate">{log.Details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <span className="text-sm text-slate-500 dark:text-slate-400">หน้า {page} / {totalPages}</span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
