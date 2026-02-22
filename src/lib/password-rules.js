// Password validation utility
// Enforces: min 8 chars, at least 1 uppercase, 1 number, 1 special char

const PASSWORD_RULES = {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
};

/**
 * Validate password complexity
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
    const errors = [];

    if (!password || password.length < PASSWORD_RULES.minLength) {
        errors.push(`ต้องมีอย่างน้อย ${PASSWORD_RULES.minLength} ตัวอักษร`);
    }
    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)');
    }
    if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
        errors.push('ต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)');
    }
    if (PASSWORD_RULES.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
        errors.push('ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&*)');
    }

    return { valid: errors.length === 0, errors };
}

export { PASSWORD_RULES };
