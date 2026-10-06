# Streaming XLSX Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export ordinary Standard reports as `.xlsx` built on the server by a streaming writer, so neither the browser nor the server holds the whole report in memory, and delete the file once it has been downloaded.

**Architecture:** `POST /api/reports/export` runs the report query in mssql streaming mode, pipes rows through an in-house streaming XLSX writer (`Transform`, ZIP written forward with data descriptors) into `tmp/exports/<uuid>.xlsx`, and answers with a download id; `GET /api/reports/export/[id]` streams that file once and deletes it. Authorization moves into a shared helper used by `execute` and the new route. `IsHeavy` reports keep the Background Job flow; only its download route starts streaming and gains `HEAD`.

**Tech Stack:** Next.js 16 App Router route handlers (JavaScript), React 19 client page (TypeScript), `mssql` 12 streaming requests, Node `zlib`/`stream`/`fs`, Vitest 4 (node environment), SheetJS 0.18.5 (tests only, to read files back).

**Spec:** `docs/superpowers/specs/2026-10-06-streaming-xlsx-export-design.md`

## Global Constraints

- Work in the worktree `D:\Antigravity\reportcenter\.claude\worktrees\ui-ux-report-permissions-users-9850aa` on branch `claude/export-format-xlsb-xlsx-592f13`. Run every command from that directory.
- No new npm dependencies.
- Node 20 compatible: do not use `zlib.crc32` in application code ("the deployment guide installs Node 20").
- Ordinary-report export files are deleted after the download; leftovers are swept after 15 minutes (`EXPORT_MAX_AGE_MS = 15 * 60 * 1000`). `IsHeavy` jobs keep CSV, 24-hour retention, history and notifications. `execute-async` is not changed.
- SQL timeout for the export request: `parseInt(process.env.REPORT_REQUEST_TIMEOUT) || 120000` (same as `execute`).
- First sheet name "Report Data", overflow "Report Data (2)", … ; at most 1,048,575 data rows per sheet; cell text cut to 32,767 characters.
- Thai UI copy, verbatim: "กำลังสร้างไฟล์ Excel…", "ยกเลิก", "ถ้าปิดหน้านี้ การส่งออกจะถูกยกเลิก", "ไม่มีข้อมูลให้ส่งออก", "ส่งออก N รายการเรียบร้อย", "ยกเลิกการส่งออกแล้ว", "ไม่สามารถส่งออกข้อมูลได้", "กรุณาเข้าสู่ระบบใหม่", "ไฟล์ยังไม่พร้อม", "ไม่พบไฟล์", "ไฟล์หมดอายุแล้ว (เก็บ 24 ชม.)", "ดาวน์โหลดไม่สำเร็จ".
- Tests are written first and must be seen failing before the implementation.
- Never use browser tools (Claude_Browser, claude-in-chrome, playwright) or call the running app at localhost:4000 except in Task 13, which the user approved for this feature only.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push. Do not commit `.impeccable/`.

## Review Focus

1. A text value whose 32,767-character cut falls inside an emoji (surrogate pair) must not leave half a character in the cell — test in Task 2.
2. Column names with XML special characters (`Amount <THB> & VAT`) and numeric-like names (`1`, `10`, `2`) must appear unchanged and in SELECT order in the header row — tests in Tasks 1 and 2.
3. A result with exactly `maxRowsPerSheet` rows must produce one sheet, not an extra empty sheet — test in Task 2.
4. A second request for the same download id (refresh, double click) must answer 404, not serve or crash — test in Task 6.
5. Cancelling while rows are streaming must reject the export, cancel the SQL request and never report success — test in Task 5.

---

### Task 0: Commit the finished `.xlsb` → `.xlsx` change

The working tree already holds the approved format change (`src/lib/excel-export.js`, its test, six call sites, docs). Commit it before new work so later diffs stay readable.

**Files:** already modified — `DEVELOPER_HANDOFF.md`, `docs/12_DECISION_LOG.md`, `docs/99_CHANGELOG.md`, `src/app/(dashboard)/admin/audit-logs/page.tsx`, `src/app/(dashboard)/reports/job-history/page.tsx`, `src/app/(dashboard)/reports/standard/page.tsx`, `src/app/(dashboard)/reports/templates/page.tsx`, `src/app/api/admin/schedules/route.js`, `src/app/api/cron/execute-schedules/route.js`, `src/app/api/reports/jobs/[id]/download/route.js`, `src/lib/excel-export.js`, `src/lib/__tests__/excel-export.test.js`, plus the spec and this plan.

- [ ] **Step 1: Run the suite**

Run: `npx vitest run`
Expected: `23 passed` test files, `257 passed | 1 todo`.

- [ ] **Step 2: Commit**

```bash
git add DEVELOPER_HANDOFF.md docs/12_DECISION_LOG.md docs/99_CHANGELOG.md "src/app/(dashboard)/admin/audit-logs/page.tsx" "src/app/(dashboard)/reports/job-history/page.tsx" "src/app/(dashboard)/reports/standard/page.tsx" "src/app/(dashboard)/reports/templates/page.tsx" src/app/api/admin/schedules/route.js src/app/api/cron/execute-schedules/route.js "src/app/api/reports/jobs/[id]/download/route.js" src/lib/excel-export.js src/lib/__tests__/excel-export.test.js docs/superpowers/specs/2026-10-06-streaming-xlsx-export-design.md docs/superpowers/plans/2026-10-06-streaming-xlsx-export.md
git commit -m "feat: export Excel as compressed .xlsx instead of .xlsb

SheetJS 0.18.5 wrote .xlsb 13-18x slower than .xlsx in Chrome and the
uncompressed .xlsb was about twice the size of .xlsx with compression and
shared strings. Adds the streaming-export spec and plan.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Column order helper

**Files:**
- Create: `src/lib/report-columns.js`
- Test: `src/lib/__tests__/report-columns.test.js`

**Interfaces:**
- Produces: `orderedColumns(metadata: Record<string, { index?: number }> | null | undefined): string[]`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/report-columns.test.js`
Expected: FAIL — cannot resolve `@/lib/report-columns`.

- [ ] **Step 3: Write the implementation**

```js
/**
 * Column names in SQL SELECT order. mssql gives each column's position as `index`;
 * Object.keys would move numeric-like names ("1", "10") ahead of the others.
 * @param {Record<string, { index?: number }> | null | undefined} metadata recordset.columns
 * @returns {string[]}
 */
export function orderedColumns(metadata) {
    if (!metadata) return [];
    return Object.entries(metadata)
        .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0))
        .map(([name]) => name)
        .filter(name => name !== '_rowNum');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/report-columns.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-columns.js src/lib/__tests__/report-columns.test.js
git commit -m "feat: add shared SELECT-order column helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Streaming XLSX writer

**Files:**
- Create: `src/lib/xlsx-stream-writer.js`
- Test: `src/lib/__tests__/xlsx-stream-writer.test.js`

**Interfaces:**
- Produces: `createXlsxStreamWriter(columns: string[], options?: { sheetName?: string, maxRowsPerSheet?: number }): Transform` — writable side takes row objects keyed by column name (object mode); readable side emits `.xlsx` bytes. `write(row)` returns `false` under back-pressure; continue after `'drain'`.
- Produces: `crc32(bytes: Buffer, previous?: number): number`
- Produces: `MAX_ROWS_PER_SHEET = 1048575`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/xlsx-stream-writer.test.js`
Expected: FAIL — cannot resolve `@/lib/xlsx-stream-writer`.

- [ ] **Step 3: Write the implementation**

```js
import { Transform } from 'stream';
import zlib from 'zlib';

/**
 * Streaming .xlsx writer: report rows in, file bytes out. Memory stays bounded by one ~64 KB chunk
 * whatever the row count, because the ZIP is written strictly forward (data descriptors, central
 * directory last). See docs/superpowers/specs/2026-10-06-streaming-xlsx-export-design.md.
 */

export const MAX_ROWS_PER_SHEET = 1048575; // Excel's 1,048,576 rows minus the header row
const MAX_CELL_CHARS = 32767;
const CHUNK_CHARS = 64 * 1024;
const ZIP32_LIMIT = 0xFFFFFFFF;
const DAY_MS = 86400000;
const EXCEL_DAYS_TO_1970 = 25569; // Excel serial of 1970-01-01
const STYLE_DATE = 1;
const STYLE_DATETIME = 2;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

/** CRC-32 (IEEE). Not zlib.crc32: the deployment guide installs Node 20, which may lack it. */
export function crc32(bytes, previous = 0) {
    let crc = (previous ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function escapeXml(text) {
    return text.replace(XML_INVALID, '')
        .replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function cellText(value) {
    let text = (Buffer.isBuffer(value) ? `0x${value.toString('hex')}` : String(value)).replace(XML_INVALID, '');
    if (text.length > MAX_CELL_CHARS) {
        text = text.slice(0, MAX_CELL_CHARS);
        const last = text.charCodeAt(text.length - 1);
        if (last >= 0xD800 && last <= 0xDBFF) text = text.slice(0, -1); // half of an emoji
    }
    return escapeXml(text);
}

function columnLetters(index) {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
}

function cellXml(ref, value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : '';
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    if (value instanceof Date) {
        const ms = value.getTime();
        if (Number.isNaN(ms)) return '';
        // mssql reads DATE/DATETIME as UTC (useUTC default), so the UTC fields are the stored value
        const style = ms % DAY_MS === 0 ? STYLE_DATE : STYLE_DATETIME;
        return `<c r="${ref}" s="${style}"><v>${ms / DAY_MS + EXCEL_DAYS_TO_1970}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${cellText(value)}</t></is></c>`;
}

function rowXml(rowNumber, refs, values) {
    let cells = '';
    for (let i = 0; i < refs.length; i++) cells += cellXml(`${refs[i]}${rowNumber}`, values[i]);
    return `<row r="${rowNumber}">${cells}</row>`;
}

const STYLES_XML = `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">`
    + '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>'
    + '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

const ROOT_RELS_XML = `${XML_HEADER}<Relationships xmlns="${PKG_REL_NS}">`
    + `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function workbookXml(sheetNames) {
    const sheets = sheetNames.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
    return `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount) {
    let rels = '';
    for (let i = 1; i <= sheetCount; i++) rels += `<Relationship Id="rId${i}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i}.xml"/>`;
    rels += `<Relationship Id="rId${sheetCount + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>`;
    return `${XML_HEADER}<Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`;
}

function contentTypesXml(sheetCount) {
    let overrides = '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (let i = 1; i <= sheetCount; i++) {
        overrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    }
    return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + `${overrides}</Types>`;
}

function dosStamp(date) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

class XlsxStreamWriter extends Transform {
    constructor(columns, { sheetName = 'Report Data', maxRowsPerSheet = MAX_ROWS_PER_SHEET } = {}) {
        super({ writableObjectMode: true });
        this.columns = columns;
        this.refs = columns.map((_, i) => columnLetters(i));
        this.sheetName = sheetName;
        this.maxRowsPerSheet = maxRowsPerSheet;
        this.stamp = dosStamp(new Date());
        this.offset = 0;
        this.entries = [];
        this.entry = null;
        this.sheetCount = 0;
        this.sheetRows = 0;
        this.sheetOpen = false;
        this.xml = '';
    }

