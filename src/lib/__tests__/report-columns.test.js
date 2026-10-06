import { describe, it, expect } from 'vitest';
import { orderedColumns } from '@/lib/report-columns';

describe('orderedColumns', () => {
    it('keeps SELECT order even for numeric-like names that Object.keys would move first', () => {
        const metadata = { FY: { index: 0 }, 10: { index: 2 }, 1: { index: 1 }, 2: { index: 3 } };
        expect(orderedColumns(metadata)).toEqual(['FY', '1', '10', '2']);
    });

    it('keeps names with XML special characters unchanged', () => {
        expect(orderedColumns({ 'Amount <THB> & VAT': { index: 0 } })).toEqual(['Amount <THB> & VAT']);
    });

    it('drops the pagination helper column', () => {
        expect(orderedColumns({ A: { index: 0 }, _rowNum: { index: 1 } })).toEqual(['A']);
    });

    it('returns no columns without metadata', () => {
        expect(orderedColumns(null)).toEqual([]);
        expect(orderedColumns(undefined)).toEqual([]);
    });
});
