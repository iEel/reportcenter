/**
 * SQL Query Validator — Application-level security layer
 * Blocks dangerous T-SQL commands before execution
 */

// Strip SQL comments and string literals to prevent bypass techniques
function stripCommentsAndStrings(query) {
    let result = query;
    // Remove block comments /* ... */
    result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
    // Remove line comments -- ...
    result = result.replace(/--[^\n]*/g, ' ');
    // Remove string literals 'xxx' (replace with empty placeholder)
    result = result.replace(/'(?:[^']|'')*'/g, "''");
    return result;
}

// Dangerous DML/DDL keywords (must appear as standalone words)
const BLOCKED_KEYWORDS = [
    // DML — data modification
    'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE',
    // DDL — structure modification
    'CREATE', 'ALTER', 'DROP',
    // Permission control
    'GRANT', 'DENY', 'REVOKE',
    // Admin commands
    'BACKUP', 'RESTORE', 'DBCC', 'SHUTDOWN', 'RECONFIGURE',
    'BULK\\s+INSERT',
];

// Dangerous objects/functions (schema snooping & RCE)
const BLOCKED_PATTERNS = [
    // System catalog / metadata views
    /\bINFORMATION_SCHEMA\b/i,
    /\bsys\s*\.\s*\w+/i,
    /\bsysobjects\b/i,
    /\bsyscolumns\b/i,
    /\bsysindexes\b/i,
    /\bsysdatabases\b/i,
    /\bsysusers\b/i,
    /\bsyslogins\b/i,
    /\bmaster\s*\.\s*\./i,
    /\btempdb\s*\.\s*\./i,
    /\bmsdb\s*\.\s*\./i,
    /\bmodel\s*\.\s*\./i,

    // Dangerous stored procedures & functions
    /\bxp_\w+/i,
    /\bsp_executesql\b/i,
    /\bsp_helptext\b/i,
    /\bsp_help\b/i,
    /\bsp_configure\b/i,
    /\bsp_addrolemember\b/i,
    /\bsp_addsrvrolemember\b/i,
    /\bsp_OACreate\b/i,

    // EXEC / EXECUTE (dynamic SQL)
    /\bEXEC\s*\(/i,
    /\bEXECUTE\s*\(/i,
    /\bEXEC\s+\w/i,
    /\bEXECUTE\s+\w/i,

    // Remote data sources
    /\bOPENROWSET\b/i,
    /\bOPENDATASOURCE\b/i,
    /\bOPENQUERY\b/i,
    /\bLINKED\s*SERVER/i,

    // Other dangerous patterns
    /\bINTO\s+\w+\s+FROM/i,      // SELECT INTO (creates table)
    /\bSELECT\s+INTO\b/i,        // SELECT INTO
    /\bWAITFOR\s+DELAY/i,        // DoS via delay
    /\bRAISERROR\b/i,
    /\bTHROW\b/i,

    // Prevent querying the ReportCenter DB itself
    /\bReportCenterDB\b/i,
    /\bUsers\b.*\bPasswordHash\b/i,
    /\bPasswordHash\b/i,
];

/**
 * Validate a T-SQL query for safety
 * @param {string} query - The T-SQL query to validate
 * @returns {{ safe: boolean, reason?: string, blockedTerm?: string }}
 */
export function validateQuery(query) {
    if (!query || typeof query !== 'string') {
        return { safe: false, reason: 'Query is empty or invalid' };
    }

    // Work with a cleaned version (no comments/strings) to prevent bypass
    const cleanedQuery = stripCommentsAndStrings(query);

    // Check blocked keywords (word-boundary match)
    for (const keyword of BLOCKED_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(cleanedQuery)) {
            // Extract the matched keyword for display
            const match = cleanedQuery.match(regex);
            return {
                safe: false,
                reason: `พบคำสั่งต้องห้าม: ${match[0].toUpperCase()}`,
                blockedTerm: match[0].toUpperCase(),
            };
        }
    }

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(cleanedQuery)) {
            const match = cleanedQuery.match(pattern);
            return {
                safe: false,
                reason: `พบรูปแบบต้องห้าม: ${match[0]}`,
                blockedTerm: match[0],
            };
        }
    }

    // Also check original query for obfuscation attempts
    // Unicode/alternate encoding tricks
    if (/\\x[0-9a-f]{2}/i.test(query) || /\\u[0-9a-f]{4}/i.test(query)) {
        return {
            safe: false,
            reason: 'พบการเข้ารหัสที่น่าสงสัย (hex/unicode escape)',
            blockedTerm: 'encoded chars',
        };
    }

    return { safe: true };
}

/**
 * Get a human-readable summary of what's blocked (for display in admin UI)
 */
export function getBlockedCommandsList() {
    return {
        dml: ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE'],
        ddl: ['CREATE', 'ALTER', 'DROP'],
        metadata: ['INFORMATION_SCHEMA.*', 'sys.*', 'sysobjects', 'syscolumns'],
        procedures: ['EXEC/EXECUTE', 'xp_*', 'sp_executesql', 'sp_help*'],
        remote: ['OPENROWSET', 'OPENDATASOURCE', 'OPENQUERY'],
        other: ['BACKUP', 'RESTORE', 'DBCC', 'WAITFOR DELAY', 'SELECT INTO'],
    };
}
