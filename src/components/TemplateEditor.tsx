"use client"

import { useState, useRef, useMemo, useCallback } from "react";
import { Code, Eye, Edit3, MousePointerClick, CheckCircle2 } from "lucide-react";

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
            // Match columns from SELECT ... FROM
            const selectMatch = sqlQuery.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
            if (!selectMatch) return [];

            const selectClause = selectMatch[1];

            // Handle SELECT *
            if (selectClause.trim() === '*') return [];

            // Split by comma, handle aliases
            const columns = selectClause.split(',').map(col => {
                const trimmed = col.trim();

                // Handle: ColumnName AS Alias or ColumnName Alias
                const asMatch = trimmed.match(/\bAS\s+\[?(\w+)\]?$/i) || trimmed.match(/\s+\[?(\w+)\]?$/);
                if (asMatch) return asMatch[1];

                // Handle: table.ColumnName
                const dotMatch = trimmed.match(/\.(\w+)$/);
                if (dotMatch) return dotMatch[1];

                // Handle: [ColumnName]
                const bracketMatch = trimmed.match(/^\[?(\w+)\]?$/);
                if (bracketMatch) return bracketMatch[1];

                // Fallback: use as-is if it's a simple name
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

    // Preview: replace {{Field}} with sample styling
    const previewHtml = useMemo(() => {
        let html = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>')
            .replace(/\{\{(\w+)\}\}/g, '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-weight:600;font-size:13px;">[$1]</span>');
        return html;
    }, [value]);

    return (
        <div className="flex flex-col h-full min-h-[500px] animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                    <Code className="w-4 h-4" />
                    Email Template Editor <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setMode('edit')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Edit3 className="w-3 h-3" /> แก้ไข
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Eye className="w-3 h-3" /> ตัวอย่าง
                    </button>
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="flex flex-1 min-h-0">
                    {/* Left: Available Fields */}
                    <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col">
                        <div className="px-3 py-2.5 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <MousePointerClick className="w-3 h-3" /> ฟิลด์ที่ใช้ได้
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">กดเพื่อแทรกลง Template</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {availableFields.length === 0 ? (
                                <div className="text-center py-6 px-2">
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
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
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                                                }`}
                                        >
                                            {isUsed ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            ) : (
                                                <span className="w-3 h-3 rounded-full border-2 border-slate-300 group-hover:border-blue-400 shrink-0 transition-colors" />
                                            )}
                                            <span className="truncate">{field}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        {availableFields.length > 0 && (
                            <div className="px-3 py-2 border-t border-slate-100 bg-white">
                                <p className="text-[10px] text-slate-400">
                                    <span className="text-emerald-500 font-bold">{usedFields.size}</span>/{availableFields.length} ฟิลด์ถูกใช้
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right: Textarea */}
                    <div className="flex-1 flex flex-col bg-white">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full flex-1 min-h-[440px] bg-transparent p-4 focus:outline-none resize-none text-sm leading-relaxed text-slate-800"
                            placeholder={"เรียนคุณลูกค้า {{CustomerName}},\n\nทางเราขอแจ้งรายการออเดอร์หมายเลข {{DocNo}} ลงวันที่ {{DocDate}} มียอดรวม {{TotalAmount}} บาท\n\nขอบคุณที่ใช้บริการครับ"}
                            spellCheck={false}
                        />
                    </div>
                </div>
            ) : (
                /* Preview Mode */
                <div className="flex-1 p-6 overflow-auto bg-gradient-to-b from-blue-50/30 to-white">
                    <div className="max-w-lg mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ตัวอย่าง Email</span>
                        </div>
                        {value ? (
                            <div
                                className="text-sm text-slate-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        ) : (
                            <p className="text-sm text-slate-400 italic">ยังไม่มีเนื้อหา — กลับไปแท็บ &quot;แก้ไข&quot; เพื่อเขียน template</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
