"use client"

import { Search, Download, ChevronLeft, ChevronRight, RefreshCw, Loader2, AlertCircle, Star, Check, FileSpreadsheet, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import TypeaheadInput from "@/components/TypeaheadInput";
import ReportSelector from "@/components/ReportSelector";
import CompanySelector from "@/components/CompanySelector";
import Link from "next/link";
import { formatDate } from '@/lib/dateUtils';
import type { StandardReport } from '@/lib/report-selector';
import { exportOutcome, getRunBlocker, pickReportCompany, shouldConfirmEmptyConditions, startJobPolling } from '@/lib/standard-report';
import { downloadJobFile, triggerBrowserDownload } from '@/lib/file-download';

interface Report extends StandardReport { ReportType: number }
interface ReportParameter { ParameterId: number; ParameterName: string; DisplayLabel?: string; InputType: string; LookupQuery?: string | null }
interface ReportCompany { companyId: number; name: string; label: string }
const NO_COMPANIES: number[] = [];

export default function StandardReportPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedReportId, setSelectedReportId] = useState<string>('');
    const [parameters, setParameters] = useState<ReportParameter[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [isLoadingParams, setIsLoadingParams] = useState(false);
    const [paramsError, setParamsError] = useState<string | null>(null);
    const [paramsAttempt, setParamsAttempt] = useState(0);

    // Form parameter values
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [selectedCompany, setSelectedCompany] = useState('');

    // Data execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState('');
    const [exportElapsed, setExportElapsed] = useState(0);
    const exportTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [reportData, setReportData] = useState<Record<string, unknown>[] | null>(null);
    const [reportColumns, setReportColumns] = useState<string[]>([]);
    const [executionError, setExecutionError] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);

    // Favorites
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

    // Background Job state
    const [activeJob, setActiveJob] = useState<{ jobId: number; status: string; rowCount?: number; fileName?: string; error?: string; reportName?: string } | null>(null);
    const jobStartingRef = useRef(false);
    const stopPollRef = useRef<(() => void) | null>(null);
    const mountedRef = useRef(true);
    const exportAbortRef = useRef<AbortController | null>(null);
    useEffect(() => {
        mountedRef.current = true;
        // Leaving the page cancels an ordinary export: nothing is kept for later download
        return () => { mountedRef.current = false; stopPollRef.current?.(); exportAbortRef.current?.abort(); };
    }, []);
    // Paging re-runs the conditions of the last fresh run, not whatever the form holds now
    const lastRunParamsRef = useRef<Record<string, string>>({});

    const [companies, setCompanies] = useState<ReportCompany[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState(false);

    const allowedCompanies = user?.allowedCompanies || NO_COMPANIES;
    const companyChoices = companies.filter(company => allowedCompanies.includes(company.companyId));

    // Default to (and stay on) a company the user may read and the selector actually lists
    useEffect(() => {
        const next = pickReportCompany(selectedCompany, allowedCompanies, companiesLoaded ? companies.map(company => company.companyId) : null);
        if (next !== selectedCompany) setSelectedCompany(next);
    }, [allowedCompanies, companies, companiesLoaded, selectedCompany]);

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
                    setReports(reportsData.reports.filter((r: Report) => r.ReportType === 1));
                }
                if (favData.success) {
                    setFavoriteIds(favData.favorites.map((f: { ReportId: number }) => f.ReportId));
                }
                if (compData.success) {
                    setCompanies(compData.companies);
                    setCompaniesLoaded(true);
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

    // A new report owns a new set of conditions and results. Late responses are ignored.
    useEffect(() => {
        const controller = new AbortController();
        setParameters([]); setParamValues({}); setReportData(null); setExecutionError(null); setParamsError(null);
        setReportColumns([]); setTotalRows(0); setCurrentPage(1);
        if (!selectedReportId) { setIsLoadingParams(false); return; }
        const fetchParams = async () => {
            setIsLoadingParams(true);
            try {
                const res = await fetch(`/api/reports/parameters?reportId=${selectedReportId}`, { signal: controller.signal });
                const data = await res.json();
                if (controller.signal.aborted) return;
                if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถโหลดเงื่อนไขรายงานได้');
                setParameters(data.parameters);
                setParamValues(Object.fromEntries(data.parameters.map((parameter: { ParameterName: string }) => [parameter.ParameterName, ''])));
            } catch (error) {
                if (!controller.signal.aborted) setParamsError(error instanceof Error ? error.message : 'ไม่สามารถโหลดเงื่อนไขรายงานได้');
            } finally { if (!controller.signal.aborted) setIsLoadingParams(false); }
        };
        void fetchParams();
        return () => controller.abort();
    }, [selectedReportId, paramsAttempt]);

    const hasCompanyChoices = companiesLoaded ? companyChoices.length > 0 : allowedCompanies.length > 0;
    const runBlocker = getRunBlocker({ reportId: selectedReportId, company: selectedCompany, isLoadingParams, paramsError, hasCompanyChoices });
    const jobRunning = activeJob?.status === 'running';

    const handleParamChange = (paramName: string, value: string) => {
        setParamValues(prev => ({ ...prev, [paramName]: value }));
    };

    // requestedPage is set when paging through results already fetched; the size is passed explicitly
    // because a page-size change calls this before React has applied the new state.
    const handleExecuteReport = async (requestedPage?: number, requestedPageSize = pageSize) => {
        if (runBlocker) {
            toast(runBlocker, 'info');
            return;
        }

        // IsHeavy reports: warn that preview is limited, suggest Export
        const report = reports.find(r => r.ReportId.toString() === selectedReportId);
        if (report?.IsHeavy && !requestedPage) {
            const confirmed = window.confirm(
                '⚠️ รายงานนี้ถูกตั้งเป็น "รายงานขนาดใหญ่"\n\n' +
                'การดึงข้อมูลจะแสดง 50 แถวแรก\n' +
                'หากต้องการข้อมูลทั้งหมด ใช้ปุ่ม "สร้างไฟล์เบื้องหลัง (CSV)"\n\n' +
                'ต้องการดึงข้อมูลต่อหรือไม่?'
            );
            if (!confirmed) return;
        }

        if (shouldConfirmEmptyConditions(paramValues, parameters.length, requestedPage !== undefined)) {
            const confirmRun = window.confirm("ยังไม่ได้กรอกเงื่อนไขบางช่อง ต้องการดำเนินการต่อหรือไม่?");
            if (!confirmRun) return;
        }

        const pg = requestedPage || 1;
        if (requestedPage === undefined) lastRunParamsRef.current = { ...paramValues };
        const runParams = lastRunParamsRef.current;
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
                    parameters: runParams,
                    page: pg,
                    pageSize: requestedPageSize,
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
        } catch (error) {
            setExecutionError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + (error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'));
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

    // One entry point for every background export, so a second click or the results-bar button
    // cannot start a duplicate job while one is running.
    const startBackgroundJob = async () => {
        if (runBlocker) {
            toast(runBlocker, 'info');
            return;
        }
        if (jobStartingRef.current || jobRunning) {
            toast('มีไฟล์กำลังสร้างอยู่ กรุณารอให้เสร็จก่อน', 'info');
            return;
        }
        jobStartingRef.current = true;
        const reportName = reports.find(r => String(r.ReportId) === selectedReportId)?.ReportName;
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
            if (!data.success) {
                toast(data.message || 'ไม่สามารถสร้าง Job ได้', 'error');
                return;
            }
            // The job keeps running on the server; if the user already left this page, history shows the result
            if (!mountedRef.current) return;
            setActiveJob({ jobId: data.jobId, status: 'running', reportName });
            toast('กำลังสร้างรายงานในพื้นหลัง...', 'info');
            stopPollRef.current?.();
            stopPollRef.current = startJobPolling<{ status: string; rowCount?: number; error?: string }>({
                check: async () => {
                    const jr = await fetch(`/api/reports/jobs/${data.jobId}`);
                    const jd = await jr.json();
                    return jr.ok && jd.success ? jd.job : null;
                },
                onJob: job => setActiveJob({ ...job, jobId: data.jobId, reportName }),
                onStop: (outcome, job) => {
                    stopPollRef.current = null;
                    if (outcome === 'done') toast(`รายงานพร้อมดาวน์โหลด (${(job?.rowCount ?? 0).toLocaleString()} แถว)`, 'success');
                    else if (outcome === 'failed') toast(`สร้างรายงานไม่สำเร็จ: ${job?.error}`, 'error');
                    else if (outcome === 'cancelled') toast('งานสร้างไฟล์ถูกยกเลิกแล้ว', 'info');
                    else {
                        setActiveJob(current => current && { ...current, status: 'unknown' });
                        toast('ตรวจสถานะงานไม่สำเร็จ ดูผลได้ที่ประวัติ', 'error');
                    }
                },
            });
        } catch {
            toast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        } finally {
            jobStartingRef.current = false;
        }
    };

    const handleExportExcel = async () => {
        if (!selectedReportId || isExporting) return;
        const report = reports.find(r => r.ReportId.toString() === selectedReportId);

        // IsHeavy → background job (same guarded path as the conditions-area button)
        if (report?.IsHeavy) {
            await startBackgroundJob();
            return;
        }

        // The server streams the rows into a temporary .xlsx; the browser only downloads the file
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setIsExporting(true);
        setExportElapsed(0);
        setExportStatus('กำลังสร้างไฟล์ Excel…');
        const startTime = Date.now();
        exportTimerRef.current = setInterval(() => {
            setExportElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        try {
            const res = await fetch('/api/reports/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: selectedReportId, companyId: selectedCompany, parameters: paramValues }),
                signal: controller.signal,
            });
            const outcome = exportOutcome(await res.json());
            if (outcome.kind === 'error') toast(outcome.message, 'error');
            else if (outcome.kind === 'empty') toast('ไม่มีข้อมูลให้ส่งออก', 'info');
            else {
                triggerBrowserDownload(outcome.url);
                toast(`ส่งออก ${outcome.rowCount.toLocaleString()} รายการเรียบร้อย`, 'success');
            }
        } catch {
            if (mountedRef.current) {
                if (controller.signal.aborted) toast('ยกเลิกการส่งออกแล้ว', 'info');
                else toast('ไม่สามารถส่งออกข้อมูลได้', 'error');
            }
        } finally {
            if (exportTimerRef.current) {
                clearInterval(exportTimerRef.current);
                exportTimerRef.current = null;
            }
            exportAbortRef.current = null;
            if (mountedRef.current) setIsExporting(false);
        }
    };

    const cancelExport = () => exportAbortRef.current?.abort();

    const handleJobDownload = async () => {
        if (!activeJob?.jobId) return;
        const result = await downloadJobFile(activeJob.jobId);
        if (!result.ok) toast(result.message, 'error');
    };


    const selectedReport = reports.find(report => String(report.ReportId) === selectedReportId);
    const favorites = reports.filter(report => favoriteIds.includes(report.ReportId));
    const stepIndex = selectedReportId ? 1 : 0;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    const secondaryButton = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
    const inputClass = "block h-11 w-full min-w-0 self-start rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
    const conditionFieldClass = "row-span-3 grid min-w-0 grid-rows-subgrid";
    const conditionLabelClass = "block self-end text-[13px] font-medium leading-5 text-slate-700 dark:text-slate-200";

    return (
        <div className="min-w-0 space-y-[18px]">
            <header>
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white">รายงานมาตรฐาน</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">เลือกรายงาน กรอกเงื่อนไขของรายงานนั้น แล้วกดดึงข้อมูล</p>
            </header>

            <section className="min-w-0 space-y-[18px] rounded-xl border border-slate-200 bg-white px-5 py-[18px] shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="เลือกรายงานและเงื่อนไข">
                <ReportSelector reports={reports} selectedReportId={selectedReportId} favoriteIds={favoriteIds} isLoading={isLoadingReports}
                    disabled={isExecuting || isExporting} onSelect={setSelectedReportId} onToggleFavorite={toggleFavorite} />

                {favorites.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="รายการโปรด">
                        <span className="inline-flex min-w-[110px] items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                            <Star className="h-3.5 w-3.5" aria-hidden="true" />รายการโปรด
                        </span>
                        {favorites.map(report => (
                            <button key={report.ReportId} type="button" onClick={() => setSelectedReportId(String(report.ReportId))}
                                disabled={isExecuting || isExporting} aria-pressed={selectedReportId === String(report.ReportId)}
                                className={"inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 " + (selectedReportId === String(report.ReportId)
                                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200"
                                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")}>
                                <span className="break-words">{report.ReportName}</span>
                            </button>
                        ))}
                    </div>
                )}

                {selectedReportId && (
                    <section className="space-y-3.5 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="report-conditions-title">
                        <h2 id="report-conditions-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">เงื่อนไขของรายงาน</h2>
                        {isLoadingParams ? (
                            <div className="flex items-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400" role="status">
                                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />กำลังโหลดเงื่อนไขรายงาน…
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-x-4 gap-y-1.5">
                                    <div className={conditionFieldClass}>
                                        <label htmlFor="report-company" className={conditionLabelClass}>บริษัท <span className="text-red-600">*</span></label>
                                        <CompanySelector id="report-company" companies={companyChoices}
                                            value={selectedCompany} onChange={setSelectedCompany} disabled={isExecuting || isExporting} />
                                        {!hasCompanyChoices
                                            ? <p className="text-xs text-amber-700 dark:text-amber-300">ไม่มีบริษัทที่คุณได้รับสิทธิ์ ติดต่อผู้ดูแลระบบ</p>
                                            : !companiesLoaded && !isLoadingReports
                                                ? <p className="text-xs text-amber-700 dark:text-amber-300">โหลดรายชื่อบริษัทไม่สำเร็จ จะดึงข้อมูลจากบริษัท #{selectedCompany} รีเฟรชหน้าเพื่อเลือกบริษัทอื่น</p>
                                                : <p className="text-xs text-slate-500 dark:text-slate-400">แสดงเฉพาะบริษัทที่คุณได้รับสิทธิ์</p>}
                                    </div>
                                    {paramsError && (
                                        <div role="alert" className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                                            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">โหลดเงื่อนไขรายงานไม่สำเร็จ: {paramsError}</span>
                                            <button type="button" onClick={() => setParamsAttempt(attempt => attempt + 1)} className="font-medium underline focus-visible:outline-2 focus-visible:outline-blue-600">ลองใหม่</button>
                                        </div>
                                    )}
                                    {parameters.map(param => (
                                        <div key={param.ParameterId} className={conditionFieldClass}>
                                            <label htmlFor={"report-param-" + param.ParameterId} className={conditionLabelClass}>{param.DisplayLabel || param.ParameterName}</label>
                                            {param.InputType === 'date' || param.InputType === 'number' ? (
                                                <input id={"report-param-" + param.ParameterId} type={param.InputType} value={paramValues[param.ParameterName] || ''}
                                                    onChange={event => handleParamChange(param.ParameterName, event.target.value)} className={inputClass} />
                                            ) : param.LookupQuery ? (
                                                <TypeaheadInput id={"report-param-" + param.ParameterId} reportId={selectedReportId} paramName={param.ParameterName}
                                                    companyId={selectedCompany} value={paramValues[param.ParameterName] || ''} onChange={value => handleParamChange(param.ParameterName, value)}
                                                    placeholder={"ค้นหา " + (param.DisplayLabel || param.ParameterName) + "..."}
                                                    className="block h-11 min-w-0 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                                            ) : (
                                                <input id={"report-param-" + param.ParameterId} type="text" value={paramValues[param.ParameterName] || ''}
                                                    onChange={event => handleParamChange(param.ParameterName, event.target.value)} className={inputClass} />
                                            )}
                                        </div>
                                    ))}
                                    {!parameters.length && !paramsError && <div className={conditionFieldClass}><span className={conditionLabelClass}>เงื่อนไขเพิ่มเติม</span><p className="self-center text-xs text-slate-500 dark:text-slate-400">รายงานนี้ไม่มีเงื่อนไขอื่น</p></div>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                    <button type="button" onClick={() => handleExecuteReport()} disabled={isExecuting || !!runBlocker}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3.5 text-[13.5px] font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
                                        {isExecuting ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                                        {isExecuting ? 'กำลังดึงข้อมูล…' : 'ดึงข้อมูล'}
                                    </button>
                                    {selectedReport?.IsHeavy && (
                                        <>
                                            <button type="button" onClick={() => void startBackgroundJob()} disabled={jobRunning || !!runBlocker} className={secondaryButton}>
                                                {jobRunning ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                                                {jobRunning ? 'กำลังสร้างไฟล์…' : 'สร้างไฟล์เบื้องหลัง (CSV)'}
                                            </button>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">รายงานนี้ข้อมูลมาก สร้างไฟล์แล้วดาวน์โหลดจากประวัติได้</span>
                                        </>
                                    )}
                                    {runBlocker && !paramsError && <span className="text-xs text-amber-700 dark:text-amber-300">{runBlocker}</span>}
                                </div>
                            </>
                        )}
                    </section>
                )}
            </section>

            {activeJob && (
                <div role="status" className={"flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm " + (activeJob.status === 'running'
                    ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    : activeJob.status === 'done' ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : activeJob.status === 'failed' ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200")}>
                    {activeJob.status === 'running' ? <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
                        : activeJob.status === 'done' ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                        {activeJob.status === 'running' && <>กำลังสร้างไฟล์ <strong>{activeJob.reportName || 'รายงาน'}</strong> เบื้องหลัง ใช้หน้าอื่นต่อได้ระหว่างรอ</>}
                        {activeJob.status === 'done' && <>ไฟล์ <strong>{activeJob.reportName || activeJob.fileName || 'รายงาน'}</strong> พร้อมแล้ว{activeJob.rowCount != null ? " · " + activeJob.rowCount.toLocaleString() + " แถว" : ''}</>}
                        {activeJob.status === 'failed' && <>สร้างไฟล์ <strong>{activeJob.reportName || 'รายงาน'}</strong> ไม่สำเร็จ: {activeJob.error}</>}
                        {activeJob.status === 'cancelled' && <>งานสร้างไฟล์ <strong>{activeJob.reportName || 'รายงาน'}</strong> ถูกยกเลิกแล้ว</>}
                        {activeJob.status === 'unknown' && <>ตรวจสถานะงานสร้างไฟล์ <strong>{activeJob.reportName || 'รายงาน'}</strong> ไม่สำเร็จ ดูผลล่าสุดได้ที่ประวัติ</>}
                    </div>
                    {activeJob.status === 'done' && <button type="button" onClick={handleJobDownload} className={secondaryButton}><Download className="h-4 w-4" aria-hidden="true" />ดาวน์โหลด</button>}
                    <Link href="/reports/job-history" className={secondaryButton}>ดูประวัติ</Link>
                    {activeJob.status !== 'running' && <button type="button" onClick={() => setActiveJob(null)} aria-label="ปิดสถานะการสร้างไฟล์" className="rounded-lg p-2 hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-4 w-4" aria-hidden="true" /></button>}
                </div>
            )}

            {executionError && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div><p className="font-semibold">เกิดข้อผิดพลาดในการดึงข้อมูล</p><p className="mt-1">{executionError}</p></div>
                </div>
            )}

            <section aria-label="ผลลัพธ์" aria-busy={isExecuting} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="text-[13.5px] text-slate-600 dark:text-slate-300" role="status">
                        {isExecuting ? 'กำลังดึงข้อมูล…' : reportData
                            ? <>พบ <strong className="font-semibold tabular-nums">{totalRows.toLocaleString()}</strong> รายการ · หน้า {currentPage} จาก {pageCount}</>
                            : selectedReportId ? 'ยังไม่ได้ดึงข้อมูล' : 'ยังไม่ได้เลือกรายงาน'}
                    </p>
                    <button type="button" onClick={handleExportExcel} disabled={!reportData || reportData.length === 0 || isExporting || isExecuting || (!!selectedReport?.IsHeavy && jobRunning)}
                        className={secondaryButton + " !h-[30px] !rounded-[7px] !px-2.5 !text-[12.5px]"}>
                        {isExporting ? <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                        {isExporting ? 'กำลังส่งออก…' : selectedReport?.IsHeavy ? 'ส่งออก CSV' : 'ส่งออก Excel (.xlsx)'}
                    </button>
                </div>

                {isExecuting ? (
                    <div className="space-y-3 px-5 py-6" aria-hidden="true">{[92, 85, 78, 71, 64, 57].map(width => <div key={width} style={{ width: width + '%' }} className="h-3.5 rounded-md bg-slate-100 motion-safe:animate-pulse dark:bg-slate-700" />)}</div>
                ) : !reportData ? (
                    <div className="flex flex-col items-center gap-3 px-5 py-11 text-center text-sm text-slate-500 dark:text-slate-400">
                        <ol aria-label="ขั้นตอนการเรียกรายงาน" className="mb-1 flex flex-wrap items-center justify-center gap-2">
                            {['เลือกรายงาน', 'กรอกเงื่อนไข', 'ดึงข้อมูล'].map((label, index) => (
                                <li key={label} className="inline-flex items-center gap-2">
                                    {index > 0 && <span className="h-px w-[18px] bg-slate-200 dark:bg-slate-600" aria-hidden="true" />}
                                    <span aria-current={index === stepIndex ? 'step' : undefined} className={"inline-flex h-8 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] font-medium " + (index === stepIndex
                                        ? "border-blue-500 text-slate-800 dark:text-slate-100" : "border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400")}>
                                        <span className={"grid h-[22px] w-[22px] place-items-center rounded-full text-xs font-bold " + (index < stepIndex
                                            ? "bg-emerald-600 text-white" : index === stepIndex ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300")}>
                                            {index < stepIndex ? <Check className="h-3 w-3" aria-label="เสร็จแล้ว" /> : index + 1}
                                        </span>{label}
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{selectedReportId ? 'กรอกเงื่อนไข แล้วกดดึงข้อมูล' : 'เลือกรายงานที่ต้องการ'}</h3>
                        <p className="max-w-[52ch] leading-relaxed">{selectedReportId
                            ? <>ผลของ <strong className="font-semibold">{selectedReport?.ReportName}</strong> จะแสดงที่นี่ และส่งออกได้หลังดึงข้อมูล</>
                            : 'ค้นหาจากชื่อ คำอธิบาย หรือหมวด หรือกดรายการโปรดด้านบน'}</p>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="px-5 py-11 text-center text-sm text-slate-500 dark:text-slate-400">ไม่พบข้อมูลตามเงื่อนไขที่ระบุ</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full whitespace-nowrap text-left text-[13px]">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[12.5px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                                <tr><th className="w-14 px-3.5 py-2.5 text-center">#</th>{columns.map((column, index) => <th key={index} className="px-3.5 py-2.5">{column}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-700 dark:text-slate-200">
                                {reportData.map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                                    <td className="px-3.5 py-[11px] text-center font-mono text-xs text-slate-400">{(currentPage - 1) * pageSize + rowIndex + 1}</td>
                                    {columns.map((column, columnIndex) => {
                                        const value = row[column];
                                        const isDate = value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/));
                                        return <td key={columnIndex} className="px-3.5 py-[11px]">{isDate ? formatDate(value as Date | string) : value === null ? '-' : String(value)}</td>;
                                    })}
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                )}

                {reportData && reportData.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-[12.5px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <span className="tabular-nums">แสดง {((currentPage - 1) * pageSize + 1).toLocaleString()}–{Math.min(currentPage * pageSize, totalRows).toLocaleString()} จาก {totalRows.toLocaleString()} รายการ</span>
                        {totalRows > pageSize && <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2">รายการ/หน้า<select value={pageSize} onChange={event => { const size = Number(event.target.value); setPageSize(size); void handleExecuteReport(1, size); }} className="h-[30px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
                            <button type="button" aria-label="หน้าก่อน" onClick={() => handleExecuteReport(currentPage - 1)} disabled={currentPage <= 1 || isExecuting} className={secondaryButton + " !h-[30px] !px-2"}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                            <span className="tabular-nums">หน้า {currentPage} / {pageCount}</span>
                            <button type="button" aria-label="หน้าถัดไป" onClick={() => handleExecuteReport(currentPage + 1)} disabled={currentPage >= pageCount || isExecuting} className={secondaryButton + " !h-[30px] !px-2"}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                        </div>}
                    </div>
                )}
            </section>

            {isExporting && (
                <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800">
                        <Loader2 className="mx-auto h-6 w-6 text-blue-600 motion-safe:animate-spin" aria-hidden="true" />
                        <h2 className="font-semibold text-slate-900 dark:text-white">กำลังส่งออกไฟล์</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{exportStatus}</p>
                        <p className="font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">{Math.floor(exportElapsed / 60).toString().padStart(2, '0')}:{(exportElapsed % 60).toString().padStart(2, '0')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ถ้าปิดหน้านี้ การส่งออกจะถูกยกเลิก</p>
                        <button type="button" onClick={cancelExport} className={secondaryButton}>ยกเลิก</button>
                    </div>
                </div>
            )}
        </div>
    );
}
