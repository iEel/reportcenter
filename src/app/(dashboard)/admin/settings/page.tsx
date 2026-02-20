"use client"

import { useState, useEffect } from "react";
import { Save, RefreshCw, Settings, Building2, Globe, Loader2 } from "lucide-react";

interface Setting {
    SettingKey: string;
    SettingValue: string;
    Description: string;
    UpdatedAt: string;
}

const settingLabels: Record<string, { label: string; icon: any; group: string }> = {
    'app_name': { label: 'ชื่อระบบ (Application Name)', icon: Globe, group: 'general' },
    'org_name': { label: 'ชื่อองค์กร (Organization Name)', icon: Globe, group: 'general' },
    'company_1_name': { label: 'บริษัทที่ 1', icon: Building2, group: 'company' },
    'company_2_name': { label: 'บริษัทที่ 2', icon: Building2, group: 'company' },
    'company_3_name': { label: 'บริษัทที่ 3', icon: Building2, group: 'company' },
};

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Setting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.success) setSettings(data.settings);
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleChange = (key: string, value: string) => {
        setSettings(prev =>
            prev.map(s => s.SettingKey === key ? { ...s, SettingValue: value } : s)
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            const data = await res.json();
            if (data.success) {
                alert('บันทึกการตั้งค่าสำเร็จ!');
                fetchSettings();
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.message);
            }
        } catch (err) {
            alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            setIsSaving(false);
        }
    };

    const generalSettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'general');
    const companySettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'company');
    const otherSettings = settings.filter(s => !settingLabels[s.SettingKey]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าระบบ</h1>
                        <p className="text-sm text-slate-500">จัดการการตั้งค่าทั่วไปของระบบ ReportCenter</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchSettings} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">

                    {/* General Settings */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-500" />
                                ข้อมูลทั่วไป
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {generalSettings.map(s => {
                                const meta = settingLabels[s.SettingKey];
                                return (
                                    <div key={s.SettingKey}>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{meta?.label || s.SettingKey}</label>
                                        <input
                                            type="text"
                                            value={s.SettingValue}
                                            onChange={e => handleChange(s.SettingKey, e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Company Name Mappings */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-emerald-500" />
                                ชื่อบริษัท (Company Mappings)
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">ชื่อที่จะแสดงใน Dropdown เมื่อผู้ใช้เลือกบริษัทเพื่อรันรายงาน</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {companySettings.map(s => {
                                const meta = settingLabels[s.SettingKey];
                                return (
                                    <div key={s.SettingKey} className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 text-sm font-bold shrink-0">
                                            {s.SettingKey.replace('company_', '').replace('_name', '')}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">{meta?.label || s.SettingKey}</label>
                                            <input
                                                type="text"
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Other/Custom Settings */}
                    {otherSettings.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="font-semibold text-slate-800">การตั้งค่าอื่นๆ</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {otherSettings.map(s => (
                                    <div key={s.SettingKey}>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{s.Description || s.SettingKey}</label>
                                        <input
                                            type="text"
                                            value={s.SettingValue}
                                            onChange={e => handleChange(s.SettingKey, e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
