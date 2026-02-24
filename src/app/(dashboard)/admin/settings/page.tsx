"use client"

import { useState, useEffect } from "react";
import { Save, RefreshCw, Settings, Building2, Globe, Loader2, ShieldAlert, Link2, CheckCircle2, XCircle } from "lucide-react";

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
    'rate_limit_max_attempts': { label: 'จำนวนครั้งสูงสุดที่อนุญาต (Max Attempts)', icon: ShieldAlert, group: 'security', description: 'จำนวนครั้งที่อนุญาตให้ Login ผิดพลาดก่อนล็อกบัญชี', type: 'number' },
    'rate_limit_window_minutes': { label: 'ระยะเวลาล็อก (Window Minutes)', icon: ShieldAlert, group: 'security', description: 'จำนวนนาทีที่ต้องรอก่อนลองใหม่', type: 'number' },
    'session_idle_timeout_minutes': { label: 'หมดเวลาไม่ใช้งาน (Idle Timeout)', icon: ShieldAlert, group: 'security', description: 'ระยะเวลา (นาที) ที่ไม่มีกิจกรรมก่อนออกจากระบบอัตโนมัติ — ตั้ง 0 เพื่อปิดใช้งาน', type: 'number' },
    'ldap_enabled': { label: 'เปิดใช้งาน LDAP', icon: Link2, group: 'ldap', type: 'toggle' },
    'ldap_url': { label: 'Server URL', icon: Link2, group: 'ldap', description: 'เช่น ldap://192.168.1.10' },
    'ldap_domain': { label: 'Domain', icon: Link2, group: 'ldap', description: 'เช่น soniclocal.com' },
    'ldap_base_dn': { label: 'Base DN', icon: Link2, group: 'ldap', description: 'เช่น DC=soniclocal,DC=com' },
};

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Setting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [ldapTestResult, setLdapTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTestingLdap, setIsTestingLdap] = useState(false);

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
    const securitySettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'security');
    const ldapSettings = settings.filter(s => settingLabels[s.SettingKey]?.group === 'ldap');
    const otherSettings = settings.filter(s => !settingLabels[s.SettingKey]);

    const ldapEnabled = settings.find(s => s.SettingKey === 'ldap_enabled')?.SettingValue === 'true';

    const handleTestLdap = async () => {
        setIsTestingLdap(true);
        setLdapTestResult(null);
        try {
            const res = await fetch('/api/admin/settings/test-ldap', { method: 'POST' });
            const data = await res.json();
            setLdapTestResult(data);
        } catch {
            setLdapTestResult({ success: false, message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' });
        } finally {
            setIsTestingLdap(false);
        }
    };

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

                    {/* Security / Rate Limiting */}
                    {securitySettings.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-500" />
                                    ความปลอดภัย (Security)
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">กำหนด Rate Limiting (Login ผิดพลาด) และ Idle Timeout (ออกจากระบบเมื่อไม่ใช้งาน)</p>
                            </div>
                            <div className="p-6 space-y-4">
                                {securitySettings.map(s => {
                                    const meta = settingLabels[s.SettingKey];
                                    return (
                                        <div key={s.SettingKey}>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">{meta?.label || s.SettingKey}</label>
                                            {meta?.description && (
                                                <p className="text-xs text-slate-400 mb-2">{meta.description}</p>
                                            )}
                                            <input
                                                type={meta?.type || 'text'}
                                                min={meta?.type === 'number' ? '1' : undefined}
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className="w-full max-w-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                            />
                                        </div>
                                    );
                                })}
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                    ⚠️ การเปลี่ยนค่าจะมีผลทันทีหลังกดบันทึก — จะใช้งานตั้งแต่การ Login ครั้งถัดไป
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LDAP / Active Directory */}
                    {ldapSettings.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-indigo-500" />
                                    Active Directory (LDAP)
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">เชื่อมต่อ On-Premise AD เพื่อให้พนักงาน login ด้วยรหัส AD — credentials ตั้งค่าใน .env</p>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Enable/Disable Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">เปิดใช้งาน LDAP</label>
                                        <p className="text-xs text-slate-400">เปิดเพื่อให้ AD users สามารถ login ได้</p>
                                    </div>
                                    <button
                                        onClick={() => handleChange('ldap_enabled', ldapEnabled ? 'false' : 'true')}
                                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${ldapEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${ldapEnabled ? 'translate-x-5.5 left-auto right-0.5' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* LDAP Fields */}
                                {ldapSettings.filter(s => s.SettingKey !== 'ldap_enabled').map(s => {
                                    const meta = settingLabels[s.SettingKey];
                                    return (
                                        <div key={s.SettingKey}>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">{meta?.label || s.SettingKey}</label>
                                            {meta?.description && (
                                                <p className="text-xs text-slate-400 mb-2">{meta.description}</p>
                                            )}
                                            <input
                                                type="text"
                                                value={s.SettingValue}
                                                onChange={e => handleChange(s.SettingKey, e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all font-mono"
                                                placeholder={meta?.description}
                                            />
                                        </div>
                                    );
                                })}

                                {/* Test Connection */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleTestLdap}
                                        disabled={isTestingLdap}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-70 shadow-md shadow-indigo-500/20"
                                    >
                                        {isTestingLdap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                        {isTestingLdap ? 'กำลังทดสอบ...' : '🔍 ทดสอบการเชื่อมต่อ'}
                                    </button>
                                    {ldapTestResult && (
                                        <div className={`flex items-center gap-1.5 text-sm font-medium ${ldapTestResult.success ? 'text-green-600' : 'text-red-500'}`}>
                                            {ldapTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                            {ldapTestResult.message}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
                                    🔐 Service Account (LDAP_BIND_DN, LDAP_BIND_PASSWORD) ตั้งค่าใน .env เพื่อความปลอดภัย
                                </div>
                            </div>
                        </div>
                    )}

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
