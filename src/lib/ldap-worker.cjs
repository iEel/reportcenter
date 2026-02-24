/**
 * Standalone LDAP Worker Script
 * 
 * This file runs as a SEPARATE Node.js process via child_process,
 * completely outside of Next.js Turbopack bundler.
 * This prevents the ldapjs BER parser from being corrupted by bundling.
 * 
 * Usage: node ldap-worker.cjs <action> <json-args>
 * Actions: search, lookup, bind, test
 */

const ldap = require('ldapjs');

function createClient(url) {
    return ldap.createClient({
        url: [url],
        connectTimeout: 5000,
        timeout: 10000,
        strictDN: false,
    });
}

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

// --- Actions ---

async function doSearch(config, query) {
    const safeQuery = query.replace(/[\\*()\x00/]/g, '');
    if (!safeQuery || safeQuery.length < 2) {
        return { success: true, users: [] };
    }

    const client = createClient(config.url);

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

        const timeout = setTimeout(() => {
            try { client.destroy(); } catch (e) { }
            safeResolve({ success: false, error: 'LDAP search timeout (10s)' });
        }, 10000);

        client.on('error', (err) => {
            clearTimeout(timeout);
            safeResolve({ success: false, error: `Cannot connect: ${err.message}` });
        });

        client.bind(config.bindDN, config.bindPassword, (bindErr) => {
            if (bindErr) {
                clearTimeout(timeout);
                try { client.destroy(); } catch (e) { }
                return safeResolve({ success: false, error: `Bind failed: ${bindErr.message}` });
            }

            const searchFilter = `(sAMAccountName=*${safeQuery}*)`;
            const searchOpts = {
                scope: 'sub',
                filter: searchFilter,
                sizeLimit: 10,
            };

            client.search(config.baseDN, searchOpts, (searchErr, res) => {
                if (searchErr) {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    return safeResolve({ success: false, error: `Search failed: ${searchErr.message}` });
                }

                const users = [];

                res.on('searchEntry', (entry) => {
                    try { users.push(parseEntry(entry)); } catch (e) { }
                });

                res.on('error', (err) => {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    if (err.code === 4) {
                        safeResolve({ success: true, users });
                    } else {
                        safeResolve({ success: false, error: `Search error: ${err.message}` });
                    }
                });

                res.on('end', () => {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    safeResolve({ success: true, users });
                });
            });
        });
    });
}

async function doLookup(config, username) {
    const client = createClient(config.url);

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

        const timeout = setTimeout(() => {
            try { client.destroy(); } catch (e) { }
            safeResolve({ success: false, error: 'LDAP lookup timeout (10s)' });
        }, 10000);

        client.on('error', (err) => {
            clearTimeout(timeout);
            safeResolve({ success: false, error: `Cannot connect: ${err.message}` });
        });

        client.bind(config.bindDN, config.bindPassword, (bindErr) => {
            if (bindErr) {
                clearTimeout(timeout);
                try { client.destroy(); } catch (e) { }
                return safeResolve({ success: false, error: `Bind failed: ${bindErr.message}` });
            }

            const searchFilter = `(sAMAccountName=${username.replace(/[\\*()\x00]/g, '')})`;
            const searchOpts = { scope: 'sub', filter: searchFilter };

            client.search(config.baseDN, searchOpts, (searchErr, res) => {
                if (searchErr) {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    return safeResolve({ success: false, error: `Search failed: ${searchErr.message}` });
                }

                let found = false;
                let userData = {};

                res.on('searchEntry', (entry) => {
                    try {
                        found = true;
                        userData = parseEntry(entry);
                        userData.success = true;
                    } catch (e) { }
                });

                res.on('error', (err) => {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    if (!found) {
                        safeResolve({ success: false, error: `Search error: ${err.message}` });
                    } else {
                        safeResolve(userData);
                    }
                });

                res.on('end', () => {
                    clearTimeout(timeout);
                    try { client.destroy(); } catch (e) { }
                    if (found) {
                        safeResolve(userData);
                    } else {
                        safeResolve({ success: false, error: 'User not found in AD' });
                    }
                });
            });
        });
    });
}

async function doBind(config, username) {
    const upn = `${username}@${config.domain}`;
    const client = createClient(config.url);

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

        const timeout = setTimeout(() => {
            try { client.destroy(); } catch (e) { }
            safeResolve({ success: false, error: 'LDAP bind timeout' });
        }, 10000);

        client.on('error', (err) => {
            clearTimeout(timeout);
            safeResolve({ success: false, error: `Cannot connect: ${err.message}` });
        });

        client.bind(upn, config.password, (err) => {
            clearTimeout(timeout);
            try { client.destroy(); } catch (e) { }
            if (err) {
                safeResolve({ success: false, error: `Bind failed: ${err.message}` });
            } else {
                safeResolve({ success: true });
            }
        });
    });
}

async function doTest(config) {
    const client = createClient(config.url);

    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

        const timeout = setTimeout(() => {
            try { client.destroy(); } catch (e) { }
            safeResolve({ success: false, error: 'Connection timeout' });
        }, 10000);

        client.on('error', (err) => {
            clearTimeout(timeout);
            safeResolve({ success: false, error: `Cannot connect: ${err.message}` });
        });

        client.bind(config.bindDN, config.bindPassword, (err) => {
            clearTimeout(timeout);
            try { client.destroy(); } catch (e) { }
            if (err) {
                safeResolve({ success: false, error: `Bind failed: ${err.message}` });
            } else {
                safeResolve({ success: true });
            }
        });
    });
}

// --- Main ---
(async () => {
    try {
        const action = process.argv[2];
        const args = JSON.parse(process.argv[3] || '{}');

        let result;
        switch (action) {
            case 'search':
                result = await doSearch(args.config, args.query);
                break;
            case 'lookup':
                result = await doLookup(args.config, args.username);
                break;
            case 'bind':
                result = await doBind(args.config, args.username);
                break;
            case 'test':
                result = await doTest(args.config);
                break;
            default:
                result = { success: false, error: `Unknown action: ${action}` };
        }

        process.stdout.write(JSON.stringify(result));
        process.exit(0);
    } catch (err) {
        process.stdout.write(JSON.stringify({ success: false, error: err.message }));
        process.exit(1);
    }
})();
