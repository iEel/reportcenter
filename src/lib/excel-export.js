/**
 * Shared settings for every Excel file the app writes with SheetJS.
 *
 * xlsx with ZIP compression and a shared string table is about half the size of the old
 * uncompressed .xlsb and over 10x faster to write in SheetJS 0.18.5 (see docs/12_DECISION_LOG.md).
 */

export const EXCEL_EXTENSION = 'xlsx';

export const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** @param {string} baseName file name without extension */
export function excelFileName(baseName) {
    return `${baseName}.${EXCEL_EXTENSION}`;
}

/**
 * A new object per call: SheetJS writeFile adds `type`/`file` to the options it is given.
 * @returns {import('xlsx').WritingOptions}
 */
export function excelWriteOptions() {
    return { bookType: EXCEL_EXTENSION, compression: true, bookSST: true };
}
