import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { EXCEL_EXTENSION, EXCEL_MIME, excelFileName, excelWriteOptions, safeFileBase } from '@/lib/excel-export';

const buildWorkbook = (rows) => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows), 'Report Data');
    return workbook;
};

const sampleRows = Array.from({ length: 2000 }, (_, i) => ({
    DocNo: `INV${2600000 + i}`,
    CustName: ['บริษัท โซนิค อินเตอร์เฟรท จำกัด', 'Autologis Co., Ltd.'][i % 2],
    Status: ['Open', 'Closed', 'Billed'][i % 3],
    Amount: i * 1.25,
}));

describe('excel-export.js', () => {
    it('names files and content type as .xlsx', () => {
        expect(EXCEL_EXTENSION).toBe('xlsx');
        expect(EXCEL_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(excelFileName('AP Aging_2026-10-06')).toBe('AP Aging_2026-10-06.xlsx');
    });

    it('writes xlsx with ZIP compression and a shared string table', () => {
        expect(excelWriteOptions()).toEqual({ bookType: 'xlsx', compression: true, bookSST: true });
    });

    it('returns a fresh object each call because SheetJS writeFile mutates its options', () => {
        const first = excelWriteOptions();
        first.type = 'file';
        expect(excelWriteOptions()).not.toHaveProperty('type');
    });

    it('produces a file that reads back with Thai text and numbers intact', () => {
        const buffer = xlsx.write(buildWorkbook(sampleRows), { type: 'buffer', ...excelWriteOptions() });

        expect(buffer.subarray(0, 2).toString()).toBe('PK');
        const back = xlsx.utils.sheet_to_json(xlsx.read(buffer, { type: 'buffer' }).Sheets['Report Data']);
        expect(back).toHaveLength(sampleRows.length);
        expect(back[0]).toEqual(sampleRows[0]);
        expect(back[1999]).toEqual(sampleRows[1999]);
    });

    it('is smaller than an uncompressed xlsx of the same data', () => {
        const workbook = buildWorkbook(sampleRows);
        const compressed = xlsx.write(workbook, { type: 'buffer', ...excelWriteOptions() });
        const plain = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        expect(compressed.length).toBeLessThan(plain.length / 2);
    });
});

describe('safeFileBase', () => {
    it('replaces characters Windows and Linux cannot use in file names', () => {
        expect(safeFileBase('ยอดขาย A/B: "Q" <1>|*?\\')).toBe('ยอดขาย A_B_ _Q_ _1_____');
    });
    it('falls back to "report" for empty names', () => {
        expect(safeFileBase('  ')).toBe('report');
        expect(safeFileBase(null)).toBe('report');
    });
});
