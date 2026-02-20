import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';

export async function GET(request) {
    try {
        // In a real application, you would get the user's role from their authentication token (NextAuth, JWT, etc.)
        // For this demo, we'll simulate a logged-in user with RoleId = 2 (Sales)
        const userRoleId = 2; // Hardcoded for demonstration

        const pool = await connectToCentralDB();

        const query = `
            SELECT r.ReportId, r.ReportName, r.Description, r.ReportType, r.EmailTemplateContent
            FROM Reports r
            LEFT JOIN ReportRoleMapping m ON r.ReportId = m.ReportId
            WHERE r.IsActive = 1 
              AND (r.IsPublic = 1 OR m.RoleId = @UserRoleId)
            GROUP BY r.ReportId, r.ReportName, r.Description, r.ReportType, r.EmailTemplateContent
            ORDER BY r.ReportType, r.ReportName;
        `;

        const result = await pool.request()
            .input('UserRoleId', sql.Int, userRoleId)
            .query(query);

        return NextResponse.json({ success: true, reports: result.recordset });

    } catch (error) {
        console.error("Error fetching reports:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
