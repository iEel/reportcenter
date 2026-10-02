"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, FileText, FolderOpen, Inbox, Info, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import useUnsavedChanges from "@/hooks/useUnsavedChanges";
import { categoryDraftIsDirty, categoryNameConflict, categoryReportCounts, parseCategorySelection, resolveCategorySelection, type CategoryDraft, type CategorySelection } from "@/lib/category-view";

const COLOR_OPTIONS = [
    { value: 'blue', label: 'น้ำเงิน', class: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
    { value: 'emerald', label: 'เขียว', class: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
    { value: 'amber', label: 'เหลือง', class: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    { value: 'rose', label: 'ชมพู', class: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
    { value: 'purple', label: 'ม่วง', class: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
    { value: 'cyan', label: 'ฟ้า', class: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-500' },
    { value: 'orange', label: 'ส้ม', class: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
    { value: 'slate', label: 'เทา', class: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500' },
    { value: 'indigo', label: 'คราม', class: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
    { value: 'teal', label: 'เขียวน้ำทะเล', class: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500' },
];
const colorOf = (tag: string | null) => COLOR_OPTIONS.find(color => color.value === tag) || COLOR_OPTIONS[7];
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const card = 'overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

interface Category {
    CategoryId: number;
    CategoryName: string;
    ColorTag: string | null;
    ReportCount: number;
    AllReportCount: number;
    InactiveReportCount: number;
}
interface CategoryReport {
    ReportId: number;
    ReportName: string;
    CategoryId: number | null;
    IsActive: boolean | number;
    ReportType: number;
    Description: string | null;
}

export default function AdminCategoriesPage() {
    return <Suspense fallback={<p className="p-6">กำลังโหลดหมวดรายงาน…</p>}><CategoryPageFromUrl /></Suspense>;
}

function CategoryPageFromUrl() {
    const params = useSearchParams();
    const categoryId = params.get('categoryId');
    return <CategoryManager key={categoryId || ''} initialSelection={parseCategorySelection(categoryId)} />;
}

function CategoryManager({ initialSelection }: { initialSelection: CategorySelection }) {
    const { toast } = useToast();
    const [categories, setCategories] = useState<Category[]>([]);
    const [reportsByCategory, setReportsByCategory] = useState<Record<string, CategoryReport[]>>({});
    const [selected, setSelected] = useState<CategorySelection>(initialSelection);
    const [draft, setDraft] = useState<CategoryDraft | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const formInput = useRef<HTMLInputElement>(null);
    const draftId = draft?.id;
    const { confirmDiscard } = useUnsavedChanges(categoryDraftIsDirty(draft, categories));

    const loadCategories = useCallback(async (preferred?: CategorySelection, signal?: AbortSignal) => {
        setIsLoading(true); setLoadError('');
        try {
            const response = await fetch('/api/admin/categories', { signal });
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.categories) || !data.allReportsByCategory) throw new Error(data.message || 'ไม่สามารถโหลดหมวดรายงานได้');
            setCategories(data.categories);
            setReportsByCategory(data.allReportsByCategory);
            setSelected(current => resolveCategorySelection(data.categories, preferred ?? current));
        } catch (error) {
            if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally { if (!signal?.aborted) setIsLoading(false); }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void loadCategories(undefined, controller.signal);
        return () => controller.abort();
    }, [loadCategories]);
    useEffect(() => { if (draftId !== undefined) formInput.current?.focus(); }, [draftId]);

    const changeContext = async (next: CategorySelection) => {
        if (selected === next && draft?.id !== 'new') return;
        if (!await confirmDiscard()) return;
        setDraft(null); setFormError(''); setSelected(next);
    };
    const startCreate = async () => {
        if (draft?.id === 'new') { formInput.current?.focus(); return; }
        if (!await confirmDiscard()) return;
        setDraft({ id: 'new', name: '', color: 'blue' }); setFormError('');
    };
    const startEdit = () => {
        const category = categories.find(item => item.CategoryId === selected);
        if (!category || draft?.id === category.CategoryId) return;
        setDraft({ id: category.CategoryId, name: category.CategoryName, color: category.ColorTag || 'slate' });
        setFormError('');
    };
    const cancelEdit = async () => {
        if (isSaving || !await confirmDiscard()) return;
        setDraft(null); setFormError('');
    };
    const saveCategory = async () => {
        if (!draft || isSaving) return;
        if (!draft.name.trim()) { setFormError('กรอกชื่อหมวดก่อนบันทึก'); formInput.current?.focus(); return; }
        if (categoryNameConflict(draft, categories)) { setFormError(`มีหมวด “${draft.name.trim()}” อยู่แล้ว`); formInput.current?.focus(); return; }
        setIsSaving(true); setFormError('');
        try {
            const creating = draft.id === 'new';
            const response = await fetch('/api/admin/categories', {
                method: creating ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(creating ? {} : { categoryId: draft.id }), name: draft.name.trim(), colorTag: draft.color }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'ไม่สามารถบันทึกหมวดได้');
            setDraft(null);
            toast(creating ? 'เพิ่มหมวดรายงานแล้ว' : 'บันทึกชื่อและสีแล้ว', 'success');
            await loadCategories(draft.id === 'new' ? data.categoryId : draft.id);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally { setIsSaving(false); }
    };
    const requestDelete = async (category: Category) => {
        if (!await confirmDiscard()) return;
        setDraft(null); setFormError(''); setDeleteError(''); setDeleteTarget(category);
    };
    const deleteCategory = async () => {
        if (!deleteTarget || isDeleting) return;
        setIsDeleting(true); setDeleteError('');
        try {
            const response = await fetch(`/api/admin/categories?categoryId=${deleteTarget.CategoryId}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'ไม่สามารถลบหมวดได้');
            setDeleteTarget(null);
            toast('ลบหมวดแล้ว รายงานและสิทธิ์เดิมยังอยู่', 'success');
            await loadCategories('uncategorized');
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } finally { setIsDeleting(false); }
    };

    const category = categories.find(item => item.CategoryId === selected);
    const reports = reportsByCategory[String(selected)] || [];
    const counts = categoryReportCounts(reports);
    const uncategorizedCount = (reportsByCategory.uncategorized || []).length;
    const deleteCounts = categoryReportCounts(deleteTarget ? reportsByCategory[deleteTarget.CategoryId] || [] : []);
    const creating = draft?.id === 'new';
    const registryHref = `/admin/reports?categoryId=${selected}`;
    const form = draft ? <form className="space-y-5 p-5" aria-label={creating ? 'สร้างหมวดรายงาน' : 'แก้ไขชื่อและสี'} onSubmit={event => { event.preventDefault(); void saveCategory(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); void cancelEdit(); } }}>
        {!creating && <h3 className="font-semibold text-slate-900 dark:text-white">แก้ไขชื่อและสี</h3>}
        <div className="max-w-lg">
            <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">ชื่อหมวด <span className="text-red-600">*</span></label>
            <input ref={formInput} id="category-name" required maxLength={100} value={draft.name} disabled={isSaving} onChange={event => { setDraft({ ...draft, name: event.target.value }); setFormError(''); }} aria-invalid={!!formError} aria-describedby={formError ? 'category-error' : 'category-name-hint'} placeholder="เช่น การเงินและบัญชี" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
            <p id="category-name-hint" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">ตั้งตามเนื้อหารายงาน หมวดใช้ช่วยค้นหา ไม่ได้กำหนดสิทธิ์</p>
        </div>
        <fieldset disabled={isSaving}><legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">สี</legend><div className="flex flex-wrap gap-2">{COLOR_OPTIONS.map(color => <label key={color.value} className="relative cursor-pointer">
            <input type="radio" className="peer sr-only" name="category-color" value={color.value} checked={draft.color === color.value} onChange={() => setDraft({ ...draft, color: color.value })} />
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 ${color.class} ${draft.color === color.value ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}><span className={`h-2 w-2 rounded-full ${color.dot}`} />{color.label}{draft.color === color.value && <Check className="h-3 w-3" />}</span>
        </label>)}</div></fieldset>
        {formError && <p id="category-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><span className="text-xs text-slate-500 dark:text-slate-400">ตัวอย่าง</span><span className={`rounded-md border px-2 py-1 text-xs ${colorOf(draft.color).class}`}>{draft.name || 'ชื่อหมวด'}</span><div className="ml-auto flex gap-2"><button type="button" onClick={() => void cancelEdit()} disabled={isSaving} className={button}>ยกเลิก</button><button type="submit" disabled={isSaving} className={primaryButton}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{creating ? 'เพิ่มหมวด' : 'บันทึก'}</button></div></div>
    </form> : null;

    return <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">หมวดรายงาน</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">จัดรายงานเป็นกลุ่มเพื่อให้ค้นหาง่าย หมวดไม่เกี่ยวกับสิทธิ์การเข้าถึง</p></div><button onClick={() => void startCreate()} disabled={isLoading || !!loadError || isSaving} className={primaryButton}><Plus className="h-4 w-4" />เพิ่มหมวด</button></header>
        {isLoading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />กำลังโหลดหมวดรายงาน…</div>
            : loadError ? <div role="alert" className={`${card} space-y-3 p-5`}><p className="text-sm text-red-600 dark:text-red-400">{loadError}</p><button className={button} onClick={() => void loadCategories()}>ลองโหลดอีกครั้ง</button></div>
                : <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <section className={card} aria-label="รายการหมวด">
                        <div className="border-b border-slate-200 p-4 dark:border-slate-700"><h2 className="font-semibold text-slate-900 dark:text-white">หมวด <span className="ml-1 font-normal text-slate-500">{categories.length}</span></h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">จำนวนรายงานที่ใช้งาน</p></div>
                        {categories.map(item => {
                            const itemCounts = categoryReportCounts(reportsByCategory[item.CategoryId] || []);
                            const current = !creating && selected === item.CategoryId;
                            return <button key={item.CategoryId} onClick={() => void changeContext(item.CategoryId)} disabled={isSaving} aria-current={current ? 'true' : undefined} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${current ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorOf(item.ColorTag).dot}`} /><span className="min-w-0 flex-1 break-words font-medium">{item.CategoryName}</span><span className="tabular-nums text-xs" title={`ใช้งาน ${itemCounts.active} จากทั้งหมด ${itemCounts.total}`}>{itemCounts.active}</span></button>;
                        })}
                        <button onClick={() => void changeContext('uncategorized')} disabled={isSaving} aria-current={!creating && selected === 'uncategorized' ? 'true' : undefined} className={`flex w-full items-center gap-3 border-t border-slate-200 px-4 py-3 text-left text-sm dark:border-slate-700 ${!creating && selected === 'uncategorized' ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Inbox className="h-4 w-4" /><span className="flex-1 font-medium">ยังไม่จัดหมวด</span><span className="text-xs tabular-nums">{categoryReportCounts(reportsByCategory.uncategorized || []).active}</span></button>
                        <div className="flex gap-2 border-t border-slate-200 p-4 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>การย้ายหมวดไม่เพิ่มหรือถอนสิทธิ์ใคร</p></div>
                    </section>
                    {creating ? <section className={card} aria-label="สร้างหมวดรายงาน"><div className="border-b border-slate-200 p-5 dark:border-slate-700"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">สร้างหมวดรายงาน</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ตั้งชื่อและสีของหมวดใหม่ แล้วกำหนดรายงานเข้าหมวดหลังบันทึก</p></div>{form}</section>
                        : <section className={card} aria-label="รายงานในหมวด">
                            {draft && <div className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30">{form}</div>}
                            <div className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">{category ? <><span className={`h-3 w-3 shrink-0 rounded-full ${colorOf(category.ColorTag).dot}`} />หมวดรายงาน: {category.CategoryName}</> : <><Inbox className="h-5 w-5" />ยังไม่จัดหมวด</>}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{counts.active} รายงานที่ใช้งาน · ปิดใช้งาน {counts.inactive} · ทั้งหมด {counts.total}</p></div>
                                <div className="flex flex-wrap gap-2">{category && <button onClick={startEdit} disabled={isSaving || !!draft} className={button}><Pencil className="h-4 w-4" />แก้ไขชื่อและสี</button>}<Link href={registryHref} className={category ? primaryButton : button}><ArrowUpRight className="h-4 w-4" />เปิดในทะเบียนรายงาน</Link>{category && <button onClick={() => void requestDelete(category)} disabled={isSaving} className={`${button} !text-red-600 dark:!text-red-400`}><Trash2 className="h-4 w-4" />ลบหมวด</button>}</div>
                                </div>{!category && <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>มุมมองนี้ไม่ใช่หมวดจริง จึงแก้ชื่อหรือลบไม่ได้ กำหนดหมวดให้แต่ละรายงานได้ที่หน้าแก้ไขรายงาน</p></div>}
                            </div>
                            {reports.length ? <ul className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">{reports.map(report => <li key={report.ReportId} className="flex flex-wrap items-center gap-3 px-5 py-4"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className={`break-words text-sm font-medium ${report.IsActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{report.ReportName}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">RID-{report.ReportId} · {report.ReportType === 1 ? 'มาตรฐาน' : 'Template'}{report.Description ? ` · ${report.Description}` : ''}</p></div><span className={`rounded-full px-2 py-1 text-xs ${report.IsActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>{report.IsActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span><Link href={`/admin/reports/${report.ReportId}/edit`} className={button} aria-label={`${category ? 'แก้ไขรายงาน' : 'กำหนดหมวดให้'} ${report.ReportName}`}>{category ? 'แก้ไขรายงาน' : 'กำหนดหมวด'}</Link></li>)}</ul>
                                : <div className="space-y-3 border-t border-slate-200 px-5 py-12 text-center dark:border-slate-700"><FolderOpen className="mx-auto h-8 w-8 text-slate-300" /><h3 className="font-medium text-slate-700 dark:text-slate-200">{category ? 'ยังไม่มีรายงานในหมวดนี้' : 'ไม่มีรายงานที่ยังไม่จัดหมวด'}</h3>{category && <p className="text-sm text-slate-500 dark:text-slate-400">เลือกหมวด “{category.CategoryName}” ได้ที่หน้าแก้ไขรายงาน</p>}{category && uncategorizedCount > 0 && <button className={button} onClick={() => void changeContext('uncategorized')}>ดูรายงานที่ยังไม่จัดหมวด ({uncategorizedCount})</button>}</div>}
                        </section>}
                </div>}
        <AccessibleDialog open={!!deleteTarget} onClose={() => { if (!isDeleting) setDeleteTarget(null); }} title={`ลบหมวด “${deleteTarget?.CategoryName || ''}”?`} footer={<><button className={button} onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</button><button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50" disabled={isDeleting} onClick={() => void deleteCategory()}>{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}ลบหมวด</button></>}>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300"><p>รายงานทั้งหมด {deleteCounts.total} รายการจะย้ายไป “ยังไม่จัดหมวด”</p><p>ใช้งาน {deleteCounts.active} · ปิดใช้งาน {deleteCounts.inactive}</p><p>รายงานและสิทธิ์การเข้าถึงยังอยู่ การลบครั้งนี้ลบเฉพาะหมวด</p>{deleteError && <p role="alert" className="text-red-600 dark:text-red-400">{deleteError}</p>}</div>
        </AccessibleDialog>
    </div>;
}
