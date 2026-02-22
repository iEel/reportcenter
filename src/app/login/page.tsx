"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User, AlertCircle, ShieldAlert, Clock } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [lockSeconds, setLockSeconds] = useState(0);
    const [shakeError, setShakeError] = useState(false);

    // Countdown timer for rate limit lockout
    useEffect(() => {
        if (lockSeconds <= 0) {
            setIsLocked(false);
            return;
        }
        const timer = setInterval(() => {
            setLockSeconds(prev => {
                if (prev <= 1) {
                    setIsLocked(false);
                    setError('');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lockSeconds]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setShakeError(false);
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (data.success) {
                router.push('/');
                router.refresh();
            } else {
                // Rate limited (429)
                if (res.status === 429) {
                    setIsLocked(true);
                    // Parse "รอ X นาที" to get seconds
                    const match = data.message?.match(/(\d+)\s*นาที/);
                    const minutes = match ? parseInt(match[1]) : 15;
                    setLockSeconds(minutes * 60);
                }

                setError(data.message || 'เกิดข้อผิดพลาด');
                setShakeError(true);
                setTimeout(() => setShakeError(false), 500);
            }
        } catch (err) {
            setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white font-bold text-2xl shadow-xl shadow-blue-500/30 mb-4">
                        RC
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-wide">ReportCenter</h1>
                    <p className="text-blue-300/60 text-sm mt-1">Sonic Group — Enterprise Reporting System</p>
                </div>

                {/* Login Card */}
                <div className={`bg-white/10 backdrop-blur-xl border rounded-3xl p-8 shadow-2xl transition-all duration-300 ${isLocked ? 'border-red-400/40' : 'border-white/20'}`}>
                    <h2 className="text-xl font-semibold text-white mb-6">เข้าสู่ระบบ</h2>

                    {/* Rate Limit Lockout Banner */}
                    {isLocked && (
                        <div className="mb-5 p-4 bg-red-500/15 border border-red-400/30 rounded-2xl animate-in fade-in slide-in-from-top-3 duration-300">
                            <div className="flex items-center gap-3 mb-2">
                                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                                <span className="text-red-300 font-semibold text-sm">บัญชีถูกล็อกชั่วคราว</span>
                            </div>
                            <p className="text-red-300/70 text-xs mb-3">เข้าสู่ระบบผิดพลาดเกินกำหนด กรุณารอสักครู่</p>
                            <div className="flex items-center gap-2 bg-red-500/10 rounded-xl px-4 py-2.5">
                                <Clock className="w-4 h-4 text-red-400" />
                                <span className="text-red-300 font-mono font-bold text-lg">{formatTime(lockSeconds)}</span>
                                <span className="text-red-300/50 text-xs ml-1">ก่อนลองใหม่</span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-blue-200/80 mb-2">ชื่อผู้ใช้งาน (Username)</label>
                            <div className="relative">
                                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="ระบุ Username..."
                                    className={`w-full pl-11 pr-4 py-3 bg-white/10 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all text-sm ${isLocked ? 'border-red-400/30 opacity-50' : 'border-white/15'}`}
                                    autoComplete="username"
                                    autoFocus
                                    disabled={isLocked}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-blue-200/80 mb-2">รหัสผ่าน (Password)</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="ระบุ Password..."
                                    className={`w-full pl-11 pr-4 py-3 bg-white/10 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all text-sm ${isLocked ? 'border-red-400/30 opacity-50' : 'border-white/15'}`}
                                    autoComplete="current-password"
                                    disabled={isLocked}
                                />
                            </div>
                        </div>

                        {error && !isLocked && (
                            <div className={`flex items-center gap-2 p-3 bg-red-500/15 border border-red-400/20 rounded-xl text-red-300 text-sm animate-in fade-in slide-in-from-top-2 duration-300 ${shakeError ? 'animate-shake' : ''}`}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || isLocked}
                            className={`w-full py-3 font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2 ${isLocked ? 'bg-red-600/50 text-red-200 shadow-red-600/10 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'}`}
                        >
                            {isLocked ? (
                                <>
                                    <ShieldAlert className="w-4 h-4" />
                                    ล็อกชั่วคราว ({formatTime(lockSeconds)})
                                </>
                            ) : isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    กำลังเข้าสู่ระบบ...
                                </>
                            ) : (
                                'เข้าสู่ระบบ'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-white/20 text-xs mt-6">
                    © 2026 Sonic Group — ReportCenter v1.0
                </p>
            </div>

            {/* Shake animation */}
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s ease-in-out;
                }
            `}</style>
        </div>
    );
}
