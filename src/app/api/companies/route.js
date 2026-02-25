import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCompanyList } from '@/lib/db';

/**
 * GET /api/companies
 * Returns list of all active companies from CompanyDatabases table
 * Used by frontend to dynamically display company names
 */
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const companies = await getCompanyList();

        return NextResponse.json({
            success: true,
            companies,
        });
    } catch (error) {
        console.error('Error fetching companies:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
