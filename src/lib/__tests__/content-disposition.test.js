import { describe, it, expect } from 'vitest';
import { attachmentHeader } from '@/lib/content-disposition';

describe('attachmentHeader', () => {
    it('gives an ASCII fallback and a UTF-8 name for Thai file names', () => {
        const header = attachmentHeader('ยอดขาย_2026-10-06.xlsx');
        // 6 Thai letters become 6 underscores, followed by the name's own underscore
        expect(header).toBe(`attachment; filename="_______2026-10-06.xlsx"; filename*=UTF-8''${encodeURIComponent('ยอดขาย_2026-10-06.xlsx')}`);
    });

    it('keeps quotes and backslashes out of the quoted fallback and encodes RFC 5987 specials', () => {
        expect(attachmentHeader(`a"b\\c'(d).csv`)).toBe(`attachment; filename="a_b_c'(d).csv"; filename*=UTF-8''a%22b%5Cc%27%28d%29.csv`);
    });
});
