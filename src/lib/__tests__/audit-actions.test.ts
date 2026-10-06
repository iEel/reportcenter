import { describe, it, expect } from 'vitest';
import { actionLabel, actionOptionLabel } from '../audit-actions';

describe('audit action labels', () => {
    it('names known action types in Thai', () => {
        expect(actionLabel('EXECUTE_REPORT')).toBe('รันรายงาน');
        expect(actionLabel('BLOCKED_QUERY')).toBe('SQL ถูกบล็อก');
        expect(actionLabel('AD_SYNC_CRON')).toBe('ซิงก์ AD อัตโนมัติ');
    });

    it('falls back to the code for an unknown type', () => {
        expect(actionLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    });

    it('shows the Thai name with the code in filter options', () => {
        expect(actionOptionLabel('EXPORT_EXCEL')).toBe('ส่งออก Excel (EXPORT_EXCEL)');
        expect(actionOptionLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    });
});
