"use client"

import { useState, useEffect } from "react";
import { Calendar, Plus, Clock, Trash2, RefreshCw, Play, Pause, Edit3, X, Mail, Send, FileText, Building2, Timer, Zap, ChevronDown } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { formatDateTime } from "@/lib/dateUtils";

interface Schedule {
    ScheduleId: number;
    ReportId: number;
    ReportName: string;
    ReportType: number;
    ScheduleName: string;
    Frequency: string;
    DayOfWeek: number | null;
    DayOfMonth: number | null;
    RunTime: string;
    CompanyId: number;
    Parameters: string | null;
    EmailTo: string;
    EmailCc: string | null;
    EmailSubject: string | null;
    IsActive: boolean;
    LastRunAt: string | null;
    LastRunStatus: string | null;
    NextRunAt: string | null;
    CreatedByName: string;
    CreatedAt: string;
}

interface Report {
    ReportId: number;
    ReportName: string;
    ReportType: number;
}

interface Param {
    ParameterId: number;
    ParameterName: string;
    DisplayLabel: string;
    InputType: string;
}

const DATE_PRESETS = [
    { value: 'TODAY', label: 'วันนี้ (TODAY)' },
    { value: 'YESTERDAY', label: 'เมื่อวาน (YESTERDAY)' },
    { value: 'MONTH_START', label: 'วันที่ 1 ของเดือนนี้' },
    { value: 'MONTH_END', label: 'วันสุดท้ายเดือนนี้' },
    { value: 'PREV_MONTH_START', label: 'วันที่ 1 ของเดือนก่อน' },
    { value: 'PREV_MONTH_END', label: 'วันสุดท้ายเดือนก่อน' },
    { value: 'YEAR_START', label: 'วันที่ 1 มกรา ของปีนี้' },
];

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const FREQ_LABELS: Record<string, string> = { daily: 'ทุกวัน', weekly: 'รายสัปดาห์', monthly: 'รายเดือน' };
const FREQ_COLORS: Record<string, string> = {
    daily: 'bg-violet-50 text-violet-700 border-violet-200',
    weekly: 'bg-sky-50 text-sky-700 border-sky-200',
    monthly: 'bg-teal-50 text-teal-700 border-teal-200',
};

const companyNames: Record<number, string> = {
    1: 'Sonic Interfreight (SNI)',
    2: 'Grandlink Logistics (GRL)',
    3: 'Sonic Autologis (SALOG)',
};

