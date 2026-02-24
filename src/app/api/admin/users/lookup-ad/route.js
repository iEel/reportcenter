import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ldapLookup } from '@/lib/ldap';

/**
 * GET /api/admin/users/lookup-ad?username=veerapon.l
 * Lookup user info from Active Directory
 */
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username');

        if (!username) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุ username' }, { status: 400 });
        }

        const result = await ldapLookup(username);
        return NextResponse.json(result);

    } catch (error) {
        console.error('AD Lookup error:', error);
        return NextResponse.json({ success: false, error: `Error: ${error.message}` }, { status: 500 });
    }
}
