"use client"

import { useState, useRef, useMemo, useCallback } from "react";
import { Code, Eye, Edit3, MousePointerClick, CheckCircle2, Bold, Underline, Italic, Strikethrough, Minus, Type, Sparkles } from "lucide-react";

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
            const cleanSql = sqlQuery
                .replace(/--[^\n]*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');

            const selectMatch = cleanSql.match(/SELECT\s+([\s\S]*?)\s+FROM\b/i);
            if (!selectMatch) return [];

            const selectClause = selectMatch[1];
            if (selectClause.trim() === '*') return [];

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

            const columns = parts.map(col => {
                const trimmed = col.trim();
                const asMatch = trimmed.match(/\bAS\s+\[?([^\]\s]+)\]?\s*$/i);
                if (asMatch) return asMatch[1].trim();
                const simpleMatch = trimmed.match(/^\[?(\w+)\]?$/);
                if (simpleMatch) return simpleMatch[1];
                const dotMatch = trimmed.match(/\.(\w+)\s*$/);
                if (dotMatch) return dotMatch[1];
                const implicitAlias = trimmed.match(/\)\s+\[?(\w+)\]?\s*$/);
                if (implicitAlias) return implicitAlias[1];
                if (/^\w+$/.test(trimmed)) return trimmed;
                return null;
            }).filter(Boolean) as string[];

            return [...new Set(columns)];
        } catch {
            return [];
        }
    }, [sqlQuery]);

    const usedFields = useMemo(() => {
        const matches = value.match(/\{\{(\w+)\}\}/g) || [];
        return new Set(matches.map(m => m.replace(/[{}]/g, '')));
    }, [value]);

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
        requestAnimationFrame(() => {
            textarea.focus();
            const newPos = start + tag.length;
            textarea.setSelectionRange(newPos, newPos);
        });
    }, [value, onChange]);

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
            newValue = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
            newCursorStart = start + prefix.length;
            newCursorEnd = newCursorStart + selected.length;
        } else {
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        switch (e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                applyFormat('*', '*', 'ข้อความ');
                break;
            case 'u':
                e.preventDefault();
                applyFormat('_', '_', 'ข้อความ');
                break;
            case 'i':
                e.preventDefault();
                applyFormat('~', '~', 'ข้อความ');
                break;
        }
    }, [applyFormat]);

    const previewHtml = useMemo(() => {
        let html = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        html = html
            .replace(/~~(.+?)~~/g, '<s>$1</s>')
            .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<u>$1</u>')
            .replace(/~(.+?)~/g, '<em>$1</em>');

        html = html.replace(/───+/g, '<hr class="border-slate-200 dark:border-slate-600 my-1"/>');
        html = html.replace(/\n/g, '<br/>');
        html = html.replace(
            /\{\{(\w+)\}\}/g,
            '<span style="background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:4px;font-weight:600;font-size:13px;">[$1]</span>'
        );
        return html;
    }, [value]);

    return (
        <div className="flex flex-col h-full min-h-[660px] animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm">
                    <Code className="w-4 h-4" />
                    Email Template Editor <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                        onClick={() => setMode('edit')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'edit' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        <Edit3 className="w-3 h-3" /> แก้ไข
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'preview' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        <Eye className="w-3 h-3" /> ตัวอย่าง
                    </button>
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="flex flex-1 min-h-0">
                    {/* Left: Available Fields */}
                    <div className="w-44 shrink-0 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col">
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
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-300'
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
                        <div className="flex items-center px-3 py-1.5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 gap-0.5">
                            {[
                                { icon: Bold, tip: 'ตัวหนา (Ctrl+B)', pre: '*', suf: '*', ph: 'ข้อความ' },
                                { icon: Italic, tip: 'ตัวเอียง (Ctrl+I)', pre: '~', suf: '~', ph: 'ข้อความ' },
                                { icon: Underline, tip: 'ขีดเส้นใต้ (Ctrl+U)', pre: '_', suf: '_', ph: 'ข้อความ' },
                                { icon: Strikethrough, tip: 'ขีดฆ่า', pre: '~~', suf: '~~', ph: 'ข้อความ' },
                            ].map((btn) => (
                                <button
                                    key={btn.tip}
                                    onClick={() => applyFormat(btn.pre, btn.suf, btn.ph)}
                                    className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                    title={btn.tip}
                                >
                                    <btn.icon className="w-4 h-4" />
                                </button>
                            ))}
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
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
                                className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                title="เส้นแบ่ง"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full flex-1 min-h-[600px] bg-transparent p-4 focus:outline-none resize-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
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

                    {/* Formatting hint */}
                    <div className="max-w-lg mx-auto mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
                        <span><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">*ตัวหนา*</code> → <strong>ตัวหนา</strong></span>
                        <span><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">_ขีดเส้นใต้_</code> → <u>ขีดเส้นใต้</u></span>
                        <span><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">~ตัวเอียง~</code> → <em>ตัวเอียง</em></span>
                    </div>
                </div>
            )}
        </div>
    );
}