    _transform(row, _encoding, callback) {
        let pending;
        try {
            pending = this.addRow(row);
        } catch (error) {
            callback(error);
            return;
        }
        if (pending) pending.then(() => callback(), callback);
        else callback();
    }

    _flush(callback) {
        this.finish().then(() => callback(), callback);
    }

    _destroy(error, callback) {
        this.entry?.deflate.destroy();
        callback(error);
    }

    /** Returns a promise only when the row needs async work (a chunk to deflate or a new sheet). */
    addRow(row) {
        if (this.sheetOpen && this.sheetRows === this.maxRowsPerSheet) {
            return this.endSheet().then(() => {
                this.beginSheet();
                return this.appendRow(row);
            });
        }
        if (!this.sheetOpen) this.beginSheet();
        return this.appendRow(row);
    }

    appendRow(row) {
        this.sheetRows++;
        this.xml += rowXml(this.sheetRows + 1, this.refs, this.columns.map(name => row?.[name]));
        return this.xml.length >= CHUNK_CHARS ? this.flushXml() : null;
    }

    beginSheet() {
        this.sheetCount++;
        this.sheetRows = 0;
        this.sheetOpen = true;
        this.beginEntry(`xl/worksheets/sheet${this.sheetCount}.xml`);
        this.xml = `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetData>${rowXml(1, this.refs, this.columns)}`;
    }

    async endSheet() {
        this.xml += '</sheetData></worksheet>';
        await this.flushXml();
        this.sheetOpen = false;
        await this.endEntry();
    }

    flushXml() {
        const text = this.xml;
        this.xml = '';
        return this.writeEntryData(text);
    }

    async finish() {
        if (!this.sheetOpen) this.beginSheet(); // no rows: one sheet holding the header row
        await this.endSheet();
        const names = Array.from({ length: this.sheetCount }, (_, i) => (i === 0 ? this.sheetName : `${this.sheetName} (${i + 1})`));
        await this.writeWholeEntry('xl/styles.xml', STYLES_XML);
        await this.writeWholeEntry('xl/workbook.xml', workbookXml(names));
        await this.writeWholeEntry('xl/_rels/workbook.xml.rels', workbookRelsXml(this.sheetCount));
        await this.writeWholeEntry('_rels/.rels', ROOT_RELS_XML);
        await this.writeWholeEntry('[Content_Types].xml', contentTypesXml(this.sheetCount));
        this.writeCentralDirectory();
    }

    async writeWholeEntry(name, text) {
        this.beginEntry(name);
        await this.writeEntryData(text);
        await this.endEntry();
    }

    pushBytes(bytes) {
        this.offset += bytes.length;
        this.push(bytes);
    }

    assertZip32(...values) {
        if ([this.offset, ...values].some(value => value > ZIP32_LIMIT)) {
            throw new Error('Excel file is larger than 4 GB (ZIP64 is not supported)');
        }
    }

    beginEntry(name) {
        const nameBytes = Buffer.from(name, 'utf8');
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);            // version needed: 2.0
        header.writeUInt16LE(0x0008, 6);        // CRC and sizes follow in a data descriptor
        header.writeUInt16LE(8, 8);             // deflate
        header.writeUInt16LE(this.stamp.time, 10);
        header.writeUInt16LE(this.stamp.date, 12);
        header.writeUInt16LE(nameBytes.length, 26);
        const deflate = zlib.createDeflateRaw({ level: 6 });
        const entry = { name: nameBytes, offset: this.offset, crc: 0, size: 0, compressedSize: 0, deflate };
        this.pushBytes(Buffer.concat([header, nameBytes]));
        deflate.on('data', chunk => {
            entry.compressedSize += chunk.length;
            this.pushBytes(chunk);
        });
        this.entry = entry;
    }

    writeEntryData(text) {
        const bytes = Buffer.from(text, 'utf8');
        const entry = this.entry;
        entry.crc = crc32(bytes, entry.crc);
        entry.size += bytes.length;
        return new Promise((resolve, reject) => {
            entry.deflate.write(bytes, error => (error ? reject(error) : resolve()));
        });
    }

    endEntry() {
        const entry = this.entry;
        this.entry = null;
        return new Promise((resolve, reject) => {
            entry.deflate.once('error', reject);
            entry.deflate.once('end', resolve);
            entry.deflate.end();
        }).then(() => {
            this.assertZip32(entry.size, entry.compressedSize);
            const descriptor = Buffer.alloc(16);
            descriptor.writeUInt32LE(0x08074b50, 0);
            descriptor.writeUInt32LE(entry.crc, 4);
            descriptor.writeUInt32LE(entry.compressedSize, 8);
            descriptor.writeUInt32LE(entry.size, 12);
            this.pushBytes(descriptor);
            this.entries.push(entry);
        });
    }

    writeCentralDirectory() {
        const start = this.offset;
        for (const entry of this.entries) {
            const header = Buffer.alloc(46);
            header.writeUInt32LE(0x02014b50, 0);
            header.writeUInt16LE(20, 4);        // made by: 2.0
            header.writeUInt16LE(20, 6);        // needed: 2.0
            header.writeUInt16LE(0x0008, 8);
            header.writeUInt16LE(8, 10);
            header.writeUInt16LE(this.stamp.time, 12);
            header.writeUInt16LE(this.stamp.date, 14);
            header.writeUInt32LE(entry.crc, 16);
            header.writeUInt32LE(entry.compressedSize, 20);
            header.writeUInt32LE(entry.size, 24);
            header.writeUInt16LE(entry.name.length, 28);
            header.writeUInt32LE(entry.offset, 42);
            this.pushBytes(Buffer.concat([header, entry.name]));
        }
        const size = this.offset - start;
        this.assertZip32(start, size);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(this.entries.length, 8);
        end.writeUInt16LE(this.entries.length, 10);
        end.writeUInt32LE(size, 12);
        end.writeUInt32LE(start, 16);
        this.pushBytes(end);
    }
}

/**
 * @param {string[]} columns header names in SELECT order; rows are read by these keys
 * @param {{ sheetName?: string, maxRowsPerSheet?: number }} [options]
 */
export function createXlsxStreamWriter(columns, options) {
    return new XlsxStreamWriter(columns, options);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/xlsx-stream-writer.test.js`
Expected: PASS (11 tests). If SheetJS reports a value type differently from the expectation, inspect the generated sheet XML (`zipEntries(buffer)[0].data.toString()`) before changing either side; the spec's cell rules are the contract.

- [ ] **Step 5: Commit**

```bash
git add src/lib/xlsx-stream-writer.js src/lib/__tests__/xlsx-stream-writer.test.js
git commit -m "feat: add streaming xlsx writer with bounded memory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared report-run helper; `execute` uses it and drops `exportAll`

**Files:**
- Create: `src/lib/report-run.js`
- Test: `src/lib/__tests__/report-run.test.js`
- Modify: `src/app/api/reports/execute/route.js` (whole top half: lines 1-119 and the log block at 237-266)
- Existing test that must keep passing unchanged: `src/app/api/reports/execute/__tests__/route.test.js`

**Interfaces:**
- Consumes: `orderedColumns` (Task 1)
- Produces: `prepareReportRun({ session, reportId, companyId, centralPool }): Promise<{ ok: true, tSqlQuery: string, reportName: string, expectedParams: { ParameterName: string, InputType: string }[] } | { ok: false, status: number, message: string }>`
- Produces: `bindReportParameters(request, expectedParams, parameters): void`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sql from 'mssql';

vi.mock('@/lib/sql-validator', () => ({ validateQuery: vi.fn(() => ({ safe: true })) }));

import { prepareReportRun, bindReportParameters } from '@/lib/report-run';
import { validateQuery } from '@/lib/sql-validator';

let results;
let queries;

function centralPool() {
    return {
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => { queries.push({ text, inputs }); return results.shift() || { recordset: [] }; }),
            };
            return req;
        },
    };
}

const admin = { userId: 1, roleId: 1, roleName: 'Admin', allowedCompanies: [1, 2] };
const user = { userId: 2, roleId: 5, roleName: 'User', allowedCompanies: [1] };
const report = { recordset: [{ TSqlQuery: 'SELECT 1', ReportName: 'ยอดขาย' }] };

