"use client"

import { useState, useEffect } from "react";
import { Save, RefreshCw, Settings, Building2, Globe, Loader2, ShieldAlert, Link2, CheckCircle2, XCircle, Clock, Lock, Server, AtSign, Network } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface Setting {
    SettingKey: string;
    SettingValue: string;
    Description: string;
    UpdatedAt: string;
}

const settingLabels: Record<string, { label: string; icon: any; group: string; description?: string; type?: string }> = {
    'app_name': { label: 'ชื่อระบบ (Application Name)', icon: Globe, group: 'general' },
    'org_name': { label: 'ชื่อองค์กร (Organization Name)', icon: Globe, group: 'general' },
    'company_1_name': { label: 'บริษัทที่ 1', icon: Building2, group: 'company' },
    'company_2_name': { label: 'บริษัทที่ 2', icon: Building2, group: 'company' },
    'company_3_name': { label: 'บริษัทที่ 3', icon: Building2, group: 'company' },
    'rate_limit_max_attempts': { label: 'จำนวนครั้งสูงสุดที่อนุญาต', icon: Lock, group: 'security', description: 'จำนวนครั้งที่อนุญาตให้ Login ผิดพลาดก่อนล็อกบัญชี', type: 'number' },
    'rate_limit_window_minutes': { label: 'ระยะเวลาล็อก (นาที)', icon: Clock, group: 'security', description: 'จำนวนนาทีที่ต้องรอก่อนลองใหม่', type: 'number' },
    'session_idle_timeout_minutes': { label: 'หมดเวลาไม่ใช้งาน (นาที)', icon: Clock, group: 'security', description: 'ระยะเวลาที่ไม่มีกิจกรรมก่อนออกจากระบบอัตโนมัติ — ตั้ง 0 เพื่อปิด', type: 'number' },
    'ldap_enabled': { label: 'เปิดใช้งาน LDAP', icon: Link2, group: 'ldap', type: 'toggle' },
    'ldap_url': { label: 'Server URL', icon: Server, group: 'ldap', description: 'เช่น ldap://192.168.1.10:389' },
    'ldap_domain': { label: 'Domain', icon: AtSign, group: 'ldap', description: 'เช่น soniclocal.com' },
    'ldap_base_dn': { label: 'Base DN', icon: Network, group: 'ldap', description: 'เช่น DC=soniclocal,DC=com' },
    'auto_purge_logs_days': { label: 'ลบ Log อัตโนมัติ (วัน)', icon: Clock, group: 'security', description: 'ลบ Audit Log เก่ากว่ากี่วันอัตโนมัติ — ตั้ง 0 เพื่อปิด', type: 'number' },
};

