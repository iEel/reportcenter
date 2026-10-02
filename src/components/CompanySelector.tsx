"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface CompanySelectorProps {
    id: string;
    companies: { companyId: number; name: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export default function CompanySelector({ id, companies, value, onChange, disabled = false }: CompanySelectorProps) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxId = useId();
    const selectedIndex = companies.findIndex(company => String(company.companyId) === value);
    const selected = companies[selectedIndex];
    const isDisabled = disabled || companies.length === 0;
    const isOpen = open && !isDisabled;
    const activeCompany = companies[activeIndex];

    useEffect(() => {
        if (!isOpen) return;
        const closeOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeCompany) {
            document.getElementById(`${listboxId}-${activeCompany.companyId}`)?.scrollIntoView({ block: 'nearest' });
        }
    }, [isOpen, activeCompany, listboxId]);

    const close = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };
    const openList = (last = false) => {
        if (isDisabled) return;
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : last ? companies.length - 1 : 0);
        setOpen(true);
    };
    const select = (index: number) => {
        const company = companies[index];
        if (isDisabled || !company) return;
        onChange(String(company.companyId));
        close();
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (isDisabled) return;
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                event.preventDefault();
                if (!isOpen) openList(event.key === 'ArrowUp');
                else {
                    const direction = event.key === 'ArrowDown' ? 1 : -1;
                    setActiveIndex(current => (current + direction + companies.length) % companies.length);
                }
                break;
            }
            case 'Home':
            case 'End':
                event.preventDefault();
                setOpen(true);
                setActiveIndex(event.key === 'Home' ? 0 : companies.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen) select(activeIndex);
                else openList();
                break;
            case 'Escape':
                if (isOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
                break;
            case 'Tab':
                // Focus remains on the trigger while open, so native Tab order stays intact.
                setOpen(false);
                break;
        }
    };

    return (
        <div ref={rootRef} className="relative min-w-0 w-full" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                role="combobox"
                disabled={isDisabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={isOpen && activeCompany ? `${listboxId}-${activeCompany.companyId}` : undefined}
                onClick={() => isOpen ? close() : openList()}
                onKeyDown={handleKeyDown}
                className="flex h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition-colors hover:border-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            >
                {selected ? <>
                    <span className="max-w-[40%] shrink-0 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{selected.label}</span>
                    <span className="min-w-0 flex-1 truncate" title={selected.name}>{selected.name}</span>
                </> : <span className="min-w-0 flex-1 text-slate-500 dark:text-slate-400">{companies.length ? 'เลือกบริษัท' : 'ไม่มีบริษัทที่พร้อมใช้งาน'}</span>}
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && <div
                id={listboxId}
                role="listbox"
                aria-labelledby={id}
                className="absolute inset-x-0 z-50 mt-2 max-h-[min(18rem,50dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            >
                {companies.map((company, index) => {
                    const isSelected = String(company.companyId) === value;
                    const isActive = index === activeIndex;
                    return <div
                        key={company.companyId}
                        id={`${listboxId}-${company.companyId}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => select(index)}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${isActive ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100' : isSelected ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <span className="max-w-[40%] shrink-0 truncate rounded-md border border-current/15 px-2 py-1 text-xs font-semibold">{company.label}</span>
                        <span className="min-w-0 flex-1 break-words text-sm">{company.name}</span>
                        <span className="w-4 shrink-0">{isSelected && <Check aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />}</span>
                    </div>;
                })}
            </div>}
        </div>
    );
}