describe('prepareReportRun', () => {
    beforeEach(() => {
        results = [];
        queries = [];
        validateQuery.mockReturnValue({ safe: true });
    });

    it('returns 404 when the report does not exist', async () => {
        results = [{ recordset: [] }];
        expect(await prepareReportRun({ session: admin, reportId: 9, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: false, status: 404, message: 'Report not found' });
    });

    it('blocks unsafe SQL with 403 and logs BLOCKED_QUERY', async () => {
        results = [{ recordset: [{ TSqlQuery: 'DROP TABLE X', ReportName: 'Evil' }] }];
        validateQuery.mockReturnValue({ safe: false, reason: 'พบคำสั่งต้องห้าม: DROP' });
        const run = await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: centralPool() });
        expect(run).toEqual({ ok: false, status: 403, message: 'คำสั่ง SQL ถูกบล็อกเนื่องจากมีคำสั่งที่ไม่อนุญาต: พบคำสั่งต้องห้าม: DROP' });
        expect(queries[1].text).toMatch(/INSERT INTO ActivityLogs/);
        expect(queries[1].inputs.ActionType).toBe('BLOCKED_QUERY');
    });

    it('still answers 403 when the BLOCKED_QUERY log fails', async () => {
        const pool = centralPool();
        const original = pool.request;
        let calls = 0;
        pool.request = () => {
            const req = original();
            if (++calls === 2) req.query = vi.fn(async () => { throw new Error('no table'); });
            return req;
        };
        results = [{ recordset: [{ TSqlQuery: 'DROP TABLE X', ReportName: 'Evil' }] }];
        validateQuery.mockReturnValue({ safe: false, reason: 'DROP' });
        expect((await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: pool })).status).toBe(403);
    });

    it('refuses a company outside the session list for every role, before the role check', async () => {
        results = [report];
        const run = await prepareReportRun({ session: admin, reportId: 1, companyId: 3, centralPool: centralPool() });
        expect(run).toEqual({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' });
        expect(queries).toHaveLength(1);
    });

    it('accepts a companyId sent as a string', async () => {
        results = [report, { recordset: [] }];
        expect((await prepareReportRun({ session: admin, reportId: 1, companyId: '2', centralPool: centralPool() })).ok).toBe(true);
    });

    it('refuses a non-admin whose role is not mapped to the report', async () => {
        results = [report, { recordset: [] }];
        expect(await prepareReportRun({ session: user, reportId: 1, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
    });

    it('returns the query, name and parameter definitions for a mapped user', async () => {
        const params = [{ ParameterName: '@from', InputType: 'date' }];
        results = [report, { recordset: [{ 1: 1 }] }, { recordset: params }];
        expect(await prepareReportRun({ session: user, reportId: 1, companyId: 1, centralPool: centralPool() }))
            .toEqual({ ok: true, tSqlQuery: 'SELECT 1', reportName: 'ยอดขาย', expectedParams: params });
    });

    it('skips the role query for admins', async () => {
        results = [report, { recordset: [] }];
        await prepareReportRun({ session: admin, reportId: 1, companyId: 1, centralPool: centralPool() });
        expect(queries.map(q => q.text).some(text => /ReportRoleMapping/.test(text))).toBe(false);
    });
});

describe('bindReportParameters', () => {
    const expected = [
        { ParameterName: '@from', InputType: 'date' },
        { ParameterName: '@amount', InputType: 'number' },
        { ParameterName: '@name', InputType: 'text' },
        { ParameterName: '@blank', InputType: 'text' },
    ];

    it('binds by input type and sends empty values as NULL', () => {
        const req = { input: vi.fn() };
        bindReportParameters(req, expected, { '@from': '2026-01-01', '@amount': '12.5', '@name': 'ก', '@blank': '' });
        expect(req.input).toHaveBeenCalledWith('from', sql.Date, '2026-01-01');
        expect(req.input).toHaveBeenCalledWith('amount', sql.Decimal, 12.5);
        expect(req.input).toHaveBeenCalledWith('name', expect.objectContaining({ type: sql.NVarChar }), 'ก');
        expect(req.input).toHaveBeenCalledWith('blank', expect.objectContaining({ type: sql.NVarChar }), null);
    });

    it('binds nothing when no parameter values were sent', () => {
        const req = { input: vi.fn() };
        bindReportParameters(req, expected, undefined);
        expect(req.input).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/report-run.test.js`
Expected: FAIL — cannot resolve `@/lib/report-run`.

- [ ] **Step 3: Write `src/lib/report-run.js`**

```js
import sql from 'mssql';
import { validateQuery } from '@/lib/sql-validator';

/**
 * Checks every route that runs a report for a signed-in user must make, in this order:
 * report exists → SQL is safe → company allowed (every role) → role mapped (non-admins).
 * Keeps the central-DB query order that `execute` has always used.
 */
export async function prepareReportRun({ session, reportId, companyId, centralPool }) {
    const reportResult = await centralPool.request()
        .input('ReportId', sql.Int, parseInt(reportId))
        .query('SELECT TSqlQuery, ReportName FROM Reports WHERE ReportId = @ReportId');
    if (reportResult.recordset.length === 0) return { ok: false, status: 404, message: 'Report not found' };
    const { TSqlQuery: tSqlQuery, ReportName: reportName } = reportResult.recordset[0];

    const validation = validateQuery(tSqlQuery);
    if (!validation.safe) {
        try {
            await centralPool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('ActionType', sql.NVarChar(50), 'BLOCKED_QUERY')
                .input('Details', sql.NVarChar(500), `ถูกบล็อก: "${reportName}" — ${validation.reason}`)
                .query('INSERT INTO ActivityLogs (UserId, ReportId, ActionType, Details) VALUES (@UserId, @ReportId, @ActionType, @Details)');
        } catch { /* logging must never change the answer */ }
        return { ok: false, status: 403, message: `คำสั่ง SQL ถูกบล็อกเนื่องจากมีคำสั่งที่ไม่อนุญาต: ${validation.reason}` };
    }

    const allowed = session.allowedCompanies || [];
    if (!allowed.includes(parseInt(companyId))) {
        return { ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' };
    }

    if (session.roleName?.toLowerCase() !== 'admin') {
        const accessCheck = await centralPool.request()
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('RoleId', sql.Int, session.roleId)
            .query('SELECT 1 FROM ReportRoleMapping WHERE ReportId = @ReportId AND RoleId = @RoleId');
        if (accessCheck.recordset.length === 0) return { ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' };
    }

    const paramResult = await centralPool.request()
        .input('ReportId', sql.Int, parseInt(reportId))
        .query('SELECT ParameterName, InputType FROM ReportParameters WHERE ReportId = @ReportId');
    return { ok: true, tSqlQuery, reportName, expectedParams: paramResult.recordset };
}

/** Bind the report's declared parameters; values the user left empty are sent as NULL. */
export function bindReportParameters(request, expectedParams, parameters) {
    if (!parameters) return;
    for (const expectedParam of expectedParams) {
        const paramName = expectedParam.ParameterName.replace('@', '');
        const value = parameters[expectedParam.ParameterName];
        if (value === undefined || value === '') {
            request.input(paramName, sql.NVarChar(sql.MAX), null);
            continue;
        }
        switch (expectedParam.InputType) {
            case 'date':
                request.input(paramName, sql.Date, value);
                break;
            case 'number':
                request.input(paramName, sql.Decimal, parseFloat(value));
                break;
            default:
                request.input(paramName, sql.NVarChar(sql.MAX), value);
        }
    }
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run src/lib/__tests__/report-run.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Switch `execute` to the helpers**

In `src/app/api/reports/execute/route.js`:

Replace the imports with:

```js
import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB, getCompanyLabel } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { orderedColumns } from '@/lib/report-columns';
```

Replace everything from `const body = await request.json();` down to and including the closing `};` of the `bindParams` helper (the block that ends just before `// 4. Execute — with or without pagination`) with:

```js
        const body = await request.json();
        const { reportId, companyId, parameters, page, pageSize } = body;

        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: "ReportId and CompanyId are required" }, { status: 400 });
        }

        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const centralPool = await connectToCentralDB();
        const run = await prepareReportRun({ session, reportId, companyId, centralPool });
        if (!run.ok) {
            return NextResponse.json({ success: false, message: run.message }, { status: run.status });
        }
        const { tSqlQuery, reportName, expectedParams } = run;

        const companyPool = await connectToCompanyDB(companyId);

        // Bind parameters to a request + set report timeout
        const bindParams = (req) => {
            req.timeout = REPORT_TIMEOUT;
            bindReportParameters(req, expectedParams, parameters);
        };
```

Change `let usePagination = page && pageSize && !exportAll;` to:

```js
        let usePagination = page && pageSize;
```

Replace the body of `captureColumns` with:

```js
        const captureColumns = (result) => {
            if (capturedColumns) return; // already captured
            const meta = result?.recordset?.columns;
            if (meta) capturedColumns = orderedColumns(meta);
        };
```

Replace the activity-log block (`// 5. Log Activity …` through the end of its `catch`) with:

```js
        // 5. Log Activity (non-blocking, don't fail if table doesn't exist)
        try {
            const companyLabel = getCompanyLabel(companyId);
            let paramSummary = '';
            if (parameters && Object.keys(parameters).length > 0) {
                const paramParts = Object.entries(parameters)
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => `${k}=${v}`);
                if (paramParts.length > 0) paramSummary = ` | ${paramParts.join(', ')}`;
            }
            const changeData = parameters && Object.keys(parameters).length > 0
                ? JSON.stringify({ parameters })
                : null;

            await centralPool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .input('CompanyId', sql.Int, parseInt(companyId))
                .input('ActionType', sql.NVarChar(50), 'EXECUTE_REPORT')
                .input('Details', sql.NVarChar(sql.MAX), `รัน "${reportName}" (${companyLabel}) ได้ ${totalRows.toLocaleString()} แถว${paramSummary}`)
                .input('ChangeData', sql.NVarChar(sql.MAX), changeData)
                .query(`INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details, @ChangeData)`);
        } catch (logErr) {
            // Silently fail — logging should never break execution
            console.warn('Activity log failed (table may not exist):', logErr.message);
        }
```

Leave the pagination, fallback and response code unchanged.

- [ ] **Step 6: Run both suites**

Run: `npx vitest run src/lib/__tests__/report-run.test.js src/app/api/reports/execute/__tests__/route.test.js`
Expected: PASS. The `execute` tests are not edited; if one fails, the helper changed the query order or a message — fix the helper, not the test.

- [ ] **Step 7: Confirm `exportAll` is gone**

Run: `git grep -n exportAll -- src`
Expected: only `src/app/(dashboard)/reports/standard/page.tsx` (removed in Task 9).

- [ ] **Step 8: Commit**

```bash
git add src/lib/report-run.js src/lib/__tests__/report-run.test.js src/app/api/reports/execute/route.js
git commit -m "refactor: share report authorization between execute and export

Moves report lookup, SQL validation, company and role checks and parameter
binding into src/lib/report-run.js with the same order and messages, and
drops the unused exportAll path from execute.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Temporary export files, file-name and download-header helpers

**Files:**
- Create: `src/lib/export-files.js`
- Create: `src/lib/content-disposition.js`
- Modify: `src/lib/excel-export.js` (add `safeFileBase`)
- Test: `src/lib/__tests__/export-files.test.js`, `src/lib/__tests__/content-disposition.test.js`, `src/lib/__tests__/excel-export.test.js` (append)

**Interfaces:**
- Produces (`export-files.js`): `EXPORTS_DIR: string`, `EXPORT_MAX_AGE_MS = 900000`, `isExportId(id): boolean`, `exportFilePaths(id, dir?): { dataPath, metaPath }`, `createExportFile(dir?): Promise<{ id, dataPath, metaPath }>`, `writeExportMeta(id, meta: { userId: number, fileName: string, createdAt: string }, dir?): Promise<void>`, `readExportMeta(id, dir?): Promise<meta | null>`, `deleteExportFile(id, dir?): Promise<void>`, `sweepExportFiles({ maxAgeMs?, now?, dir? }?): Promise<number>`
- Produces (`content-disposition.js`): `attachmentHeader(fileName: string): string`
- Produces (`excel-export.js`): `safeFileBase(name: unknown): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/export-files.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    createExportFile, deleteExportFile, EXPORT_MAX_AGE_MS, exportFilePaths, isExportId,
    readExportMeta, sweepExportFiles, writeExportMeta,
} from '@/lib/export-files';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-export-files-')); });

describe('export files', () => {
    it('creates a UUID id with paths inside the directory', async () => {
        const file = await createExportFile(dir);
        expect(isExportId(file.id)).toBe(true);
        expect(file.dataPath).toBe(path.join(dir, `${file.id}.xlsx`));
        expect(file.metaPath).toBe(path.join(dir, `${file.id}.json`));
    });

    it('round-trips metadata', async () => {
        const { id } = await createExportFile(dir);
        const meta = { userId: 7, fileName: 'ยอดขาย_2026-10-06.xlsx', createdAt: '2026-10-06T00:00:00.000Z' };
        await writeExportMeta(id, meta, dir);
        expect(await readExportMeta(id, dir)).toEqual(meta);
    });

    it('returns null for ids that are not UUIDs or have no metadata', async () => {
        expect(await readExportMeta('../../etc/passwd', dir)).toBeNull();
        expect(await readExportMeta('00000000-0000-4000-8000-000000000000', dir)).toBeNull();
    });

    it('deletes both files and tolerates files already gone', async () => {
        const { id, dataPath, metaPath } = await createExportFile(dir);
        fs.writeFileSync(dataPath, 'x');
        await writeExportMeta(id, { userId: 1, fileName: 'a.xlsx', createdAt: '' }, dir);
        await deleteExportFile(id, dir);
        await deleteExportFile(id, dir);
        expect(fs.existsSync(dataPath) || fs.existsSync(metaPath)).toBe(false);
    });

    it('sweeps files older than the limit and keeps recent ones', async () => {
        const oldFile = exportFilePaths('11111111-1111-4111-8111-111111111111', dir).dataPath;
        const newFile = exportFilePaths('22222222-2222-4222-8222-222222222222', dir).dataPath;
        fs.writeFileSync(oldFile, 'old');
        fs.writeFileSync(newFile, 'new');
        const now = Date.now();
        const past = new Date(now - EXPORT_MAX_AGE_MS - 60000);
        fs.utimesSync(oldFile, past, past);
        expect(await sweepExportFiles({ dir, now })).toBe(1);
        expect(fs.existsSync(oldFile)).toBe(false);
        expect(fs.existsSync(newFile)).toBe(true);
    });

    it('sweeps nothing when the directory does not exist yet', async () => {
        expect(await sweepExportFiles({ dir: path.join(dir, 'missing') })).toBe(0);
    });
});
```

`src/lib/__tests__/content-disposition.test.js`:

```js
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
```

Append to `src/lib/__tests__/excel-export.test.js` (and add `safeFileBase` to its import list):

```js
describe('safeFileBase', () => {
    it('replaces characters Windows and Linux cannot use in file names', () => {
        expect(safeFileBase('ยอดขาย A/B: "Q" <1>|*?\\')).toBe('ยอดขาย A_B_ _Q_ _1_____');
    });
    it('falls back to "report" for empty names', () => {
        expect(safeFileBase('  ')).toBe('report');
        expect(safeFileBase(null)).toBe('report');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/export-files.test.js src/lib/__tests__/content-disposition.test.js src/lib/__tests__/excel-export.test.js`
Expected: FAIL — cannot resolve `@/lib/export-files` and `@/lib/content-disposition`; `safeFileBase` is not exported.

- [ ] **Step 3: Write the implementations**

`src/lib/export-files.js`:

```js
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Temporary files for ordinary-report exports: `<uuid>.xlsx` plus `<uuid>.json` metadata.
 * Deleted after the single download; anything left behind is swept after 15 minutes.
 * (Background-job files for IsHeavy reports live in tmp/jobs and are kept 24 hours.)
 */
export const EXPORTS_DIR = path.join(process.cwd(), 'tmp', 'exports');
export const EXPORT_MAX_AGE_MS = 15 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isExportId(id) {
    return typeof id === 'string' && ID_PATTERN.test(id);
}

export function exportFilePaths(id, dir = EXPORTS_DIR) {
    return { dataPath: path.join(dir, `${id}.xlsx`), metaPath: path.join(dir, `${id}.json`) };
}

export async function createExportFile(dir = EXPORTS_DIR) {
    await fs.promises.mkdir(dir, { recursive: true });
    const id = randomUUID();
    return { id, ...exportFilePaths(id, dir) };
}

export async function writeExportMeta(id, meta, dir = EXPORTS_DIR) {
    await fs.promises.writeFile(exportFilePaths(id, dir).metaPath, JSON.stringify(meta), 'utf8');
}

/** Metadata of an export, or null when the id is malformed or the export no longer exists. */
export async function readExportMeta(id, dir = EXPORTS_DIR) {
    if (!isExportId(id)) return null;
    try {
        return JSON.parse(await fs.promises.readFile(exportFilePaths(id, dir).metaPath, 'utf8'));
    } catch {
        return null;
    }
}

export async function deleteExportFile(id, dir = EXPORTS_DIR) {
    const { dataPath, metaPath } = exportFilePaths(id, dir);
    await Promise.all([fs.promises.rm(dataPath, { force: true }), fs.promises.rm(metaPath, { force: true })]);
}

/** Delete export files older than `maxAgeMs`; returns how many were removed. */
export async function sweepExportFiles({ maxAgeMs = EXPORT_MAX_AGE_MS, now = Date.now(), dir = EXPORTS_DIR } = {}) {
    let names;
    try {
        names = await fs.promises.readdir(dir);
    } catch {
        return 0;
    }
    let deleted = 0;
    for (const name of names) {
        const filePath = path.join(dir, name);
        try {
            const stat = await fs.promises.stat(filePath);
            if (now - stat.mtimeMs > maxAgeMs) {
                await fs.promises.rm(filePath, { force: true });
                deleted++;
            }
        } catch { /* removed meanwhile */ }
    }
    return deleted;
}
```

`src/lib/content-disposition.js`:

```js
/**
 * `Content-Disposition` for a download: an ASCII fallback for old clients plus the real
 * (often Thai) name as RFC 5987 `filename*`, so browsers do not show it percent-encoded.
 */
export function attachmentHeader(fileName) {
    const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(fileName).replace(/['()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
```

Append to `src/lib/excel-export.js`:

```js
/** A report name made safe for a file name on Windows and Linux. */
export function safeFileBase(name) {
    const cleaned = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
    return cleaned || 'report';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/export-files.test.js src/lib/__tests__/content-disposition.test.js src/lib/__tests__/excel-export.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-files.js src/lib/content-disposition.js src/lib/excel-export.js src/lib/__tests__/export-files.test.js src/lib/__tests__/content-disposition.test.js src/lib/__tests__/excel-export.test.js
git commit -m "feat: add temporary export file store and download header helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Stream a query into an xlsx file

**Files:**
- Create: `src/lib/report-export-stream.js`
- Test: `src/lib/__tests__/report-export-stream.test.js`

**Interfaces:**
- Consumes: `orderedColumns` (Task 1), `createXlsxStreamWriter` (Task 2)
- Produces: `streamQueryToXlsx({ sqlRequest, query: string, filePath: string, signal?: AbortSignal }): Promise<number>` — resolves with the data-row count of the first recordset once the file is fully written; rejects on SQL, write or abort errors (the caller deletes the file).

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as xlsx from 'xlsx';
import { streamQueryToXlsx } from '@/lib/report-export-stream';

/** A stand-in for an mssql streaming request; `script` emits the events once query() is called. */
function fakeSqlRequest(script) {
    const req = new EventEmitter();
    req.pause = vi.fn();
    req.resume = vi.fn();
    req.cancel = vi.fn();
    req.query = vi.fn(() => { setImmediate(() => script(req)); });
    return req;
}

let filePath;
beforeEach(() => {
    filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-export-stream-')), 'out.xlsx');
});

const readRows = () => xlsx.utils.sheet_to_json(xlsx.readFile(filePath).Sheets['Report Data'], { header: 1 });

describe('streamQueryToXlsx', () => {
    it('writes the first recordset in SELECT order and resolves with the row count', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { B: { index: 1 }, A: { index: 0 } });
            req.emit('row', { A: 1, B: 'หนึ่ง' });
            req.emit('row', { A: 2, B: 'สอง' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'SELECT 1', filePath })).resolves.toBe(2);
        expect(sqlRequest.stream).toBe(true);
        expect(sqlRequest.query).toHaveBeenCalledWith('SELECT 1');
        expect(readRows()).toEqual([['A', 'B'], [1, 'หนึ่ง'], [2, 'สอง']]);
    });

    it('ignores rows from later recordsets', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            req.emit('row', { A: 1 });
            req.emit('recordset', { Other: { index: 0 } });
            req.emit('row', { Other: 'x' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(1);
        expect(readRows()).toEqual([['A'], [1]]);
    });

    it('resolves 0 with a valid file when the query returns no recordset', async () => {
        const sqlRequest = fakeSqlRequest(req => req.emit('done', {}));
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(0);
        expect(xlsx.readFile(filePath).SheetNames).toEqual(['Report Data']);
    });

    it('rejects on a SQL error', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            req.emit('error', new Error('Invalid column name'));
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).rejects.toThrow('Invalid column name');
    });

    it('cancels the SQL request and rejects when aborted mid-stream, never resolving', async () => {
        const controller = new AbortController();
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { A: { index: 0 } });
            for (let i = 0; i < 100; i++) req.emit('row', { A: i });
            controller.abort();
            req.emit('row', { A: 'late' });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, signal: controller.signal })).rejects.toBeDefined();
        expect(sqlRequest.cancel).toHaveBeenCalled();
    });

    it('rejects at once when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const sqlRequest = fakeSqlRequest(() => {});
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath, signal: controller.signal })).rejects.toBeDefined();
        expect(sqlRequest.query).not.toHaveBeenCalled();
    });

    it('pauses the SQL stream under back-pressure and resumes after drain', async () => {
        const sqlRequest = fakeSqlRequest(req => {
            req.emit('recordset', { Hex: { index: 0 } });
            for (let i = 0; i < 2000; i++) req.emit('row', { Hex: randomBytes(1000).toString('hex') });
            req.emit('done', {});
        });
        await expect(streamQueryToXlsx({ sqlRequest, query: 'q', filePath })).resolves.toBe(2000);
        expect(sqlRequest.pause).toHaveBeenCalled();
        expect(sqlRequest.resume).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/report-export-stream.test.js`
Expected: FAIL — cannot resolve `@/lib/report-export-stream`.

- [ ] **Step 3: Write the implementation**

```js
import fs from 'fs';
import { finished } from 'stream/promises';
import { orderedColumns } from '@/lib/report-columns';
import { createXlsxStreamWriter } from '@/lib/xlsx-stream-writer';

/**
 * Run `query` on an mssql request in streaming mode and write its first recordset to `filePath`
 * as .xlsx, pausing the SQL stream whenever the writer falls behind. Resolves with the number of
 * data rows once the file is complete. Rejects on SQL, write or abort errors; the caller deletes
 * the file. Later recordsets are ignored, matching what `execute` shows.
 */
export function streamQueryToXlsx({ sqlRequest, query, filePath, signal }) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new Error('Export aborted'));
            return;
        }
        const file = fs.createWriteStream(filePath);
        let writer = null;
        let recordsets = 0;
        let rowCount = 0;
        let waitingForDrain = false;
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            try { sqlRequest.cancel(); } catch { /* request already finished */ }
            writer?.destroy();
            file.destroy();
            reject(error);
        };
        const onAbort = () => fail(signal.reason ?? new Error('Export aborted'));
        signal?.addEventListener('abort', onAbort, { once: true });

        const startWriter = (columns) => {
            writer = createXlsxStreamWriter(columns);
            writer.on('error', fail);
            writer.pipe(file);
        };

        file.on('error', fail);
        sqlRequest.stream = true;
        sqlRequest.on('recordset', (metadata) => {
            recordsets++;
            if (recordsets === 1 && !settled) startWriter(orderedColumns(metadata));
        });
        sqlRequest.on('row', (row) => {
            if (settled || recordsets !== 1) return;
            rowCount++;
            if (!writer.write(row) && !waitingForDrain) {
                waitingForDrain = true;
                sqlRequest.pause();
                writer.once('drain', () => {
                    waitingForDrain = false;
                    sqlRequest.resume();
                });
            }
        });
        sqlRequest.on('error', fail);
        sqlRequest.on('done', () => {
            if (settled) return;
            if (!writer) startWriter([]);
            writer.end();
            finished(file).then(() => {
                if (settled) return;
                settled = true;
                signal?.removeEventListener('abort', onAbort);
                resolve(rowCount);
            }, fail);
        });
        sqlRequest.query(query);
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/report-export-stream.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-export-stream.js src/lib/__tests__/report-export-stream.test.js
git commit -m "feat: stream a report query into an xlsx file with back-pressure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Export routes — `POST /api/reports/export` and `GET /api/reports/export/[id]`

**Files:**
- Create: `src/app/api/reports/export/route.js`
- Create: `src/app/api/reports/export/[id]/route.js`
- Test: `src/app/api/reports/export/__tests__/route.test.js`, `src/app/api/reports/export/[id]/__tests__/route.test.js`

**Interfaces:**
- Consumes: `prepareReportRun`, `bindReportParameters` (Task 3); `sweepExportFiles`, `createExportFile`, `writeExportMeta`, `deleteExportFile`, `readExportMeta`, `exportFilePaths` (Task 4); `attachmentHeader` (Task 4); `safeFileBase`, `excelFileName`, `EXCEL_MIME` (`src/lib/excel-export.js`); `streamQueryToXlsx` (Task 5)
- Produces: `POST /api/reports/export` body `{ reportId, companyId, parameters }` → `200 { success: true, rowCount: 0 }` | `200 { success: true, downloadId: string, fileName: string, rowCount: number }` | `4xx/500 { success: false, message }`
- Produces: `GET /api/reports/export/{downloadId}` → the file once (`Content-Type: EXCEL_MIME`), then 404

- [ ] **Step 1: Write the failing POST tests** (`src/app/api/reports/export/__tests__/route.test.js`)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
    connectToCentralDB: vi.fn(),
    connectToCompanyDB: vi.fn(),
    getCompanyLabel: vi.fn(() => 'Sonic Interfreight (SNI)'),
}));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/report-run', () => ({ prepareReportRun: vi.fn(), bindReportParameters: vi.fn() }));
vi.mock('@/lib/export-files', () => ({
    sweepExportFiles: vi.fn(async () => 0),
    createExportFile: vi.fn(async () => ({ id: 'export-1', dataPath: '/tmp/export-1.xlsx', metaPath: '/tmp/export-1.json' })),
    writeExportMeta: vi.fn(async () => {}),
    deleteExportFile: vi.fn(async () => {}),
}));
vi.mock('@/lib/report-export-stream', () => ({ streamQueryToXlsx: vi.fn() }));

import { POST } from '@/app/api/reports/export/route';
import { getSession } from '@/lib/auth';
import { connectToCentralDB, connectToCompanyDB } from '@/lib/db';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';

let logged;
let companyRequest;
const today = () => new Date().toISOString().split('T')[0];
const params = [{ ParameterName: '@from', InputType: 'date' }];
const createRequest = (body, signal) => ({ json: async () => body, signal });

beforeEach(() => {
    vi.clearAllMocks();
    logged = [];
    companyRequest = { timeout: 0 };
    getSession.mockResolvedValue({ userId: 7, roleName: 'User', roleId: 3, allowedCompanies: [1] });
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const inputs = {};
            const req = {
                input: vi.fn((name, _type, value) => { inputs[name] = value; return req; }),
                query: vi.fn(async text => { logged.push({ text, inputs }); return { recordset: [] }; }),
            };
            return req;
        },
    });
    connectToCompanyDB.mockResolvedValue({ request: () => companyRequest });
    prepareReportRun.mockResolvedValue({ ok: true, tSqlQuery: 'SELECT 1', reportName: 'ยอดขาย A/B: "Q"', expectedParams: params });
    streamQueryToXlsx.mockResolvedValue(3);
});

