"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Loader2, Search, Star, Tag, X } from 'lucide-react';
import {
    filterReports,
    getNextActiveIndex,
    groupReports,
    type StandardReport,
} from '@/lib/report-selector';

interface ReportSelectorProps {
    reports: StandardReport[];
    selectedReportId: string;
    favoriteIds: number[];
    isLoading: boolean;
    disabled?: boolean;
    onSelect: (reportId: string) => void;
    onToggleFavorite: (reportId: number) => void | Promise<void>;
}

export default function ReportSelector({
    reports,
    selectedReportId,
    favoriteIds,
    isLoading,
    disabled = false,
    onSelect,
    onToggleFavorite,
}: ReportSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();

    const selectedReport = reports.find((report) => report.ReportId.toString() === selectedReportId);
    const groupedReports = useMemo(
        () => groupReports(filterReports(reports, query)),
        [query, reports],
    );
    const visibleReports = useMemo(
        () => groupedReports.flatMap((group) => group.reports),
        [groupedReports],
    );
    const isDisabled = disabled || isLoading;

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery('');
                setActiveIndex(-1);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const openSelector = () => {
        if (isDisabled) return;
        if (!isOpen) {
            setActiveIndex(visibleReports.findIndex(
                (report) => report.ReportId.toString() === selectedReportId,
            ));
        }
        setIsOpen(true);
    };

    const selectReport = (report: StandardReport) => {
        onSelect(report.ReportId.toString());
        setQuery('');
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            setActiveIndex((current) => getNextActiveIndex(
                current,
                visibleReports.length,
                event.key === 'ArrowDown' ? 1 : -1,
            ));
            return;
        }

        if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
            event.preventDefault();
            selectReport(visibleReports[activeIndex]);
            return;
        }

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            setIsOpen(false);
            setQuery('');
            setActiveIndex(-1);
        }
    };

    const clearSelection = () => {
        onSelect('');
        setQuery('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const inputValue = isOpen ? query : selectedReport?.ReportName ?? '';

    return (
        <div ref={rootRef} className="w-full">
            <label
                htmlFor={`${listboxId}-input`}
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
                <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
                เลือกรายงานมาตรฐาน
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="กำลังโหลดรายงาน" />}
            </label>

            <div className="flex items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                    />
                    <input
                        ref={inputRef}
                        id={`${listboxId}-input`}
                        role="combobox"
                        type="text"
                        value={inputValue}
                        title={!isOpen ? selectedReport?.ReportName : undefined}
                        placeholder={isLoading ? 'กำลังโหลดรายงาน...' : 'ค้นหาชื่อ คำอธิบาย หรือหมวดหมู่...'}
                        disabled={isDisabled}
                        aria-expanded={isOpen}
                        aria-controls={listboxId}
                        aria-autocomplete="list"
                        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${visibleReports[activeIndex]?.ReportId}` : undefined}
                        onFocus={openSelector}
                        onClick={openSelector}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActiveIndex(-1);
                            setIsOpen(true);
                        }}
                        onKeyDown={handleKeyDown}
                        className="h-11 w-full truncate rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-20 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
                        {selectedReport && !isOpen && (
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                aria-label="ล้างรายงานที่เลือก"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <ChevronDown
                            className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </div>

                    {isOpen && (
                        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                            <div
                                id={listboxId}
                                role="listbox"
                                aria-label="รายงานมาตรฐาน"
                                className="max-h-80 overflow-y-auto py-1"
                            >
                                {!isLoading && reports.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                                        ยังไม่มีรายงานที่พร้อมใช้งาน
                                    </div>
                                ) : visibleReports.length === 0 ? (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-sm font-medium text-slate-700">ไม่พบรายงานที่ค้นหา</p>
                                        <p className="mt-1 text-xs text-slate-500">ลองค้นหาด้วยชื่อหรือหมวดหมู่อื่น</p>
                                    </div>
                                ) : (
                                    groupedReports.map((group) => (
                                        <div key={group.category}>
                                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-800">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                                                    หมวดหมู่: {group.category}
                                                </span>
                                                <span className="font-medium text-blue-600">{group.reports.length} รายงาน</span>
                                            </div>
                                            {group.reports.map((report) => {
                                                const reportIndex = visibleReports.findIndex((item) => item.ReportId === report.ReportId);
                                                const isSelected = report.ReportId.toString() === selectedReportId;
                                                const isActive = reportIndex === activeIndex;
                                                return (
                                                    <div
                                                        key={report.ReportId}
                                                        id={`${listboxId}-option-${report.ReportId}`}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        onMouseEnter={() => setActiveIndex(reportIndex)}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => selectReport(report)}
                                                        className={`group flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-3 transition-colors last:border-b-0 ${isActive
                                                            ? 'bg-blue-100'
                                                            : isSelected
                                                                ? 'bg-blue-50'
                                                                : 'hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <FileText
                                                            className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                                                            aria-hidden="true"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <span className={`truncate text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                                                    {report.ReportName}
                                                                </span>
                                                                {report.IsHeavy && (
                                                                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                                                        ข้อมูลขนาดใหญ่
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {report.Description && (
                                                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                                                    {report.Description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {selectedReport && (
                    <button
                        type="button"
                        onClick={() => void onToggleFavorite(selectedReport.ReportId)}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${favoriteIds.includes(selectedReport.ReportId)
                            ? 'border-amber-200 bg-amber-50 text-amber-500 hover:bg-amber-100'
                            : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-amber-500'
                            }`}
                        aria-label={favoriteIds.includes(selectedReport.ReportId) ? 'นำรายงานนี้ออกจากรายการโปรด' : 'เพิ่มรายงานนี้เป็นรายการโปรด'}
                        title={favoriteIds.includes(selectedReport.ReportId) ? 'นำออกจากรายการโปรด' : 'เพิ่มลงรายการโปรด'}
                    >
                        <Star className={`h-5 w-5 ${favoriteIds.includes(selectedReport.ReportId) ? 'fill-current' : ''}`} />
                    </button>
                )}
            </div>

            {selectedReport && (
                <div className="mt-2 flex flex-col items-start gap-1 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:gap-2">
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        หมวดหมู่: {selectedReport.CategoryName?.trim() || 'อื่น ๆ'}
                    </span>
                    {selectedReport.Description && (
                        <p className="w-full min-w-0 py-1 leading-5 sm:w-auto sm:flex-1">{selectedReport.Description}</p>
                    )}
                </div>
            )}
        </div>
    );
}
