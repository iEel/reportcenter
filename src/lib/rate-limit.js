// Simple in-memory rate limiter for login attempts
// Blocks IP after MAX_ATTEMPTS within WINDOW_MS

const attempts = new Map(); // key = IP, value = { count, firstAttempt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if an IP is rate-limited
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(ip) {
    const now = Date.now();
    const record = attempts.get(ip);

    // No record or window expired → allow
    if (!record || (now - record.firstAttempt) > WINDOW_MS) {
        return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterMs: 0 };
    }

    // Within window
    if (record.count >= MAX_ATTEMPTS) {
        const retryAfterMs = WINDOW_MS - (now - record.firstAttempt);
        return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining: MAX_ATTEMPTS - record.count, retryAfterMs: 0 };
}

/**
 * Record a failed login attempt
 * @param {string} ip
 */
export function recordFailedAttempt(ip) {
    const now = Date.now();
    const record = attempts.get(ip);

    if (!record || (now - record.firstAttempt) > WINDOW_MS) {
        attempts.set(ip, { count: 1, firstAttempt: now });
    } else {
        record.count++;
    }
}

/**
 * Clear attempts on successful login
 * @param {string} ip
 */
export function clearAttempts(ip) {
    attempts.delete(ip);
}

// Cleanup old entries periodically (every 30 min)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts) {
        if ((now - record.firstAttempt) > WINDOW_MS) {
            attempts.delete(ip);
        }
    }
}, 30 * 60 * 1000);
