import { describe, it, expect } from 'vitest';
import { once } from 'events';
import { randomBytes } from 'crypto';
import zlib from 'zlib';
import * as xlsx from 'xlsx';
import { createXlsxStreamWriter, crc32 } from '@/lib/xlsx-stream-writer';

async function writeXlsx(columns, rows, options) {
    const writer = createXlsxStreamWriter(columns, options);
    const chunks = [];
    writer.on('data', chunk => chunks.push(chunk));
    const ended = once(writer, 'end');
    for (const row of rows) {
        if (!writer.write(row)) await once(writer, 'drain');
    }
    writer.end();
    await ended;
    return Buffer.concat(chunks);
}

const read = buffer => xlsx.read(buffer, { type: 'buffer', cellNF: true });

/** Parse the ZIP independently of SheetJS: every entry from the central directory, inflated. */
function zipEntries(buffer) {
    const end = buffer.length - 22;
    expect(buffer.readUInt32LE(end)).toBe(0x06054b50);
    const count = buffer.readUInt16LE(end + 10);
    let at = buffer.readUInt32LE(end + 16);
    const entries = [];
    for (let i = 0; i < count; i++) {
        expect(buffer.readUInt32LE(at)).toBe(0x02014b50);
        const crc = buffer.readUInt32LE(at + 16);
        const compressedSize = buffer.readUInt32LE(at + 20);
        const size = buffer.readUInt32LE(at + 24);
        const nameLength = buffer.readUInt16LE(at + 28);
        const offset = buffer.readUInt32LE(at + 42);
        const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
        expect(buffer.readUInt32LE(offset)).toBe(0x04034b50);
        const dataStart = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
        const data = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compressedSize));
        expect(buffer.readUInt32LE(dataStart + compressedSize)).toBe(0x08074b50);
        entries.push({ name, crc, size, data });
        at += 46 + nameLength;
    }
    return entries;
}

describe('crc32', () => {
    it('matches the standard check value', () => {
        expect(crc32(Buffer.from('123456789'))).toBe(0xCBF43926);
    });
    it('can be computed in pieces', () => {
        expect(crc32(Buffer.from('6789'), crc32(Buffer.from('12345')))).toBe(0xCBF43926);
    });
});

