import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rc_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const user = await verifyToken(token);
        if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');
        const paramName = searchParams.get('paramName');
        const q = searchParams.get('q') || '';
        const companyId = searchParams.get('companyId');

        if (!reportId || !paramName || !companyId) {
            return NextResponse.json({ success: false, message: 'reportId, paramName, companyId required' }, { status: 400 });
        }

        // Verify user has access to this company
        const allowed = user.allowedCompanies || [];
        if (!allowed.includes(parseInt(companyId))) {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        // Minimum 2 chars to search
        if (q.length < 2) {
            return NextResponse.json({ success: true, suggestions: [] });
        }

        // Fetch the LookupQuery for this parameter
        const pool = await connectToCentralDB();
        const paramResult = await pool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('ParameterName', sql.NVarChar(50), paramName)
            .query(`SELECT LookupQuery FROM ReportParameters WHERE ReportId = @ReportId AND ParameterName = @ParameterName`);

        if (paramResult.recordset.length === 0 || !paramResult.recordset[0].LookupQuery) {
            return NextResponse.json({ success: true, suggestions: [] });
        }

        const lookupQuery = paramResult.recordset[0].LookupQuery;

        // SQL Injection Guard: only allow SELECT queries
        const normalized = lookupQuery.trim().toUpperCase();
        const forbidden = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'EXEC ', 'EXECUTE ', 'TRUNCATE ', 'CREATE ', 'GRANT ', 'REVOKE ', 'xp_', 'sp_'];
        if (!normalized.startsWith('SELECT ') || forbidden.some(kw => normalized.includes(kw))) {
            console.error(`Blocked unsafe LookupQuery for param "${paramName}":`, lookupQuery);
            return NextResponse.json({ success: false, message: 'LookupQuery contains forbidden SQL statements' }, { status: 400 });
        }

        // Execute lookup on company DB
        const companyPool = await connectToCompanyDB(parseInt(companyId));
        const result = await companyPool.request()
            .input('q', sql.NVarChar(200), q)
            .query(lookupQuery);

        return NextResponse.json({
            success: true,
            suggestions: result.recordset.slice(0, 30), // Safety cap
        });

    } catch (error) {
        console.error('Search param error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
