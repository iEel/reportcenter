'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface Suggestion {
    value: string;
    label: string;
}

interface TypeaheadInputProps {
    value: string;
    onChange: (value: string) => void;
    reportId: string;
    paramName: string;
    companyId: string;
    placeholder?: string;
    className?: string;
}

export default function TypeaheadInput({
    value,
    onChange,
    reportId,
    paramName,
    companyId,
    placeholder = 'พิมพ์เพื่อค้นหา...',
    className = '',
}: TypeaheadInputProps) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>(null);

    // Sync external value changes
    useEffect(() => { setQuery(value || ''); }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchSuggestions = useCallback(async (searchTerm: string) => {
        if (searchTerm.length < 2 || !reportId || !companyId) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/reports/search-param?reportId=${reportId}&paramName=${encodeURIComponent(paramName)}&q=${encodeURIComponent(searchTerm)}&companyId=${companyId}`
            );
            const data = await res.json();
            if (data.success && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
                setIsOpen(true);
                setHighlightIdx(-1);
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
        } catch {
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, [reportId, paramName, companyId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onChange(val);

        // Debounced search
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    };

    const handleSelect = (suggestion: Suggestion) => {
        setQuery(suggestion.value);
        onChange(suggestion.value);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleClear = () => {
        setQuery('');
        onChange('');
        setSuggestions([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && highlightIdx >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightIdx]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className={`w-full bg-white border border-slate-200 text-sm py-2 pl-9 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors ${className}`}
                />
                {isLoading ? (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 animate-spin" />
                ) : query ? (
                    <button
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                ) : null}
            </div>

            {/* Suggestions dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto animate-in fade-in slide-in-from-top-1 duration-150">
                    {suggestions.map((s, idx) => (
                        <button
                            key={`${s.value}-${idx}`}
                            onClick={() => handleSelect(s)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${idx === highlightIdx
                                ? 'bg-purple-50 text-purple-700'
                                : 'hover:bg-slate-50 text-slate-700'
                                } ${idx !== suggestions.length - 1 ? 'border-b border-slate-50' : ''}`}
                        >
                            <span className="font-medium text-slate-900">{s.value}</span>
                            {s.label !== s.value && (
                                <span className="text-xs text-slate-400 truncate">— {s.label}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