describe('POST /api/reports/export', () => {
    it('returns 400 without reportId or companyId', async () => {
        expect((await POST(createRequest({ companyId: 1 }))).status).toBe(400);
        expect((await POST(createRequest({ reportId: 1 }))).status).toBe(400);
    });

    it('returns 401 without a session', async () => {
        getSession.mockResolvedValue(null);
        expect((await POST(createRequest({ reportId: 1, companyId: 1 }))).status).toBe(401);
        expect(createExportFile).not.toHaveBeenCalled();
    });

    it('passes the helper refusal through and creates no file', async () => {
        prepareReportRun.mockResolvedValue({ ok: false, status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
        const res = await POST(createRequest({ reportId: 1, companyId: 1 }));
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงรายงานนี้' });
        expect(createExportFile).not.toHaveBeenCalled();
    });

    it('streams the query into the export file and answers with a download id', async () => {
        const signal = new AbortController().signal;
        const parameters = { '@from': '2026-01-01' };
        const res = await POST(createRequest({ reportId: 5, companyId: 1, parameters }, signal));
        const data = await res.json();

        const fileName = `ยอดขาย A_B_ _Q__${today()}.xlsx`;
        expect(data).toEqual({ success: true, downloadId: 'export-1', fileName, rowCount: 3 });
        expect(sweepExportFiles.mock.invocationCallOrder[0]).toBeLessThan(createExportFile.mock.invocationCallOrder[0]);
        expect(companyRequest.timeout).toBe(120000);
        expect(bindReportParameters).toHaveBeenCalledWith(companyRequest, params, parameters);
        expect(streamQueryToXlsx).toHaveBeenCalledWith({ sqlRequest: companyRequest, query: 'SELECT 1', filePath: '/tmp/export-1.xlsx', signal });
        expect(writeExportMeta).toHaveBeenCalledWith('export-1', { userId: 7, fileName, createdAt: expect.any(String) });
        expect(deleteExportFile).not.toHaveBeenCalled();
    });

    it('logs EXPORT_EXCEL with the row count and parameters', async () => {
        await POST(createRequest({ reportId: 5, companyId: 1, parameters: { '@from': '2026-01-01' } }));
        const log = logged.find(entry => /INSERT INTO ActivityLogs/.test(entry.text));
        expect(log.inputs.ActionType).toBe('EXPORT_EXCEL');
        expect(log.inputs.Details).toBe('Export Excel "ยอดขาย A/B: "Q"" (Sonic Interfreight (SNI)) ได้ 3 แถว | @from=2026-01-01');
        expect(log.inputs.ChangeData).toBe(JSON.stringify({ parameters: { '@from': '2026-01-01' } }));
    });

    it('deletes the file and offers no download when there are no rows', async () => {
        streamQueryToXlsx.mockResolvedValue(0);
        const data = await (await POST(createRequest({ reportId: 5, companyId: 1 }))).json();
        expect(data).toEqual({ success: true, rowCount: 0 });
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
        expect(writeExportMeta).not.toHaveBeenCalled();
        expect(logged.some(entry => entry.inputs.ActionType === 'EXPORT_EXCEL')).toBe(true);
    });

    it('removes the partial file and answers 500 when streaming fails', async () => {
        streamQueryToXlsx.mockRejectedValue(new Error('Invalid column name'));
        const res = await POST(createRequest({ reportId: 5, companyId: 1 }));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ success: false, message: 'ไม่สามารถส่งออกข้อมูลได้' });
        expect(deleteExportFile).toHaveBeenCalledWith('export-1');
        expect(writeExportMeta).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Write the failing GET tests** (`src/app/api/reports/export/[id]/__tests__/route.test.js`)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { randomUUID } from 'crypto';

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/export-files', async (importOriginal) => {
    const actual = await importOriginal();
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const dir = mkdtempSync(join(tmpdir(), 'rc-export-get-'));
    return {
        ...actual,
        exportFilePaths: id => actual.exportFilePaths(id, dir),
        readExportMeta: id => actual.readExportMeta(id, dir),
        deleteExportFile: id => actual.deleteExportFile(id, dir),
        writeExportMeta: (id, meta) => actual.writeExportMeta(id, meta, dir),
    };
});

import { GET } from '@/app/api/reports/export/[id]/route';
import { getSession } from '@/lib/auth';
import { exportFilePaths, writeExportMeta } from '@/lib/export-files';
import { EXCEL_MIME } from '@/lib/excel-export';

const fileName = 'ยอดขาย_2026-10-06.xlsx';
const bytes = Buffer.from('xlsx-bytes-for-test');
const props = id => ({ params: Promise.resolve({ id }) });

async function createExport(userId = 7) {
    const id = randomUUID();
    fs.writeFileSync(exportFilePaths(id).dataPath, bytes);
    await writeExportMeta(id, { userId, fileName, createdAt: new Date().toISOString() });
    return id;
}

beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: 7 });
});

