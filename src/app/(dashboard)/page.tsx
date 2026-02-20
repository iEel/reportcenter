"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Database, Users, Shield, Clock, Activity, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface DashboardStats {
  totalReports: number;
  totalUsers: number;
  totalRoles: number;
  standardReports: number;
  templateReports: number;
}

interface ActivityLog {
  LogId: number;
  ActionType: string;
  Details: string;
  CreatedAt: string;
  UserName: string;
  ReportName: string;
  CompanyId: number;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLogs(data.recentLogs || []);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              สวัสดี, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">{user?.fullName || 'ผู้ใช้'}</span>
            </h1>
            <p className="text-slate-400 max-w-xl text-sm sm:text-base leading-relaxed">
              ศูนย์รวมรายงานสำหรับ Sonic Group — เรียกดูข้อมูลและจัดการรายงานได้จากที่นี่
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="w-24 h-24 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl flex items-center justify-center transform rotate-6 shadow-2xl">
              <BarChart3 className="w-10 h-10 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">รายงานทั้งหมด</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{isLoading ? '—' : stats?.totalReports || 0}</p>
          <div className="flex gap-2 mt-2 text-xs text-slate-400">
            <span>Standard: {stats?.standardReports || 0}</span>
            <span>•</span>
            <span>Template: {stats?.templateReports || 0}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">ผู้ใช้งาน</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{isLoading ? '—' : stats?.totalUsers || 0}</p>
          <p className="text-xs text-slate-400 mt-2">บัญชีที่ Active</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">ตำแหน่ง/สิทธิ์</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{isLoading ? '—' : stats?.totalRoles || 0}</p>
          <p className="text-xs text-slate-400 mt-2">Role ในระบบ</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">กิจกรรมล่าสุด</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{isLoading ? '—' : logs.length}</p>
          <p className="text-xs text-slate-400 mt-2">รายการล่าสุด</p>
        </div>
      </div>

      {/* Quick Access + Activity Log Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Access */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">เข้าถึงอย่างรวดเร็ว</h2>

          <Link href="/reports/standard" className="block bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                <FileText className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">รายงานมาตรฐาน</h3>
                <p className="text-xs text-slate-500">เรียกดูยอดขาย สต๊อก ข้อมูลลูกค้า</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link href="/reports/templates" className="block bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                <Database className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">รายงานส่งอีเมล</h3>
                <p className="text-xs text-slate-500">Template ข้อความ Copy ไปวางได้เลย</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {user?.roleName?.toLowerCase() === 'admin' && (
            <Link href="/admin/reports" className="block bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm border border-slate-700 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">จัดการรายงาน (Admin)</h3>
                  <p className="text-xs text-slate-400">สร้าง แก้ไข ลบ รายงาน</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          )}
        </div>

        {/* Activity Log */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              กิจกรรมล่าสุด
            </h2>
            <button onClick={fetchDashboard} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีกิจกรรมในระบบ</p>
                <p className="text-xs mt-1">เมื่อมีคนเรียกดูรายงาน ระบบจะบันทึกไว้ที่นี่</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <div key={log.LogId} className="px-5 py-4 hover:bg-slate-50/50 transition-colors flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold mt-0.5 shrink-0">
                      {log.UserName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold">{log.UserName || 'ไม่ทราบ'}</span>
                        {' '}
                        <span className="text-slate-500">{log.Details}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatTime(log.CreatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