describe('createXlsxStreamWriter', () => {
    it('writes a header row and every cell type by the spec rules', async () => {
        const columns = ['Num', 'Bool', 'Day', 'Stamp', 'Text', 'Empty', 'Blob', 'Big', 'Bad', 'Amount <THB> & VAT'];
        const buffer = await writeXlsx(columns, [{
            Num: 1234.5,
            Bool: true,
            Day: new Date(Date.UTC(2026, 0, 6)),
            Stamp: new Date(Date.UTC(2026, 0, 6, 13, 45, 30)),
            Text: 'บริษัท <A&B> "Q"\u0007',
            Empty: null,
            Blob: Buffer.from([0xde, 0xad]),
            Big: 12345678901234567890n,
            Bad: Number.NaN,
            'Amount <THB> & VAT': '',
        }]);
        const workbook = read(buffer);
        expect(workbook.SheetNames).toEqual(['Report Data']);
        const sheet = workbook.Sheets['Report Data'];
        expect(columns.map((_, i) => sheet[`${String.fromCharCode(65 + i)}1`].v)).toEqual(columns);
        expect(sheet.A2).toMatchObject({ t: 'n', v: 1234.5 });
        expect(sheet.B2).toMatchObject({ t: 'b', v: true });
        expect(sheet.C2).toMatchObject({ t: 'n', v: 46028, z: 'yyyy-mm-dd' });
        expect(sheet.D2.t).toBe('n');
        expect(sheet.D2.v).toBeCloseTo(46028 + (13 * 3600 + 45 * 60 + 30) / 86400, 9);
        expect(sheet.D2.z).toBe('yyyy-mm-dd hh:mm:ss');
        expect(sheet.E2).toMatchObject({ t: 's', v: 'บริษัท <A&B> "Q"' });
        expect(sheet.F2).toBeUndefined();
        expect(sheet.G2).toMatchObject({ t: 's', v: '0xdead' });
        expect(sheet.H2).toMatchObject({ t: 's', v: '12345678901234567890' });
        expect(sheet.I2).toBeUndefined();
        expect(sheet.J2).toBeUndefined();
    });

    it("matches Excel's 1900 serials, where serial 60 is the phantom 1900-02-29", async () => {
        const buffer = await writeXlsx(['D'], [
            { D: new Date(Date.UTC(1900, 0, 1)) },   // SQL Server's usual "no date" placeholder
            { D: new Date(Date.UTC(1900, 1, 28)) },
            { D: new Date(Date.UTC(1900, 2, 1)) },
            { D: new Date(Date.UTC(1900, 0, 1, 12)) },
        ]);
        const sheet = read(buffer).Sheets['Report Data'];
        expect(sheet.A2).toMatchObject({ t: 'n', v: 1, z: 'yyyy-mm-dd' });
        expect(sheet.A3.v).toBe(59);
        expect(sheet.A4.v).toBe(61);
        expect(sheet.A5.v).toBeCloseTo(1.5, 9);
    });

    it('writes dates Excel cannot show (before 1900) as text instead of ####', async () => {
        const buffer = await writeXlsx(['D'], [
            { D: new Date(Date.UTC(1753, 0, 1)) },
            { D: new Date('0001-01-01T10:20:30Z') },
            { D: new Date(Date.UTC(1899, 11, 31)) },
        ]);
        const sheet = read(buffer).Sheets['Report Data'];
        expect(sheet.A2).toMatchObject({ t: 's', v: '1753-01-01' });
        expect(sheet.A3).toMatchObject({ t: 's', v: '0001-01-01 10:20:30' });
        expect(sheet.A4).toMatchObject({ t: 's', v: '1899-12-31' });
    });

    it('cuts text at 32,767 characters', async () => {
        const buffer = await writeXlsx(['T'], [{ T: 'ก'.repeat(40000) }]);
        expect(read(buffer).Sheets['Report Data'].A2.v).toHaveLength(32767);
    });

    it('never leaves half an emoji at the cut', async () => {
        const buffer = await writeXlsx(['T'], [{ T: `${'a'.repeat(32766)}😀tail` }]);
        expect(read(buffer).Sheets['Report Data'].A2.v).toBe('a'.repeat(32766));
    });

    it('continues on numbered sheets past maxRowsPerSheet, repeating the header', async () => {
        const rows = Array.from({ length: 7 }, (_, i) => ({ N: i + 1 }));
        const workbook = read(await writeXlsx(['N'], rows, { maxRowsPerSheet: 3 }));
        expect(workbook.SheetNames).toEqual(['Report Data', 'Report Data (2)', 'Report Data (3)']);
        const second = workbook.Sheets['Report Data (2)'];
        expect(second.A1.v).toBe('N');
        expect(second.A2.v).toBe(4);
        expect(xlsx.utils.sheet_to_json(workbook.Sheets['Report Data (3)'])).toEqual([{ N: 7 }]);
    });

    it('does not add an empty sheet when rows exactly fill the last one', async () => {
        const rows = [{ N: 1 }, { N: 2 }, { N: 3 }];
        expect(read(await writeXlsx(['N'], rows, { maxRowsPerSheet: 3 })).SheetNames).toEqual(['Report Data']);
    });

    it('writes one sheet with only the header when there are no rows', async () => {
        const workbook = read(await writeXlsx(['A', 'B'], []));
        expect(workbook.SheetNames).toEqual(['Report Data']);
        expect(xlsx.utils.sheet_to_json(workbook.Sheets['Report Data'], { header: 1 })).toEqual([['A', 'B']]);
    });

    it('keeps every row across many deflate chunks', async () => {
        const rows = Array.from({ length: 5000 }, (_, i) => ({ Id: i, Name: `ลูกค้า ${i} ${'x'.repeat(40)}` }));
        const back = xlsx.utils.sheet_to_json(read(await writeXlsx(['Id', 'Name'], rows)).Sheets['Report Data']);
        expect(back).toHaveLength(5000);
        expect(back[4999]).toEqual(rows[4999]);
    });

    it('writes sheets first, metadata last, with correct CRC and sizes', async () => {
        const entries = zipEntries(await writeXlsx(['N'], [{ N: 1 }, { N: 2 }], { maxRowsPerSheet: 1 }));
        expect(entries.map(entry => entry.name)).toEqual([
            'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/styles.xml', 'xl/workbook.xml',
            'xl/_rels/workbook.xml.rels', '_rels/.rels', '[Content_Types].xml',
        ]);
        for (const entry of entries) {
            expect(entry.data.length).toBe(entry.size);
            expect(crc32(entry.data)).toBe(entry.crc);
            if (zlib.crc32) expect(zlib.crc32(entry.data)).toBe(entry.crc);
        }
    });

    it('sizes columns so dates are not shown as #### in Excel', async () => {
        const columns = ['Id', 'Day', 'Stamp', 'Customer'];
        const buffer = await writeXlsx(columns, [
            { Id: 1, Day: new Date(Date.UTC(2026, 0, 6)), Stamp: new Date(Date.UTC(2026, 0, 6, 8, 30)), Customer: 'บริษัท โซนิค อินเตอร์เฟรท จำกัด' },
        ]);
        const sheetXml = zipEntries(buffer)[0].data.toString('utf8');
        expect(sheetXml).toMatch(/<worksheet [^>]*><cols>.*<\/cols><sheetData>/);
        const widths = Object.fromEntries([...sheetXml.matchAll(/<col min="(\d+)" max="\d+" width="(\d+)" customWidth="1"\/>/g)]
            .map(([, column, width]) => [Number(column), Number(width)]));
        expect(widths[1]).toBe(10);                  // narrow columns keep a readable minimum
        expect(widths[2]).toBeGreaterThanOrEqual(12); // yyyy-mm-dd
        expect(widths[3]).toBeGreaterThanOrEqual(21); // yyyy-mm-dd hh:mm:ss
        expect(widths[4]).toBeGreaterThan(widths[1]);
    });

    it('writes no column widths when there are no columns', async () => {
        const sheetXml = zipEntries(await writeXlsx([], []))[0].data.toString('utf8');
        expect(sheetXml).not.toContain('<cols>');
    });

    it('signals back-pressure and drains once the output is read', async () => {
        const writer = createXlsxStreamWriter(['Hex']);
        let accepted = 0;
        while (writer.write({ Hex: randomBytes(1000).toString('hex') })) {
            accepted++;
            if (accepted > 100000) break;
        }
        expect(accepted).toBeLessThan(100000);
        const drained = once(writer, 'drain');
        writer.resume();
        await drained;
        writer.destroy();
    });
});
