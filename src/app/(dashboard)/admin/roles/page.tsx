"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FileText, GitCompareArrows, Loader2, LockKeyhole, Pencil, Plus, RefreshCw, Search, Shield, Trash2, Users } from 'lucide-react';
import AccessibleDialog from '@/components/ui/AccessibleDialog';
import { useToast } from '@/components/providers/ToastProvider';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import useUnsavedChanges from '@/hooks/useUnsavedChanges';
import {
    compareRoleReports, createRoleDraft, draftChanges, draftPayload, editReports,
    isAdminRole, isReportActive, reportCounts, reportsForRole, setDraftReports,
    type RoleAccessDraft, type RoleAccessReport, type RoleAccessRole,
} from '@/lib/role-access';

interface Role extends RoleAccessRole { UserCount: number }
interface Report extends RoleAccessReport { ReportType: number; CategoryName: string; CategoryColor: string }
interface Member { UserId: number; FullName: string; Username: string; RoleId: number; IsActive: boolean; AuthType?: string }
interface NameForm { mode: 'create' | 'rename'; roleId: number; name: string; originalName: string; copyFrom: string }
type Tab = 'reports' | 'members' | 'compare';

const card = 'rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700';
const primary = `${button} border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700`;
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-blue-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const muted = 'text-sm text-slate-500 dark:text-slate-400';

function Counts({ reports }: { reports: RoleAccessReport[] }) {
    const counts = reportCounts(reports);
    return <span>ใช้งาน {counts.active} · ปิดใช้งาน {counts.inactive}</span>;
}

function groupReports(reports: Report[]) {
    const groups = new Map<number | null, { id: number | null; name: string; reports: Report[] }>();
    reports.forEach(report => {
        if (!groups.has(report.CategoryId)) groups.set(report.CategoryId, { id: report.CategoryId, name: report.CategoryName || 'ยังไม่จัดหมวด', reports: [] });
        groups.get(report.CategoryId)!.reports.push(report);
    });
    return [...groups.values()];
}

