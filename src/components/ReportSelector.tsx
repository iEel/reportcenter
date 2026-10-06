"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, FileText, Loader2, Search, Star, X } from 'lucide-react';
import { activeIndexForQuery, filterReports, getNextActiveIndex, groupReports, splitSearchMatches, type StandardReport } from '@/lib/report-selector';

interface ReportSelectorProps {
    reports: StandardReport[];
    selectedReportId: string;
    favoriteIds: number[];
    isLoading: boolean;
    disabled?: boolean;
    onSelect: (reportId: string) => void;
    onToggleFavorite: (reportId: number) => void | Promise<void>;
}

const categoryColors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
    violet: 'bg-violet-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500', slate: 'bg-slate-400',
    indigo: 'bg-indigo-500', teal: 'bg-teal-500', purple: 'bg-purple-500', pink: 'bg-pink-500',
};

function Match({ text, query }: { text: string; query: string }) {
    return <>{splitSearchMatches(text, query).map((part, index) => part.matched
        ? <mark key={index} className="rounded-sm bg-amber-100 text-inherit dark:bg-amber-900/60">{part.text}</mark>
        : <span key={index}>{part.text}</span>)}</>;
}

function Category({ name, color, query = '' }: { name: string; color?: string | null; query?: string }) {
    return <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${categoryColors[color || ''] || 'bg-slate-400'}`} />
        <span className="truncate"><span className="sr-only">หมวดรายงาน: </span><Match text={name} query={query} /></span>
    </span>;
}

export default function ReportSelector({ reports, selectedReportId, favoriteIds, isLoading, disabled = false, onSelect, onToggleFavorite }: ReportSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const selectedReport = reports.find(report => String(report.ReportId) === selectedReportId);
    const groups = useMemo(() => groupReports(filterReports(reports, query)), [reports, query]);
    const visible = useMemo(() => groups.flatMap(group => group.reports), [groups]);
    const isDisabled = disabled || isLoading;
    const open = isOpen && !isDisabled;

    useEffect(() => {
        const pointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false); setQuery(''); setActiveIndex(-1);
            }
        };
        document.addEventListener('pointerdown', pointerDown);
        return () => document.removeEventListener('pointerdown', pointerDown);
    }, []);

    useEffect(() => {
        if (open && activeIndex >= 0) document.getElementById(`${listboxId}-option-${visible[activeIndex]?.ReportId}`)?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex, listboxId, visible]);

    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (isDisabled || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
                target?.closest('input, textarea, select, [contenteditable], [role="combobox"], [role="textbox"]') || document.querySelector('dialog[open]')) return;
            event.preventDefault();
            setQuery(''); setActiveIndex(-1); setIsOpen(true); inputRef.current?.focus();
        };
        document.addEventListener('keydown', shortcut);
        return () => document.removeEventListener('keydown', shortcut);
    }, [isDisabled]);

    const openSelector = () => {
        if (isDisabled) return;
        if (!isOpen) setActiveIndex(visible.findIndex(report => String(report.ReportId) === selectedReportId));
        setIsOpen(true);
    };
    const close = () => { setIsOpen(false); setQuery(''); setActiveIndex(-1); };
    const selectReport = (report: StandardReport | undefined) => {
        if (isDisabled || !report) return;
        onSelect(String(report.ReportId)); close();
    };
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || isDisabled) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setIsOpen(true);
            setActiveIndex(current => getNextActiveIndex(current, visible.length, event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Enter' && open && activeIndex >= 0) {
            event.preventDefault(); selectReport(visible[activeIndex]);
        } else if (event.key === 'Tab' || event.key === 'Escape') {
            if (event.key === 'Escape' && open) event.preventDefault();
            close();
        }
    };
    const clearSelection = () => {
        if (isDisabled) return;
        onSelect(''); close(); inputRef.current?.focus();
    };

    return <div ref={rootRef} className="w-full" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
        <label htmlFor={`${listboxId}-input`} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            รายงาน {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="กำลังโหลดรายงาน" />}
        </label>
        <div className="flex items-start gap-2">
            <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
                <input ref={inputRef} id={`${listboxId}-input`} role="combobox" type="text" autoComplete="off"
                    value={open ? query : selectedReport?.ReportName ?? ''} title={!open ? selectedReport?.ReportName : undefined}
                    placeholder={isLoading ? 'กำลังโหลดรายงาน…' : 'ค้นหาหรือเลือกรายงาน…'} disabled={isDisabled}
                    aria-expanded={open} aria-controls={open ? listboxId : undefined} aria-autocomplete="list"
                    aria-keyshortcuts="/" aria-activedescendant={open && activeIndex >= 0 && visible[activeIndex] ? `${listboxId}-option-${visible[activeIndex].ReportId}` : undefined}
                    onFocus={openSelector} onClick={openSelector} onKeyDown={handleKeyDown}
                    onChange={event => { const next = event.target.value; setQuery(next); setActiveIndex(activeIndexForQuery(next, filterReports(reports, next).length)); setIsOpen(true); }}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
                {!selectedReport && !open && <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-3 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-400 dark:border-slate-600">/</kbd>}
                {selectedReport && !open && <button type="button" onClick={clearSelection} disabled={isDisabled} aria-label="ล้างรายงานที่เลือก"
                    className="absolute right-1 top-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:text-slate-100"><X className="h-4 w-4" aria-hidden="true" /></button>}
                {open && <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
                    <div id={listboxId} role="listbox" aria-label="รายงานมาตรฐาน" className="max-h-[min(360px,45dvh)] overflow-y-auto overscroll-contain py-1">
                        {!visible.length ? <div role="status" className="px-4 py-7 text-center text-sm text-slate-500">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{!reports.length ? 'ยังไม่มีรายงานที่พร้อมใช้งาน' : 'ไม่พบรายงานที่ค้นหา'}</p>
                            {!!reports.length && <p className="mt-1 text-xs">ลองค้นหาจากชื่อ คำอธิบาย หรือหมวดรายงาน</p>}
                        </div> : groups.map(group => <div key={group.category} role="group" aria-label={`หมวดรายงาน: ${group.category}`}>
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-y border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                <Category name={group.category} color={group.reports[0]?.CategoryColor} query={query} />
                                <span className="shrink-0 text-xs text-slate-500">{group.reports.length} รายงาน</span>
                            </div>
                            {group.reports.map(report => {
                                const index = visible.findIndex(item => item.ReportId === report.ReportId);
                                const selected = String(report.ReportId) === selectedReportId;
                                const active = index === activeIndex;
                                return <div key={report.ReportId} id={`${listboxId}-option-${report.ReportId}`} role="option" aria-selected={selected}
                                    onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => selectReport(report)}
                                    className={`flex cursor-pointer items-start gap-2.5 px-3 py-3 text-sm ${active ? 'bg-blue-50 dark:bg-blue-950' : selected ? 'bg-slate-50 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">
                                        <span className="break-words font-medium text-slate-800 dark:text-slate-100"><Match text={report.ReportName} query={query} /></span>
                                        {favoriteIds.includes(report.ReportId) && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-label="รายการโปรด" />}
                                        {report.IsHeavy && <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">ข้อมูลขนาดใหญ่</span>}
                                    </div>{report.Description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500"><Match text={report.Description} query={query} /></p>}</div>
                                    {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />}
                                </div>;
                            })}
                        </div>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                        <span><kbd>↑ ↓</kbd> เลือก</span><span><kbd>Enter</kbd> เปิดรายงาน</span><span><kbd>Esc</kbd> ปิด</span><span className="ml-auto">{visible.length} รายงาน</span>
                    </div>
                </div>}
            </div>
            {selectedReport && <button type="button" onClick={() => void onToggleFavorite(selectedReport.ReportId)} disabled={isDisabled}
                aria-pressed={favoriteIds.includes(selectedReport.ReportId)} aria-label={favoriteIds.includes(selectedReport.ReportId) ? 'นำรายงานนี้ออกจากรายการโปรด' : 'เพิ่มรายงานนี้เป็นรายการโปรด'}
                className={`flex h-12 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${favoriteIds.includes(selectedReport.ReportId) ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                <Star className={`h-5 w-5 ${favoriteIds.includes(selectedReport.ReportId) ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>}
        </div>
        {selectedReport && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Category name={selectedReport.CategoryName?.trim() || 'ยังไม่จัดหมวด'} color={selectedReport.CategoryColor} />
            {selectedReport.IsHeavy && <span className="rounded-md border border-amber-200 px-1.5 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:text-amber-200">ข้อมูลขนาดใหญ่</span>}
            {selectedReport.Description && <p className="min-w-0 basis-64 flex-1 text-xs leading-5 text-slate-500">{selectedReport.Description}</p>}
        </div>}
    </div>;
}
