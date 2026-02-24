/**
 * LDAP Integration Library
 * 
 * All LDAP operations are delegated to ldap-worker.cjs which runs as a 
 * separate Node.js process. This avoids Next.js Turbopack bundling 
 * ldapjs (which corrupts its BER parser in production builds).
 */

import { connectToCentralDB } from './db';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the path to the ldap-worker.cjs script.
 * In production (build), __dirname points to .next/server/... so we use
 * process.cwd() to find the worker in the project root.
 */
function getWorkerPath() {
    // Try multiple locations
    const candidates = [
        path.join(process.cwd(), 'src', 'lib', 'ldap-worker.cjs'),
        path.join(process.cwd(), 'ldap-worker.cjs'),
    ];

    // In dev, __dirname works
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        candidates.unshift(path.join(__dirname, 'ldap-worker.cjs'));
    } catch (e) { /* import.meta.url not available */ }

    return candidates[0]; // Primary location
}

/**
 * Call the LDAP worker process
 */
function callWorker(action, args) {
    return new Promise((resolve) => {
        const workerPath = getWorkerPath();
        const argsJson = JSON.stringify(args);

        execFile('node', [workerPath, action, argsJson], {
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
                console.error('LDAP worker output parse error:', stdout);
                resolve({ success: false, error: 'Invalid response from LDAP worker' });
            }
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