export default function AdminRolesPage() {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [roles, setRoles] = useState<Role[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const [reportQuery, setReportQuery] = useState('');
    const [tab, setTab] = useState<Tab>('reports');
    const [compareId, setCompareId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [draft, setDraft] = useState<RoleAccessDraft | null>(null);
    const [nameForm, setNameForm] = useState<NameForm | null>(null);
    const [formError, setFormError] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [memberState, setMemberState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    const detailHeading = useRef<HTMLHeadingElement>(null);
    const changes = draft ? draftChanges(draft) : { added: [], removed: [], dirty: false };
    const nameDirty = !!nameForm && (nameForm.name !== nameForm.originalName || !!nameForm.copyFrom);
    const { confirmDiscard } = useUnsavedChanges(changes.dirty || nameDirty);

    const loadRoles = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setLoadError('');
        try {
            const response = await fetch('/api/admin/roles', { signal });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'ไม่สามารถโหลดกลุ่มสิทธิ์ได้');
            setRoles(data.roles);
            setReports(data.allReports);
            setSelectedId(previous => data.roles.some((role: Role) => role.RoleId === previous) ? previous : (data.roles[0]?.RoleId ?? null));
        } catch (error) {
            if (signal?.aborted) return;
            setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดกลุ่มสิทธิ์ได้');
        } finally { if (!signal?.aborted) setLoading(false); }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void loadRoles(controller.signal);
        return () => controller.abort();
    }, [loadRoles]);

    const selected = roles.find(role => role.RoleId === selectedId);
    const assigned = selected ? reportsForRole(selected, reports) : [];
    const selectedSet = new Set(draft?.selectedReports ?? []);
    const shown = draft ? editReports(reports, draft, reportQuery) : [];
    const visibleSelected = shown.filter(report => selectedSet.has(report.ReportId)).length;
    const roleMembers = members.filter(member => member.RoleId === selectedId);
    const otherRoles = roles.filter(role => role.RoleId !== selectedId && !isAdminRole(role));
    const compareRole = otherRoles.find(role => String(role.RoleId) === compareId) ?? otherRoles[0];
    const comparison = selected && compareRole ? compareRoleReports(selected, compareRole, reports) : null;
    const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
        { id: 'reports', label: 'รายงานที่อนุญาต', icon: FileText },
        { id: 'members', label: `สมาชิก ${selected?.UserCount ?? 0}`, icon: Users },
        ...(!selected || isAdminRole(selected) ? [] : [{ id: 'compare' as const, label: 'เทียบกับกลุ่มอื่น', icon: GitCompareArrows }]),
    ];

    const guardContext = () => {
        if (savingRef.current || loading) return false;
        if (!draft) return true;
        toast('บันทึกหรือยกเลิกการแก้ไขรายงานก่อนเปลี่ยนกลุ่มหรือทำรายการอื่น', 'info');
        return false;
    };
    const loadMembers = async () => {
        setMemberState('loading');
        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error('โหลดสมาชิกไม่สำเร็จ');
            setMembers(data.users);
            setMemberState('loaded');
        } catch { setMemberState('error'); }
    };
    const selectRole = (role: Role) => {
        if (role.RoleId === selectedId || !guardContext()) return;
        setSelectedId(role.RoleId);
        setCompareId('');
        if (isAdminRole(role) && tab === 'compare') setTab('reports');
        requestAnimationFrame(() => {
            detailHeading.current?.focus({ preventScroll: true });
            if (window.matchMedia('(max-width: 1023px)').matches) detailHeading.current?.scrollIntoView({ block: 'start' });
        });
    };
    const changeTab = (next: Tab) => {
        if (next === tab || !guardContext()) return;
        setTab(next);
        if (next === 'members' && memberState === 'idle') void loadMembers();
    };
    const startEdit = () => {
        if (!selected || isAdminRole(selected) || savingRef.current || loading) return;
        setDraft(createRoleDraft(selected));
        setReportQuery('');
    };
    const cancelEdit = async () => {
        if (savingRef.current || !(await confirmDiscard())) return;
        setDraft(null);
        setReportQuery('');
    };
    const updateSelection = (ids: number[], checked: boolean) => {
        if (!savingRef.current) setDraft(current => current ? setDraftReports(current, ids, checked) : null);
    };
    const saveDraft = async () => {
        if (!draft || savingRef.current || !changes.dirty) return;
        const payload = draftPayload(draft);
        savingRef.current = true;
        setSaving(true);
        try {
            const response = await fetch('/api/admin/roles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'บันทึกสิทธิ์ไม่สำเร็จ');
            setRoles(current => current.map(role => role.RoleId === payload.roleId ? { ...role, assignedReports: payload.assignedReports } : role));
            setDraft(null);
            setReportQuery('');
            toast(`บันทึกรายงานของกลุ่ม ${payload.roleName} แล้ว`, 'success');
        } catch (error) { toast(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); }
        finally { savingRef.current = false; setSaving(false); }
    };
    const openNameForm = (role?: Role) => {
        if (!guardContext() || (role && isAdminRole(role))) return;
        setFormError('');
        setNameForm({ mode: role ? 'rename' : 'create', roleId: role?.RoleId ?? 0, name: role?.RoleName ?? '', originalName: role?.RoleName ?? '', copyFrom: '' });
    };
    const closeNameForm = async () => {
        if (!savingRef.current && await confirmDiscard()) setNameForm(null);
    };
    const saveName = async (event: FormEvent) => {
        event.preventDefault();
        if (!nameForm || savingRef.current) return;
        const name = nameForm.name.trim();
        if (!name || name.length > 50) { setFormError('กรอกชื่อกลุ่มไม่เกิน 50 ตัวอักษร'); return; }
        if (name.toLowerCase() === 'admin') { setFormError('ชื่อ Admin สงวนไว้สำหรับผู้ดูแลระบบ'); return; }
        if (roles.some(role => role.RoleId !== nameForm.roleId && role.RoleName.toLowerCase() === name.toLowerCase())) { setFormError('มีกลุ่มสิทธิ์ชื่อนี้แล้ว'); return; }
        const original = roles.find(role => role.RoleId === nameForm.roleId);
        const copy = roles.find(role => String(role.RoleId) === nameForm.copyFrom);
        const assignedReports = nameForm.mode === 'rename' ? original?.assignedReports ?? [] : copy?.assignedReports ?? [];
        savingRef.current = true;
        setSaving(true);
        try {
            const response = await fetch('/api/admin/roles', { method: nameForm.mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: nameForm.roleId, roleName: name, assignedReports }) });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'บันทึกกลุ่มไม่สำเร็จ');
            if (nameForm.mode === 'create') {
                setRoles(current => [...current, { RoleId: data.roleId, RoleName: name, UserCount: 0, assignedReports: [...assignedReports] }]);
                setSelectedId(data.roleId);
                setTab('reports');
            } else setRoles(current => current.map(role => role.RoleId === nameForm.roleId ? { ...role, RoleName: name } : role));
            setNameForm(null);
            toast(nameForm.mode === 'create' ? 'เพิ่มกลุ่มสิทธิ์แล้ว' : 'เปลี่ยนชื่อกลุ่มแล้ว', 'success');
        } catch (error) { setFormError(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
        finally { savingRef.current = false; setSaving(false); }
    };
    const deleteRole = async () => {
        if (!selected || isAdminRole(selected) || !guardContext()) return;
        if (selected.UserCount > 0) { toast(`กลุ่มนี้มีสมาชิก ${selected.UserCount} คน ย้ายสมาชิกไปกลุ่มอื่นก่อนลบ`, 'info'); return; }
        const role = selected;
        if (!(await confirm({ title: `ลบกลุ่ม “${role.RoleName}”?`, message: `กลุ่มนี้ไม่มีสมาชิก สิทธิ์รายงาน ${role.assignedReports.length} รายการของกลุ่มจะถูกลบ รายงานยังคงอยู่`, confirmLabel: 'ลบกลุ่ม', variant: 'danger' }))) return;
        savingRef.current = true;
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/roles?roleId=${role.RoleId}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'ลบกลุ่มไม่สำเร็จ');
            setRoles(current => current.filter(item => item.RoleId !== role.RoleId));
            setSelectedId(roles.find(item => item.RoleId !== role.RoleId)?.RoleId ?? null);
            setTab('reports');
            toast('ลบกลุ่มสิทธิ์แล้ว', 'success');
        } catch (error) { toast(error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); }
        finally { savingRef.current = false; setSaving(false); }
    };

    return <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">กลุ่มสิทธิ์</h1><p className={`${muted} mt-1`}>กลุ่มกำหนดรายงานที่ผู้ใช้เข้าถึง ผู้ใช้ 1 คนอยู่ได้ 1 กลุ่ม ส่วนบริษัทกำหนดที่หน้าผู้ใช้</p></div>
            <div className="flex gap-2"><button className={button} aria-label="โหลดกลุ่มสิทธิ์ใหม่" disabled={loading || saving} onClick={() => { if (guardContext()) { void loadRoles(); if (tab === 'members') void loadMembers(); } }}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><button className={primary} disabled={loading || saving} onClick={() => openNameForm()}><Plus size={17} />เพิ่มกลุ่ม</button></div>
        </header>
        {loadError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{loadError} <button className="underline" onClick={() => { if (guardContext()) void loadRoles(); }}>ลองใหม่</button></div> : null}
        {loading && !roles.length ? <div className="flex justify-center p-12" role="status"><Loader2 className="animate-spin" /><span className="sr-only">กำลังโหลดกลุ่มสิทธิ์</span></div> : <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className={card} aria-label="รายการกลุ่มสิทธิ์">
                <div className="relative border-b border-slate-200 p-3 dark:border-slate-700"><Search size={16} className="pointer-events-none absolute left-6 top-6 text-slate-400" /><input className={`${input} pl-9`} value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหากลุ่ม" aria-label="ค้นหากลุ่มสิทธิ์" /></div>
                <div className="max-h-80 overflow-auto p-2 lg:max-h-[65vh]">{roles.filter(role => role.RoleName.toLowerCase().includes(query.trim().toLowerCase())).map(role => <button key={role.RoleId} aria-current={selectedId === role.RoleId ? 'true' : undefined} disabled={saving} onClick={() => selectRole(role)} className={`mb-1 flex w-full items-start gap-2 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-blue-600 ${selectedId === role.RoleId ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                    <span className="min-w-0 flex-1"><span className="block break-words font-medium">{role.RoleName}</span><span className={`${muted} mt-1 block text-xs`}>{role.UserCount} คน · {isAdminRole(role) ? `ทุกรายงานที่ใช้งาน (${reports.filter(isReportActive).length})` : <>รายงาน: <Counts reports={reportsForRole(role, reports)} /></>}</span></span>{isAdminRole(role) ? <LockKeyhole size={15} aria-label="ผู้ดูแลระบบ" /> : null}
                </button>)}{!roles.some(role => role.RoleName.toLowerCase().includes(query.trim().toLowerCase())) ? <p className={`${muted} p-4 text-center`}>ไม่พบกลุ่มสิทธิ์</p> : null}</div>
                <div className={`${muted} border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-700`}>{roles.length} กลุ่ม · {roles.reduce((sum, role) => sum + role.UserCount, 0)} ผู้ใช้</div>
            </section>
            {selected ? <section className={`${card} min-w-0`} aria-label="รายละเอียดกลุ่มสิทธิ์">
                <div className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h2 ref={detailHeading} tabIndex={-1} className="flex items-center gap-2 text-lg font-semibold text-slate-900 outline-none dark:text-white">{isAdminRole(selected) ? <LockKeyhole size={18} /> : null}กลุ่มสิทธิ์: {selected.RoleName}</h2><p className={`${muted} mt-1`}>{selected.UserCount} คน · รายงาน: <Counts reports={assigned} /></p></div>{!isAdminRole(selected) ? <div className="flex flex-wrap gap-2"><button className={button} disabled={saving} onClick={() => openNameForm(selected)}><Pencil size={15} />เปลี่ยนชื่อ</button><button className={`${button} text-red-600 dark:text-red-400`} disabled={saving} onClick={() => void deleteRole()}><Trash2 size={15} />ลบกลุ่ม</button>{tab === 'reports' && !draft ? <button className={primary} disabled={saving} onClick={startEdit}><Pencil size={15} />แก้ไขรายงานที่อนุญาต</button> : null}</div> : null}</div>
                <div className="flex flex-wrap gap-1 border-y border-slate-200 px-3 dark:border-slate-700" aria-label="มุมมองกลุ่มสิทธิ์">{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={tab === id} onClick={() => changeTab(id)} disabled={saving} className={`flex flex-wrap items-center gap-2 border-b-2 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${tab === id ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500 dark:text-slate-400'}`}><Icon size={16} />{label}{id === 'reports' ? <span className="text-xs"><Counts reports={assigned} /></span> : null}</button>)}</div>
                {tab === 'reports' ? isAdminRole(selected) ? <div className="m-5 flex gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"><Shield className="shrink-0" size={20} /><p>ผู้ดูแลระบบเห็นทุกรายงานที่ใช้งานอยู่ ({assigned.length} รายงาน) โดยอัตโนมัติ รวมรายงานใหม่ ชื่อและสิทธิ์ของกลุ่มนี้แก้ไขจากหน้านี้ไม่ได้</p></div> : draft ? <>
                    <div className="flex flex-wrap items-center gap-2 p-4"><input id="role-report-search" autoFocus className={`${input} sm:max-w-xs`} placeholder="ค้นหารายงาน" aria-label="ค้นหารายงานที่จะเลือก" value={reportQuery} disabled={saving} onChange={event => setReportQuery(event.target.value)} /><button className={button} disabled={saving || visibleSelected === shown.length} onClick={() => updateSelection(shown.map(report => report.ReportId), true)}>เลือกที่แสดงอยู่ ({shown.length})</button><button className={button} disabled={saving || !visibleSelected} onClick={() => updateSelection(shown.map(report => report.ReportId), false)}>ไม่เลือกที่แสดงอยู่</button></div>
                    <p role="status" className={`${muted} px-4 pb-3`}>เลือกทั้งหมด {selectedSet.size} · อยู่ในผลค้นหา {visibleSelected}</p>
                    {groupReports(shown).map(group => <div key={group.id ?? 'none'}><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 dark:bg-slate-900/50"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">หมวด: {group.name}</span><span className={muted}><Counts reports={group.reports} /></span></div><button className={`${button} py-1 text-xs`} disabled={saving} onClick={() => updateSelection(group.reports.map(report => report.ReportId), !group.reports.every(report => selectedSet.has(report.ReportId)))}>{group.reports.every(report => selectedSet.has(report.ReportId)) ? 'ไม่เลือก' : 'เลือก'} {group.reports.length} รายงาน{reportQuery.trim() ? 'ในผลค้นหานี้' : 'ในหมวดนี้'}</button></div>
                        {group.reports.map(report => <label key={report.ReportId} className="flex cursor-pointer flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"><input id={`role-${draft.roleId}-report-${report.ReportId}`} type="checkbox" checked={selectedSet.has(report.ReportId)} disabled={saving} onChange={event => updateSelection([report.ReportId], event.target.checked)} className="h-4 w-4 shrink-0 accent-blue-600" /><span className="min-w-0 flex-1 break-words">{report.ReportName}</span>{!isReportActive(report) ? <span className="text-xs text-slate-500">ปิดใช้งาน · เก็บสิทธิ์เดิม</span> : null}{changes.added.includes(report.ReportId) ? <span className="text-xs text-emerald-700 dark:text-emerald-300">+ จะเพิ่ม</span> : changes.removed.includes(report.ReportId) ? <span className="text-xs text-red-600 dark:text-red-300">− จะถอน</span> : null}</label>)}</div>)}
                    {!shown.length ? <p className={`${muted} p-8 text-center`}>ไม่พบรายงานตามคำค้น</p> : null}
                    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><span className={muted}>{changes.dirty ? `เพิ่ม ${changes.added.length} · ถอน ${changes.removed.length} · กระทบสมาชิก ${selected.UserCount} คน` : 'ยังไม่มีการเปลี่ยนแปลง'}</span><div className="flex gap-2"><button className={button} disabled={saving} onClick={() => void cancelEdit()}>ยกเลิก</button><button className={primary} disabled={saving || !changes.dirty} onClick={() => void saveDraft()}>{saving ? <Loader2 size={16} className="animate-spin" /> : null}บันทึก</button></div></div>
                </> : <>{groupReports(assigned).map(group => <div key={group.id ?? 'none'}><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-sm dark:bg-slate-900/50"><span className="font-medium">หมวด: {group.name}</span><span className={muted}><Counts reports={group.reports} /></span></div>{group.reports.map(report => <div key={report.ReportId} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm dark:border-slate-700"><span className="min-w-0 break-words">{report.ReportName}</span><span className="text-xs text-slate-500">{isReportActive(report) ? report.ReportType === 1 ? 'มาตรฐาน' : 'Template' : 'ปิดใช้งาน · สิทธิ์ยังเก็บไว้'}</span></div>)}</div>)}{!assigned.length ? <p className={`${muted} p-8 text-center`}>กลุ่มนี้ยังไม่มีรายงาน เลือกรายงานเพื่อให้สมาชิกเข้าถึงได้</p> : null}</> : null}
                {tab === 'members' ? <div className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className={muted}>เปลี่ยนกลุ่มและบริษัทที่เข้าถึงได้จากหน้าผู้ใช้</p><Link className={button} href="/admin/users">เปิดหน้าผู้ใช้</Link></div>{memberState === 'loading' ? <p role="status" className={muted}>กำลังโหลดสมาชิก…</p> : memberState === 'error' ? <div role="alert" className={muted}>โหลดสมาชิกไม่สำเร็จ <button className="underline" onClick={() => void loadMembers()}>ลองใหม่</button></div> : roleMembers.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="py-2 font-medium">ผู้ใช้</th><th>บัญชี</th><th>สถานะ</th></tr></thead><tbody>{roleMembers.map(member => <tr key={member.UserId} className="border-b border-slate-100 dark:border-slate-700"><td className="py-3"><span className="block font-medium">{member.FullName}</span><span className={muted}>@{member.Username}</span></td><td>{member.AuthType?.toLowerCase() === 'ldap' ? 'AD' : 'Local'}</td><td>{member.IsActive ? 'ใช้งาน' : 'ระงับ'}</td></tr>)}</tbody></table></div> : <p className={`${muted} py-8 text-center`}>กลุ่มนี้ยังไม่มีสมาชิก</p>}</div> : null}
                {tab === 'compare' && !isAdminRole(selected) ? <div className="space-y-4 p-5">{compareRole && comparison ? <><label className="block text-sm font-medium">เทียบกับกลุ่ม<select className={`${input} mt-2 max-w-sm`} value={compareRole.RoleId} onChange={event => setCompareId(event.target.value)}>{otherRoles.map(role => <option key={role.RoleId} value={role.RoleId}>{role.RoleName}</option>)}</select></label><p className={muted}>รายงานที่ใช้งานตรงกัน {comparison.both.length} จาก {comparison.union} รายงานรวม</p><p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">เทียบเฉพาะรายงานที่ใช้งาน ไม่รวมรายงานปิดใช้งานและบริษัทของสมาชิก รายงานตรงกันจึงไม่ได้หมายความว่าสิทธิ์ทุกด้านเหมือนกัน</p><div className="grid gap-3 xl:grid-cols-3">{[{ title: `เฉพาะ ${selected.RoleName}`, ids: comparison.onlyA }, { title: 'มีทั้งสองกลุ่ม', ids: comparison.both }, { title: `เฉพาะ ${compareRole.RoleName}`, ids: comparison.onlyB }].map(column => <section key={column.title} className={card}><h3 className="border-b border-slate-200 p-3 text-sm font-medium dark:border-slate-700">{column.title} · {column.ids.length}</h3><ul className="divide-y divide-slate-100 text-sm dark:divide-slate-700">{column.ids.map(id => <li className="break-words p-3" key={id}>{reports.find(report => report.ReportId === id)?.ReportName}</li>)}</ul>{!column.ids.length ? <p className={`${muted} p-3`}>ไม่มี</p> : null}</section>)}</div></> : <p className={muted}>ยังไม่มีกลุ่มอื่นให้เทียบ</p>}</div> : null}
            </section> : <div className={`${card} p-10 text-center ${muted}`}>ยังไม่มีกลุ่มสิทธิ์</div>}
        </div>}
        <AccessibleDialog open={!!nameForm} onClose={() => void closeNameForm()} title={nameForm?.mode === 'rename' ? 'เปลี่ยนชื่อกลุ่มสิทธิ์' : 'เพิ่มกลุ่มสิทธิ์'} description="ตั้งชื่อตามกลุ่มคนที่ใช้รายงานชุดเดียวกัน">
            {nameForm ? <form onSubmit={saveName} className="space-y-5"><div><label htmlFor="role-name" className="mb-2 block text-sm font-medium">ชื่อกลุ่ม <span className="text-red-600">*</span></label><input id="role-name" autoFocus className={input} maxLength={50} value={nameForm.name} disabled={saving} aria-invalid={!!formError} aria-describedby={formError ? 'role-form-error' : undefined} onChange={event => { setNameForm({ ...nameForm, name: event.target.value }); setFormError(''); }} /></div>{nameForm.mode === 'create' ? <div><label htmlFor="role-copy" className="mb-2 block text-sm font-medium">เริ่มจากรายงานของกลุ่ม</label><select id="role-copy" className={input} disabled={saving} value={nameForm.copyFrom} onChange={event => setNameForm({ ...nameForm, copyFrom: event.target.value })}><option value="">ไม่คัดลอก — เริ่มจากกลุ่มว่าง</option>{roles.filter(role => !isAdminRole(role)).map(role => <option key={role.RoleId} value={role.RoleId}>{role.RoleName} · {role.assignedReports.length} รายการที่กำหนดสิทธิ์</option>)}</select></div> : null}{formError ? <p id="role-form-error" role="alert" className="text-sm text-red-600">{formError}</p> : null}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={() => void closeNameForm()}>ยกเลิก</button><button className={primary} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null}{nameForm.mode === 'create' ? 'เพิ่มกลุ่ม' : 'บันทึก'}</button></div></form> : null}
        </AccessibleDialog>
    </div>;
}