export default function ScheduledReportsPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [triggeringId, setTriggeringId] = useState<number | null>(null);
    const [testingEmail, setTestingEmail] = useState(false);

    const [form, setForm] = useState({
        reportId: '',
        scheduleName: '',
        frequency: 'daily',
        dayOfWeek: 1,
        dayOfMonth: 1,
        runTime: '08:00',
        companyId: '1',
        isActive: true,
        emailTo: '',
        emailCc: '',
        emailSubject: '',
    });

    // Dynamic parameters
    const [params, setParams] = useState<Param[]>([]);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [isLoadingParams, setIsLoadingParams] = useState(false);

    const fetchParams = async (reportId: string) => {
        if (!reportId) { setParams([]); setParamValues({}); return; }
        setIsLoadingParams(true);
        try {
            const res = await fetch(`/api/reports/parameters?reportId=${reportId}`);
            const data = await res.json();
            if (data.success) {
                setParams(data.parameters);
                const initial: Record<string, string> = {};
                data.parameters.forEach((p: Param) => { initial[p.ParameterName] = ''; });
                setParamValues(prev => Object.keys(prev).length > 0 ? prev : initial);
            }
        } catch (err) {
            console.error('Error fetching params:', err);
        } finally {
            setIsLoadingParams(false);
        }
    };

    const handleReportChange = (reportId: string) => {
        setForm(f => ({ ...f, reportId }));
        setParamValues({});
        fetchParams(reportId);
    };

    const fetchSchedules = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/schedules');
            const data = await res.json();
            if (data.success) setSchedules(data.schedules);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReports = async () => {
        try {
            const res = await fetch('/api/admin/reports');
            const data = await res.json();
            if (data.success) setReports(data.reports.filter((r: any) => r.IsActive));
        } catch (err) {
            console.error('Error:', err);
        }
    };

    useEffect(() => {
        fetchSchedules();
        fetchReports();
    }, []);

    const openCreateModal = () => {
        setEditSchedule(null);
        setForm({ reportId: '', scheduleName: '', frequency: 'daily', dayOfWeek: 1, dayOfMonth: 1, runTime: '08:00', companyId: '1', isActive: true, emailTo: '', emailCc: '', emailSubject: '' });
        setParams([]);
        setParamValues({});
        setShowModal(true);
    };

    const openEditModal = (s: Schedule) => {
        setEditSchedule(s);
        setForm({
            reportId: s.ReportId.toString(),
            scheduleName: s.ScheduleName,
            frequency: s.Frequency,
            dayOfWeek: s.DayOfWeek ?? 1,
            dayOfMonth: s.DayOfMonth ?? 1,
            runTime: s.RunTime,
            companyId: s.CompanyId.toString(),
            isActive: s.IsActive,
            emailTo: s.EmailTo || '',
            emailCc: s.EmailCc || '',
            emailSubject: s.EmailSubject || '',
        });
        if (s.Parameters) {
            try { setParamValues(JSON.parse(s.Parameters)); } catch { setParamValues({}); }
        } else {
            setParamValues({});
        }
        fetchParams(s.ReportId.toString());
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.reportId || !form.scheduleName.trim() || !form.emailTo.trim()) {
            toast('กรุณากรอกข้อมูลให้ครบ (ชื่อ, รายงาน, ผู้รับ Email)', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const body: any = {
                reportId: parseInt(form.reportId),
                scheduleName: form.scheduleName,
                frequency: form.frequency,
                dayOfWeek: form.frequency === 'weekly' ? form.dayOfWeek : null,
                dayOfMonth: form.frequency === 'monthly' ? form.dayOfMonth : null,
                runTime: form.runTime,
                companyId: parseInt(form.companyId),
                isActive: form.isActive,
                emailTo: form.emailTo,
                emailCc: form.emailCc || null,
                emailSubject: form.emailSubject || null,
                parameters: Object.keys(paramValues).length > 0 ? paramValues : null,
            };

            if (editSchedule) {
                body.scheduleId = editSchedule.ScheduleId;
                await fetch('/api/admin/schedules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                toast('อัปเดตกำหนดการสำเร็จ', 'success');
            } else {
                await fetch('/api/admin/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                toast('สร้างกำหนดการสำเร็จ', 'success');
            }

            setShowModal(false);
            fetchSchedules();
        } catch {
            toast('เกิดข้อผิดพลาด', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const ok = await confirm({ title: 'ลบกำหนดการ', message: 'คุณแน่ใจว่าต้องการลบกำหนดการนี้?', variant: 'danger' });
        if (!ok) return;
        try {
            await fetch(`/api/admin/schedules?scheduleId=${id}`, { method: 'DELETE' });
            toast('ลบกำหนดการสำเร็จ', 'success');
            fetchSchedules();
        } catch {
            toast('เกิดข้อผิดพลาด', 'error');
        }
    };

    const toggleActive = async (s: Schedule) => {
        try {
            const body = {
                scheduleId: s.ScheduleId, scheduleName: s.ScheduleName, frequency: s.Frequency,
                dayOfWeek: s.DayOfWeek, dayOfMonth: s.DayOfMonth, runTime: s.RunTime,
                companyId: s.CompanyId, isActive: !s.IsActive,
                emailTo: s.EmailTo, emailCc: s.EmailCc, emailSubject: s.EmailSubject,
            };
            await fetch('/api/admin/schedules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            toast(s.IsActive ? 'หยุดกำหนดการแล้ว' : 'เปิดกำหนดการแล้ว', 'success');
            fetchSchedules();
        } catch {
            toast('เกิดข้อผิดพลาด', 'error');
        }
    };

    const getFreqText = (s: Schedule) => {
        if (s.Frequency === 'daily') return `ทุกวัน เวลา ${s.RunTime} น.`;
        if (s.Frequency === 'weekly') return `ทุกวัน${DAYS[s.DayOfWeek ?? 0]} เวลา ${s.RunTime} น.`;
        if (s.Frequency === 'monthly') return `ทุกวันที่ ${s.DayOfMonth} เวลา ${s.RunTime} น.`;
        return s.Frequency;
    };

    const handleTrigger = async (scheduleId: number) => {
        setTriggeringId(scheduleId);
        try {
            const res = await fetch('/api/admin/schedules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleId }),
            });
            const data = await res.json();
            if (data.success) {
                toast(data.message || 'รันเรียบร้อย!', 'success');
                fetchSchedules();
            } else {
                toast(data.message || 'ไม่สามารถรันได้', 'error');
            }
        } catch {
            toast('เกิดข้อผิดพลาดในการรัน', 'error');
        } finally {
            setTriggeringId(null);
        }
    };

    const handleTestEmail = async () => {
        setTestingEmail(true);
        try {
            const res = await fetch('/api/admin/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) {
                toast(data.message || 'ส่ง Email ทดสอบสำเร็จ!', 'success');
            } else {
                toast(data.message || 'ส่ง Email ไม่สำเร็จ', 'error');
            }
        } catch {
            toast('ไม่สามารถเชื่อมต่อได้', 'error');
        } finally {
            setTestingEmail(false);
        }
    };

    const activeCount = schedules.filter(s => s.IsActive).length;
    const pausedCount = schedules.length - activeCount;
    const successCount = schedules.filter(s => s.LastRunStatus === 'success').length;

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2Mmgt MnYtMnptLTQgMHYyaC0ydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                <Calendar className="w-5 h-5" />
                            </div>
                            ตั้งเวลารายงาน
                        </h1>
                        <p className="text-blue-100 text-sm mt-1.5">สร้างรายงานอัตโนมัติ แล้วส่ง Excel ทาง Email ตาม schedule ที่กำหนด</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleTestEmail} disabled={testingEmail} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                            <Send className={`w-4 h-4 ${testingEmail ? 'animate-pulse' : ''}`} /> {testingEmail ? 'กำลังส่ง...' : 'ทดสอบ Email'}
                        </button>
                        <button onClick={fetchSchedules} className="p-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl transition-all">
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-semibold text-sm transition-all shadow-sm">
                            <Plus className="w-4 h-4" /> สร้างกำหนดการ
                        </button>
                    </div>
                </div>

                {/* Mini stat cards */}
                <div className="relative grid grid-cols-3 gap-3 mt-5">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                        <p className="text-3xl font-bold">{activeCount}</p>
                        <p className="text-blue-200 text-xs mt-0.5">ใช้งานอยู่</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                        <p className="text-3xl font-bold">{pausedCount}</p>
                        <p className="text-blue-200 text-xs mt-0.5">หยุดชั่วคราว</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                        <p className="text-3xl font-bold">{successCount}</p>
                        <p className="text-blue-200 text-xs mt-0.5">รันสำเร็จ</p>
                    </div>
                </div>
            </div>

            {/* Schedule Cards */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                    <p className="text-slate-500 mt-4 font-medium">กำลังโหลดกำหนดการ...</p>
                </div>
            ) : schedules.length === 0 ? (
                <div className="relative text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20" />
                    <div className="relative">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl mx-auto flex items-center justify-center mb-5">
                            <Calendar className="w-10 h-10 text-blue-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-lg font-semibold">ยังไม่มีกำหนดการ</p>
                        <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">เริ่มต้นสร้างกำหนดการเพื่อให้ระบบส่ง Report ทาง Email อัตโนมัติ</p>
                        <button onClick={openCreateModal} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm">
                            <Plus className="w-4 h-4" /> สร้างกำหนดการแรกของคุณ
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {schedules.map(s => (
                        <div
                            key={s.ScheduleId}
                            className={`group bg-white dark:bg-slate-800 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${s.IsActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800'
                                }`}
                        >
                            <div className="flex">
                                {/* Left accent */}
                                <div className={`w-1.5 shrink-0 ${!s.IsActive ? 'bg-slate-200' :
                                    s.LastRunStatus === 'failed' ? 'bg-red-400' :
                                        s.LastRunStatus === 'success' ? 'bg-emerald-400' :
                                            'bg-blue-400'
                                    }`} />

                                <div className={`flex-1 p-5 ${!s.IsActive ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Row 1: Name + Badges */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-[15px]">{s.ScheduleName}</h3>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.IsActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    {s.IsActive ? <><Play className="w-2.5 h-2.5" /> ใช้งาน</> : <><Pause className="w-2.5 h-2.5" /> หยุด</>}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${FREQ_COLORS[s.Frequency]}`}>
                                                    {FREQ_LABELS[s.Frequency]}
                                                </span>
                                                {s.LastRunStatus === 'success' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ สำเร็จ</span>
                                                )}
                                                {s.LastRunStatus === 'failed' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">✗ ล้มเหลว</span>
                                                )}
                                            </div>

                                            {/* Row 2: Report + Company */}
                                            <div className="flex items-center gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                                    {s.ReportName}
                                                </span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                    {companyNames[s.CompanyId] || `Company ${s.CompanyId}`}
                                                </span>
                                            </div>

                                            {/* Row 3: Schedule + Email */}
                                            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Timer className="w-3.5 h-3.5 text-indigo-400" />
                                                    {getFreqText(s)}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                                                    <span className="truncate max-w-[200px]">{s.EmailTo}</span>
                                                    {s.EmailCc && <span className="text-slate-400">(+CC)</span>}
                                                </span>
                                            </div>

                                            {/* Row 4: Next / Last Run */}
                                            {(s.NextRunAt || s.LastRunAt) && (
                                                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px] text-slate-400">
                                                    {s.NextRunAt && <span>▶ ถัดไป: <span className="font-medium text-slate-500">{formatDateTime(s.NextRunAt)}</span></span>}
                                                    {s.LastRunAt && <span>✓ ล่าสุด: <span className="font-medium text-slate-500">{formatDateTime(s.LastRunAt)}</span></span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleTrigger(s.ScheduleId)}
                                                disabled={triggeringId === s.ScheduleId}
                                                className="p-2 rounded-xl hover:bg-cyan-50 text-cyan-500 transition-all disabled:opacity-50"
                                                title="รันเดี๋ยวนี้"
                                            >
                                                {triggeringId === s.ScheduleId
                                                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                    : <Zap className="w-4 h-4" />
                                                }
                                            </button>
                                            <button onClick={() => toggleActive(s)} className={`p-2 rounded-xl transition-all ${s.IsActive ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-500'}`} title={s.IsActive ? 'หยุดชั่วคราว' : 'เปิดใช้งาน'}>
                                                {s.IsActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => openEditModal(s)} className="p-2 rounded-xl hover:bg-blue-50 text-blue-500 transition-all" title="แก้ไข">
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(s.ScheduleId)} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-all" title="ลบ">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Modal ─── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 rounded-t-2xl flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                    {editSchedule ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    {editSchedule ? 'แก้ไขกำหนดการ' : 'สร้างกำหนดการใหม่'}
                                </h2>
                                <p className="text-blue-200 text-xs mt-0.5">เลือกรายงาน ตั้งเวลา แล้วกำหนดผู้รับ Email</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white transition-colors p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body — scrollable */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                            {/* ── Section 1: ข้อมูลพื้นฐาน ── */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">ข้อมูลพื้นฐาน</h3>
                                </div>
                                <div className="space-y-4 pl-8">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">ชื่อกำหนดการ <span className="text-red-500">*</span></label>
                                        <input value={form.scheduleName} onChange={e => setForm({ ...form, scheduleName: e.target.value })} placeholder="เช่น สรุปยอดขายรายวัน SNI" className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">รายงาน <span className="text-red-500">*</span></label>
                                            <select value={form.reportId} onChange={e => handleReportChange(e.target.value)} className={inputClass}>
                                                <option value="">-- เลือก --</option>
                                                {reports.map(r => (<option key={r.ReportId} value={r.ReportId}>{r.ReportName}</option>))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">บริษัท</label>
                                            <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className={inputClass}>
                                                {Object.entries(companyNames).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* ── Section 1.5: Dynamic Parameters ── */}
                            {params.length > 0 && (
                                <section className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200/50 dark:border-amber-800/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">ตัวแปรของรายงาน</h3>
                                        {isLoadingParams && <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />}
                                    </div>
                                    <div className="space-y-3">
                                        {params.map(p => (
                                            <div key={p.ParameterId}>
                                                <label className="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">{p.DisplayLabel || p.ParameterName}</label>
                                                {p.InputType === 'date' ? (
                                                    <div>
                                                        <select
                                                            value={paramValues[p.ParameterName] || ''}
                                                            onChange={e => setParamValues(v => ({ ...v, [p.ParameterName]: e.target.value }))}
                                                            className={`${inputClass} !bg-white dark:!bg-slate-700`}
                                                        >
                                                            <option value="">-- เลือกวันที่สัมพัทธ์ --</option>
                                                            {DATE_PRESETS.map(dp => (<option key={dp.value} value={dp.value}>{dp.label}</option>))}
                                                        </select>
                                                        <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60 mt-1">ระบบจะคำนวณวันที่จริงอัตโนมัติตอนรันรายงาน</p>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={p.InputType === 'number' ? 'number' : 'text'}
                                                        value={paramValues[p.ParameterName] || ''}
                                                        onChange={e => setParamValues(v => ({ ...v, [p.ParameterName]: e.target.value }))}
                                                        placeholder={`ค่า ${p.DisplayLabel || p.ParameterName}`}
                                                        className={`${inputClass} !bg-white dark:!bg-slate-700`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ── Section 2: ตั้งเวลา ── */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">2</div>
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">กำหนดเวลา</h3>
                                </div>
                                <div className="space-y-4 pl-8">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">ความถี่</label>
                                            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className={inputClass}>
                                                <option value="daily">ทุกวัน</option>
                                                <option value="weekly">รายสัปดาห์</option>
                                                <option value="monthly">รายเดือน</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">เวลา</label>
                                            <input type="time" value={form.runTime} onChange={e => setForm({ ...form, runTime: e.target.value })} className={inputClass} />
                                        </div>
                                    </div>
                                    {form.frequency === 'weekly' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">วันในสัปดาห์</label>
                                            <div className="flex gap-1.5">
                                                {DAYS.map((d, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, dayOfWeek: i })}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${form.dayOfWeek === i
                                                            ? 'bg-violet-600 text-white shadow-sm'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                    >
                                                        {d.substring(0, 2)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {form.frequency === 'monthly' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">วันที่ในเดือน</label>
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {Array.from({ length: 28 }, (_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, dayOfMonth: i + 1 })}
                                                        className={`py-2 rounded-lg text-xs font-medium transition-all ${form.dayOfMonth === i + 1
                                                            ? 'bg-teal-600 text-white shadow-sm'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── Section 3: Email ── */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">3</div>
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">ตั้งค่า Email</h3>
                                </div>
                                <div className="space-y-4 pl-8">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">ส่งถึง (To) <span className="text-red-500">*</span></label>
                                        <input value={form.emailTo} onChange={e => setForm({ ...form, emailTo: e.target.value })} placeholder="user@company.com, user2@company.com" className={inputClass} />
                                        <p className="text-[11px] text-slate-400 mt-1">คั่นด้วย , หากมีหลายคน</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">สำเนา (CC)</label>
                                        <input value={form.emailCc} onChange={e => setForm({ ...form, emailCc: e.target.value })} placeholder="manager@company.com" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">หัวข้อ Email <span className="text-slate-400 font-normal">(ไม่บังคับ)</span></label>
                                        <input value={form.emailSubject} onChange={e => setForm({ ...form, emailSubject: e.target.value })} placeholder="[ReportCenter] {report} - {date}" className={inputClass} />
                                        <p className="text-[11px] text-slate-400 mt-1">ใช้ {'{report}'} แทนชื่อรายงาน, {'{date}'} แทนวันที่</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Modal Footer — sticky bottom */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-2xl flex items-center justify-between gap-3 shrink-0 border-t border-slate-200 dark:border-slate-600">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-sm inline-flex items-center gap-2 disabled:opacity-60"
                            >
                                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {editSchedule ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างกำหนดการ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