// Explicit LDAP field order
const ldapFieldOrder = ['ldap_url', 'ldap_domain', 'ldap_base_dn'];

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<Setting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [ldapTestResult, setLdapTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTestingLdap, setIsTestingLdap] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                setHasChanges(false);
            }
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
        setHasChanges(true);
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
                toast('บันทึกการตั้งค่าสำเร็จ!', 'success');
                fetchSettings();
            } else {
                toast('เกิดข้อผิดพลาด: ' + data.message, 'error');
            }
        } catch (err) {
            toast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const generalSettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'general');
    const companySettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'company');
    const securitySettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'security');
    const ldapSettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'ldap');
    const otherSettings = settings.filter(s => !settingLabels[s.SettingKey]);

    const ldapEnabled = settings.find(s => s.SettingKey === 'ldap_enabled')?.SettingValue === 'true';

    // Sort LDAP fields by explicit order
    const sortedLdapFields = ldapFieldOrder
        .map(key => ldapSettings.find(s => s.SettingKey === key))
        .filter(Boolean) as Setting[];

    const handleTestLdap = async () => {
        setIsTestingLdap(true);
        setLdapTestResult(null);
        try {
            const res = await fetch('/api/admin/settings/test-ldap', { method: 'POST' });
            const data = await res.json();
            setLdapTestResult(data);
            if (data.success) toast('เชื่อมต่อ AD สำเร็จ!', 'success');
        } catch {
            setLdapTestResult({ success: false, message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' });
        } finally {
            setIsTestingLdap(false);
        }
    };

    // Shared input style
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all text-slate-900 dark:text-white placeholder:text-slate-400";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto pb-8">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-lg shadow-slate-300/30">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ตั้งค่าระบบ</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">จัดการการตั้งค่าทั่วไปของระบบ ReportCenter</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchSettings} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="รีเฟรช">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl active:scale-95 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed ${hasChanges
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'กำลังบันทึก...' : hasChanges ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึก'}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">กำลังโหลดการตั้งค่า...</p>
                </div>
            ) : (
                <div className="space-y-6">

                    {/* General + Company — side by side on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* General Settings */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-800">
                                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    ข้อมูลทั่วไป
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {generalSettings.map(s => {
                                    const meta = settingLabels[s.SettingKey];
                                    return (
                                        <div key={s.SettingKey}>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{meta?.label || s.SettingKey}</label>
                                            <input
                                                type="text"
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Company Name Mappings */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/10 dark:to-slate-800">
                                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                                        <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    ชื่อบริษัท
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-9">ชื่อที่แสดงใน Dropdown เลือกบริษัท</p>
                            </div>
                            <div className="p-6 space-y-3">
                                {companySettings.map(s => {
                                    const num = s.SettingKey.replace('company_', '').replace('_name', '');
                                    const colors = ['blue', 'emerald', 'purple'];
                                    const colorIdx = parseInt(num) - 1;
                                    const badgeColors = [
                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                                    ];
                                    return (
                                        <div key={s.SettingKey} className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${badgeColors[colorIdx] || badgeColors[0]}`}>
                                                {num}
                                            </div>
                                            <input
                                                type="text"
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className={`flex-1 ${inputClass}`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Security Settings */}
                    {securitySettings.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/10 dark:to-slate-800">
                                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    ความปลอดภัย
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-9">Rate Limiting, Idle Timeout</p>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {securitySettings.map(s => {
                                        const meta = settingLabels[s.SettingKey];
                                        const Icon = meta?.icon || ShieldAlert;
                                        return (
                                            <div key={s.SettingKey} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Icon className="w-4 h-4 text-amber-500" />
                                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{meta?.label}</label>
                                                </div>
                                                {meta?.description && (
                                                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">{meta.description}</p>
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={s.SettingValue}
                                                    onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-center font-semibold text-slate-900 dark:text-white transition-all"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">⚠️</span>
                                    <span>การเปลี่ยนค่าจะมีผลทันทีหลังกดบันทึก — ใช้งานตั้งแต่การ Login ครั้งถัดไป</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LDAP / Active Directory */}
                    {ldapSettings.length > 0 && (
                        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border overflow-hidden transition-all ${ldapEnabled ? 'border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-100 dark:ring-indigo-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
                            <div className={`px-6 py-4 border-b transition-all ${ldapEnabled ? 'border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800' : 'border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700/30 dark:to-slate-800'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${ldapEnabled ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                            <Link2 className={`w-3.5 h-3.5 transition-colors ${ldapEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-slate-800 dark:text-white">Active Directory (LDAP)</h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ให้พนักงาน login ด้วยรหัส AD</p>
                                        </div>
                                    </div>
                                    {/* Toggle */}
                                    <button
                                        onClick={() => handleChange('ldap_enabled', ldapEnabled ? 'false' : 'true')}
                                        className={`relative w-14 h-8 rounded-full transition-all duration-300 ${ldapEnabled ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${ldapEnabled ? 'left-7' : 'left-1'}`}>
                                            {ldapEnabled ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* LDAP Fields — explicit order: URL → Domain → Base DN */}
                                {sortedLdapFields.map(s => {
                                    const meta = settingLabels[s.SettingKey];
                                    const Icon = meta?.icon || Link2;
                                    return (
                                        <div key={s.SettingKey}>
                                            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                <Icon className="w-3.5 h-3.5 text-indigo-500" />
                                                {meta?.label}
                                            </label>
                                            <input
                                                type="text"
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all font-mono text-slate-900 dark:text-white placeholder:text-slate-400`}
                                                placeholder={meta?.description}
                                            />
                                        </div>
                                    );
                                })}

                                {/* Test Connection */}
                                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    <button
                                        onClick={handleTestLdap}
                                        disabled={isTestingLdap}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-indigo-500/20"
                                    >
                                        {isTestingLdap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                        {isTestingLdap ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
                                    </button>
                                    {ldapTestResult && (
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${ldapTestResult.success
                                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                                            }`}>
                                            {ldapTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                                            <span>{ldapTestResult.message}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">🔐</span>
                                    <span>Service Account (<code className="font-mono bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded">LDAP_BIND_DN</code>, <code className="font-mono bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded">LDAP_BIND_PASSWORD</code>) ตั้งค่าใน <code className="font-mono bg-indigo-100 dark:bg-indigo-900/30 px-1 rounded">.env</code></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Other/Custom Settings */}
                    {otherSettings.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                                <h2 className="font-semibold text-slate-800 dark:text-white">การตั้งค่าอื่นๆ</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {otherSettings.map(s => (
                                    <div key={s.SettingKey}>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{s.Description || s.SettingKey}</label>
                                        <input
                                            type="text"
                                            value={s.SettingValue}
                                            onChange={e => handleChange(s.SettingKey, e.target.value)}
                                            className={inputClass}
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
