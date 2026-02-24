import ldap from 'ldapjs';
import sql from 'mssql';
import { connectToCentralDB } from './db.js';

/**
 * Read LDAP config from SystemSettings (URL/Domain/BaseDN) + .env (credentials)
 * @returns {{ enabled, url, domain, baseDN, bindDN, bindPassword }}
 */
export async function getLdapConfig() {
    const pool = await connectToCentralDB();
    const result = await pool.request().query(`
        SELECT SettingKey, SettingValue FROM SystemSettings
        WHERE SettingKey IN ('ldap_enabled', 'ldap_url', 'ldap_domain', 'ldap_base_dn')
    `);

    const cfg = {};
    for (const row of result.recordset) {
        cfg[row.SettingKey] = row.SettingValue;
    }

    return {
        enabled: cfg['ldap_enabled'] === 'true',
        url: cfg['ldap_url'] || '',
        domain: cfg['ldap_domain'] || '',
        baseDN: cfg['ldap_base_dn'] || '',
        bindDN: process.env.LDAP_BIND_DN || '',
        bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    };
}

/**
 * Parse distinguishedName to extract OU values
 * Example: CN=Veerapon,OU=IT,OU=SathuPradit,DC=soniclocal,DC=com
 *   → department = "IT", branch = "SathuPradit"
 */
function parseDistinguishedName(dn) {
    if (!dn) return { department: '', branch: '' };
    const ouParts = [];
    const parts = dn.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.toUpperCase().startsWith('OU=')) {
            ouParts.push(trimmed.substring(3));
        }
    }
    return {
        department: ouParts[0] || '',
        branch: ouParts[1] || '',
    };
}

/**
 * Create an LDAP client with timeout
 */
function createClient(url) {
    return ldap.createClient({
        url: [url],
        connectTimeout: 5000,
        timeout: 10000,
    });
}

/**
 * Authenticate a user via LDAP bind (for login)
 * @param {string} username - UPN prefix (e.g. "veerapon.l")
 * @param {string} password - User's AD password
 * @returns {{ success: boolean, error?: string }}
 */
export async function ldapBind(username, password) {
    const config = await getLdapConfig();

    if (!config.enabled) {
        return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    }
    if (!config.url || !config.domain) {
        return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่า URL หรือ Domain' };
    }

    const upn = `${username}@${config.domain}`;
    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', (err) => {
            resolve({ success: false, error: `ไม่สามารถเชื่อมต่อ LDAP Server: ${err.message}` });
        });

        client.bind(upn, password, (err) => {
            client.unbind(() => { });
            if (err) {
                resolve({ success: false, error: 'รหัสผ่าน AD ไม่ถูกต้อง' });
            } else {
                resolve({ success: true });
            }
        });
    });
}

/**
 * Lookup user info from AD (for admin creating AD users)
 * Binds with service account, then searches for the user
 * @param {string} username - UPN prefix (e.g. "veerapon.l")
 * @returns {{ success, fullName, email, employeeId, company, department, branch, error? }}
 */
export async function ldapLookup(username) {
    const config = await getLdapConfig();

    if (!config.enabled) {
        return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
    }
    if (!config.url || !config.domain || !config.baseDN) {
        return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ (URL/Domain/BaseDN)' };
    }
    if (!config.bindDN || !config.bindPassword) {
        return { success: false, error: 'ไม่ได้ตั้งค่า LDAP Service Account ใน .env' };
    }

    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', (err) => {
            resolve({ success: false, error: `ไม่สามารถเชื่อมต่อ LDAP Server: ${err.message}` });
        });

        // Step 1: Bind with service account
        client.bind(config.bindDN, config.bindPassword, (bindErr) => {
            if (bindErr) {
                client.unbind(() => { });
                return resolve({ success: false, error: `Service Account bind ล้มเหลว: ${bindErr.message}` });
            }

            // Step 2: Search for the user by sAMAccountName
            const searchFilter = `(sAMAccountName=${username})`;
            const searchOpts = {
                scope: 'sub',
                filter: searchFilter,
                attributes: ['sAMAccountName', 'displayName', 'mail', 'employeeID', 'company', 'distinguishedName'],
            };

            client.search(config.baseDN, searchOpts, (searchErr, res) => {
                if (searchErr) {
                    client.unbind(() => { });
                    return resolve({ success: false, error: `Search ล้มเหลว: ${searchErr.message}` });
                }

                let found = false;
                let userData = {};

                res.on('searchEntry', (entry) => {
                    found = true;
                    const attrs = {};
                    // ldapjs v3+ uses pojo property
                    const pojo = entry.pojo || entry;
                    if (pojo.attributes) {
                        for (const attr of pojo.attributes) {
                            attrs[attr.type] = attr.values?.[0] || '';
                        }
                    }

                    const dn = attrs['distinguishedName'] || entry.dn?.toString() || '';
                    const { department, branch } = parseDistinguishedName(dn);

                    userData = {
                        success: true,
                        username: attrs['sAMAccountName'] || username,
                        fullName: attrs['displayName'] || '',
                        email: attrs['mail'] || '',
                        employeeId: attrs['employeeID'] || '',
                        company: attrs['company'] || '',
                        department,
                        branch,
                    };
                });

                res.on('error', (err) => {
                    client.unbind(() => { });
                    resolve({ success: false, error: `Search error: ${err.message}` });
                });

                res.on('end', () => {
                    client.unbind(() => { });
                    if (found) {
                        resolve(userData);
                    } else {
                        resolve({ success: false, error: `ไม่พบ "${username}" ใน Active Directory` });
                    }
                });
            });
        });
    });
}

