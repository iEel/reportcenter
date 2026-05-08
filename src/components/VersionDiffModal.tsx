"use client"

import { X, GitCompareArrows, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";

interface VersionDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    oldVersion: {
        versionNumber: number;
        reportName: string;
        sql: string;
        changedByName?: string;
        createdAt?: string;
    };
    newVersion: {
        versionNumber: number | string;
        reportName: string;
        sql: string;
        changedByName?: string;
        createdAt?: string;
    };
}

interface DiffLine {
    type: 'same' | 'add' | 'remove';
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

/**
 * Simple line-by-line diff using LCS (Longest Common Subsequence) algorithm.
 * No external dependencies needed.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Build LCS table
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to produce diff
    const result: DiffLine[] = [];
    let i = m, j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.unshift({ type: 'same', content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'add', content: newLines[j - 1], newLineNum: j });
            j--;
        } else if (i > 0) {
            result.unshift({ type: 'remove', content: oldLines[i - 1], oldLineNum: i });
            i--;
        }
    }

    return result;
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    // MSSQL GETDATE() stores server local time but mssql driver treats it as UTC.
    // Use timeZone: 'UTC' to display the raw value without adding local offset again.
    return d.toLocaleDateString('th-TH', {
        timeZone: 'UTC',
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function VersionDiffModal({ isOpen, onClose, oldVersion, newVersion }: VersionDiffModalProps) {
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const diffLines = computeDiff(oldVersion.sql || '', newVersion.sql || '');
    const addCount = diffLines.filter(l => l.type === 'add').length;
    const removeCount = diffLines.filter(l => l.type === 'remove').length;

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <GitCompareArrows className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">เปรียบเทียบเวอร์ชัน</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="font-medium text-red-600">v{oldVersion.versionNumber}</span>
                                <ArrowRight className="w-3 h-3" />
                                <span className="font-medium text-emerald-600">
                                    {typeof newVersion.versionNumber === 'number' ? `v${newVersion.versionNumber}` : newVersion.versionNumber}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-semibold">
                                +{addCount} เพิ่ม
                            </span>
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md font-semibold">
                                −{removeCount} ลบ
                            </span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Version info bar */}
                <div className="grid grid-cols-2 border-b border-slate-200 text-xs shrink-0">
                    <div className="px-6 py-2 bg-red-50/50 border-r border-slate-200 text-red-700">
                        <span className="font-bold">v{oldVersion.versionNumber}</span>
                        {oldVersion.changedByName && <span className="ml-2 text-slate-500">โดย {oldVersion.changedByName}</span>}
                        {oldVersion.createdAt && <span className="ml-2 text-slate-400">{formatDate(oldVersion.createdAt)}</span>}
                    </div>
                    <div className="px-6 py-2 bg-emerald-50/50 text-emerald-700">
                        <span className="font-bold">
                            {typeof newVersion.versionNumber === 'number' ? `v${newVersion.versionNumber}` : newVersion.versionNumber}
                        </span>
                        {newVersion.changedByName && <span className="ml-2 text-slate-500">โดย {newVersion.changedByName}</span>}
                        {newVersion.createdAt && <span className="ml-2 text-slate-400">{formatDate(newVersion.createdAt)}</span>}
                    </div>
                </div>

                {/* Diff content */}
                <div className="flex-1 overflow-auto font-mono text-[13px] leading-6">
                    {diffLines.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">
                            ไม่มีการเปลี่ยนแปลง SQL
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <tbody>
                                {diffLines.map((line, idx) => (
                                    <tr
                                        key={idx}
                                        className={
                                            line.type === 'add'
                                                ? 'bg-emerald-50/80'
                                                : line.type === 'remove'
                                                    ? 'bg-red-50/80'
                                                    : 'hover:bg-slate-50/50'
                                        }
                                    >
                                        {/* Old line number */}
                                        <td className="w-12 text-right px-2 text-slate-400 select-none border-r border-slate-200 text-xs shrink-0">
                                            {line.type !== 'add' ? line.oldLineNum : ''}
                                        </td>
                                        {/* New line number */}
                                        <td className="w-12 text-right px-2 text-slate-400 select-none border-r border-slate-200 text-xs shrink-0">
                                            {line.type !== 'remove' ? line.newLineNum : ''}
                                        </td>
                                        {/* Sign */}
                                        <td className={`w-6 text-center select-none font-bold ${line.type === 'add' ? 'text-emerald-600' : line.type === 'remove' ? 'text-red-600' : 'text-transparent'}`}>
                                            {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                                        </td>
                                        {/* Content */}
                                        <td className={`px-3 whitespace-pre-wrap break-all ${line.type === 'add' ? 'text-emerald-900' : line.type === 'remove' ? 'text-red-900 line-through opacity-70' : 'text-slate-700'}`}>
                                            {line.content || ' '}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500">
                        {diffLines.length} บรรทัดทั้งหมด • {addCount} เพิ่ม • {removeCount} ลบ • {diffLines.length - addCount - removeCount} ไม่เปลี่ยน
                    </span>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition-colors font-medium">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
}
