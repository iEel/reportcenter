import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const pool = await connectToCentralDB();

        // Check if SystemSettings table exists
        const tableCheck = await pool.request().query(
            `SELECT OBJECT_ID('SystemSettings') AS TableExists`
        );

        if (!tableCheck.recordset[0].TableExists) {
            // Create table if it doesn't exist
            await pool.request().query(`
                CREATE TABLE SystemSettings (
                    SettingKey NVARCHAR(100) PRIMARY KEY,
                    SettingValue NVARCHAR(MAX),
                    Description NVARCHAR(200),
                    UpdatedAt DATETIME DEFAULT GETDATE()
                );

                INSERT INTO SystemSettings (SettingKey, SettingValue, Description) VALUES
                ('company_1_name', 'Sonic Interfreight (SNI)', 'ชื่อบริษัทที่ 1'),
                ('company_2_name', 'Grandlink Logistics (GRL)', 'ชื่อบริษัทที่ 2'),
                ('company_3_name', 'Sonic Autologis (SALOG)', 'ชื่อบริษัทที่ 3'),
                ('app_name', 'ReportCenter', 'ชื่อระบบ'),
                ('org_name', 'Sonic Group', 'ชื่อองค์กร'),
                ('rate_limit_max_attempts', '5', 'จำนวนครั้งสูงสุดที่อนุญาต Login ผิดพลาด'),
                ('rate_limit_window_minutes', '15', 'ระยะเวลาล็อก (นาที)');
            `);
        }

        const result = await pool.request().query(
            `SELECT SettingKey, SettingValue, Description, UpdatedAt FROM SystemSettings ORDER BY SettingKey`
        );

        // Auto-seed rate limit + idle timeout settings if missing
        const keys = result.recordset.map(r => r.SettingKey);
        const seedSettings = [];
        if (!keys.includes('rate_limit_max_attempts')) {
            seedSettings.push("('rate_limit_max_attempts', '5', 'จำนวนครั้งสูงสุดที่อนุญาต Login ผิดพลาด')");
            seedSettings.push("('rate_limit_window_minutes', '15', 'ระยะเวลาล็อก (นาที)')");
        }
        if (!keys.includes('session_idle_timeout_minutes')) {
            seedSettings.push("('session_idle_timeout_minutes', '30', 'ระยะเวลาไม่ใช้งานก่อนออกจากระบบอัตโนมัติ (นาที) — 0 = ปิดใช้งาน')");
        }
        if (!keys.includes('ldap_enabled')) {
            seedSettings.push("('ldap_enabled', 'false', 'เปิด/ปิด LDAP Authentication')");
            seedSettings.push("('ldap_url', '', 'LDAP Server URL เช่น ldap://192.168.1.10')");
            seedSettings.push("('ldap_domain', '', 'Domain สำหรับ UPN bind เช่น soniclocal.com')");
            seedSettings.push("('ldap_base_dn', '', 'Base DN สำหรับ search เช่น DC=soniclocal,DC=com')");
        }

        if (seedSettings.length > 0) {
            await pool.request().query(`
                INSERT INTO SystemSettings (SettingKey, SettingValue, Description) VALUES
                ${seedSettings.join(',\n                ')}
            `);
            // Re-fetch after seeding
            const updated = await pool.request().query(
                `SELECT SettingKey, SettingValue, Description, UpdatedAt FROM SystemSettings ORDER BY SettingKey`
            );
            return NextResponse.json({ success: true, settings: updated.recordset });
        }

        return NextResponse.json({ success: true, settings: result.recordset });

    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { settings } = await request.json();

        if (!settings || !Array.isArray(settings)) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        for (const s of settings) {
            await pool.request()
                .input('Key', sql.NVarChar(100), s.SettingKey)
                .input('Value', sql.NVarChar(sql.MAX), s.SettingValue)
                .query(`
                    UPDATE SystemSettings 
                    SET SettingValue = @Value, UpdatedAt = GETDATE() 
                    WHERE SettingKey = @Key
                `);
        }

        return NextResponse.json({ success: true, message: 'บันทึกการตั้งค่าสำเร็จ' });

    } catch (error) {
        console.error('Settings PUT error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
