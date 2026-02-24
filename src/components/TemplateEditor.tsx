"use client"

import { useState, useRef, useMemo, useCallback } from "react";
import { Code, Eye, Edit3, MousePointerClick, CheckCircle2, Bold, Underline, Italic, Strikethrough, List, Minus } from "lucide-react";

interface TemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    sqlQuery: string;
}

export default function TemplateEditor({ value, onChange, sqlQuery }: TemplateEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');

    // Parse SQL SELECT columns
    const availableFields = useMemo(() => {
        if (!sqlQuery) return [];
        try {
            // Strip SQL comments to prevent false FROM matches (e.g. "-- Detail from TableX")
            const cleanSql = sqlQuery
                .replace(/--[^\n]*/g, '')           // Remove single-line comments
                .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove block comments

            // Match columns from SELECT ... FROM (first occurrence)
            const selectMatch = cleanSql.match(/SELECT\s+([\s\S]*?)\s+FROM\b/i);
            if (!selectMatch) return [];

            const selectClause = selectMatch[1];

            // Handle SELECT *
            if (selectClause.trim() === '*') return [];

            // Parenthesis-aware comma split: only split at top-level commas
            const parts: string[] = [];
            let depth = 0;
            let current = '';
            for (const ch of selectClause) {
                if (ch === '(') depth++;
                else if (ch === ')') depth--;
                else if (ch === ',' && depth === 0) {
                    parts.push(current.trim());
                    current = '';
                    continue;
                }
                current += ch;
            }
            if (current.trim()) parts.push(current.trim());

            // Extract column name or alias from each part
            const columns = parts.map(col => {
                const trimmed = col.trim();

                // Handle: ... AS [Alias] or ... AS Alias
                const asMatch = trimmed.match(/\bAS\s+\[?([^\]\s]+)\]?\s*$/i);
                if (asMatch) return asMatch[1].trim();

                // Simple column: just a word or [word]
                const simpleMatch = trimmed.match(/^\[?(\w+)\]?$/);
                if (simpleMatch) return simpleMatch[1];

                // table.Column
                const dotMatch = trimmed.match(/\.(\w+)\s*$/);
                if (dotMatch) return dotMatch[1];

                // Expression without AS — last word after ) might be implicit alias
                const implicitAlias = trimmed.match(/\)\s+\[?(\w+)\]?\s*$/);
                if (implicitAlias) return implicitAlias[1];

                // Fallback: if simple name
                if (/^\w+$/.test(trimmed)) return trimmed;

                return null;
            }).filter(Boolean) as string[];

            // Dedupe
            return [...new Set(columns)];
        } catch {
            return [];
        }
    }, [sqlQuery]);

    // Which fields are already used in the template
    const usedFields = useMemo(() => {
        const matches = value.match(/\{\{(\w+)\}\}/g) || [];
        return new Set(matches.map(m => m.replace(/[{}]/g, '')));
    }, [value]);

    // Insert field at cursor position
    const insertField = useCallback((fieldName: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            onChange(value + `{{${fieldName}}}`);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const tag = `{{${fieldName}}}`;
        const newValue = value.substring(0, start) + tag + value.substring(end);
        onChange(newValue);

        // Restore cursor position after the inserted tag
        requestAnimationFrame(() => {
            textarea.focus();
            const newPos = start + tag.length;
            textarea.setSelectionRange(newPos, newPos);
        });
    }, [value, onChange]);

    // Wrap selected text with formatting markers, or insert placeholder
    const applyFormat = useCallback((prefix: string, suffix: string, placeholder: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = value.substring(start, end);

        let newValue: string;
        let newCursorStart: number;
        let newCursorEnd: number;

        if (selected) {
            // Wrap selection
            newValue = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
            newCursorStart = start + prefix.length;
            newCursorEnd = newCursorStart + selected.length;
        } else {
            // Insert placeholder
            newValue = value.substring(0, start) + prefix + placeholder + suffix + value.substring(end);
            newCursorStart = start + prefix.length;
            newCursorEnd = newCursorStart + placeholder.length;
        }

        onChange(newValue);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorStart, newCursorEnd);
        });
    }, [value, onChange]);

    // Format buttons config
    const formatButtons = [
        { icon: Bold, label: 'ตัวหนา', prefix: '*', suffix: '*', placeholder: 'ข้อความตัวหนา', shortcut: 'Ctrl+B' },
        { icon: Underline, label: 'ขีดเส้นใต้', prefix: '_', suffix: '_', placeholder: 'ข้อความขีดเส้นใต้', shortcut: 'Ctrl+U' },
        { icon: Italic, label: 'ตัวเอียง', prefix: '~', suffix: '~', placeholder: 'ข้อความตัวเอียง', shortcut: 'Ctrl+I' },
        { icon: Strikethrough, label: 'ขีดฆ่า', prefix: '~~', suffix: '~~', placeholder: 'ข้อความขีดฆ่า', shortcut: '' },
    ];

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;

        switch (e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                applyFormat('*', '*', 'ข้อความตัวหนา');
                break;
            case 'u':
                e.preventDefault();
                applyFormat('_', '_', 'ข้อความขีดเส้นใต้');
                break;
            case 'i':
                e.preventDefault();
                applyFormat('~', '~', 'ข้อความตัวเอียง');
                break;
        }
    }, [applyFormat]);

    // Preview: replace formatting markers + {{Field}} with styled HTML
    const previewHtml = useMemo(() => {
        let html = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Apply formatting (order matters: strikethrough first since it uses ~~)
        html = html
            .replace(/~~(.+?)~~/g, '<s class="text-slate-400">$1</s>')
            .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<u>$1</u>')
            .replace(/~(.+?)~/g, '<em>$1</em>');

        // Line breaks
        html = html.replace(/\n/g, '<br/>');

        // Field placeholders
        html = html.replace(/\{\{(\w+)\}\}/g, '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-weight:600;font-size:13px;">[$1]</span>');

        return html;
    }, [value]);

    return (
        <div className="flex flex-col h-full min-h-[500px] animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm">
                    <Code className="w-4 h-4" />
                    Email Template Editor <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                        onClick={() => setMode('edit')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'edit' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Edit3 className="w-3 h-3" /> แก้ไข
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'preview' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Eye className="w-3 h-3" /> ตัวอย่าง
                    </button>
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="flex flex-1 min-h-0">
                    {/* Left: Available Fields */}
                    <div className="w-52 shrink-0 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col">
                        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <MousePointerClick className="w-3 h-3" /> ฟิลด์ที่ใช้ได้
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">กดเพื่อแทรกลง Template</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {availableFields.length === 0 ? (
                                <div className="text-center py-6 px-2">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                                        ยังไม่พบฟิลด์<br />
                                        กรุณาใส่คำสั่ง SQL<br />
                                        ที่มี SELECT ... FROM<br />
                                        ในแท็บ &quot;คำสั่ง T-SQL&quot; ก่อน
                                    </p>
                                </div>
                            ) : (
                                availableFields.map(field => {
                                    const isUsed = usedFields.has(field);
                                    return (
                                        <button
                                            key={field}
                                            onClick={() => insertField(field)}
                                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-2 group ${isUsed
                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700'
                                                }`}
                                        >
                                            {isUsed ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            ) : (
                                                <span className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-500 group-hover:border-blue-400 shrink-0 transition-colors" />
                                            )}
                                            <span className="truncate">{field}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        {availableFields.length > 0 && (
                            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    <span className="text-emerald-500 font-bold">{usedFields.size}</span>/{availableFields.length} ฟิลด์ถูกใช้
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right: Toolbar + Textarea */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                        {/* Formatting Toolbar */}
                        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {formatButtons.map((btn) => (
                                <button
                                    key={btn.label}
                                    onClick={() => applyFormat(btn.prefix, btn.suffix, btn.placeholder)}
                                    className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                    title={`${btn.label}${btn.shortcut ? ` (${btn.shortcut})` : ''}`}
                                >
                                    <btn.icon className="w-4 h-4" />
                                </button>
                            ))}
                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
                            <button
                                onClick={() => {
                                    const textarea = textareaRef.current;
                                    if (!textarea) return;
                                    const start = textarea.selectionStart;
                                    const newValue = value.substring(0, start) + '\n───────────────\n' + value.substring(start);
                                    onChange(newValue);
                                    requestAnimationFrame(() => {
                                        textarea.focus();
                                        const newPos = start + 18;
                                        textarea.setSelectionRange(newPos, newPos);
                                    });
                                }}
                                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                title="เส้นแบ่ง"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <div className="flex-1" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                                *ตัวหนา* &nbsp; _ขีดเส้นใต้_ &nbsp; ~ตัวเอียง~
                            </span>
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full flex-1 min-h-[400px] bg-transparent p-4 focus:outline-none resize-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            placeholder={"เรียนคุณลูกค้า {{CustomerName}},\n\nทางเราขอแจ้งรายการออเดอร์หมายเลข *{{DocNo}}* ลงวันที่ {{DocDate}}\nมียอดรวม _{{TotalAmount}}_ บาท\n\n───────────────\nขอบคุณที่ใช้บริการครับ"}
                            spellCheck={false}
                        />
                    </div>
                </div>
            ) : (
                /* Preview Mode */
                <div className="flex-1 p-6 overflow-auto bg-gradient-to-b from-blue-50/30 to-white dark:from-slate-800/30 dark:to-slate-900">
                    <div className="max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ตัวอย่าง Email</span>
                        </div>
                        {value ? (
                            <div
                                className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        ) : (
                            <p className="text-sm text-slate-400 italic">ยังไม่มีเนื้อหา — กลับไปแท็บ &quot;แก้ไข&quot; เพื่อเขียน template</p>
                        )}
                    </div>

                    {/* Formatting Legend */}
                    <div className="max-w-lg mx-auto mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">วิธีจัดรูปแบบ</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                                <code className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[11px] border border-slate-200 dark:border-slate-600">*ข้อความ*</code>
                                <span>→ <strong>ตัวหนา</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[11px] border border-slate-200 dark:border-slate-600">_ข้อความ_</code>
                                <span>→ <u>ขีดเส้นใต้</u></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[11px] border border-slate-200 dark:border-slate-600">~ข้อความ~</code>
                                <span>→ <em>ตัวเอียง</em></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[11px] border border-slate-200 dark:border-slate-600">~~ข้อความ~~</code>
                                <span>→ <s>ขีดฆ่า</s></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
