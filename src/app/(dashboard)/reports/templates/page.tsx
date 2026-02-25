"use client";

import { Search, Filter, Copy, Download, LayoutTemplate, ChevronDown, CheckCircle2, RefreshCw, Loader2, AlertCircle, Star } from "lucide-react";
import { useState, useEffect } from "react";
import * as xlsx from 'xlsx';
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import TypeaheadInput from "@/components/TypeaheadInput";

export default function TemplateReportPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [copiedId, setCopiedId] = useState<number | null>(null);

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
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [templateText, setTemplateText] = useState<string>('');

    // Favorites
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Background Job state
    const [activeJob, setActiveJob] = useState<{ jobId: number; status: string; rowCount?: number; fileName?: string; error?: string } | null>(null);

    const [companies, setCompanies] = useState<any[]>([]);

    const companyNames: Record<number, string> = {};
    companies.forEach(c => { companyNames[c.companyId] = `${c.name} (${c.label})`; });
    const allowedCompanies = user?.allowedCompanies || [];

    useEffect(() => {
        if (allowedCompanies.length > 0 && !selectedCompany) {
            setSelectedCompany(allowedCompanies[0].toString());
        }
    }, [allowedCompanies, selectedCompany]);

    // Fetch available template reports + favorites
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
                    setReports(reportsData.reports.filter((r: any) => r.ReportType === 2));
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
    }, []);;

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
            setTemplateText('');
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

                // Set the template text based on the selected report
                const report = reports.find(r => r.ReportId.toString() === selectedReportId);
                if (report) {
                    setTemplateText(report.EmailTemplateContent || 'ยังไม่มีการตั้งค่า Template');
                }

            } catch (error) {
                console.error("Failed to fetch parameters:", error);
            } finally {
                setIsLoadingParams(false);
            }
        };
        fetchParams();
    }, [selectedReportId, reports]);

    const handleParamChange = (paramName: string, value: string) => {
        setParamValues(prev => ({ ...prev, [paramName]: value }));
    };

    const handleExecuteReport = async (overrideParams?: Record<string, string>) => {
        if (!selectedReportId) {
            alert("กรุณาเลือกรายงานก่อนดึงข้อมูล");
            return;
        }

        setIsExecuting(true);
        setExecutionError(null);
        setReportData(null);

        const finalParams = overrideParams || paramValues;

        try {
            const res = await fetch('/api/reports/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: selectedReportId,
                    companyId: selectedCompany,
                    parameters: finalParams
                })
            });

            const data = await res.json();

            if (data.success) {
                // For template reports, we add a mock ID for react mapping if none exists
                const dataWithIds = data.data.map((row: any, index: number) => ({
                    _rowId: index,
                    ...row
                }));
                setReportData(dataWithIds);
            } else {
                setExecutionError(data.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
            }
        } catch (error: any) {
            setExecutionError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + error.message);
        } finally {
            setIsExecuting(false);
        }
    };


    const generateMessage = (dataRow: any) => {
        let msg = templateText;
        Object.keys(dataRow).forEach(key => {
            // ignore _rowId
            if (key === '_rowId') return;
            const regex = new RegExp(`{{${key}}}`, 'g');
            // Check if value is null to avoid placing text "null" in the string easily 
            const value = dataRow[key] !== null && dataRow[key] !== undefined ? dataRow[key] : '';
            msg = msg.replace(regex, value.toString());
        });
        return msg;
    };

    const handleCopy = async (id: number, dataRow: any) => {
        const text = generateMessage(dataRow);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-secure contexts (HTTP)
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            toast('ไม่สามารถคัดลอกข้อความได้', 'error');
        }
    };

    // Calculate dynamic columns based on the first row of return data
    const getColumns = () => {
        if (!reportData || reportData.length === 0) return [];
        return Object.keys(reportData[0]).filter(k => k !== '_rowId');
    };

    const columns = getColumns();

    const handleExportExcel = async () => {
        if (!reportData || reportData.length === 0) return;
        const report = reports.find(r => r.ReportId.toString() === selectedReportId);
        const reportName = report ? report.ReportName : 'Report';
        const dateStr = new Date().toISOString().split('T')[0];

        // IsHeavy → use background job
        if (report?.IsHeavy) {
            try {
                const res = await fetch('/api/reports/execute-async', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportId: selectedReportId,
                        companyId: selectedCompany,
                        parameters: Object.fromEntries(
                            Object.entries(paramValues).filter(([, v]) => v !== '')
                        ),
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    setActiveJob({ jobId: data.jobId, status: 'running' });
                    toast('กำลังสร้างรายงานในพื้นหลัง...', 'info');
                    // Start polling
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
            return;
        }

        // Normal export (client-side)
        const exportData = reportData.map(row => {
            const { _rowId, ...rest } = row;
            return rest;
        });
        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Report Data");
        xlsx.writeFile(workbook, `${reportName}_${dateStr}.xlsb`, { bookType: 'xlsb' });
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
                                        ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm'
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

                <div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
                    <div className="w-full max-w-sm">
                        <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4 text-purple-500" />
                            เลือกรายงาน Template
                            {isLoadingReports && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                        </label>
                        <div className="relative mb-2">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ค้นหารายงาน..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    value={selectedReportId}
                                    onChange={e => setSelectedReportId(e.target.value)}
                                    disabled={isLoadingReports || isExecuting}
                                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-slate-900 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium disabled:opacity-60"
                                >
                                    <option value="">-- กรุณาเลือกรายงานเทมเพลต ({reports.length} รายการ) --</option>
                                    {reports.filter(r => {
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
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> กำลังโหลดตัวกรอง...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">สาขา / บริษัท <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedCompany}
                                    onChange={e => setSelectedCompany(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
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
                                    {param.LookupQuery ? (
                                        <TypeaheadInput
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={(val) => handleParamChange(param.ParameterName, val)}
                                            onSelect={(val) => {
                                                const updated = { ...paramValues, [param.ParameterName]: val };
                                                setParamValues(updated);
                                                handleExecuteReport(updated);
                                            }}
                                            reportId={selectedReportId}
                                            paramName={param.ParameterName}
                                            companyId={selectedCompany}
                                            placeholder={`ค้นหา${param.DisplayLabel || param.ParameterName}...`}
                                        />
                                    ) : param.InputType === 'date' ? (
                                        <input
                                            type="date"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
                                        />
                                    ) : param.InputType === 'number' ? (
                                        <input
                                            type="number"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={paramValues[param.ParameterName] || ''}
                                            onChange={e => handleParamChange(param.ParameterName, e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-sm py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
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
            {executionError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">เกิดข้อผิดพลาดในการดึงข้อมูล</h4>
                        <p className="text-sm opacity-90">{executionError}</p>
                    </div>
                </div>
            )}

            {/* Template Preview Box */}
            {selectedReportId && templateText && (
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mt-0.5">
                        <LayoutTemplate className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-purple-900 text-sm">รูปแบบข้อความ (Template) ที่ตั้งค่าไว้</h4>
                        <p className="text-sm text-purple-800/80 mt-1 whitespace-pre-wrap font-mono">
                            {templateText}
                        </p>
                    </div>
                </div>
            )}

            {/* Data Grid Area with Copy Button */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">

                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-600">
                        {reportData ? (
                            <>พบข้อมูล <span className="text-purple-600 font-bold">{reportData.length}</span> รายการ {reportData.length > 100 && <span className="text-slate-400 font-normal ml-2">(แสดงผลบนหน้าจอ 100 รายการแรก)</span>}</>
                        ) : (
                            'รอการดึงข้อมูล...'
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={!reportData || reportData.length === 0}
                            className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Export Excel
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {isExecuting ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mb-4" />
                            <p>กำลังรันคำสั่งฐานข้อมูล โปรดรอสักครู่...</p>
                        </div>
                    ) : !reportData ? (
                        <div className="h-full flex items-center justify-center p-12 text-slate-400">
                            กรุณาเลือกรายงานและกดปุ่ม 'ดึงข้อมูล' เพื่อแสดงผล
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="h-full flex items-center justify-center p-12 text-slate-500">
                            ไม่พบข้อมูลตามเงื่อนไขที่ระบุ
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 shadow-sm z-10">
                                <tr>
                                    {columns.map((col) => (
                                        <th key={col} className="px-6 py-3">{col}</th>
                                    ))}
                                    <th className="px-6 py-3 text-center bg-purple-50/50 sticky right-0 shadow-sm border-l border-purple-100">คัดลอกข้อความ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {reportData.slice(0, 100).map((row) => (
                                    <tr key={row._rowId} className="hover:bg-purple-50/50 transition-colors group">
                                        {columns.map((col) => (
                                            <td key={col} className={`px-6 py-4 ${typeof row[col] === 'number' ? 'text-right font-medium' : ''}`}>
                                                {row[col] === null ? <span className="text-slate-300 italic">null</span> : row[col]}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-center bg-purple-50/30 group-hover:bg-purple-100/50 transition-colors sticky right-0 border-l border-purple-100">
                                            <button
                                                onClick={() => handleCopy(row._rowId, row)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 shadow-sm
                                                    ${copiedId === row._rowId
                                                        ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30'
                                                    }`}
                                            >
                                                {copiedId === row._rowId ? (
                                                    <><CheckCircle2 className="w-4 h-4" /> คัดลอกแล้ว</>
                                                ) : (
                                                    <><Copy className="w-4 h-4" /> Copy Message</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
