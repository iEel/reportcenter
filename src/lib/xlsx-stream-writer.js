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
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

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

const MIN_COL_WIDTH = 10;
const MAX_COL_WIDTH = 60;

/** Characters a value needs on screen; Excel shows #### when a date does not fit its column. */
function displayLength(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value).length : 0;
    if (typeof value === 'boolean') return 5;
    if (value instanceof Date) return value.getTime() % DAY_MS === 0 ? 10 : 19;
    return Math.min(String(value).length, MAX_COL_WIDTH);
}

function colsXml(widths) {
    if (widths.length === 0) return '';
    const cols = widths.map((length, i) => {
        const width = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, length + 2));
        return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    }).join('');
    return `<cols>${cols}</cols>`;
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
        const values = this.columns.map(name => row?.[name]);
        if (!this.colsWritten) {
            values.forEach((value, i) => { this.widths[i] = Math.max(this.widths[i], displayLength(value)); });
        }
        this.xml += rowXml(this.sheetRows + 1, this.refs, values);
        return this.xml.length >= CHUNK_CHARS ? this.flushXml() : null;
    }

    /** Column widths come from the header and the rows buffered before the sheet's first chunk is written. */
    beginSheet() {
        this.sheetCount++;
        this.sheetRows = 0;
        this.sheetOpen = true;
        this.colsWritten = false;
        this.widths = this.columns.map(displayLength);
        this.beginEntry(`xl/worksheets/sheet${this.sheetCount}.xml`);
        this.xml = rowXml(1, this.refs, this.columns);
    }

    async endSheet() {
        this.xml += '</sheetData></worksheet>';
        await this.flushXml();
        this.sheetOpen = false;
        await this.endEntry();
    }

    flushXml() {
        let text = this.xml;
        this.xml = '';
        if (!this.colsWritten) {
            text = `${XML_HEADER}<worksheet xmlns="${MAIN_NS}">${colsXml(this.widths)}<sheetData>${text}`;
            this.colsWritten = true;
        }
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