describe('GET /api/reports/export/[id]', () => {
    it('returns 401 without a session', async () => {
        getSession.mockResolvedValue(null);
        expect((await GET({}, props(await createExport()))).status).toBe(401);
    });

    it('returns 404 for an id that is not an export id', async () => {
        expect((await GET({}, props('../../etc/passwd'))).status).toBe(404);
    });

    it("returns 404 for another user's export and leaves it in place", async () => {
        const id = await createExport(99);
        expect((await GET({}, props(id))).status).toBe(404);
        expect(fs.existsSync(exportFilePaths(id).dataPath)).toBe(true);
    });

    it('streams the file once with download headers, deletes it, then answers 404', async () => {
        const id = await createExport();
        const res = await GET({}, props(id));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe(EXCEL_MIME);
        expect(res.headers.get('content-length')).toBe(String(bytes.length));
        expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent(fileName)}`);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
        await vi.waitFor(() => {
            expect(fs.existsSync(exportFilePaths(id).dataPath)).toBe(false);
            expect(fs.existsSync(exportFilePaths(id).metaPath)).toBe(false);
        });
        expect((await GET({}, props(id))).status).toBe(404);
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/app/api/reports/export`
Expected: FAIL — cannot resolve the two route modules.

- [ ] **Step 4: Write `src/app/api/reports/export/route.js`**

```js
import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB, connectToCompanyDB, getCompanyLabel } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { bindReportParameters, prepareReportRun } from '@/lib/report-run';
import { createExportFile, deleteExportFile, sweepExportFiles, writeExportMeta } from '@/lib/export-files';
import { streamQueryToXlsx } from '@/lib/report-export-stream';
import { excelFileName, safeFileBase } from '@/lib/excel-export';

// Same limit as /api/reports/execute; reports that need longer should be marked IsHeavy
const REPORT_TIMEOUT = parseInt(process.env.REPORT_REQUEST_TIMEOUT) || 120000;

/**
 * Export an ordinary report as .xlsx without holding it in memory: rows stream from SQL into a
 * temporary file, and the browser fetches it once from GET /api/reports/export/[id].
 * IsHeavy reports use /api/reports/execute-async instead (CSV kept 24 hours for later download).
 */
export async function POST(request) {
    let exportId = null;
    try {
        const { reportId, companyId, parameters } = await request.json();
        if (!reportId || !companyId) {
            return NextResponse.json({ success: false, message: 'ReportId and CompanyId are required' }, { status: 400 });
        }

        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const centralPool = await connectToCentralDB();
        const run = await prepareReportRun({ session, reportId, companyId, centralPool });
        if (!run.ok) {
            return NextResponse.json({ success: false, message: run.message }, { status: run.status });
        }

        await sweepExportFiles();
        const file = await createExportFile();
        exportId = file.id;

        const companyPool = await connectToCompanyDB(companyId);
        const sqlRequest = companyPool.request();
        sqlRequest.timeout = REPORT_TIMEOUT;
        bindReportParameters(sqlRequest, run.expectedParams, parameters);

        const rowCount = await streamQueryToXlsx({ sqlRequest, query: run.tSqlQuery, filePath: file.dataPath, signal: request.signal });
        await logExport({ centralPool, session, reportId, companyId, reportName: run.reportName, rowCount, parameters });

        if (rowCount === 0) {
            await deleteExportFile(file.id);
            return NextResponse.json({ success: true, rowCount: 0 });
        }

        const fileName = excelFileName(`${safeFileBase(run.reportName)}_${new Date().toISOString().split('T')[0]}`);
        await writeExportMeta(file.id, { userId: session.userId, fileName, createdAt: new Date().toISOString() });
        return NextResponse.json({ success: true, downloadId: file.id, fileName, rowCount });
    } catch (error) {
        if (exportId) await deleteExportFile(exportId).catch(() => {});
        if (request.signal?.aborted) console.log('[Export] Cancelled by the client; SQL request cancelled');
        else console.error('Error exporting report:', error);
        return NextResponse.json({ success: false, message: 'ไม่สามารถส่งออกข้อมูลได้' }, { status: 500 });
    }
}

async function logExport({ centralPool, session, reportId, companyId, reportName, rowCount, parameters }) {
    try {
        const paramParts = Object.entries(parameters || {})
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${k}=${v}`);
        const paramSummary = paramParts.length > 0 ? ` | ${paramParts.join(', ')}` : '';
        const changeData = parameters && Object.keys(parameters).length > 0 ? JSON.stringify({ parameters }) : null;

        await centralPool.request()
            .input('UserId', sql.Int, session.userId)
            .input('ReportId', sql.Int, parseInt(reportId))
            .input('CompanyId', sql.Int, parseInt(companyId))
            .input('ActionType', sql.NVarChar(50), 'EXPORT_EXCEL')
            .input('Details', sql.NVarChar(sql.MAX), `Export Excel "${reportName}" (${getCompanyLabel(companyId)}) ได้ ${rowCount.toLocaleString()} แถว${paramSummary}`)
            .input('ChangeData', sql.NVarChar(sql.MAX), changeData)
            .query('INSERT INTO ActivityLogs (UserId, ReportId, CompanyId, ActionType, Details, ChangeData) VALUES (@UserId, @ReportId, @CompanyId, @ActionType, @Details, @ChangeData)');
    } catch (error) {
        console.warn('Activity log failed (table may not exist):', error.message);
    }
}
```

- [ ] **Step 5: Write `src/app/api/reports/export/[id]/route.js`**

```js
import { NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'stream';
import { getSession } from '@/lib/auth';
import { deleteExportFile, exportFilePaths, readExportMeta } from '@/lib/export-files';
import { attachmentHeader } from '@/lib/content-disposition';
import { EXCEL_MIME } from '@/lib/excel-export';

const notFound = () => NextResponse.json({ success: false, message: 'ไม่พบไฟล์' }, { status: 404 });

/** Send an ordinary-report export once, then delete it. */
export async function GET(request, props) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;
        const meta = await readExportMeta(id); // null for a malformed id or an export already downloaded
        if (!meta || meta.userId !== session.userId) return notFound();

        const { dataPath } = exportFilePaths(id);
        let stat;
        try {
            stat = await fs.promises.stat(dataPath);
        } catch {
            await deleteExportFile(id);
            return notFound();
        }

        const stream = fs.createReadStream(dataPath);
        // 'close' fires after a full send or an interrupted one; either way the export is used up
        stream.once('close', () => { void deleteExportFile(id); });
        return new Response(Readable.toWeb(stream), {
            headers: {
                'Content-Type': EXCEL_MIME,
                'Content-Length': String(stat.size),
                'Content-Disposition': attachmentHeader(meta.fileName),
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('Export download error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/app/api/reports/export`
Expected: PASS (7 + 4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reports/export
git commit -m "feat: add streaming xlsx export routes for ordinary reports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stream heavy-job downloads and add `HEAD`

**Files:**
- Modify: `src/app/api/reports/jobs/[id]/download/route.js` (replace the whole file)
- Test: `src/app/api/reports/jobs/[id]/download/__tests__/route.test.js`

**Interfaces:**
- Consumes: `attachmentHeader` (Task 4), `EXCEL_MIME`
- Produces: `HEAD /api/reports/jobs/{id}/download` → same status codes as `GET` (401, 404, 400, 410, 200), no body

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/lib/db', () => ({ connectToCentralDB: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

import { GET, HEAD } from '@/app/api/reports/jobs/[id]/download/route';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

let jobRow;
const props = { params: Promise.resolve({ id: '12' }) };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-download-'));

function job(fileName, contents = 'a,b\n1,2\n') {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, contents);
    return { FilePath: filePath, FileName: fileName, Status: 'done' };
}

beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: 7 });
    jobRow = job('ยอดขาย_2026-10-06_job12.csv');
    connectToCentralDB.mockResolvedValue({
        request: () => {
            const req = { input: vi.fn(() => req), query: vi.fn(async () => ({ recordset: jobRow ? [jobRow] : [] })) };
            return req;
        },
    });
});

describe('job file download', () => {
    it('streams a CSV with its content type, length and Thai file name', async () => {
        const res = await GET({}, props);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
        expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength('a,b\n1,2\n')));
        expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('ยอดขาย_2026-10-06_job12.csv')}`);
        expect(await res.text()).toBe('a,b\n1,2\n');
    });

    it('labels an .xlsx job file as Excel', async () => {
        jobRow = job('r_job12.xlsx', 'PK');
        expect((await GET({}, props)).headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('answers HEAD with the same headers and no body', async () => {
        const res = await HEAD({}, props);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength('a,b\n1,2\n')));
        expect(res.body).toBeNull();
    });

    it.each([
        ['no session', () => getSession.mockResolvedValue(null), 401],
        ['unknown job', () => { jobRow = null; }, 404],
        ['job still running', () => { jobRow = { ...jobRow, Status: 'running' }; }, 400],
        ['file already cleaned up', () => { jobRow = { ...jobRow, FilePath: path.join(dir, 'gone.csv') }; }, 410],
    ])('returns %s as %i for GET and HEAD', async (_name, arrange, status) => {
        arrange();
        expect((await GET({}, props)).status).toBe(status);
        const head = await HEAD({}, props);
        expect(head.status).toBe(status);
        expect(head.body).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/reports/jobs/[id]/download/__tests__/route.test.js"`
Expected: FAIL — `HEAD` is not exported and the CSV `content-disposition` lacks `filename*`.

- [ ] **Step 3: Replace `src/app/api/reports/jobs/[id]/download/route.js`**

```js
import { NextResponse } from 'next/server';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { attachmentHeader } from '@/lib/content-disposition';
import { EXCEL_MIME } from '@/lib/excel-export';

function contentTypeFor(fileName) {
    if (fileName?.endsWith('.csv')) return 'text/csv; charset=utf-8';
    if (fileName?.endsWith('.xlsx')) return EXCEL_MIME;
    return 'application/octet-stream';
}

/** The job file the signed-in user may download, or the status explaining why not. */
async function findJobFile(request, props) {
    const session = await getSession(request);
    if (!session) return { status: 401, message: 'Unauthorized' };

    const { id } = await props.params;
    const pool = await connectToCentralDB();
    const result = await pool.request()
        .input('JobId', sql.Int, parseInt(id))
        .input('UserId', sql.Int, session.userId)
        .query('SELECT FilePath, FileName, Status FROM ReportJobs WHERE JobId = @JobId AND UserId = @UserId');
    if (result.recordset.length === 0) return { status: 404, message: 'Job not found' };

    const job = result.recordset[0];
    if (job.Status !== 'done' || !job.FilePath) return { status: 400, message: 'File not ready' };
    try {
        const stat = await fs.promises.stat(job.FilePath);
        return { status: 200, job, stat };
    } catch {
        return { status: 410, message: 'File expired or deleted' };
    }
}

function fileHeaders(job, stat) {
    const fileName = job.FileName || path.basename(job.FilePath);
    return {
        'Content-Type': contentTypeFor(fileName),
        'Content-Length': String(stat.size),
        'Content-Disposition': attachmentHeader(fileName),
    };
}

export async function GET(request, props) {
    try {
        const found = await findJobFile(request, props);
        if (found.status !== 200) {
            return NextResponse.json({ success: false, message: found.message }, { status: found.status });
        }
        // Stream from disk: a heavy report's file can be hundreds of MB
        return new Response(Readable.toWeb(fs.createReadStream(found.job.FilePath)), { headers: fileHeaders(found.job, found.stat) });
    } catch (error) {
        console.error('Job download error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
    }
}

/** Lets the page check a file before handing the URL to the browser's download manager. */
export async function HEAD(request, props) {
    try {
        const found = await findJobFile(request, props);
        if (found.status !== 200) return new Response(null, { status: found.status });
        return new Response(null, { headers: fileHeaders(found.job, found.stat) });
    } catch (error) {
        console.error('Job download check error:', error);
        return new Response(null, { status: 500 });
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/reports/jobs/[id]/download/__tests__/route.test.js"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/reports/jobs/[id]/download"
git commit -m "fix: stream heavy-job downloads and add a HEAD check

The route read the whole file into memory with readFileSync although the
Handoff says it streams, and percent-encoded Thai file names.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Client download helper and export outcome

**Files:**
- Create: `src/lib/file-download.ts`
- Test: `src/lib/__tests__/file-download.test.ts`
- Modify: `src/lib/standard-report.ts` (add `exportOutcome` after `exportProblem`; `exportProblem` is removed in Task 9 together with its last caller)
- Modify: `src/lib/__tests__/standard-report.test.ts` (add an `exportOutcome` block and import)

**Interfaces:**
- Produces: `jobDownloadUrl(jobId: number): string`, `jobDownloadErrorMessage(status: number): string`, `triggerBrowserDownload(url: string): void`, `downloadJobFile(jobId: number, fetchImpl?: typeof fetch, trigger?: (url: string) => void): Promise<{ ok: true } | { ok: false; message: string }>`
- Produces: `exportOutcome(data: ExportResponse): ExportOutcome` with `ExportOutcome = { kind: 'download'; url: string; rowCount: number } | { kind: 'empty' } | { kind: 'error'; message: string }`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/file-download.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { downloadJobFile, jobDownloadErrorMessage, jobDownloadUrl } from '../file-download';

describe('jobDownloadErrorMessage', () => {
    it.each([
        [401, 'กรุณาเข้าสู่ระบบใหม่'],
        [400, 'ไฟล์ยังไม่พร้อม'],
        [404, 'ไม่พบไฟล์'],
        [410, 'ไฟล์หมดอายุแล้ว (เก็บ 24 ชม.)'],
        [500, 'ดาวน์โหลดไม่สำเร็จ'],
        [0, 'ดาวน์โหลดไม่สำเร็จ'],
    ])('maps %i to %s', (status, message) => {
        expect(jobDownloadErrorMessage(status)).toBe(message);
    });
});

describe('downloadJobFile', () => {
    it('checks with HEAD, then hands the URL to the browser', async () => {
        const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
        const trigger = vi.fn();
        expect(await downloadJobFile(12, fetchImpl, trigger)).toEqual({ ok: true });
        expect(fetchImpl).toHaveBeenCalledWith(jobDownloadUrl(12), { method: 'HEAD' });
        expect(trigger).toHaveBeenCalledWith('/api/reports/jobs/12/download');
    });

    it('reports an expired file without starting a download', async () => {
        const fetchImpl = vi.fn(async () => new Response(null, { status: 410 })) as unknown as typeof fetch;
        const trigger = vi.fn();
        expect(await downloadJobFile(12, fetchImpl, trigger)).toEqual({ ok: false, message: 'ไฟล์หมดอายุแล้ว (เก็บ 24 ชม.)' });
        expect(trigger).not.toHaveBeenCalled();
    });

    it('reports a network failure', async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
        expect(await downloadJobFile(12, fetchImpl, vi.fn())).toEqual({ ok: false, message: 'ดาวน์โหลดไม่สำเร็จ' });
    });
});
```

In `src/lib/__tests__/standard-report.test.ts`, add `exportOutcome` to the import list and add this block after the existing `exportProblem` block:

```ts
describe('exportOutcome', () => {
    it('surfaces the server message for a refused export', () => {
        expect(exportOutcome({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' }))
            .toEqual({ kind: 'error', message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลบริษัทนี้' });
    });
    it('falls back to a generic error message', () => {
        expect(exportOutcome({ success: false })).toEqual({ kind: 'error', message: 'ไม่สามารถส่งออกข้อมูลได้' });
    });
    it('reports an empty result separately from an error', () => {
        expect(exportOutcome({ success: true, rowCount: 0 })).toEqual({ kind: 'empty' });
    });
    it('points at the one-time download for an export with rows', () => {
        expect(exportOutcome({ success: true, rowCount: 3, downloadId: 'abc' }))
            .toEqual({ kind: 'download', url: '/api/reports/export/abc', rowCount: 3 });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/file-download.test.ts src/lib/__tests__/standard-report.test.ts`
Expected: FAIL — `../file-download` missing and `exportOutcome` not exported.

- [ ] **Step 3: Write the implementations**

`src/lib/file-download.ts`:

```ts
/** Downloads that go straight to the browser's download manager, never through JavaScript memory. */

export function jobDownloadUrl(jobId: number) {
    return `/api/reports/jobs/${jobId}/download`;
}

export function jobDownloadErrorMessage(status: number) {
    switch (status) {
        case 401: return 'กรุณาเข้าสู่ระบบใหม่';
        case 400: return 'ไฟล์ยังไม่พร้อม';
        case 404: return 'ไม่พบไฟล์';
        case 410: return 'ไฟล์หมดอายุแล้ว (เก็บ 24 ชม.)';
        default: return 'ดาวน์โหลดไม่สำเร็จ';
    }
}

export function triggerBrowserDownload(url: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = ''; // keep the server's Content-Disposition name
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/** Check a background-job file with HEAD so problems become a toast, then let the browser download it. */
export async function downloadJobFile(
    jobId: number,
    fetchImpl: typeof fetch = fetch,
    trigger: (url: string) => void = triggerBrowserDownload,
): Promise<{ ok: true } | { ok: false; message: string }> {
    const url = jobDownloadUrl(jobId);
    try {
        const res = await fetchImpl(url, { method: 'HEAD' });
        if (!res.ok) return { ok: false, message: jobDownloadErrorMessage(res.status) };
    } catch {
        return { ok: false, message: jobDownloadErrorMessage(0) };
    }
    trigger(url);
    return { ok: true };
}
```

In `src/lib/standard-report.ts`, add after the `exportProblem` function:

```ts
export interface ExportResponse { success?: boolean; message?: string; rowCount?: number; downloadId?: string }
export type ExportOutcome =
    | { kind: 'download'; url: string; rowCount: number }
    | { kind: 'empty' }
    | { kind: 'error'; message: string };

/** What the page does with the answer of POST /api/reports/export. */
export function exportOutcome(data: ExportResponse): ExportOutcome {
    if (!data.success) return { kind: 'error', message: data.message || 'ไม่สามารถส่งออกข้อมูลได้' };
    if (!data.rowCount || !data.downloadId) return { kind: 'empty' };
    return { kind: 'download', url: `/api/reports/export/${data.downloadId}`, rowCount: data.rowCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/file-download.test.ts src/lib/__tests__/standard-report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

```bash
git add src/lib/file-download.ts src/lib/__tests__/file-download.test.ts src/lib/standard-report.ts src/lib/__tests__/standard-report.test.ts
git commit -m "feat: add browser download helper and export outcome mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Standard page uses the server export

**Files:**
- Modify: `src/app/(dashboard)/reports/standard/page.tsx` (imports lines 5 and 13-15; unmount effect lines 59-62; `handleExportExcel` and `handleJobDownload` lines 293-367; export overlay lines 576-585)
- Modify: `src/lib/standard-report.ts` and `src/lib/__tests__/standard-report.test.ts` (remove `exportProblem`, which loses its last caller here)

**Interfaces:**
- Consumes: `exportOutcome` (Task 8), `triggerBrowserDownload`, `downloadJobFile` (Task 8), `POST /api/reports/export` (Task 6)

- [ ] **Step 0: Remove `exportProblem`**

Delete the `exportProblem` function and its doc comment from `src/lib/standard-report.ts`, and in `src/lib/__tests__/standard-report.test.ts` delete the `describe` block that tests it (the one containing `'has no problem when rows came back'`) and remove `exportProblem` from the import list.

- [ ] **Step 1: Imports**

Delete `import * as xlsx from 'xlsx';` and `import { excelFileName, excelWriteOptions } from '@/lib/excel-export';`. Replace the `standard-report` import line with:

```tsx
import { exportOutcome, getRunBlocker, pickReportCompany, shouldConfirmEmptyConditions, startJobPolling } from '@/lib/standard-report';
import { downloadJobFile, triggerBrowserDownload } from '@/lib/file-download';
```

- [ ] **Step 2: Abort an export when the page unmounts**

Replace:

```tsx
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; stopPollRef.current?.(); };
    }, []);
```

with:

```tsx
    const mountedRef = useRef(true);
    const exportAbortRef = useRef<AbortController | null>(null);
    useEffect(() => {
        mountedRef.current = true;
        // Leaving the page cancels an ordinary export: nothing is kept for later download
        return () => { mountedRef.current = false; stopPollRef.current?.(); exportAbortRef.current?.abort(); };
    }, []);
```

- [ ] **Step 3: Replace `handleExportExcel` and `handleJobDownload`**

Replace both functions (from `const handleExportExcel = async () => {` to the end of `handleJobDownload`) with:

```tsx
    const handleExportExcel = async () => {
        if (!selectedReportId || isExporting) return;
        const report = reports.find(r => r.ReportId.toString() === selectedReportId);

        // IsHeavy → background job (same guarded path as the conditions-area button)
        if (report?.IsHeavy) {
            await startBackgroundJob();
            return;
        }

        // The server streams the rows into a temporary .xlsx; the browser only downloads the file
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setIsExporting(true);
        setExportElapsed(0);
        setExportStatus('กำลังสร้างไฟล์ Excel…');
        const startTime = Date.now();
        exportTimerRef.current = setInterval(() => {
            setExportElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        try {
            const res = await fetch('/api/reports/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: selectedReportId, companyId: selectedCompany, parameters: paramValues }),
                signal: controller.signal,
            });
            const outcome = exportOutcome(await res.json());
            if (outcome.kind === 'error') toast(outcome.message, 'error');
            else if (outcome.kind === 'empty') toast('ไม่มีข้อมูลให้ส่งออก', 'info');
            else {
                triggerBrowserDownload(outcome.url);
                toast(`ส่งออก ${outcome.rowCount.toLocaleString()} รายการเรียบร้อย`, 'success');
            }
        } catch {
            if (mountedRef.current) {
                if (controller.signal.aborted) toast('ยกเลิกการส่งออกแล้ว', 'info');
                else toast('ไม่สามารถส่งออกข้อมูลได้', 'error');
            }
        } finally {
            if (exportTimerRef.current) {
                clearInterval(exportTimerRef.current);
                exportTimerRef.current = null;
            }
            exportAbortRef.current = null;
            if (mountedRef.current) setIsExporting(false);
        }
    };

    const cancelExport = () => exportAbortRef.current?.abort();

    const handleJobDownload = async () => {
        if (!activeJob?.jobId) return;
        const result = await downloadJobFile(activeJob.jobId);
        if (!result.ok) toast(result.message, 'error');
    };
```

The banner button keeps `onClick={handleJobDownload}`; it now returns a promise, which React accepts.

- [ ] **Step 4: Overlay copy and cancel button**

In the `{isExporting && (` overlay, replace:

```tsx
                        <p className="text-xs text-slate-500 dark:text-slate-400">กรุณาอย่าปิดหน้านี้ระหว่างส่งออก</p>
```

with:

```tsx
                        <p className="text-xs text-slate-500 dark:text-slate-400">ถ้าปิดหน้านี้ การส่งออกจะถูกยกเลิก</p>
                        <button type="button" onClick={cancelExport} className={secondaryButton}>ยกเลิก</button>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint "src/app/(dashboard)/reports/standard/page.tsx"` here and the same command in `D:/Antigravity/reportcenter` (still on master).
Expected: the branch reports no more problems than master.

Run: `npx vitest run src/lib/__tests__/standard-report.test.ts`
Expected: PASS.

Run: `git grep -n "exportAll\|exportProblem" -- src`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/reports/standard/page.tsx" src/lib/standard-report.ts src/lib/__tests__/standard-report.test.ts
git commit -m "feat: export ordinary Standard reports through the streaming server export

The browser no longer receives the rows as JSON or builds the workbook; it
downloads the server-built .xlsx once, and leaving the page cancels it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Job history downloads without loading the file

**Files:**
- Modify: `src/app/(dashboard)/reports/job-history/page.tsx` (`handleDownload` lines 60-80 and its call site near line 225)

**Interfaces:**
- Consumes: `downloadJobFile` (Task 8)

- [ ] **Step 1: Replace `handleDownload`**

Add `import { downloadJobFile } from "@/lib/file-download";` next to the other `@/` imports, then replace the whole `handleDownload` function with:

```tsx
    const handleDownload = async (jobId: number) => {
        const result = await downloadJobFile(jobId);
        if (result.ok) toast('เริ่มดาวน์โหลดแล้ว', 'success');
        else toast(result.message, 'error');
    };
```

Change the call site `onClick={() => handleDownload(job.JobId, job.FileName!)}` to:

```tsx
onClick={() => handleDownload(job.JobId)}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint "src/app/(dashboard)/reports/job-history/page.tsx"`
Expected: the same problem count as `npx eslint` reports for this file on the main checkout (`D:/Antigravity/reportcenter`), which is still on master.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/reports/job-history/page.tsx"
git commit -m "fix: download job files without loading them into the browser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Sweep leftover export files from the cron cleanup

**Files:**
- Modify: `src/app/api/cron/execute-schedules/route.js` (imports; first lines of `cleanupOldJobs`)

**Interfaces:**
- Consumes: `sweepExportFiles` (Task 4)

- [ ] **Step 1: Edit**

Add to the imports:

```js
import { sweepExportFiles } from '@/lib/export-files';
```

At the start of the `try` block in `cleanupOldJobs`, before `const jobsDir = …`, add:

```js
        // Ordinary-report exports are deleted after download; remove any left behind (> 15 min)
        await sweepExportFiles();
```

- [ ] **Step 2: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: all tests pass, no type errors.

```bash
git add src/app/api/cron/execute-schedules/route.js
git commit -m "chore: sweep leftover export files in the cron cleanup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Verification, documentation and wiki

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`, `docs/12_DECISION_LOG.md`, `docs/99_CHANGELOG.md`
- Wiki (outside the repo): `D:\Obsidian\Eltross\ReportCenter\analyses\rc-export-format-xlsb-vs-xlsx-20261006.md`, `rc-standard-reports.md`, `rc-open-questions.md`, `rc-status.md`, `rc-log.md`
- Scratch only (not committed): `<session scratchpad>/verify/`

- [ ] **Step 1: Full checks**

Run each and keep the output for the changelog:

```bash
npx vitest run
npx tsc --noEmit -p .
npx eslint src/lib src/app/api/reports "src/app/(dashboard)/reports/standard/page.tsx" "src/app/(dashboard)/reports/job-history/page.tsx" src/app/api/cron/execute-schedules/route.js
npm run build
```

Expected: tests pass; no type errors; ESLint problem count for the touched pre-existing files equal to master (compare by running the same `npx eslint` command in `D:/Antigravity/reportcenter`, ignoring paths that do not exist there) and 0 for new files; build succeeds and lists `/api/reports/export` and `/api/reports/export/[id]`.

- [ ] **Step 2: Memory benchmark with the real writer**

The writer has no `@/` imports, so copy it next to the script: `mkdir -p <scratchpad>/verify && cp src/lib/xlsx-stream-writer.js <scratchpad>/verify/writer.mjs`. Then create `<scratchpad>/verify/bench.mjs` and run it from that folder:

```js
// bench.mjs — 1,000,000 synthetic rows through the real writer into a file
import fs from 'fs';
import { once } from 'events';
import { finished } from 'stream/promises';
import { createXlsxStreamWriter } from './writer.mjs';

const N = Number(process.argv[2] || 1000000);
const names = ['บริษัท โซนิค อินเตอร์เฟรท จำกัด', 'Autologis Co., Ltd.', 'ห้างหุ้นส่วนจำกัด สยามขนส่ง'];
const columns = ['DocNo', 'DocDate', 'CustName', 'Qty', 'Amount', 'Remark'];
let peak = 0;
const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 20);
const started = Date.now();
const file = fs.createWriteStream('bench.xlsx');
const writer = createXlsxStreamWriter(columns);
writer.pipe(file);
for (let i = 0; i < N; i++) {
    const row = { DocNo: `INV${2600000 + i}`, DocDate: new Date(Date.UTC(2026, 0, 1 + (i % 270))), CustName: names[i % 3], Qty: i % 400, Amount: (i * 7919 % 1e7) / 100, Remark: i % 6 ? '' : 'ส่งสินค้าล่าช้า' };
    if (!writer.write(row)) await once(writer, 'drain');
}
writer.end();
await finished(file);
clearInterval(timer);
console.log(`${N} rows: ${(fs.statSync('bench.xlsx').size / 1048576).toFixed(1)} MB, ${Date.now() - started} ms, peak RSS ${(peak / 1048576).toFixed(0)} MB`);
```

Run: `node --max-old-space-size=48 bench.mjs 1000000`
Expected: completes; record size, time and peak RSS. Then `node -e "const x=require('D:/Antigravity/reportcenter/node_modules/xlsx');const wb=x.readFile('bench.xlsx',{sheetRows:3});console.log(wb.SheetNames)"` prints `[ 'Report Data' ]`.

- [ ] **Step 3: Excel check**

Create `<scratchpad>/verify/sample.mjs` and run `node sample.mjs` in that folder:

```js
import fs from 'fs';
import { finished } from 'stream/promises';
import { createXlsxStreamWriter } from './writer.mjs';

const file = fs.createWriteStream('sample.xlsx');
const writer = createXlsxStreamWriter(['ลำดับ', 'วันที่', 'วันเวลา', 'ลูกค้า', 'ยอด'], { maxRowsPerSheet: 3 });
writer.pipe(file);
for (let i = 1; i <= 5; i++) {
    writer.write({
        'ลำดับ': i,
        'วันที่': new Date(Date.UTC(2026, 0, i)),
        'วันเวลา': new Date(Date.UTC(2026, 0, i, 8, 30, 15)),
        'ลูกค้า': i % 2 ? 'บริษัท โซนิค อินเตอร์เฟรท จำกัด' : 'Autologis & Co. <TH>',
        'ยอด': i * 1234.56,
    });
}
writer.end();
await finished(file);
console.log('sample.xlsx written');
```

Then, in PowerShell:

```powershell
$excel = New-Object -ComObject Excel.Application -ErrorAction Stop
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("<scratchpad>\verify\sample.xlsx", 0, $true)
"$($wb.Worksheets.Count) sheets; A1=$($wb.Worksheets.Item(1).Range('A1').Text); B2=$($wb.Worksheets.Item(1).Range('B2').Text); D2=$($wb.Worksheets.Item(1).Range('D2').Text)"
$wb.Close($false); $excel.Quit()
```

Expected: `2 sheets; A1=ลำดับ; B2=2026-01-01; D2=บริษัท โซนิค อินเตอร์เฟรท จำกัด` with no repair prompt (`Open` would throw if Excel needed to repair the file because `DisplayAlerts` is off and the workbook is opened read-only). If Excel is not installed (`New-Object` fails), send `sample.xlsx` to the user with SendUserFile and ask them to open it.

- [ ] **Step 4: Documentation**

`DEVELOPER_HANDOFF.md`:
- Route tree (around line 108): add under `reports/`
  `│   │           ├── export/route.js       # POST: ordinary-report .xlsx export — mssql streaming → tmp/exports (bounded memory), returns downloadId`
  `│   │           ├── export/[id]/route.js  # GET: send the export once, then delete it`
  and change the `jobs/[id]/download/route.js` comment to `# GET: stream job file | HEAD: check before download`.
- `src/lib` tree: add `report-run.js`, `report-columns.js`, `xlsx-stream-writer.js`, `report-export-stream.js`, `export-files.js`, `content-disposition.js`, `file-download.ts`, each with a one-line purpose.
- API table (around line 310): add `| POST | /api/reports/export | Ordinary-report .xlsx export streamed to a temporary file; answers downloadId |` and `| GET | /api/reports/export/[id] | Download the export once (then deleted) |`; change the `execute` row to drop any export wording.
- Background Job section (around line 607): replace `- Report ปกติ → export client-side เหมือนเดิม` with `- Report ปกติ → POST /api/reports/export สร้าง .xlsx แบบ stream ที่ server แล้วดาวน์โหลดครั้งเดียว ลบไฟล์ทันที (ไม่เก็บ 24 ชม., ไม่เข้าประวัติ/กระดิ่ง)`; replace the `GET /api/reports/jobs/{id}/download` line with `- GET /api/reports/jobs/{id}/download → stream ไฟล์จากดิสก์ (Content-Disposition แบบ filename*) · HEAD ใช้ตรวจก่อนดาวน์โหลด, กดซ้ำได้`.
- Activity log table (line ~904): `EXPORT_EXCEL` source becomes `/api/reports/export` ("logged when the export finishes, including 0 rows").
- Roadmap: add `- [x] Streaming .xlsx export for ordinary reports (server-side, bounded memory, single-use download)`.

`docs/12_DECISION_LOG.md`: add at the top

```markdown
## 2026-10-06 — ส่งออก Excel รายงานทั่วไปแบบ stream ที่ server และไม่เก็บไฟล์

**สถานะ:** ผู้ใช้อนุมัติ spec `docs/superpowers/specs/2026-10-06-streaming-xlsx-export-design.md` และแผน; แก้บน branch `claude/export-format-xlsb-xlsx-592f13`

- รายงานทั่วไป: `POST /api/reports/export` ดึงแบบ stream เขียน .xlsx ลง `tmp/exports` แล้วเบราว์เซอร์ดาวน์โหลดผ่าน `GET /api/reports/export/[id]` ครั้งเดียวและลบไฟล์ทันที ไฟล์ค้างถูกกวาดเมื่อเกิน 15 นาที
- รายงาน IsHeavy คงระบบ job/CSV/เก็บ 24 ชม./ประวัติ/กระดิ่ง แก้เฉพาะการดาวน์โหลดให้ stream และมี HEAD

**เหตุผลและหลักฐาน:** ผู้ใช้ยืนยันว่าการเก็บไฟล์ให้ดาวน์โหลดภายหลังมีไว้เฉพาะรายงานขนาดใหญ่ ผลวัด (ข้อมูลสมมติ) แบบเดิมใช้ RAM 1,533 MB ที่ 300,000 แถว ตัวเขียนใหม่ 1,000,000 แถวใช้ peak RSS X MB ภายใต้ heap 48 MB (แทน X ด้วยตัวเลขจาก Step 2); ExcelJS ใช้ RAM โตตามแถวและเพิ่ม 97 package จึงไม่เลือก

**ขอบเขต:** ไม่แตะ `execute-async`, Template, Audit log, อีเมลตั้งเวลา; request ยังเปิดค้างระหว่างรัน query เหมือนเดิม (timeout 120 วิ / nginx 180 วิ)
```

`docs/99_CHANGELOG.md`: add a 2026-10-06 bullet listing the new routes and helpers, the Step 1 results (test files/tests, tsc, ESLint, build), the Step 2 benchmark and Step 3 Excel result, and "ยังไม่ได้ทดสอบในแอปจริง" until Task 13 is done.

- [ ] **Step 5: Wiki**

Update the analysis page (status, what was implemented, results), `rc-standard-reports.md` (export now server-side; ordinary files not kept), `rc-open-questions.md` 6a (download mismatch fixed on branch; what remains: live test, merge, deploy), `rc-status.md` row "Standard reports / Excel", and add a `rc-log.md` line. Run `node tools/wiki-lint.mjs ReportCenter --repo D:/Antigravity/reportcenter --prefix rc-` in `D:\Obsidian\Eltross`; expected "ไม่พบปัญหาเชิงโครงสร้าง". Do not list files that exist only on the branch as wiki `sources:` (the lint checks the main checkout).

- [ ] **Step 6: Commit**

```bash
git add DEVELOPER_HANDOFF.md docs/12_DECISION_LOG.md docs/99_CHANGELOG.md
git commit -m "docs: record streaming xlsx export design, results and decisions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Bring the branch to master and test in the live app

Requires the user's go-ahead in chat for the merge, and again before any file download in the browser.

- [ ] **Step 1: Ask the user** whether to fast-forward `master` in `D:/Antigravity/reportcenter` to this branch (the dev server at localhost:4000 serves that checkout and hot-reloads). On yes:

```bash
git -C D:/Antigravity/reportcenter status --short
git -C D:/Antigravity/reportcenter merge --ff-only claude/export-format-xlsb-xlsx-592f13
```

Expected: the status is empty before merging; the merge fast-forwards.

- [ ] **Step 2: Live export (approved for this feature only)** — in the in-app browser at `http://localhost:4000/reports/standard`: pick one ordinary report (no "ข้อมูลขนาดใหญ่" badge), choose the company and conditions, press "ดึงข้อมูล", then "ส่งออก Excel (.xlsx)". Before the download completes in the browser, tell the user the file name and ask for permission to download it. Confirm with `read_network_requests` that `POST /api/reports/export` returned `success: true` and `GET /api/reports/export/<id>` returned 200 with `content-type` Excel and `filename*`; confirm `D:/Antigravity/reportcenter/tmp/exports` is empty afterwards; ask the user to open the file in Excel.

- [ ] **Step 3: Cancel once** — start another export of the same report and press "ยกเลิก" in the overlay. Expected toast "ยกเลิกการส่งออกแล้ว"; check the dev-server output (ask the user, or `read_terminal` if it runs in the Terminal panel) for `[Export] Cancelled by the client; SQL request cancelled` and that `tmp/exports` holds no file older than the attempt. Record whether Next.js 16 signalled the abort.

- [ ] **Step 4: Record results** in `docs/99_CHANGELOG.md`, the wiki analysis page and `rc-log.md`; commit on master only if the user asks.

No other live action: no save, delete, toggle, rename or submit.
