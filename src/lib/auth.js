import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'rc-super-secret-key-2026');
const COOKIE_NAME = 'rc_token';

/**
 * Sign a JWT token with user payload
 * @param {object} payload - { userId, username, fullName, roleId, roleName, companyId }
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

/**
 * Get current session from request cookies
 * @param {Request} request - Next.js request object
 * @returns {Promise<object|null>} user session or null
 */
export async function getSession(request) {
    const token = request.cookies?.get(COOKIE_NAME)?.value
        || request.headers?.get('cookie')?.match(/rc_token=([^;]+)/)?.[1];

    if (!token) return null;
    return verifyToken(token);
}

export { COOKIE_NAME };
