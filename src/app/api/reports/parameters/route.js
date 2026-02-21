import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json({ success: false, message: "ReportId is required" }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Auto-add LookupQuery column if missing
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReportParameters' AND COLUMN_NAME = 'LookupQuery')
                ALTER TABLE ReportParameters ADD LookupQuery NVARCHAR(MAX) NULL;
            `);
        } catch { }

        const query = `
            SELECT ParameterId, ParameterName, DisplayLabel, InputType, DropdownQuery, LookupQuery, OrderIndex 
            FROM ReportParameters
            WHERE ReportId = @ReportId
            ORDER BY OrderIndex;
        `;

        const result = await pool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .query(query);

        return NextResponse.json({ success: true, parameters: result.recordset });

    } catch (error) {
        console.error("Error fetching report parameters:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
