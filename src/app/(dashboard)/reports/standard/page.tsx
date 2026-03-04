"use client"

import { Search, Filter, Download, FileText, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Loader2, AlertCircle, Star, Tag, BarChart3, Calendar, Play, ArrowRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import * as xlsx from 'xlsx';
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import TypeaheadInput from "@/components/TypeaheadInput";
import { formatDate } from '@/lib/dateUtils';

export default function StandardReportPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [reports, setReports] = useState<any[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string>('');
    const [parameters, setParameters] = useState<any[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [isLoadingParams, setIsLoadingParams] = useState(false);

    // Form parameter values
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [selectedCompany, setSelectedCompany] = useState('');

    // Data execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState('');
    const [exportElapsed, setExportElapsed] = useState(0);
    const exportTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [reportColumns, setReportColumns] = useState<string[]>([]);
    const [executionError, setExecutionError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);

    // Favorites
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

    // Search & Category filter
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // Background Job state
    const [activeJob, setActiveJob] = useState<{ jobId: number; status: string; rowCount?: number; fileName?: string; error?: string } | null>(null);

    const [companies, setCompanies] = useState<any[]>([]);

    const companyNames: Record<number, string> = {};
    companies.forEach(c => { companyNames[c.companyId] = `${c.name} (${c.label})`; });

    const allowedCompanies = user?.allowedCompanies || [];

    // Set default selected company when user loads
    useEffect(() => {
        if (allowedCompanies.length > 0 && !selectedCompany) {
            setSelectedCompany(allowedCompanies[0].toString());
        }
    }, [allowedCompanies, selectedCompany]);

    // Fetch available standard reports + favorites
    useEffect(() => {
        const fetchReports = async () => {
            setIsLoadingReports(true);
            try {
                const [reportsRes, favRes, compRes] = await Promise.all([
                    fetch('/api/reports/available'),
                    fetch('/api/reports/favorites'),
                    fetch('/api/companies'),
                ]);
                const reportsData = await reportsRes.json();
                const favData = await favRes.json();
                const compData = await compRes.json();
                if (reportsData.success) {
                    setReports(reportsData.reports.filter((r: any) => r.ReportType === 1));
                }
                if (favData.success) {
                    setFavoriteIds(favData.favorites.map((f: any) => f.ReportId));
                }
                if (compData.success) {
                    setCompanies(compData.companies);
                }
            } catch (error) {
                console.error("Failed to fetch reports:", error);
            } finally {
                setIsLoadingReports(false);
            }
        };
        fetchReports();
    }, []);

    const toggleFavorite = async (reportId: number) => {
        try {
            const res = await fetch('/api/reports/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId }),
            });
            const data = await res.json();
            if (data.success) {
                if (data.action === 'added') {
                    setFavoriteIds(prev => [...prev, reportId]);
                    toast('เพิ่มลงรายการโปรดแล้ว', 'success');
                } else {
                    setFavoriteIds(prev => prev.filter(id => id !== reportId));
                    toast('นำออกจากรายการโปรดแล้ว', 'info');
                }
            }
        } catch {
            toast('ไม่สามารถอัปเดตรายการโปรดได้', 'error');
        }
    };

    // Fetch parameters when report changes
    useEffect(() => {
        if (!selectedReportId) {
            setParameters([]);
            setParamValues({});
            setReportData(null);
            setExecutionError(null);
            return;
        }

        const fetchParams = async () => {
            setIsLoadingParams(true);
            try {
                const res = await fetch(`/api/reports/parameters?reportId=${selectedReportId}`);
                const data = await res.json();
                if (data.success) {
                    setParameters(data.parameters);
                    // Initialize paramValues
                    const initialVals: Record<string, string> = {};
                    data.parameters.forEach((p: any) => {
                        initialVals[p.ParameterName] = '';
                    });
                    setParamValues(initialVals);
                }
            } catch (error) {
                console.error("Failed to fetch parameters:", error);
            } finally {
                setIsLoadingParams(false);
            }
        };
        fetchParams();
    }, [selectedReportId]);

    const handleParamChange = (paramName: string, value: string) => {
        setParamValues(prev => ({ ...prev, [paramName]: value }));
    };

    const handleExecuteReport = async (requestedPage?: number) => {
        if (!selectedReportId) {
            toast('กรุณาเลือกรายงานก่อนดึงข้อมูล', 'info');
            return;
        }

        // IsHeavy reports: warn that preview is limited, suggest Export
        const report = reports.find(r => r.ReportId.toString() === selectedReportId);
        if (report?.IsHeavy && !requestedPage) {
            const confirmed = window.confirm(
                '⚠️ รายงานนี้ถูกตั้งเป็น "รายงานขนาดใหญ่"\n\n' +
                'การดึงข้อมูลจะแสดงตัวอย่างเพียง 50 แถวแรก\n' +
                'หากต้องการข้อมูลทั้งหมด กรุณาใช้ปุ่ม "Export Excel" (จะส่งออกเป็น CSV)\n\n' +
                'ต้องการดูตัวอย่างต่อหรือไม่?'
            );
            if (!confirmed) return;
        }

        // Validate required params visually (optional, but good UX)
        let hasEmptyFields = false;
        Object.keys(paramValues).forEach(key => {
            if (!paramValues[key] && paramValues[key] !== '0') {
                hasEmptyFields = true;
            }
        });

        if (hasEmptyFields && parameters.length > 0) {
            const confirmRun = window.confirm("ยังไม่ได้กรอกเงื่อนไขบางช่อง ต้องการดำเนินการต่อหรือไม่?");
            if (!confirmRun) return;
        }

        const pg = requestedPage || 1;
        setIsExecuting(true);
        setExecutionError(null);
        if (pg === 1) setReportData(null);

        try {
            const res = await fetch('/api/reports/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: selectedReportId,
                    companyId: selectedCompany,
                    parameters: paramValues,
                    page: pg,
                    pageSize,
                })
            });

            const data = await res.json();

            if (data.success) {
                setReportData(data.data);
                if (data.columns) setReportColumns(data.columns);
                setTotalRows(data.totalRows || data.data.length);
                setCurrentPage(pg);
            } else {
                setExecutionError(data.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
            }
        } catch (error: any) {
            setExecutionError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + error.message);
        } finally {
            setIsExecuting(false);
        }
    };

    // Use column order from API (preserves SQL SELECT order) or fallback to Object.keys
    const getColumns = () => {
        if (reportColumns.length > 0) return reportColumns;
        if (!reportData || reportData.length === 0) return [];
        return Object.keys(reportData[0]);
    };

    const columns = getColumns();

    const handleExportExcel = async () => {
        if (!selectedReportId || isExporting) return;
        setIsExporting(true);
        setExportElapsed(0);
        setExportStatus('กำลังดึงข้อมูลจากฐานข้อมูล...');

        // Start elapsed timer
        const startTime = Date.now();
        exportTimerRef.current = setInterval(() => {
            setExportElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        const stopTimer = () => {
            if (exportTimerRef.current) {
                clearInterval(exportTimerRef.current);
                exportTimerRef.current = null;
            }
        };

        const report = reports.find(r => r.ReportId.toString() === selectedReportId);
        const reportName = report ? report.ReportName : 'Report';
        const dateStr = new Date().toISOString().split('T')[0];

        // IsHeavy → background job
        if (report?.IsHeavy) {
            try {
                const res = await fetch('/api/reports/execute-async', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportId: selectedReportId,
                        companyId: selectedCompany,
                        parameters: paramValues,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    setActiveJob({ jobId: data.jobId, status: 'running' });
                    toast('กำลังสร้างรายงานในพื้นหลัง...', 'info');
                    const poll = setInterval(async () => {
                        try {
                            const jr = await fetch(`/api/reports/jobs/${data.jobId}`);
                            const jd = await jr.json();
                            if (jd.success) {
                                setActiveJob(jd.job);
                                if (jd.job.status === 'done') {
                                    clearInterval(poll);
                                    toast(`รายงานพร้อมดาวน์โหลด (${jd.job.rowCount} แถว)`, 'success');
                                } else if (jd.job.status === 'failed') {
                                    clearInterval(poll);
                                    toast(`สร้างรายงานไม่สำเร็จ: ${jd.job.error}`, 'error');
                                }
                            }
                        } catch { clearInterval(poll); }
                    }, 3000);
                } else {
                    toast(data.message || 'ไม่สามารถสร้าง Job ได้', 'error');
                }
            } catch {
                toast('เกิดข้อผิดพลาด', 'error');
            }
            stopTimer();
            setIsExporting(false);
            return;
        }

        // Normal export
        try {
            const res = await fetch('/api/reports/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: selectedReportId,
                    companyId: selectedCompany,
                    parameters: paramValues,
                    exportAll: true,
                })
            });
            const data = await res.json();
            if (!data.success || !data.data.length) {
                toast('ไม่มีข้อมูลให้ส่งออก', 'info');
                return;
            }
            setExportStatus(`กำลังสร้างไฟล์ Excel (${data.data.length.toLocaleString()} แถว)...`);
            // Small delay to let UI update before heavy xlsx work
            await new Promise(r => setTimeout(r, 100));
            // Use API column order via header option (Object.keys reorders numeric keys)
            const exportCols = data.columns || Object.keys(data.data[0]);
            const worksheet = xlsx.utils.json_to_sheet(data.data, { header: exportCols });
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Report Data");
            xlsx.writeFile(workbook, `${reportName}_${dateStr}.xlsb`, { bookType: 'xlsb' });
            toast(`ส่งออก ${data.data.length.toLocaleString()} รายการเรียบร้อย`, 'success');
        } catch {
            toast('ไม่สามารถส่งออกข้อมูลได้', 'error');
        } finally {
            stopTimer();
            setIsExporting(false);
        }
    };

    const handleJobDownload = () => {
        if (activeJob?.jobId) {
            window.open(`/api/reports/jobs/${activeJob.jobId}/download`, '_blank');
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full flex flex-col">

            {/* Background Job Banner */}
            {activeJob && (
                <div className={`flex items-center justify-between px-5 py-3 rounded-xl border shadow-sm animate-in slide-in-from-top-2 duration-300 ${activeJob.status === 'running' ? 'bg-blue-50 border-blue-200' :
                    activeJob.status === 'done' ? 'bg-emerald-50 border-emerald-200' :
                        'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        {activeJob.status === 'running' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                        {activeJob.status === 'done' && <Download className="w-5 h-5 text-emerald-600" />}
                        {activeJob.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        <span className="text-sm font-medium">
                            {activeJob.status === 'running' && 'กำลังสร้างรายงานในพื้นหลัง... กรุณารอสักครู่'}
                            {activeJob.status === 'done' && `รายงานพร้อมแล้ว! (${activeJob.rowCount} แถว)`}
                            {activeJob.status === 'failed' && `สร้างรายงานไม่สำเร็จ: ${activeJob.error}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeJob.status === 'done' && (
                            <button onClick={handleJobDownload} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                                <Download className="w-4 h-4" /> ดาวน์โหลด
                            </button>
                        )}
                        {activeJob.status !== 'running' && (
                            <button onClick={() => setActiveJob(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
                        )}
                    </div>
                </div>
            )}

            {/* Header / Report Selector */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                {/* Pinned Favorites */}
                {reports.filter(r => favoriteIds.includes(r.ReportId)).length > 0 && (
                    <div className="mb-5">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> รายการโปรด
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {reports.filter(r => favoriteIds.includes(r.ReportId)).map(r => (
                                <button
                                    key={r.ReportId}
                                    onClick={() => setSelectedReportId(r.ReportId.toString())}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedReportId === r.ReportId.toString()
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                >
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    {r.ReportName}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Category Filter Chips */}
                {(() => {
                    const cats = reports.reduce((acc: Record<string, { name: string; color: string; count: number }>, r: any) => {
                        if (r.CategoryName) {
                            if (!acc[r.CategoryName]) acc[r.CategoryName] = { name: r.CategoryName, color: r.CategoryColor || 'slate', count: 0 };
                            acc[r.CategoryName].count++;
                        }
                        return acc;
                    }, {} as Record<string, { name: string; color: string; count: number }>);
                    const catList = Object.values(cats) as { name: string; color: string; count: number }[];
                    if (catList.length === 0) return null;
                    return (
                        <div className="flex flex-wrap gap-2 mb-5">
                            <button
                                onClick={() => setSelectedCategory('')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === ''
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                ทั้งหมด ({reports.length})
                            </button>
                            {catList.map(cat => (
                                <button
                                    key={cat.name}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === cat.name
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <Tag className="w-3 h-3" />
                                    {cat.name} ({cat.count})
                                </button>
                            ))}
                        </div>
                    );
                })()}

                <div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
                    <div className="w-full max-w-sm">
                        <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            เลือกรายงานมาตรฐาน
                            {isLoadingReports && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                        </label>
                        <div className="relative mb-2">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ค้นหารายงาน..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    value={selectedReportId}
                                    onChange={e => setSelectedReportId(e.target.value)}
                                    disabled={isLoadingReports || isExecuting}
                                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-slate-900 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium disabled:opacity-60"
                                >
                                    <option value="">-- กรุณาเลือกรายงาน --</option>
                                    {reports.filter(r => {
                                        if (selectedCategory && r.CategoryName !== selectedCategory) return false;
                                        if (!searchQuery) return true;
                                        const q = searchQuery.toLowerCase();
                                        return r.ReportName?.toLowerCase().includes(q) || r.Description?.toLowerCase().includes(q);
                                    }).map(r => (
                                        <option key={r.ReportId} value={r.ReportId}>{r.ReportName} {r.Description ? `(${r.Description})` : ''}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            {selectedReportId && (
                                <button
                                    onClick={() => toggleFavorite(parseInt(selectedReportId))}
                                    className={`p-2.5 rounded-lg border transition-all ${favoriteIds.includes(parseInt(selectedReportId))
                                        ? 'bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100'
                                        : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-amber-500'
                                        }`}
                                    title={favoriteIds.includes(parseInt(selectedReportId)) ? 'นำออกจากรายการโปรด' : 'เพิ่มลงรายการโปรด'}
                                >
                                    <Star className={`w-5 h-5 ${favoriteIds.includes(parseInt(selectedReportId)) ? 'fill-amber-500' : ''}`} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dynamic Filters Area */}
                <div className="mt-6 pt-6 border-t border-slate-100 min-h-[140px]">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Filter className="w-4 h-4" /> ตัวกรองข้อมูล (Filters)
                    </h3>

                    {!selectedReportId ? (
                        <div className="text-center text-sm text-slate-400 py-6">กรุณาเลือกรายงานเพื่อแสดงตัวกรองข้อมูล</div>
                    ) : isLoadingParams ? (
                        <div className="flex items-center justify-center py-6 text-slate-500 text-sm gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> กำลังโหลดตัวกรอง...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            {/* Company Selector - Universal */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">สาขา / บริษัท <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedCompany}
                                    onChange={e => setSelectedCompany(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                >
                                    {companies.map(c => (
                                        <option key={c.companyId} value={c.companyId}>{c.companyId}. {c.name} ({c.label})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dynamic Database Parameters */}
                            {parameters.map((param) => (
                                <div key={param.ParameterId}>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        {param.DisplayLabel || param.ParameterName}
                                    </label>
                                    {param.InputType === 'date' ? (
                                        <input
                                            type="date"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        />
                                    ) : param.InputType === 'number' ? (
                                        <input
                                            type="number"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        />
                                    ) : param.LookupQuery ? (
                                        <TypeaheadInput
                                            reportId={selectedReportId}
                                            paramName={param.ParameterName}
                                            companyId={selectedCompany}
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={(val: string) => handleParamChange(param.ParameterName, val)}
                                            placeholder={`ค้นหา ${param.DisplayLabel || param.ParameterName}...`}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        />
                                    )}
                                </div>
                            ))}

                            <div className="flex items-end mt-2 lg:mt-0">
                                <button
                                    onClick={() => handleExecuteReport()}
                                    disabled={isExecuting}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    {isExecuting ? 'กำลังประมวลผล...' : 'ดึงข้อมูล'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {
                executionError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-sm">เกิดข้อผิดพลาดในการดึงข้อมูล</h4>
                            <p className="text-sm opacity-90">{executionError}</p>
                        </div>
                    </div>
                )
            }

            {/* Data Grid Area */}
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden relative">

                {/* Export Progress Overlay */}
                {isExporting && (
                    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-sm w-full mx-4 text-center space-y-5">
                            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto">
                                <Download className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">กำลังส่งออก Excel</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{exportStatus}</p>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse" style={{ width: '75%' }} />
                            </div>
                            {/* Elapsed Time */}
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                                <span className="text-slate-600 dark:text-slate-300 font-mono">
                                    {Math.floor(exportElapsed / 60).toString().padStart(2, '0')}:{(exportElapsed % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">กรุณาอย่าปิดหน้านี้ระหว่างส่งออก</p>
                        </div>
                    </div>
                )}
                {/* Actions Toolbar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-600">
                        {reportData ? (
                            <>พบข้อมูล <span className="text-blue-600 font-bold">{totalRows}</span> รายการ (หน้า {currentPage}/{Math.ceil(totalRows / pageSize) || 1})</>
                        ) : (
                            'รอการดึงข้อมูล...'
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            disabled={!reportData || reportData.length === 0}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            Print / PDF
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={!reportData || reportData.length === 0 || isExporting}
                            className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
                        >
                            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? 'กำลังส่งออก...' : 'Export Excel'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {isExecuting ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                            <p>กำลังรันคำสั่งฐานข้อมูล โปรดรอสักครู่...</p>
                        </div>
                    ) : !reportData ? (
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center max-w-lg space-y-6">
                                {/* Icon */}
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                                    <BarChart3 className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                                </div>

                                {/* Title */}
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">เลือกรายงานเพื่อเริ่มต้น</h3>
                                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">ทำตาม 3 ขั้นตอนง่ายๆ ด้านล่าง</p>
                                </div>

                                {/* Steps */}
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex flex-col items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">1</div>
                                        <FileText className="w-5 h-5 text-blue-500" />
                                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">เลือกรายงาน</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                    <div className="flex flex-col items-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                                        <div className="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">2</div>
                                        <Calendar className="w-5 h-5 text-purple-500" />
                                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">กรอก Parameter</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                    <div className="flex flex-col items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                        <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">3</div>
                                        <Play className="w-5 h-5 text-emerald-500" />
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">กดดึงข้อมูล</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-400 dark:text-slate-500">💡 กด ★ เพื่อปักหมุดรายงานที่ใช้บ่อย</p>
                            </div>
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="h-full flex items-center justify-center p-12 text-slate-500">
                            ไม่พบข้อมูลตามเงื่อนไขที่ระบุ
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-6 py-3 w-16 text-center text-xs font-medium text-slate-400 uppercase">#</th>
                                    {columns.map((col, idx) => (
                                        <th key={idx} className="px-6 py-3">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {reportData.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 text-center font-mono text-xs text-slate-400 bg-slate-50/30">
                                            {(currentPage - 1) * pageSize + rowIndex + 1}
                                        </td>
                                        {columns.map((col, colIndex) => {
                                            const val = row[col];
                                            const isDate = val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/));
                                            const displayVal = isDate
                                                ? formatDate(val)
                                                : val === null ? '-' : String(val);

                                            return (
                                                <td key={colIndex} className="px-6 py-4">
                                                    {displayVal}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls */}
                {reportData && totalRows > pageSize && (
                    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>แสดง</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); handleExecuteReport(1); }} className="border border-slate-200 rounded px-2 py-1 text-sm bg-white">
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>รายการ/หน้า</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleExecuteReport(currentPage - 1)} disabled={currentPage <= 1 || isExecuting} className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 text-sm font-medium">{currentPage} / {Math.ceil(totalRows / pageSize)}</span>
                            <button onClick={() => handleExecuteReport(currentPage + 1)} disabled={currentPage >= Math.ceil(totalRows / pageSize) || isExecuting} className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
