import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { testLdapConnection } from '@/lib/ldap';

/**
 * POST /api/admin/settings/test-ldap
 * Test LDAP connection using service account
 */
export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const result = await testLdapConnection();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Test LDAP error:', error);
        return NextResponse.json({ success: false, message: `Error: ${error.message}` }, { status: 500 });
    }
}
