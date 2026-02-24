"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Database, Users, Shield, Clock, Activity, RefreshCw, Calendar, AlertTriangle, Star, Zap } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { timeAgo } from '@/lib/dateUtils';

interface DashboardStats {
  totalReports: number;
  totalUsers: number | null;
  totalRoles: number | null;
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

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  LOGIN: { icon: '🔑', color: 'bg-blue-100 dark:bg-blue-900/40' },
  LOGOUT: { icon: '🚪', color: 'bg-slate-100 dark:bg-slate-700' },
  LOGIN_FAIL: { icon: '🚫', color: 'bg-red-100 dark:bg-red-900/40' },
  EXECUTE_REPORT: { icon: '▶️', color: 'bg-emerald-100 dark:bg-emerald-900/40' },
  EXPORT_EXCEL: { icon: '📊', color: 'bg-amber-100 dark:bg-amber-900/40' },
  CREATE_REPORT: { icon: '➕', color: 'bg-purple-100 dark:bg-purple-900/40' },
  UPDATE_REPORT: { icon: '✏️', color: 'bg-indigo-100 dark:bg-indigo-900/40' },
  RUN_SCHEDULE: { icon: '⚡', color: 'bg-orange-100 dark:bg-orange-900/40' },
  CRON_SUCCESS: { icon: '✅', color: 'bg-lime-100 dark:bg-lime-900/40' },
  CRON_FAIL: { icon: '❌', color: 'bg-red-100 dark:bg-red-900/40' },
  CREATE_USER: { icon: '👤', color: 'bg-violet-100 dark:bg-violet-900/40' },
  UPDATE_USER: { icon: '👤', color: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
  CHANGE_PASSWORD: { icon: '🔒', color: 'bg-sky-100 dark:bg-sky-900/40' },
};

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [scheduleStats, setScheduleStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = user?.roleName?.toLowerCase() === 'admin';

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLogs(data.recentLogs || []);
        setScheduleStats(data.scheduleStats || null);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/dashboard/charts').then(r => r.json()).then(d => {
        if (d.success) setChartData(d);
      }).catch(() => { });
    }
  }, [isAdmin]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'สวัสดีตอนเช้า';
    if (h < 17) return 'สวัสดีตอนบ่าย';
    return 'สวัสดีตอนเย็น';
  })();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-700/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-slate-400 text-sm mb-1">{greeting}</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">{user?.fullName || 'ผู้ใช้'}</span>
            </h1>
            <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
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

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/reports/standard" className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 dark:text-white">รายงานมาตรฐาน</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">เรียกดูยอดขาย สต๊อก ข้อมูลลูกค้า</p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
          {stats && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
              {stats.standardReports} รายงาน
            </div>
          )}
        </Link>

        <Link href="/reports/templates" className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 dark:text-white">รายงาน Template</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">สร้างข้อความจาก Template คัดลอกไปใช้</p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
          </div>
          {stats && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500">
              {stats.templateReports} รายงาน
            </div>
          )}
        </Link>

        {isAdmin && (
          <Link href="/admin/reports" className="group relative bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800 text-white rounded-2xl shadow-sm border border-slate-700 dark:border-slate-600 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">จัดการรายงาน</h3>
                <p className="text-xs text-slate-400">สร้าง แก้ไข ลบ รายงาน</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            {stats && (
              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-slate-400">
                {stats.totalReports} รายงาน • {stats.totalUsers} ผู้ใช้ • {stats.totalRoles} สิทธิ์
              </div>
            )}
          </Link>
        )}
      </div>

      {/* Admin Stats Row */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">รายงานทั้งหมด</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : stats?.totalReports || 0}</p>
            <div className="flex gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
              <span>Standard: {stats?.standardReports || 0}</span>
              <span>•</span>
              <span>Template: {stats?.templateReports || 0}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">ผู้ใช้งาน</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : stats?.totalUsers || 0}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">บัญชีที่ Active</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">ตำแหน่ง/สิทธิ์</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : stats?.totalRoles || 0}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Role ในระบบ</p>
          </div>

          {/* Schedule Status Card */}
          {scheduleStats ? (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border p-5 hover:shadow-md transition-shadow ${scheduleStats.failed > 0 ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scheduleStats.failed > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-cyan-100 dark:bg-cyan-900/50'}`}>
                  {scheduleStats.failed > 0 ? <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /> : <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />}
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">ตั้งเวลารายงาน</span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{scheduleStats.active}<span className="text-sm font-normal text-slate-400 ml-1">active</span></p>
              <div className="flex flex-col gap-1 mt-2 text-xs">
                {scheduleStats.failed > 0 && (
                  <span className="text-red-500 font-semibold">⚠ {scheduleStats.failed} รายการ failed</span>
                )}
                {scheduleStats.nextRun && (
                  <span className="text-slate-400 dark:text-slate-500">ถัดไป: {timeAgo(scheduleStats.nextRun)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">กิจกรรมล่าสุด</span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : logs.length}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">รายการล่าสุด</p>
            </div>
          )}
        </div>
      )}

      {/* Charts Section (Admin only) */}
      {isAdmin && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage per Day Bar Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">📊 การใช้งานรายวัน (14 วัน)</h3>
            {chartData.usagePerDay.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {chartData.usagePerDay.map((d: any, i: number) => {
                  const max = Math.max(...chartData.usagePerDay.map((x: any) => x.count));
                  const pct = max > 0 ? (d.count / max) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-500 hover:from-blue-500 hover:to-blue-300"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.date?.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีข้อมูล</p>
            )}
          </div>

          {/* Top Reports */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">🏆 รายงานยอดนิยม (30 วัน)</h3>
            {chartData.topReports.length > 0 ? (
              <div className="space-y-3">
                {chartData.topReports.map((r: any, i: number) => {
                  const max = chartData.topReports[0]?.count || 1;
                  const pct = (r.count / max) * 100;
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{r.ReportName}</span>
                        <span className="text-slate-400 text-xs ml-2 shrink-0">{r.count} ครั้ง</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${colors[i]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีข้อมูล</p>
            )}
            {chartData.activeUsersToday > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-slate-500 dark:text-slate-400">ผู้ใช้งานวันนี้: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{chartData.activeUsersToday}</span> คน</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            กิจกรรมล่าสุด{!isAdmin && ' ของคุณ'}
          </h2>
          <button onClick={fetchDashboard} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีกิจกรรมในระบบ</p>
              <p className="text-xs mt-1">เมื่อมีคนเรียกดูรายงาน ระบบจะบันทึกไว้ที่นี่</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {logs.map((log) => {
                const actionInfo = ACTION_ICONS[log.ActionType] || { icon: '📋', color: 'bg-slate-100 dark:bg-slate-700' };
                return (
                  <div key={log.LogId} className="px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl ${actionInfo.color} flex items-center justify-center text-sm mt-0.5 shrink-0`}>
                      {actionInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-800 dark:text-white">{log.UserName || 'ไม่ทราบ'}</span>
                        {' '}
                        <span className="text-slate-500 dark:text-slate-400">{log.Details}</span>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(log.CreatedAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
