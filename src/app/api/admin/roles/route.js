import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: List all roles with their assigned reports
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const pool = await connectToCentralDB();

        // Get all roles
        const rolesResult = await pool.request().query(`
            SELECT r.RoleId, r.RoleName,
                   (SELECT COUNT(*) FROM Users u WHERE u.RoleId = r.RoleId) AS UserCount
            FROM Roles r
            ORDER BY r.RoleId
        `);

        // Get all report-role mappings
        const mappingsResult = await pool.request().query(`
            SELECT rrm.RoleId, rrm.ReportId, rpt.ReportName
            FROM ReportRoleMapping rrm
            JOIN Reports rpt ON rrm.ReportId = rpt.ReportId
            WHERE rpt.IsActive = 1
        `);

        // Get all active reports for selection
        const reportsResult = await pool.request().query(`
            SELECT ReportId, ReportName, ReportType
            FROM Reports WHERE IsActive = 1
            ORDER BY ReportName
        `);

        // Merge mappings into roles
        const roles = rolesResult.recordset.map(role => ({
            ...role,
            assignedReports: mappingsResult.recordset
                .filter(m => m.RoleId === role.RoleId)
                .map(m => m.ReportId),
        }));

        return NextResponse.json({
            success: true,
            roles,
            allReports: reportsResult.recordset,
        });
    } catch (error) {
        console.error('Roles GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create new role
export async function POST(request) {
    try {
        const { roleName, assignedReports } = await request.json();

        if (!roleName?.trim()) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุชื่อ Role' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Check duplicate
        const check = await pool.request()
            .input('RoleName', sql.NVarChar(50), roleName.trim())
            .query('SELECT RoleId FROM Roles WHERE RoleName = @RoleName');

        if (check.recordset.length > 0) {
            return NextResponse.json({ success: false, message: 'ชื่อ Role นี้มีอยู่แล้ว' }, { status: 400 });
        }

        // Insert role
        const result = await pool.request()
            .input('RoleName', sql.NVarChar(50), roleName.trim())
            .query('INSERT INTO Roles (RoleName) OUTPUT INSERTED.RoleId VALUES (@RoleName)');

        const newRoleId = result.recordset[0].RoleId;

        // Insert report mappings
        if (assignedReports && assignedReports.length > 0) {
            for (const reportId of assignedReports) {
                await pool.request()
                    .input('RoleId', sql.Int, newRoleId)
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .query('INSERT INTO ReportRoleMapping (RoleId, ReportId) VALUES (@RoleId, @ReportId)');
            }
        }

        return NextResponse.json({ success: true, roleId: newRoleId });
    } catch (error) {
        console.error('Roles POST error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT: Update role name and report mappings
export async function PUT(request) {
    try {
        const { roleId, roleName, assignedReports } = await request.json();

        if (!roleId || !roleName?.trim()) {
            return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบ' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Update role name
        await pool.request()
            .input('RoleId', sql.Int, parseInt(roleId))
            .input('RoleName', sql.NVarChar(50), roleName.trim())
            .query('UPDATE Roles SET RoleName = @RoleName WHERE RoleId = @RoleId');

        // Delete old mappings and re-insert
        await pool.request()
            .input('RoleId', sql.Int, parseInt(roleId))
            .query('DELETE FROM ReportRoleMapping WHERE RoleId = @RoleId');

        if (assignedReports && assignedReports.length > 0) {
            for (const reportId of assignedReports) {
                await pool.request()
                    .input('RoleId', sql.Int, parseInt(roleId))
                    .input('ReportId', sql.Int, parseInt(reportId))
                    .query('INSERT INTO ReportRoleMapping (RoleId, ReportId) VALUES (@RoleId, @ReportId)');
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Roles PUT error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Delete role (only if no users assigned)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const roleId = searchParams.get('roleId');

        if (!roleId) {
            return NextResponse.json({ success: false, message: 'ไม่พบ roleId' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Check if users are assigned to this role
        const check = await pool.request()
            .input('RoleId', sql.Int, parseInt(roleId))
            .query('SELECT COUNT(*) AS cnt FROM Users WHERE RoleId = @RoleId');

        if (check.recordset[0].cnt > 0) {
            return NextResponse.json({
                success: false,
                message: `ไม่สามารถลบได้ — Role นี้มีผู้ใช้ ${check.recordset[0].cnt} คนอยู่`,
            }, { status: 400 });
        }

        // Delete mappings first, then role
        await pool.request()
            .input('RoleId', sql.Int, parseInt(roleId))
            .query('DELETE FROM ReportRoleMapping WHERE RoleId = @RoleId');

        await pool.request()
            .input('RoleId', sql.Int, parseInt(roleId))
            .query('DELETE FROM Roles WHERE RoleId = @RoleId');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Roles DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
