import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = 'rc_token';

/**
 * Sign a JWT token with user payload
 * @param {object} payload - { userId, username, fullName, roleId, roleName, companyId, tokenVersion }
 * @returns {Promise<string>} JWT token string
 */
export async function signToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 * @param {string} token
 * @returns {Promise<object|null>} decoded payload or null
 */
export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (error) {
        return null;
    }
}

// --- Session Revocation Cache ---
// Caches user active status + tokenVersion for 60 seconds
// to avoid hitting the DB on every single request
const sessionCache = new Map();
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Check if user session is still valid (active + tokenVersion matches)
 * Results are cached for 60s to avoid DB overhead
 * @param {number} userId
 * @param {number} tokenVersion
 * @returns {Promise<boolean>}
 */
async function isSessionValid(userId, tokenVersion) {
    const cacheKey = `user_${userId}`;
    const cached = sessionCache.get(cacheKey);

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.isActive && cached.tokenVersion === tokenVersion;
    }

    try {
        // Dynamic import to avoid circular dependency
        const { connectToCentralDB } = await import('@/lib/db');
        const sql = (await import('mssql')).default;
        const pool = await connectToCentralDB();

        // Auto-add tokenVersion column if it doesn't exist
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'TokenVersion')
                ALTER TABLE Users ADD TokenVersion INT DEFAULT 0
            `);
        } catch { /* ignore if already exists */ }

        const result = await pool.request()
            .input('UserId', sql.Int, userId)
            .query('SELECT IsActive, TokenVersion FROM Users WHERE UserId = @UserId');

        if (result.recordset.length === 0) {
            sessionCache.set(cacheKey, { isActive: false, tokenVersion: -1, ts: Date.now() });
            return false;
        }

        const user = result.recordset[0];
        const dbVersion = user.TokenVersion ?? 0;
        const isActive = user.IsActive;

        sessionCache.set(cacheKey, { isActive, tokenVersion: dbVersion, ts: Date.now() });
        return isActive && dbVersion === tokenVersion;
    } catch (e) {
        console.warn('Session validation DB check failed:', e.message);
        // If DB check fails, allow the session (fail-open for availability)
        return true;
    }
}

/**
 * Invalidate the session cache for a specific user
 * Call this when admin changes user status or tokenVersion
 * @param {number} userId
 */
export function invalidateSessionCache(userId) {
    sessionCache.delete(`user_${userId}`);
}

/**
 * Get current session from request cookies
 * Validates JWT + checks user is still active + tokenVersion matches
 * @param {Request} request - Next.js request object
 * @returns {Promise<object|null>} user session or null
 */
export async function getSession(request) {
    const token = request.cookies?.get(COOKIE_NAME)?.value
        || request.headers?.get('cookie')?.match(/rc_token=([^;]+)/)?.[1];

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    // Check session revocation (tokenVersion + IsActive)
    const tokenVersion = payload.tokenVersion ?? 0;
    const valid = await isSessionValid(payload.userId, tokenVersion);
    if (!valid) return null;

    return payload;
}

export { COOKIE_NAME };
