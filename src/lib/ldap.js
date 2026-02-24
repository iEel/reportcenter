/**
 * LDAP Integration Library
 * Direct ldapjs import — requires building with webpack (not Turbopack)
 * to properly externalize ldapjs via serverExternalPackages in next.config.ts
 */

import { connectToCentralDB } from './db';
import ldap from 'ldapjs';

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
 * Create an LDAP client with timeout
 */
function createClient(url) {
    return ldap.createClient({
        url: [url],
        connectTimeout: 5000,
        timeout: 10000,
        strictDN: false,
    });
}

/**
 * Parse OU from Distinguished Name
 */
function parseDistinguishedName(dn) {
    let department = '';
    let branch = '';
    if (!dn) return { department, branch };
    const ouMatches = dn.match(/OU=([^,]+)/gi);
    if (ouMatches && ouMatches.length > 0) {
        const ous = ouMatches.map(m => m.replace(/OU=/i, ''));
        if (ous.length >= 2) {
            department = ous[0] || '';
            branch = ous[1] || '';
        } else if (ous.length === 1) {
            department = ous[0] || '';
        }
    }
    return { department, branch };
}

/**
 * Parse an LDAP search entry into a user object
 */
function parseEntry(entry) {
    const attrs = {};
    const pojo = entry.pojo || entry;
    if (pojo.attributes) {
        for (const attr of pojo.attributes) {
            if (attr.type) {
                attrs[attr.type] = attr.values?.[0] || '';
            }
        }
    }
    const dn = attrs['distinguishedName'] || (entry.dn ? entry.dn.toString() : '');
    const { department, branch } = parseDistinguishedName(dn);
    return {
        username: attrs['sAMAccountName'] || '',
        fullName: attrs['displayName'] || '',
        email: attrs['mail'] || '',
        employeeId: attrs['employeeID'] || '',
        company: attrs['company'] || '',
        department,
        branch,
    };
}

/**
 * Authenticate a user via LDAP bind (for login)
 */
export async function ldapBind(username, password) {
    const config = await getLdapConfig();
    if (!config.enabled) return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    if (!config.url || !config.domain) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };

    const upn = `${username}@${config.domain}`;
    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', () => resolve({ success: false, error: 'ไม่สามารถเชื่อมต่อ LDAP ได้' }));
        client.bind(upn, password, (err) => {
            client.unbind(() => { });
            resolve(err ? { success: false, error: `Bind ล้มเหลว: ${err.message}` } : { success: true });
        });
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

    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', (err) => resolve({ success: false, error: `ไม่สามารถเชื่อมต่อ: ${err.message}` }));

        client.bind(config.bindDN, config.bindPassword, (bindErr) => {
            if (bindErr) { client.unbind(() => { }); return resolve({ success: false, error: `Bind ล้มเหลว: ${bindErr.message}` }); }

            const searchFilter = `(sAMAccountName=${username.replace(/[\\*()\x00]/g, '')})`;
            client.search(config.baseDN, { scope: 'sub', filter: searchFilter }, (searchErr, res) => {
                if (searchErr) { client.unbind(() => { }); return resolve({ success: false, error: `Search ล้มเหลว: ${searchErr.message}` }); }

                let found = false;
                let userData = {};

                res.on('searchEntry', (entry) => {
                    try { found = true; userData = { success: true, ...parseEntry(entry) }; } catch (e) { }
                });
                res.on('error', () => { client.unbind(() => { }); resolve(found ? userData : { success: false, error: 'Search error' }); });
                res.on('end', () => { client.unbind(() => { }); resolve(found ? userData : { success: false, error: 'ไม่พบ user ใน AD' }); });
            });
        });
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

    const safeQuery = query.replace(/[\\*()\x00/]/g, '');
    if (!safeQuery || safeQuery.length < 2) return { success: true, users: [] };

    const client = createClient(config.url);

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

        const timeout = setTimeout(() => {
            try { client.destroy(); } catch (e) { }
            safeResolve({ success: false, error: 'LDAP search timeout' });
        }, 10000);

        client.on('error', (err) => { clearTimeout(timeout); safeResolve({ success: false, error: `ไม่สามารถเชื่อมต่อ: ${err.message}` }); });

        client.bind(config.bindDN, config.bindPassword, (bindErr) => {
            if (bindErr) { clearTimeout(timeout); try { client.destroy(); } catch (e) { } return safeResolve({ success: false, error: `Bind ล้มเหลว: ${bindErr.message}` }); }

            const searchFilter = `(sAMAccountName=*${safeQuery}*)`;
            client.search(config.baseDN, { scope: 'sub', filter: searchFilter, sizeLimit: 10 }, (searchErr, res) => {
                if (searchErr) { clearTimeout(timeout); try { client.destroy(); } catch (e) { } return safeResolve({ success: false, error: `Search ล้มเหลว: ${searchErr.message}` }); }

                const users = [];
                res.on('searchEntry', (entry) => { try { users.push(parseEntry(entry)); } catch (e) { } });
                res.on('error', (err) => { clearTimeout(timeout); try { client.destroy(); } catch (e) { } safeResolve(err.code === 4 ? { success: true, users } : { success: false, error: `Error: ${err.message}` }); });
                res.on('end', () => { clearTimeout(timeout); try { client.destroy(); } catch (e) { } safeResolve({ success: true, users }); });
            });
        });
    });
}

/**
 * Test LDAP connection using service account
 */
export async function testLdapConnection() {
    const config = await getLdapConfig();
    if (!config.url || !config.domain || !config.baseDN) return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };
    if (!config.bindDN || !config.bindPassword) return { success: false, error: 'ไม่ได้ตั้งค่า Service Account ใน .env' };

    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', (err) => resolve({ success: false, error: `ไม่สามารถเชื่อมต่อ: ${err.message}` }));
        client.bind(config.bindDN, config.bindPassword, (err) => {
            client.unbind(() => { });
            resolve(err ? { success: false, error: `Bind ล้มเหลว: ${err.message}` } : { success: true });
        });
    });
}