/**
 * Search AD for users matching a partial username (for autocomplete)
 * Returns up to 10 matching users
 * @param {string} query - Partial username (e.g. "veer")
 * @returns {{ success, users: Array<{username, fullName, email, department}>, error? }}
 */
export async function ldapSearchUsers(query) {
    try {
        const config = await getLdapConfig();

        if (!config.enabled) {
            return { success: false, error: 'LDAP ไม่ได้เปิดใช้งาน' };
        }
        if (!config.url || !config.domain || !config.baseDN) {
            return { success: false, error: 'LDAP ยังไม่ได้ตั้งค่าครบ' };
        }
        if (!config.bindDN || !config.bindPassword) {
            return { success: false, error: 'ไม่ได้ตั้งค่า Service Account ใน .env' };
        }

        // Escape LDAP special characters
        const safeQuery = query.replace(/[\\*()\x00/]/g, '');
        if (!safeQuery || safeQuery.length < 2) {
            return { success: true, users: [] };
        }

        const client = createClient(config.url);

        return new Promise((resolve) => {
            let resolved = false;
            const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

            // Timeout safety
            const timeout = setTimeout(() => {
                try { client.unbind(() => { }); } catch (e) { }
                safeResolve({ success: false, error: 'LDAP search timeout' });
            }, 10000);

            client.on('error', (err) => {
                clearTimeout(timeout);
                safeResolve({ success: false, error: `ไม่สามารถเชื่อมต่อ: ${err.message}` });
            });

            client.bind(config.bindDN, config.bindPassword, (bindErr) => {
                if (bindErr) {
                    clearTimeout(timeout);
                    try { client.unbind(() => { }); } catch (e) { }
                    return safeResolve({ success: false, error: `Bind ล้มเหลว: ${bindErr.message}` });
                }

                // Simpler filter — only search sAMAccountName to avoid ldapjs parse issues
                const searchFilter = `(sAMAccountName=*${safeQuery}*)`;
                const searchOpts = {
                    scope: 'sub',
                    filter: searchFilter,
                    attributes: ['sAMAccountName', 'displayName', 'mail', 'employeeID', 'company', 'distinguishedName'],
                    sizeLimit: 10,
                };

                try {
                    client.search(config.baseDN, searchOpts, (searchErr, res) => {
                        if (searchErr) {
                            clearTimeout(timeout);
                            try { client.unbind(() => { }); } catch (e) { }
                            return safeResolve({ success: false, error: `Search ล้มเหลว: ${searchErr.message}` });
                        }

                        const users = [];

                        res.on('searchEntry', (entry) => {
                            try {
                                const attrs = {};
                                const pojo = entry.pojo || entry;
                                if (pojo.attributes) {
                                    for (const attr of pojo.attributes) {
                                        attrs[attr.type] = attr.values?.[0] || '';
                                    }
                                }

                                const dn = attrs['distinguishedName'] || entry.dn?.toString() || '';
                                const { department, branch } = parseDistinguishedName(dn);

                                users.push({
                                    username: attrs['sAMAccountName'] || '',
                                    fullName: attrs['displayName'] || '',
                                    email: attrs['mail'] || '',
                                    employeeId: attrs['employeeID'] || '',
                                    company: attrs['company'] || '',
                                    department,
                                    branch,
                                });
                            } catch (e) {
                                console.warn('Error parsing LDAP entry:', e.message);
                            }
                        });

                        res.on('error', (err) => {
                            clearTimeout(timeout);
                            try { client.unbind(() => { }); } catch (e) { }
                            // Size limit exceeded is not a real error — just return what we have
                            if (err.code === 4 || err.message?.includes('Size Limit')) {
                                safeResolve({ success: true, users });
                            } else {
                                safeResolve({ success: false, error: `Search error: ${err.message}` });
                            }
                        });

                        res.on('end', () => {
                            clearTimeout(timeout);
                            try { client.unbind(() => { }); } catch (e) { }
                            safeResolve({ success: true, users });
                        });
                    });
                } catch (filterErr) {
                    clearTimeout(timeout);
                    try { client.unbind(() => { }); } catch (e) { }
                    safeResolve({ success: false, error: `Filter error: ${filterErr.message}` });
                }
            });
        });
    } catch (err) {
        console.error('ldapSearchUsers fatal error:', err);
        return { success: false, error: `Error: ${err.message}` };
    }
}

/**
 * Test LDAP connection by binding with service account
 * @returns {{ success: boolean, message: string }}
 */
export async function testLdapConnection() {
    const config = await getLdapConfig();

    if (!config.url) {
        return { success: false, message: 'ยังไม่ได้ตั้งค่า LDAP URL' };
    }
    if (!config.bindDN || !config.bindPassword) {
        return { success: false, message: 'ไม่ได้ตั้งค่า LDAP_BIND_DN / LDAP_BIND_PASSWORD ใน .env' };
    }

    const client = createClient(config.url);

    return new Promise((resolve) => {
        client.on('error', (err) => {
            resolve({ success: false, message: `ไม่สามารถเชื่อมต่อ: ${err.message}` });
        });

        client.bind(config.bindDN, config.bindPassword, (err) => {
            client.unbind(() => { });
            if (err) {
                resolve({ success: false, message: `Bind ล้มเหลว: ${err.message}` });
            } else {
                resolve({ success: true, message: `เชื่อมต่อ ${config.url} สำเร็จ!` });
            }
        });
    });
}
