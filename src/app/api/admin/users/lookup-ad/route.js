import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ldapLookup, ldapSearchUsers } from '@/lib/ldap';

/**
 * GET /api/admin/users/lookup-ad?username=veerapon.l       → exact lookup
 * GET /api/admin/users/lookup-ad?search=veer               → wildcard search (autocomplete)
 */
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username');
        const search = searchParams.get('search');

        if (search) {
            // Wildcard search mode (autocomplete)
            if (search.length < 2) {
                return NextResponse.json({ success: true, users: [] });
            }
            const result = await ldapSearchUsers(search);
            return NextResponse.json(result);
        }

        if (username) {
            // Exact lookup mode
            const result = await ldapLookup(username);
            return NextResponse.json(result);
        }

        return NextResponse.json({ success: false, message: 'กรุณาระบุ username หรือ search' }, { status: 400 });

    } catch (error) {
        console.error('AD Lookup error:', error);
        return NextResponse.json({ success: false, error: `Error: ${error.message}` }, { status: 500 });
    }
}
