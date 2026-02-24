"use client"

import { useState, useEffect } from "react";
import { ArrowLeft, Database, Save, Code, Sliders, Type, Loader2 } from "lucide-react";
import Link from "next/link";
import TemplateEditor from "@/components/TemplateEditor";
import { useRouter, useParams } from "next/navigation";

export default function EditReportPage() {
    const router = useRouter();
    const params = useParams();
    const reportId = params?.id;

    const [activeTab, setActiveTab] = useState<'general' | 'sql' | 'template' | 'params'>('general');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [reportName, setReportName] = useState('');
    const [description, setDescription] = useState('');
    const [reportType, setReportType] = useState('1');
    const [isPublic, setIsPublic] = useState('public');
    const [isActive, setIsActive] = useState(true);
    const [tSqlQuery, setTSqlQuery] = useState('');
    const [emailTemplateContent, setEmailTemplateContent] = useState('');
    const [isHeavy, setIsHeavy] = useState(false);

    // Roles State
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/admin/users');
                const data = await res.json();
                if (data.success) setRoles(data.roles || []);
            } catch (error) {
                console.error("Failed to fetch roles:", error);
            }
        };
        fetchRoles();
    }, []);

    // Parameters State
    const [parameters, setParameters] = useState<any[]>([]);

    useEffect(() => {
        if (!reportId) return;

        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/${reportId}`);
                const data = await res.json();

                if (data.success) {
                    const r = data.report;
                    setReportName(r.ReportName || '');
                    setDescription(r.Description || '');
                    setReportType(r.ReportType ? r.ReportType.toString() : '1');
                    setIsPublic(r.IsPublic ? 'public' : 'role');
                    setIsActive(r.IsActive);
                    setTSqlQuery(r.TSqlQuery || '');
                    setEmailTemplateContent(r.EmailTemplateContent || '');
                    setIsHeavy(!!r.IsHeavy);
                    setParameters(data.parameters || []);
                    if (r.Roles) setSelectedRoles(r.Roles);
                } else {
                    alert("ไม่พบรายงานนี้ในระบบ");
                    router.push('/admin/reports');
                }
            } catch (error) {
                console.error("Failed to fetch report:", error);
                alert("ไม่สามารถดึงข้อมูลรายงานได้");
                router.push('/admin/reports');
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [reportId, router]);

    const extractParameters = () => {
        if (!tSqlQuery) return;
        const regex = /(?<!@)@([a-zA-Z0-9_]+)/g;
        const matches = [...tSqlQuery.matchAll(regex)];
        const extractedParams = matches.map(match => match[0]);
        const uniqueParams = [...new Set(extractedParams)];
        const newParams = uniqueParams.map(paramName => {
            const existing = parameters.find(p => p.ParameterName === paramName);
            return existing || {
                ParameterName: paramName,
                DisplayLabel: paramName.replace('@', ''),
                InputType: 'text',
                LookupQuery: '',
            };
        });
        setParameters(newParams);
        setActiveTab('params');
    };

    const handleParamChange = (index: number, field: string, value: string) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        setParameters(newParams);
    };

    const handleSave = async () => {
        if (!reportName || !tSqlQuery) {
            alert("กรุณากรอกชื่อรายงานและคำสั่ง T-SQL ให้ครบถ้วน");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/admin/reports/${reportId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report: {
                        ReportName: reportName,
                        Description: description,
                        ReportType: parseInt(reportType),
                        TSqlQuery: tSqlQuery,
                        EmailTemplateContent: parseInt(reportType) === 2 ? emailTemplateContent : null,
                        IsPublic: isPublic === 'public',
                        IsActive: isActive,
                        IsHeavy: isHeavy,
                        Roles: selectedRoles
                    },
                    parameters: parameters
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("แก้ไขและบันทึกรายงานสำเร็จ!");
                router.push('/admin/reports');
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-24 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/reports" className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">แก้ไขรายงาน: {reportName}</h1>
                        <p className="text-sm text-slate-500">แก้ไขรูปค่าพื้นฐาน ตัวแปร และคำสั่ง SQL</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium disabled:opacity-70 disabled:active:scale-100"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar Menu */}
                <div className="md:col-span-1 space-y-1">
                    <button onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'general' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Type className="w-4 h-4" /> ข้อมูลทั่วไป
                    </button>
                    <button onClick={() => setActiveTab('sql')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'sql' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Database className="w-4 h-4" /> คำสั่ง T-SQL
                    </button>
                    {reportType === '2' && (
                        <button onClick={() => setActiveTab('template')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'template' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Code className="w-4 h-4" /> อีเมลเทมเพลต
                        </button>
                    )}
                    <button onClick={() => setActiveTab('params')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'params' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                <Sliders className="w-4 h-4" /> ตัวแปร ({parameters.length})
                            </div>
                        </div>
                    </button>
                </div>

                {/* Content Area */}
                <div className="md:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">

                        {/* Tab 1: General Info */}
                        {activeTab === 'general' && (
                            <div className="p-6 space-y-5 animate-in fade-in duration-300">
                                <h3 className="text-lg font-semibold border-b border-slate-100 pb-3">1. ข้อมูลทั่วไปของรายงาน</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อรายงาน <span className="text-red-500">*</span></label>
                                        <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} placeholder="เช่น รายงานยอดขายประจำวัน" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">คำอธิบาย (จะแสดงใต้ชื่อรายงาน)</label>
                                        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="อธิบายสั้นๆ ว่ารายงานนี้เกี่ยวกับอะไร" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">รูปแบบรายงาน</label>
                                            <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                                                <option value="1">รายงานมาตรฐาน (Standard Table)</option>
                                                <option value="2">รายงานข้อความ (Template Email)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">สิทธิ์การเข้าถึง</label>
                                            <select value={isPublic} onChange={e => setIsPublic(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                                                <option value="public">ทุกคน (Public)</option>
                                                <option value="role">ระบุตามตำแหน่ง (Role Based)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer mt-4 border border-slate-200 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-700">เปิดใช้งานรายงานนี้ (Active)</span>
                                        </label>
                                    </div>
                                    {isPublic === 'role' && (
                                        <div className="mt-4 space-y-2">
                                            <label className="block text-sm font-medium text-slate-700">ระบุตำแหน่งที่เข้าถึงได้ (Roles)</label>
                                            <div className="flex flex-wrap gap-3">
                                                {roles.length === 0 ? (
                                                    <span className="text-sm text-slate-500 italic">ไม่พบตำแหน่งงานในระบบ...</span>
                                                ) : (
                                                    roles.map(role => (
                                                        <label key={role.RoleId} className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                                                            <input type="checkbox" checked={selectedRoles.includes(role.RoleId)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedRoles(prev => [...prev, role.RoleId]);
                                                                    else setSelectedRoles(prev => prev.filter(id => id !== role.RoleId));
                                                                }}
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm font-medium text-slate-700">{role.RoleName}</span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* Heavy Report Toggle */}
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isHeavy}
                                                onChange={e => setIsHeavy(e.target.checked)}
                                                className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                                            />
                                            <div>
                                                <span className="text-sm font-medium text-slate-700">🕐 รายงานขนาดใหญ่ (Background Job)</span>
                                                <p className="text-xs text-slate-500 mt-0.5">ถ้า query ใช้เวลานาน ให้สร้างไฟล์ในพื้นหลังแทนการดาวน์โหลดทันที</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: T-SQL Editor */}
                        {activeTab === 'sql' && (
                            <div className="flex flex-col h-full min-h-[500px] animate-in fade-in duration-300">
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                    <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                                        <Database className="w-4 h-4" /> SQL Editor <span className="text-red-500">*</span>
                                    </div>
                                    <button onClick={extractParameters} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md font-medium hover:bg-emerald-200 transition-colors">
                                        Extract Parameters จาก @
                                    </button>
                                </div>
                                <div className="flex-1 bg-[#1e1e1e] p-0 font-mono text-sm text-blue-300 leading-relaxed max-h-[500px]">
                                    <textarea value={tSqlQuery} onChange={e => setTSqlQuery(e.target.value)} className="w-full h-full min-h-[440px] bg-transparent text-slate-200 p-4 focus:outline-none resize-none" placeholder="SELECT * FROM TableName WHERE Date >= @StartDate" spellCheck={false} />
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Template Editor */}
                        {activeTab === 'template' && reportType === '2' && (
                            <TemplateEditor
                                value={emailTemplateContent}
                                onChange={setEmailTemplateContent}
                                sqlQuery={tSqlQuery}
                            />
                        )}

                        {/* Tab 4: Parameters */}
                        {activeTab === 'params' && (
                            <div className="p-6 space-y-5 animate-in fade-in duration-300">
                                <h3 className="text-lg font-semibold border-b border-slate-100 pb-3">3. ตั้งค่าหน้าจอกรอกเงื่อนไข (สำหรับลูกน้อง)</h3>
                                {parameters.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        ยังไม่มีตัวแปร กดปุ่ม <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">Extract Parameters จาก @</span> ในหน้าคำสั่ง T-SQL
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        {parameters.map((param, index) => (
                                            <div key={index} className="p-4 border border-blue-100 bg-blue-50/30 rounded-xl relative group">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                                    <div className="md:col-span-3">
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">ตัวแปร (ใน SQL)</label>
                                                        <input type="text" value={param.ParameterName} readOnly className="w-full bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200" />
                                                    </div>
                                                    <div className="md:col-span-5">
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">ชื่อที่จะแสดงบนหน้าจอ</label>
                                                        <input type="text" value={param.DisplayLabel} onChange={e => handleParamChange(index, 'DisplayLabel', e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">ประเภทช่องกรอกข้อมูล</label>
                                                        <select value={param.InputType} onChange={e => handleParamChange(index, 'InputType', e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none">
                                                            <option value="date">วันที่ (Date Picker)</option>
                                                            <option value="text">ข้อความ (Textbox)</option>
                                                            <option value="number">ตัวเลข</option>
                                                        </select>
                                                    </div>
                                                    <div className="md:col-span-12">
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                                                            Lookup Query <span className="text-slate-400 normal-case font-normal">(SQL ค้นหาแบบ Typeahead — ใช้ @q แทนค่าที่ user พิมพ์, ต้อง return คอลัมน์ value และ label)</span>
                                                        </label>
                                                        <textarea
                                                            value={param.LookupQuery || ''}
                                                            onChange={e => handleParamChange(index, 'LookupQuery', e.target.value)}
                                                            placeholder={`ตัวอย่าง: SELECT TOP 20 JOBNO AS value, JOBNO + ' - ' + EXPORTERNAME AS label FROM SFJOB WHERE JOBNO LIKE @q + '%' ORDER BY JOBNO DESC`}
                                                            rows={2}
                                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-slate-50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
