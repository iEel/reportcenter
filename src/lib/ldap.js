/**
 * LDAP Integration Library
 * 
 * All LDAP operations are delegated to ldap-worker.cjs which runs as a 
 * separate Node.js process. This avoids Next.js Turbopack bundling 
 * ldapjs (which corrupts its BER parser in production builds).
 */

import { connectToCentralDB } from './db';

/**
 * Call the LDAP worker process.
 * Uses exec() with a command string so Turbopack cannot trace the file path.
 * Arguments are base64-encoded to avoid shell escaping issues.
 */
function callWorker(action, args) {
    return new Promise((resolve) => {
        // Dynamic import to prevent Turbopack from analyzing child_process usage
        import('child_process').then(({ exec }) => {
            const argsB64 = Buffer.from(JSON.stringify(args)).toString('base64');
            // Use exec with string command — Turbopack can't trace this
            const cmd = `node ldap-worker.cjs ${action} ${argsB64}`;

            exec(cmd, {
                cwd: process.cwd(),
                timeout: 15000,
                maxBuffer: 1024 * 1024,
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`LDAP worker error (${action}):`, error.message);
                    if (stderr) console.error('LDAP worker stderr:', stderr);
                    resolve({ success: false, error: `Worker error: ${error.message}` });
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseErr) {
                    console.error('LDAP worker parse error, stdout:', stdout);
                    resolve({ success: false, error: 'Invalid response from LDAP worker' });
                }
            });
        }).catch(err => {
            resolve({ success: false, error: `Cannot load child_process: ${err.message}` });
        });
    });
}

/**
 * Read LDAP configuration from SystemSettings + .env
 */
export async function getLdapConfig() {
    try {
        const pool = await connectToCentralDB();
        const result = await pool.request().query(`
            SELECT SettingKey, SettingValue FROM SystemSettings
            WHERE SettingKey IN ('ldap_enabled','ldap_url','ldap_domain','ldap_basedn')
        `);

        const settings = {};
        result.recordset.forEach(row => {
            settings[row.SettingKey] = row.SettingValue;
        });

        return {
            enabled: settings['ldap_enabled'] === 'true',
            url: settings['ldap_url'] || '',
            domain: settings['ldap_domain'] || '',
            baseDN: settings['ldap_basedn'] || '',
            bindDN: process.env.LDAP_BIND_DN || '',
            bindPassword: process.env.LDAP_BIND_PASSWORD || '',
        };
    } catch (err) {
        console.error('Error reading LDAP config:', err.message);
        return { enabled: false, url: '', domain: '', baseDN: '', bindDN: '', bindPassword: '' };
    }
}

/**
 * Authenticate a user via LDAP bind (for login)
 */
export async function ldapBind(username, password) {
    const config = await getLdapConfig();
    if (!config.enabled) return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    if (!config.url || !config.domain) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };

    return callWorker('bind', {
        config: { url: config.url, domain: config.domain, password },
        username,
    });
}

/**
 * Look up a single user in AD by exact sAMAccountName
 */
export async function ldapLookup(username) {
    const config = await getLdapConfig();
    if (!config.enabled) return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    if (!config.url || !config.domain || !config.baseDN) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };
    if (!config.bindDN || !config.bindPassword) return { success: false, error: 'ไม่ได้ตั้งค่า Service Account ใน .env' };

    return callWorker('lookup', {
        config: { url: config.url, domain: config.domain, baseDN: config.baseDN, bindDN: config.bindDN, bindPassword: config.bindPassword },
        username,
    });
}

/**
 * Search AD users with wildcard (for autocomplete)
 */
export async function ldapSearchUsers(query) {
    const config = await getLdapConfig();
    if (!config.enabled) return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    if (!config.url || !config.domain || !config.baseDN) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };
    if (!config.bindDN || !config.bindPassword) return { success: false, error: 'ไม่ได้ตั้งค่า Service Account ใน .env' };

    return callWorker('search', {
        config: { url: config.url, domain: config.domain, baseDN: config.baseDN, bindDN: config.bindDN, bindPassword: config.bindPassword },
        query,
    });
}

/**
 * Test LDAP connection using service account
 */
export async function testLdapConnection() {
    const config = await getLdapConfig();
    if (!config.url || !config.domain || !config.baseDN) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };
    if (!config.bindDN || !config.bindPassword) return { success: false, error: 'ไม่ได้ตั้งค่า Service Account ใน .env' };

    return callWorker('test', {
        config: { url: config.url, bindDN: config.bindDN, bindPassword: config.bindPassword },
    });
}
