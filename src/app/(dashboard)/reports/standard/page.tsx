"use client"

import { Search, Filter, Download, FileText, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Loader2, AlertCircle, Star } from "lucide-react";
import { useState, useEffect } from "react";
import * as xlsx from 'xlsx';
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
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
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);

    // Favorites
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    const companyNames: Record<number, string> = {
        1: 'Sonic Interfreight (SNI)',
        2: 'Grandlink Logistics (GRL)',
        3: 'Sonic Autologis (SALOG)',
    };

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
                const [reportsRes, favRes] = await Promise.all([
                    fetch('/api/reports/available'),
                    fetch('/api/reports/favorites'),
                ]);
                const reportsData = await reportsRes.json();
                const favData = await favRes.json();
                if (reportsData.success) {
                    setReports(reportsData.reports.filter((r: any) => r.ReportType === 1));
                }
                if (favData.success) {
                    setFavoriteIds(favData.favorites.map((f: any) => f.ReportId));
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

    // Calculate dynamic columns based on the first row of return data
    const getColumns = () => {
        if (!reportData || reportData.length === 0) return [];
        return Object.keys(reportData[0]);
    };

    const columns = getColumns();

    const handleExportExcel = async () => {
        if (!selectedReportId) return;

        const report = reports.find(r => r.ReportId.toString() === selectedReportId);
        const reportName = report ? report.ReportName : 'Report';
        const dateStr = new Date().toISOString().split('T')[0];

        try {
            // Fetch ALL data for export (no pagination)
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
            const worksheet = xlsx.utils.json_to_sheet(data.data);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Report Data");
            xlsx.writeFile(workbook, `${reportName}_${dateStr}.xlsb`, { bookType: 'xlsb' });
            toast(`ส่งออก ${data.data.length} รายการเรียบร้อย`, 'success');
        } catch {
            toast('ไม่สามารถส่งออกข้อมูลได้', 'error');
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full flex flex-col">

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
                                    <option value="">-- กรุณาเลือกรายงาน ({reports.length} รายการ) --</option>
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
                                    {allowedCompanies.map(cid => (
                                        <option key={cid} value={cid}>{cid}. {companyNames[cid] || `Company ${cid}`}</option>
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
            {executionError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">เกิดข้อผิดพลาดในการดึงข้อมูล</h4>
                        <p className="text-sm opacity-90">{executionError}</p>
                    </div>
                </div>
            )}

            {/* Data Grid Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">

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
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
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
        </div>
    );
}
