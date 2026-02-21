"use client"

import { useState, useEffect } from "react";
import { Calendar, Plus, Clock, Trash2, RefreshCw, Play, Pause, Edit3, X, CheckCircle2, AlertCircle } from "lucide-react";
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
    IsActive: boolean;
    LastRunAt: string | null;
    NextRunAt: string | null;
    CreatedByName: string;
    CreatedAt: string;
}

interface Report {
    ReportId: number;
    ReportName: string;
    ReportType: number;
}

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const FREQ_LABELS: Record<string, string> = { daily: 'ทุกวัน', weekly: 'รายสัปดาห์', monthly: 'รายเดือน' };

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

    // Form state
    const [form, setForm] = useState({
        reportId: '',
        scheduleName: '',
        frequency: 'daily',
        dayOfWeek: 1,
        dayOfMonth: 1,
        runTime: '08:00',
        companyId: '1',
        isActive: true,
    });

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
        setForm({ reportId: '', scheduleName: '', frequency: 'daily', dayOfWeek: 1, dayOfMonth: 1, runTime: '08:00', companyId: '1', isActive: true });
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
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.reportId || !form.scheduleName.trim()) {
            toast('กรุณากรอกข้อมูลให้ครบ', 'error');
            return;
        }

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
                scheduleId: s.ScheduleId,
                scheduleName: s.ScheduleName,
                frequency: s.Frequency,
                dayOfWeek: s.DayOfWeek,
                dayOfMonth: s.DayOfMonth,
                runTime: s.RunTime,
                companyId: s.CompanyId,
                isActive: !s.IsActive,
            };
            await fetch('/api/admin/schedules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            toast(s.IsActive ? 'หยุดกำหนดการแล้ว' : 'เปิดกำหนดการแล้ว', 'success');
            fetchSchedules();
        } catch {
            toast('เกิดข้อผิดพลาด', 'error');
        }
    };

    const getFreqText = (s: Schedule) => {
        if (s.Frequency === 'daily') return `ทุกวัน เวลา ${s.RunTime}`;
        if (s.Frequency === 'weekly') return `ทุกวัน${DAYS[s.DayOfWeek ?? 0]} เวลา ${s.RunTime}`;
        if (s.Frequency === 'monthly') return `ทุกวันที่ ${s.DayOfMonth} เวลา ${s.RunTime}`;
        return s.Frequency;
    };

    const activeCount = schedules.filter(s => s.IsActive).length;
    const pausedCount = schedules.length - activeCount;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ตั้งเวลารายงาน (Scheduled Reports)</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        จัดการกำหนดการสร้างรายงานอัตโนมัติ —
                        <span className="font-bold text-green-600 ml-1">{activeCount} ใช้งาน</span>
                        {pausedCount > 0 && <span className="font-bold text-slate-400 ml-2">{pausedCount} หยุดชั่วคราว</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchSchedules} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> สร้างกำหนดการ
                    </button>
                </div>
            </div>

            {/* Schedule Cards */}
            {isLoading ? (
                <div className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังโหลด...
                </div>
            ) : schedules.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 text-lg font-medium">ยังไม่มีกำหนดการ</p>
                    <p className="text-slate-400 text-sm mt-1">กด &quot;สร้างกำหนดการ&quot; เพื่อตั้งเวลารายงานอัตโนมัติ</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {schedules.map(s => (
                        <div key={s.ScheduleId} className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 transition-all ${s.IsActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-slate-900 dark:text-white">{s.ScheduleName}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.IsActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                            {s.IsActive ? <><Play className="w-3 h-3" /> ใช้งาน</> : <><Pause className="w-3 h-3" /> หยุด</>}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                            {FREQ_LABELS[s.Frequency]}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        📊 {s.ReportName} — 🏢 {companyNames[s.CompanyId] || `Company ${s.CompanyId}`}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {getFreqText(s)}</span>
                                        {s.NextRunAt && <span>▶ ถัดไป: {formatDateTime(s.NextRunAt)}</span>}
                                        {s.LastRunAt && <span>✓ ล่าสุด: {formatDateTime(s.LastRunAt)}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => toggleActive(s)} className={`p-2 rounded-lg transition-colors ${s.IsActive ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-500'}`} title={s.IsActive ? 'หยุดชั่วคราว' : 'เปิดใช้งาน'}>
                                        {s.IsActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => openEditModal(s)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="แก้ไข">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(s.ScheduleId)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="ลบ">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-t-2xl flex items-center justify-between">
                            <h2 className="text-white font-bold text-lg">{editSchedule ? 'แก้ไขกำหนดการ' : 'สร้างกำหนดการใหม่'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Schedule Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ชื่อกำหนดการ <span className="text-red-500">*</span></label>
                                <input value={form.scheduleName} onChange={e => setForm({ ...form, scheduleName: e.target.value })} placeholder="เช่น สรุปยอดขายรายวัน" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>

                            {/* Report */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">รายงาน <span className="text-red-500">*</span></label>
                                <select value={form.reportId} onChange={e => setForm({ ...form, reportId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">-- เลือกรายงาน --</option>
                                    {reports.map(r => (
                                        <option key={r.ReportId} value={r.ReportId}>{r.ReportName}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Company */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">บริษัท</label>
                                <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    {Object.entries(companyNames).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Frequency + Time Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ความถี่</label>
                                    <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                        <option value="daily">ทุกวัน</option>
                                        <option value="weekly">รายสัปดาห์</option>
                                        <option value="monthly">รายเดือน</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">เวลา</label>
                                    <input type="time" value={form.runTime} onChange={e => setForm({ ...form, runTime: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                </div>
                            </div>

                            {/* Conditional: Day of Week */}
                            {form.frequency === 'weekly' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันในสัปดาห์</label>
                                    <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                        {DAYS.map((d, i) => (
                                            <option key={i} value={i}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Conditional: Day of Month */}
                            {form.frequency === 'monthly' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันที่ในเดือน</label>
                                    <select value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: parseInt(e.target.value) })} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                        {Array.from({ length: 28 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-2xl flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                ยกเลิก
                            </button>
                            <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                                {editSchedule ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างกำหนดการ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
