import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_RULES } from '@/lib/password-rules';

describe('password-rules.js', () => {
    describe('PASSWORD_RULES', () => {
        it('should have correct default rules', () => {
            expect(PASSWORD_RULES.minLength).toBe(8);
            expect(PASSWORD_RULES.requireUppercase).toBe(true);
            expect(PASSWORD_RULES.requireNumber).toBe(true);
            expect(PASSWORD_RULES.requireSpecial).toBe(true);
        });
    });

    describe('validatePassword', () => {
        it('should accept a valid password', () => {
            const result = validatePassword('P@ssw0rd123');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject empty password', () => {
            const result = validatePassword('');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject null password', () => {
            const result = validatePassword(null);
            expect(result.valid).toBe(false);
        });

        it('should reject password shorter than 8 characters', () => {
            const result = validatePassword('A1!abc');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('ต้องมีอย่างน้อย 8 ตัวอักษร');
        });

        it('should reject password without uppercase', () => {
            const result = validatePassword('p@ssw0rd123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)');
        });

        it('should reject password without number', () => {
            const result = validatePassword('P@sswordABC');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('ต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)');
        });

        it('should reject password without special character', () => {
            const result = validatePassword('Passw0rd123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&*)');
        });

        it('should return multiple errors for very weak password', () => {
            const result = validatePassword('abc');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(3);
        });

        it('should accept password with exactly 8 characters meeting all rules', () => {
            const result = validatePassword('A1!abcde');
            expect(result.valid).toBe(true);
        });
    });
});
