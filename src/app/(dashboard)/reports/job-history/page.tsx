"use client"

import { useState, useEffect } from "react";
import { Clock, Download, RefreshCw, CheckCircle2, XCircle, Loader2, FileText, AlertTriangle, StopCircle, Timer } from "lucide-react";
import { timeAgo } from "@/lib/dateUtils";
import { useToast } from "@/components/providers/ToastProvider";

interface Job {
    JobId: number;
    ReportId: number;
    CompanyId: number;
    Status: string;
    FileName: string | null;
    RowCount: number | null;
    ErrorMessage: string | null;
    CreatedAt: string;
    CompletedAt: string | null;
    ElapsedSeconds: number | null;
    ReportName: string | null;
}

export default function JobHistoryPage() {
    const { toast } = useToast();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Format duration in seconds to human-readable Thai
    const formatDuration = (seconds: number | null) => {
        if (seconds === null || seconds === undefined) return '—';
        if (seconds < 0) seconds = 0;
        if (seconds < 60) return `${seconds} วินาที`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) return `${mins} นาที ${secs} วินาที`;
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs} ชม. ${remainMins} นาที`;
    };

    const fetchJobs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/reports/job-history');
            const data = await res.json();
            if (data.success) setJobs(data.jobs || []);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        // Auto-refresh every 10 seconds for running jobs
        const interval = setInterval(fetchJobs, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleDownload = async (jobId: number, fileName: string) => {
        try {
            const res = await fetch(`/api/reports/jobs/${jobId}/download`);
            if (!res.ok) {
                const err = await res.json();
                toast(err.message || 'ไม่สามารถดาวน์โหลดได้', 'error');
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || `report_${jobId}.xlsb`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast('ดาวน์โหลดสำเร็จ', 'success');
        } catch {
            toast('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
        }
    };

    const handleCancelJob = async (jobId: number) => {
        const confirmed = window.confirm('ต้องการยกเลิก Job นี้หรือไม่?');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/reports/jobs/${jobId}`, { method: 'PATCH' });
            const data = await res.json();
            if (data.success) {
                toast('ยกเลิก Job สำเร็จ', 'success');
                fetchJobs();
            } else {
                toast(data.message || 'ไม่สามารถยกเลิกได้', 'error');
            }
        } catch {
            toast('เกิดข้อผิดพลาด', 'error');
        }
    };

    const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
        'running': { label: 'กำลังสร้าง...', icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50' },
        'done': { label: 'สำเร็จ', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        'failed': { label: 'ล้มเหลว', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        'cancelled': { label: 'ยกเลิกแล้ว', icon: StopCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    };

    const runningJobs = jobs.filter(j => j.Status === 'running');
    const completedJobs = jobs.filter(j => j.Status !== 'running');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ประวัติการสร้างรายงาน</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">รายงานที่สร้างภายใน 24 ชั่วโมง — สามารถดาวน์โหลดซ้ำได้</p>
                    </div>
                </div>
                <button
                    onClick={fetchJobs}
                    className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Running Jobs Banner */}
            {runningJobs.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="font-semibold text-blue-800 dark:text-blue-300">กำลังสร้างรายงาน ({runningJobs.length} รายการ)</span>
                    </div>
                    <div className="space-y-2">
                        {runningJobs.map(job => (
                            <div key={job.JobId} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="font-medium">{job.ReportName || `Report #${job.ReportId}`}</span>
                                <span className="text-blue-500 dark:text-blue-500">— {timeAgo(job.CreatedAt)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Jobs Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {isLoading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mb-3" />
                        <p className="text-sm">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileText className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">ยังไม่มีรายงานที่สร้างภายใน 24 ชั่วโมง</p>
                        <p className="text-xs mt-1 text-slate-300">เมื่อคุณรันรายงานแบบ Heavy ระบบจะบันทึกไว้ที่นี่</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-600">
                                <tr>
                                    <th className="px-6 py-4">รายงาน</th>
                                    <th className="px-6 py-4">สถานะ</th>
                                    <th className="px-6 py-4">จำนวนแถว</th>
                                    <th className="px-6 py-4">เวลา</th>
                                    <th className="px-6 py-4 text-right">ดาวน์โหลด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                {jobs.map(job => {
                                    const sc = statusConfig[job.Status] || statusConfig['failed'];
                                    const Icon = sc.icon;
                                    return (
                                        <tr key={job.JobId} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900 dark:text-white">{job.ReportName || `Report #${job.ReportId}`}</span>
                                                    <span className="text-xs text-slate-400">{job.FileName || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                                                    <Icon className={`w-3.5 h-3.5 ${job.Status === 'running' ? 'animate-spin' : ''}`} />
                                                    {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                                {job.RowCount != null ? job.RowCount.toLocaleString() : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{timeAgo(job.CreatedAt)}</span>
                                                    <span className="text-xs mt-0.5 flex items-center gap-1">
                                                        <Timer className="w-3 h-3 text-slate-400" />
                                                        <span className={job.Status === 'running' ? 'text-blue-500 font-medium' : 'text-slate-400'}>
                                                            {formatDuration(job.ElapsedSeconds)}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {job.Status === 'done' && job.FileName ? (
                                                    <button
                                                        onClick={() => handleDownload(job.JobId, job.FileName!)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        ดาวน์โหลด
                                                    </button>
                                                ) : job.Status === 'running' ? (
                                                    <button
                                                        onClick={() => handleCancelJob(job.JobId)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                                                    >
                                                        <StopCircle className="w-3.5 h-3.5" />
                                                        ยกเลิก
                                                    </button>
                                                ) : job.Status === 'cancelled' ? (
                                                    <span className="text-xs text-orange-500">
                                                        <StopCircle className="w-3.5 h-3.5 inline mr-1" />
                                                        ยกเลิกแล้ว
                                                    </span>
                                                ) : job.Status === 'failed' ? (
                                                    <span className="text-xs text-red-400" title={job.ErrorMessage || ''}>
                                                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                                                        {job.ErrorMessage?.substring(0, 30) || 'ผิดพลาด'}
                                                    </span>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 pb-4">
                ไฟล์จะถูกลบอัตโนมัติหลัง 24 ชั่วโมง — หน้านี้รีเฟรชอัตโนมัติทุก 10 วินาที
            </div>
        </div>
    );
}
