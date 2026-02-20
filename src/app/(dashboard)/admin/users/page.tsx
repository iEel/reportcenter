"use client"

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Shield, User, Building, RefreshCw, X, Save, Loader2 } from "lucide-react";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        UserId: '',
        Username: '',
        PasswordHash: '',
        FullName: '',
        CompanyId: '',
        RoleId: '',
        IsActive: true
    });

    const fetchUsersAndRoles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
                setRoles(data.roles);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsersAndRoles();
    }, []);

    const handleOpenAddModal = () => {
        setEditMode(false);
        setFormData({
            UserId: '',
            Username: '',
            PasswordHash: '',
            FullName: '',
            CompanyId: '',
            RoleId: '',
            IsActive: true
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: any) => {
        setEditMode(true);
        setFormData({
            UserId: user.UserId,
            Username: user.Username,
            PasswordHash: '', // Keep empty unless changing
            FullName: user.FullName,
            CompanyId: user.CompanyId ? user.CompanyId.toString() : '',
            RoleId: user.RoleId ? user.RoleId.toString() : '',
            IsActive: user.IsActive
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSaveUser = async () => {
        if (!formData.FullName || (!editMode && !formData.Username)) {
            alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
            return;
        }

        setIsSaving(true);
        try {
            const endpoint = '/api/admin/users';
            const method = editMode ? 'PUT' : 'POST';

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (data.success) {
                alert(editMode ? "อัปเดตข้อมูลผู้ใช้สำเร็จ" : "เพิ่มผู้ใช้ใหม่สำเร็จ");
                setIsModalOpen(false);
                fetchUsersAndRoles();
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (error) {
            console.error("Error saving user:", error);
            alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        } finally {
            setIsSaving(false);
        }
    };

    const getCompanyName = (companyId: number) => {
        switch (companyId) {
            case 1: return "1. Sonic Interfreight (SNI)";
            case 2: return "2. Grandlink Logistics (GRL)";
            case 3: return "3. Sonic Autologis (SALOG)";
            default: return "ไม่ระบุ";
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้ & สิทธิ์</h1>
                    <p className="text-sm text-slate-500 mt-1">เพิ่มลบผู้ใช้งาน และกำหนดสิทธิ์ Role เพื่อควบคุมการเข้าถึงรายงาน</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchUsersAndRoles} className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg active:scale-95 transition-all shadow-md shadow-blue-500/30 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        เพิ่มผู้ใช้ใหม่
                    </button>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อผู้ใช้..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">ชื่อ-นามสกุล</th>
                                <th className="px-6 py-4">สาขา/บริษัท</th>
                                <th className="px-6 py-4">สิทธิ์ผู้ใช้ (Role)</th>
                                <th className="px-6 py-4">สถานะ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                                            กำลังโหลดข้อมูลผู้ใช้...
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">ไม่พบข้อมูลผู้ใช้ในระบบ</td>
                                </tr>
                            ) : users.map((user) => (
                                <tr key={user.UserId} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4 font-mono font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {user.Username}
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <User className="w-4 h-4" />
                                        </div>
                                        {user.FullName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Building className="w-4 h-4 text-slate-400" />
                                            {getCompanyName(user.CompanyId)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.RoleName ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                <Shield className="w-3 h-3" />
                                                {user.RoleName}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">ไม่ได้กำหนด</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.IsActive ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                ใช้งาน
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-slate-400">
                                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                                ถูกระงับ
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenEditModal(user)}
                                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                            title="แก้ไข"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Add/Edit User */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                {editMode ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-700 transition-colors p-1 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {!editMode && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.Username}
                                        onChange={e => setFormData({ ...formData, Username: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="เช่น jsmith"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ - นามสกุล <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.FullName}
                                    onChange={e => setFormData({ ...formData, FullName: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>

                            {!editMode && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่านเริ่มต้น</label>
                                    <input
                                        type="password"
                                        value={formData.PasswordHash}
                                        onChange={e => setFormData({ ...formData, PasswordHash: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="(ค่าเริ่มต้น: default_password)"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">เชื่อมต่อกับสาขา/บริษัท</label>
                                <select
                                    value={formData.CompanyId}
                                    onChange={e => setFormData({ ...formData, CompanyId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">-- ไม่ระบุ --</option>
                                    <option value="1">1. Sonic Interfreight (SNI)</option>
                                    <option value="2">2. Grandlink Logistics (GRL)</option>
                                    <option value="3">3. Sonic Autologis (SALOG)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">สิทธิ์การใช้งาน (Role)</label>
                                <select
                                    value={formData.RoleId}
                                    onChange={e => setFormData({ ...formData, RoleId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">-- ไม่ระบุ --</option>
                                    {roles.map(r => (
                                        <option key={r.RoleId} value={r.RoleId}>{r.RoleName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer border border-slate-200 p-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.IsActive}
                                        onChange={e => setFormData({ ...formData, IsActive: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">บัญชีนี้สามารถเข้าใช้งานได้ (Active)</span>
                                </label>
                            </div>

                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 font-medium rounded-lg transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveUser}
                                disabled={isSaving}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:active:scale-100 active:scale-95 shadow-sm shadow-blue-500/20"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
