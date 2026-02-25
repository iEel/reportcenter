"use client"

import { useState, useEffect } from "react";
import { Activity, Download, Filter, ChevronLeft, ChevronRight, Loader2, Search, Eye, X, ArrowRight, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import * as xlsx from 'xlsx';

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-100 text-blue-700',
    LOGOUT: 'bg-slate-100 text-slate-700',
    LOGIN_FAIL: 'bg-red-100 text-red-700',
    EXECUTE_REPORT: 'bg-emerald-100 text-emerald-700',
    EXPORT_EXCEL: 'bg-amber-100 text-amber-700',
    CREATE_REPORT: 'bg-purple-100 text-purple-700',
    UPDATE_REPORT: 'bg-indigo-100 text-indigo-700',
    RUN_SCHEDULE: 'bg-orange-100 text-orange-700',
    CREATE_SCHEDULE: 'bg-teal-100 text-teal-700',
    UPDATE_SCHEDULE: 'bg-cyan-100 text-cyan-700',
    DELETE_SCHEDULE: 'bg-rose-100 text-rose-700',
    CRON_SUCCESS: 'bg-lime-100 text-lime-700',
    CRON_FAIL: 'bg-red-100 text-red-700',
    CREATE_USER: 'bg-violet-100 text-violet-700',
    UPDATE_USER: 'bg-fuchsia-100 text-fuchsia-700',
    CHANGE_PASSWORD: 'bg-sky-100 text-sky-700',
    BLOCKED_QUERY: 'bg-red-200 text-red-800 ring-1 ring-red-300',
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalRows, setTotalRows] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(30);
    const [selectedLog, setSelectedLog] = useState<any>(null);

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
            'วันที่': l.CreatedAt,
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

    const parseChangeData = (raw: string | null) => {
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    };

    // Line-level diff: returns array of { type: 'same'|'removed'|'added', text: string }
    const computeLineDiff = (oldText: string, newText: string) => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');

        // Simple LCS-based diff
        const m = oldLines.length, n = newLines.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 1; i <= m; i++)
            for (let j = 1; j <= n; j++)
                dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

        // Backtrack to build diff
        const result: { type: string; text: string }[] = [];
        let i = m, j = n;
        const stack: { type: string; text: string }[] = [];
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                stack.push({ type: 'same', text: oldLines[i - 1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                stack.push({ type: 'added', text: newLines[j - 1] });
                j--;
            } else {
                stack.push({ type: 'removed', text: oldLines[i - 1] });
                i--;
            }
        }
        stack.reverse();
        return stack;
    };

    // Render diff for a field
    const renderDiff = (oldVal: any, newVal: any) => {
        // Boolean values
        if (typeof oldVal === 'boolean' || typeof newVal === 'boolean') {
            return (
                <div className="flex items-center gap-3 p-3">
                    <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold text-sm line-through">{oldVal ? 'ใช่' : 'ไม่ใช่'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-semibold text-sm">{newVal ? 'ใช่' : 'ไม่ใช่'}</span>
                </div>
            );
        }

        const oldStr = String(oldVal || '');
        const newStr = String(newVal || '');

        // Short values: simple side-by-side
        if (!oldStr.includes('\n') && !newStr.includes('\n') && oldStr.length < 120) {
            return (
                <div className="flex items-center gap-3 p-3 flex-wrap">
                    <span className="px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm font-mono line-through">{oldStr || '(ว่าง)'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-sm font-mono">{newStr || '(ว่าง)'}</span>
                </div>
            );
        }

        // Long/multiline values: line-level diff with highlights
        const diff = computeLineDiff(oldStr, newStr);
        return (
            <div className="p-3 max-h-80 overflow-y-auto">
                <pre className="text-xs font-mono leading-6 whitespace-pre-wrap break-all">
                    {diff.map((line, idx) => (
                        <div
                            key={idx}
                            className={
                                line.type === 'removed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                    line.type === 'added' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                        'text-slate-500 dark:text-slate-500'
                            }
                        >
                            <span className="inline-block w-5 text-right mr-2 opacity-50 select-none">
                                {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                            </span>
                            {line.text || ' '}
                        </div>
                    ))}
                </pre>
            </div>
        );
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
                <div className="flex items-center gap-2">
                    <button onClick={() => { setPage(1); fetchLogs(); }} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="รีเฟรช">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm">
                        <Download className="w-4 h-4" /> Export Excel
                    </button>
                </div>
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
                                <th className="px-4 py-3 text-left font-medium">วันที่</th>
                                <th className="px-4 py-3 text-left font-medium">ผู้ใช้</th>
                                <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                                <th className="px-4 py-3 text-left font-medium">รายละเอียด</th>
                                <th className="px-4 py-3 text-center font-medium w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {logs.map(log => (
                                <tr key={log.LogId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(log.CreatedAt)}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{log.UserName || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[log.ActionType] || 'bg-slate-100 text-slate-600'}`}>
                                            {log.ActionType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-md truncate">{log.Details}</td>
                                    <td className="px-4 py-3 text-center">
                                        {log.ChangeData && (
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                title="ดูรายละเอียดการเปลี่ยนแปลง"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
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

            {/* Change Detail Modal */}
            {selectedLog && (() => {
                const changeData = parseChangeData(selectedLog.ChangeData);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-blue-500" />
                                        รายละเอียดการเปลี่ยนแปลง
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {formatDateTime(selectedLog.CreatedAt)} — {selectedLog.UserName}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedLog(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 overflow-y-auto flex-1 space-y-4">
                                {changeData ? Object.entries(changeData).map(([field, values]: [string, any]) => (
                                    <div key={field} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 font-semibold text-sm text-slate-700 dark:text-slate-300">
                                            {field}
                                        </div>
                                        {renderDiff(values.old, values.new)}
                                    </div>
                                )) : (
                                    <p className="text-sm text-slate-500">ไม่มีข้อมูลการเปลี่ยนแปลง</p>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[11px]">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> ลบออก</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> เพิ่มใหม่</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span> ไม่เปลี่ยน</span>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

