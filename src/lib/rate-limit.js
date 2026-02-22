// Simple in-memory rate limiter for login attempts
// Config is loaded from SystemSettings DB and can be updated at runtime

const attempts = new Map(); // key = IP, value = { count, firstAttempt }

// Defaults (overridden by DB settings via configure())
let MAX_ATTEMPTS = 5;
let WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Configure rate limiting parameters (called from login route after reading DB)
 * @param {{ maxAttempts?: number, windowMinutes?: number }} config
 */
export function configure(config) {
    if (config.maxAttempts && config.maxAttempts > 0) {
        MAX_ATTEMPTS = config.maxAttempts;
    }
    if (config.windowMinutes && config.windowMinutes > 0) {
        WINDOW_MS = config.windowMinutes * 60 * 1000;
    }
}

/**
 * Get current config values (for API response)
 */
export function getConfig() {
    return { maxAttempts: MAX_ATTEMPTS, windowMinutes: WINDOW_MS / 60000 };
}

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
