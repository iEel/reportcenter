import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getSession } from '@/lib/auth';
import { connectToCentralDB } from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                { success: false, message: 'ไม่ได้เข้าสู่ระบบ' },
                { status: 401 }
            );
        }

        // Fetch available report types for this user
        let availableReportTypes = [];
        try {
            const pool = await connectToCentralDB();
            const isAdmin = session.roleName?.toLowerCase() === 'admin';

            let typeResult;
            if (isAdmin) {
                typeResult = await pool.request().query(`
                    SELECT DISTINCT ReportType FROM Reports WHERE IsActive = 1
                `);
            } else {
                typeResult = await pool.request()
                    .input('RoleId', sql.Int, session.roleId)
                    .query(`
                        SELECT DISTINCT r.ReportType
                        FROM Reports r
                        INNER JOIN ReportRoleMapping m ON r.ReportId = m.ReportId
                        WHERE r.IsActive = 1 AND m.RoleId = @RoleId
                    `);
            }
            availableReportTypes = typeResult.recordset.map(r => r.ReportType);
        } catch (e) {
            console.warn('Could not fetch report types:', e.message);
        }

        return NextResponse.json({
            success: true,
            user: {
                userId: session.userId,
                username: session.username,
                fullName: session.fullName,
                roleId: session.roleId,
                roleName: session.roleName,
                companyId: session.companyId,
                allowedCompanies: session.allowedCompanies || [],
                availableReportTypes,
            }
        });

    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาด' },
            { status: 500 }
        );
    }
}
