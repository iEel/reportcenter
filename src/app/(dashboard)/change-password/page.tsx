"use client"

import { useState } from "react";
import { Lock, Eye, EyeOff, Shield, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ChangePasswordPage() {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const passwordStrength = (pw: string) => {
        if (pw.length === 0) return { level: 0, label: '', color: '' };
        if (pw.length < 6) return { level: 1, label: 'อ่อนมาก', color: 'bg-red-500' };
        if (pw.length < 8) return { level: 2, label: 'อ่อน', color: 'bg-orange-500' };
        const hasUpper = /[A-Z]/.test(pw);
        const hasNumber = /[0-9]/.test(pw);
        const hasSpecial = /[^A-Za-z0-9]/.test(pw);
        const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
        if (score >= 2 && pw.length >= 10) return { level: 4, label: 'แข็งแรงมาก', color: 'bg-emerald-500' };
        if (score >= 1 && pw.length >= 8) return { level: 3, label: 'ปานกลาง', color: 'bg-yellow-500' };
        return { level: 2, label: 'อ่อน', color: 'bg-orange-500' };
    };

    const strength = passwordStrength(newPassword);

    const handleSubmit = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        if (!currentPassword) {
            setErrorMessage('กรุณากรอกรหัสผ่านปัจจุบัน');
            return;
        }
        if (newPassword.length < 6) {
            setErrorMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMessage('รหัสผ่านใหม่กับการยืนยันไม่ตรงกัน');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccessMessage('เปลี่ยนรหัสผ่านสำเร็จ!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setErrorMessage(data.message);
            }
        } catch (err) {
            setErrorMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Lock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">เปลี่ยนรหัสผ่าน</h1>
                        <p className="text-sm text-slate-500">บัญชี: {user?.username}</p>
                    </div>
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3 border border-emerald-200 animate-in fade-in duration-300">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">{successMessage}</span>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-200 animate-in fade-in duration-300">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm font-medium">{errorMessage}</span>
                </div>
            )}

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-5">

                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่านปัจจุบัน <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10 text-sm transition-all"
                                placeholder="กรอกรหัสผ่านปัจจุบัน"
                            />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่านใหม่ <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10 text-sm transition-all"
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {/* Strength Indicator */}
                        {newPassword.length > 0 && (
                            <div className="mt-2 space-y-1">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500">ความแข็งแรง: <span className="font-medium">{strength.label}</span></p>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span></label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all ${confirmPassword && confirmPassword !== newPassword ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}
                            placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                        />
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-xs text-red-500 mt-1">รหัสผ่านไม่ตรงกัน</p>
                        )}
                        {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                            <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> ตรงกัน</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium disabled:opacity-50 disabled:active:scale-100"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {isSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
                    </button>
                </div>
            </div>
        </div>
    );
}
