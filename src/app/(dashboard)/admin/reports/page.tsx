"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit, Trash2, RefreshCw, Power, ArrowLeft, X } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import AccessibleDialog from '@/components/ui/AccessibleDialog';
import { matchesReportSearch, toggleVisibleReportSelection } from '@/lib/report-registry';

interface Report { ReportId: number; ReportName: string; Description?: string; ReportType: number; IsActive: boolean; IsHeavy?: boolean; CategoryId: number | null; CategoryName?: string; }
interface Role { RoleId: number; RoleName: string; assignedReports: number[]; }
interface Category { CategoryId: number; CategoryName: string; }
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:hover:bg-slate-700';
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

export default function AdminReportsPage() {
    return <Suspense fallback={<p className="p-6">กำลังโหลดทะเบียนรายงาน…</p>}><ReportRegistry /></Suspense>;
}

function ReportRegistry() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const params = useSearchParams();
    const router = useRouter();
    const filterCategory = params.get('categoryId') || 'all';
    const [reports, setReports] = useState<Report[]>([]);
    const [roles, setRoles] = useState<Role[] | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [type, setType] = useState('all');
    const [status, setStatus] = useState('all');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [access, setAccess] = useState<{ name: string; groups: string[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const categoryRef = useRef<HTMLSelectElement>(null);
    const typeRef = useRef<HTMLSelectElement>(null);
    const statusRef = useRef<HTMLSelectElement>(null);
    const load = useCallback(async () => {
        setIsLoading(true); setLoadError('');
        try {
            const [list, cats, groups] = await Promise.all([
                fetch('/api/admin/reports').then(r => r.json()),
                fetch('/api/admin/categories').then(r => r.json()),
                fetch('/api/admin/roles').then(r => r.json()),
            ]);
            if (!list.success) throw new Error(list.message || 'ไม่สามารถโหลดทะเบียนรายงานได้');
            setReports(list.reports);
            const ids = new Set<number>(list.reports.map((r: Report) => r.ReportId));
            setSelectedIds(previous => previous.filter(id => ids.has(id)));
            if (cats.success) setCategories(cats.categories);
            setRoles(groups.success ? groups.roles : null);
            if (!groups.success || !cats.success) toast('โหลดหมวดหรือกลุ่มสิทธิ์ไม่สำเร็จ กรุณาลองโหลดใหม่', 'error');
        } catch (error) { setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้'); }
        finally { setIsLoading(false); }
    }, [toast]);
    useEffect(() => { void load(); }, [load]);

    const filtered = reports.filter(report => {
        const categoryMatches = filterCategory === 'all' || ((filterCategory === 'uncategorized' || filterCategory === 'none') ? !report.CategoryName : String(report.CategoryId) === filterCategory);
        return categoryMatches && (type === 'all' || String(report.ReportType) === type)
            && (status === 'all' || Boolean(report.IsActive) === (status === 'active'))
            && matchesReportSearch(report, search);
    });
    const visibleIds = filtered.map(report => report.ReportId);
    const visibleSelected = visibleIds.filter(id => selectedIds.includes(id)).length;
    useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = visibleSelected > 0 && visibleSelected < visibleIds.length; }, [visibleSelected, visibleIds.length]);
    const setCategory = (value: string) => router.replace(value === 'all' ? '/admin/reports' : `/admin/reports?categoryId=${encodeURIComponent(value)}`, { scroll: false });
    const clearFilters = () => { setSearch(''); setType('all'); setStatus('all'); setCategory('all'); };
    const filterChips = [
        ...(search.trim() ? [{ key: 'search', label: `ค้นหา: ${search.trim()}`, clear: () => setSearch(''), focusTarget: searchRef }] : []),
        ...(filterCategory !== 'all' ? [{ key: 'category', label: `หมวด: ${categories.find(category => String(category.CategoryId) === filterCategory)?.CategoryName || 'ยังไม่จัดหมวด'}`, clear: () => setCategory('all'), focusTarget: categoryRef }] : []),
        ...(type !== 'all' ? [{ key: 'type', label: `ประเภท: ${type === '1' ? 'มาตรฐาน' : 'Template'}`, clear: () => setType('all'), focusTarget: typeRef }] : []),
        ...(status !== 'all' ? [{ key: 'status', label: `สถานะ: ${status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}`, clear: () => setStatus('all'), focusTarget: statusRef }] : []),
    ];

    async function mutate(url: string, method: string, body?: object) {
        setBusy(true);
        try {
            const res = await fetch(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
            toast(data.message || 'ดำเนินการเรียบร้อย', 'success');
            await load();
        } catch (error) { toast(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); }
        finally { setBusy(false); }
    }
    async function remove(report: Report) {
        if (await confirm({ title: 'ลบรายงานถาวร', message: `ลบ “${report.ReportName}”? ตัวแปร สิทธิ์และรายการโปรดที่เกี่ยวข้องจะถูกลบ การดำเนินการนี้ย้อนกลับไม่ได้`, confirmLabel: 'ลบถาวร', variant: 'danger' })) await mutate(`/api/admin/reports/${report.ReportId}`, 'DELETE');
    }
    async function toggle(report: Report) {
        const action = report.IsActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
        if (await confirm({ title: `${action}รายงาน`, message: `${action} “${report.ReportName}” หรือไม่?`, confirmLabel: action, variant: report.IsActive ? 'warning' : 'default' })) await mutate(`/api/admin/reports/${report.ReportId}`, 'PATCH');
    }
    async function removeSelected() {
        const names = reports.filter(report => selectedIds.includes(report.ReportId)).map(report => report.ReportName);
        if (await confirm({ title: `ลบรายงาน ${selectedIds.length} รายการ`, message: `รวม ${selectedIds.length - visibleSelected} รายการที่ตัวกรองซ่อนอยู่\n\n${names.join('\n')}\n\nการดำเนินการนี้ย้อนกลับไม่ได้`, confirmLabel: `ลบ ${selectedIds.length} รายการ`, variant: 'danger' })) await mutate('/api/admin/reports/bulk', 'DELETE', { reportIds: selectedIds });
    }

    return <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">ทะเบียนรายงาน</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">จัดการรายงาน หมวด และกลุ่มสิทธิ์ที่เข้าถึง</p></div>
            <div className="flex gap-2"><button className={button} onClick={() => void load()} disabled={isLoading || busy} aria-label="โหลดทะเบียนรายงานใหม่"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button><Link href="/admin/reports/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />สร้างรายงาน</Link></div>
        </div>
        {filterCategory !== 'all' && <Link href={`/admin/categories?categoryId=${encodeURIComponent(filterCategory)}`} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"><ArrowLeft className="h-4 w-4" />กลับไปหน้าหมวดรายงาน</Link>}
        {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{loadError} <button onClick={() => void load()} className="underline">ลองใหม่</button></div>}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" aria-label="รายการรายงาน">
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
                <label className="min-w-48 flex-1 text-sm"><span className="mb-1 block font-medium">ค้นหารายงาน</span><span className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input ref={searchRef} className={`${input} w-full pl-9`} value={search} onChange={e => setSearch(e.target.value)} placeholder="ชื่อ รหัส หรือคำอธิบาย" /></span></label>
                <label className="text-sm"><span className="mb-1 block font-medium">หมวดรายงาน</span><select ref={categoryRef} className={input} value={filterCategory} onChange={e => setCategory(e.target.value)}><option value="all">ทุกหมวด</option><option value="uncategorized">ยังไม่จัดหมวด</option>{categories.map(category => <option key={category.CategoryId} value={category.CategoryId}>{category.CategoryName}</option>)}</select></label>
                <label className="text-sm"><span className="mb-1 block font-medium">ประเภท</span><select ref={typeRef} className={input} value={type} onChange={e => setType(e.target.value)}><option value="all">ทุกประเภท</option><option value="1">มาตรฐาน</option><option value="2">Template</option></select></label>
                <label className="text-sm"><span className="mb-1 block font-medium">สถานะ</span><select ref={statusRef} className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="all">ทุกสถานะ</option><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></label>
                {(search || filterCategory !== 'all' || type !== 'all' || status !== 'all') && <button onClick={clearFilters} className={button}>ล้างตัวกรอง</button>}
            </div>
            {!!filterChips.length && <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700" aria-label="ตัวกรองที่ใช้">
                <span className="text-xs text-slate-500">กำลังกรอง</span>{filterChips.map(chip => <button key={chip.key} type="button" onClick={() => { chip.clear(); chip.focusTarget.current?.focus(); }} aria-label={`ล้างตัวกรอง ${chip.label}`}
                    className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"><span className="truncate">{chip.label}</span><X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></button>)}
            </div>}
            {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-3 bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950"><span role="status" className="flex-1">เลือกทั้งหมด {selectedIds.length} · อยู่ในผลค้นหา {visibleSelected} · ซ่อน {selectedIds.length - visibleSelected}</span><button className={button} onClick={() => setSelectedIds([])}>ยกเลิกเลือกทั้งหมด</button><button disabled={busy} onClick={() => void removeSelected()} className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white disabled:opacity-50">ลบที่เลือก ({selectedIds.length})</button></div>}
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><tr>
                <th className="p-4"><input ref={selectAllRef} type="checkbox" aria-label="เลือกทั้งหมดในผลค้นหา" checked={visibleIds.length > 0 && visibleSelected === visibleIds.length} onChange={() => setSelectedIds(previous => toggleVisibleReportSelection(previous, visibleIds))} disabled={!visibleIds.length || busy} className="h-4 w-4" /></th><th className="p-4">รายงาน</th><th className="p-4">หมวดรายงาน</th><th className="p-4">ประเภท</th><th className="p-4">กลุ่มสิทธิ์ที่เข้าถึง</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th>
            </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {isLoading ? <tr><td colSpan={7} className="p-12 text-center text-slate-500">กำลังโหลดรายงาน…</td></tr> : !filtered.length ? <tr><td colSpan={7} className="p-12 text-center text-slate-500">{reports.length ? 'ไม่พบรายงานตามตัวกรอง' : 'ยังไม่มีรายงาน'}</td></tr> : filtered.map(report => {
                    const groups = roles?.filter(role => role.RoleName.toLowerCase() !== 'admin' && role.assignedReports.includes(report.ReportId)).map(role => role.RoleName);
                    return <tr key={report.ReportId} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="p-4"><input type="checkbox" aria-label={`เลือก ${report.ReportName}`} checked={selectedIds.includes(report.ReportId)} onChange={() => setSelectedIds(previous => previous.includes(report.ReportId) ? previous.filter(id => id !== report.ReportId) : [...previous, report.ReportId])} disabled={busy} className="h-4 w-4" /></td>
                        <td className="min-w-64 p-4"><Link href={`/admin/reports/${report.ReportId}/edit`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-white">{report.ReportName}</Link>{report.IsHeavy && <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">ขนาดใหญ่</span>}<p className="mt-1 max-w-sm text-xs text-slate-500">RID-{String(report.ReportId).padStart(4, '0')} · {report.Description}</p></td>
                        <td className="p-4"><Link href={`/admin/categories?categoryId=${report.CategoryName ? report.CategoryId : 'uncategorized'}`} className="inline-block rounded-full border border-slate-200 px-2 py-1 text-xs font-medium hover:border-blue-400 dark:border-slate-600">{report.CategoryName || 'ยังไม่จัดหมวด'}</Link></td>
                        <td className="whitespace-nowrap p-4">{report.ReportType === 1 ? 'มาตรฐาน' : 'Template'}</td>
                        <td className="min-w-48 p-4">{groups ? <div className="flex flex-wrap gap-1.5">{groups.length ? groups.slice(0, 2).map(name => <span key={name} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">{name}</span>) : <span className="text-xs text-slate-500">เฉพาะผู้ดูแลระบบ</span>}{groups.length > 2 && <button type="button" aria-haspopup="dialog" aria-label={`ดูกลุ่มสิทธิ์ทั้งหมด ${groups.length} กลุ่มของ ${report.ReportName}`} onClick={() => setAccess({ name: report.ReportName, groups })} className="rounded-full border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline-2">+{groups.length - 2}</button>}</div> : <span className="text-xs text-slate-500">โหลดสิทธิ์ไม่สำเร็จ</span>}</td>
                        <td className="whitespace-nowrap p-4"><span className={report.IsActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}>{report.IsActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td>
                        <td className="p-4"><div className="flex items-center gap-1"><Link aria-label={`แก้ไข ${report.ReportName}`} href={`/admin/reports/${report.ReportId}/edit`} className={button}><Edit className="h-4 w-4" />แก้ไข</Link><button disabled={busy} aria-label={`${report.IsActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} ${report.ReportName}`} onClick={() => void toggle(report)} className={button}><Power className="h-4 w-4" /></button><button disabled={busy} aria-label={`ลบ ${report.ReportName}`} onClick={() => void remove(report)} className={`${button} text-red-600`}><Trash2 className="h-4 w-4" /></button></div></td>
                    </tr>;
                })}
            </tbody></table></div>
            <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700">แสดง {filtered.length} จาก {reports.length} รายงาน · คอลัมน์กลุ่มสิทธิ์แสดงการผูกรายงานกับกลุ่มผู้ใช้ ผู้ดูแลระบบใช้สิทธิ์ Admin</p>
        </section>
        <AccessibleDialog open={!!access} onClose={() => setAccess(null)} title="กลุ่มสิทธิ์ที่เข้าถึงรายงาน" description={access ? `${access.name} · ${access.groups.length} กลุ่ม` : undefined} footer={<button className={button} onClick={() => setAccess(null)}>ปิด</button>}>
            <ul className="space-y-2">{access?.groups.map(name => <li key={name} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700">{name}</li>)}</ul>
        </AccessibleDialog>
    </div>;
}
