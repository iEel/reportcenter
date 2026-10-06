# Streaming XLSX Export

Date: 2026-10-06

## Goal

Pressing "ส่งออก Excel (.xlsx)" on `/reports/standard` must not load the report into the user's browser memory, and must not hold the whole result in server memory either, regardless of row count. Files for ordinary reports are not kept after the download; only `IsHeavy` reports keep files for later download.

## Current Problem

For a report without `IsHeavy`, the export button calls `POST /api/reports/execute` with `exportAll: true`. The server buffers the full recordset, serializes it to one JSON response, and the browser parses it and builds the workbook with SheetJS in memory. In a Node simulation of that client work, 300,000 rows × 10 columns peaked at 1,533 MB RSS. Dates also reach Excel as ISO text (`2026-01-06T00:00:00.000Z`) because they pass through JSON.

`IsHeavy` reports use the Background Job system (`execute-async`: mssql streaming → CSV in `tmp/jobs`, kept 24 hours, listed in job history, bell notification) so users need not wait and can download later. Two of its download paths still load whole files:

- `GET /api/reports/jobs/[id]/download` reads the file with `fs.readFileSync` (the Handoff says it streams).
- The job history page downloads with `fetch` → `blob`, which holds the file in browser memory.

## Approved Direction

- Ordinary reports: a synchronous server-side export. The server streams the query into a temporary `.xlsx` with a small in-house streaming writer, the browser downloads it through its own download manager, and the server deletes the file once it has been sent. No job record, no job history entry, no bell notification, no 24-hour retention.
- `IsHeavy` reports: the Background Job flow stays as it is (CSV, 24 hours, history, notifications). Only its two download paths change so they stream.

Probe results (Node 24, synthetic 10-column data, throwaway code in the session scratchpad): the in-house writer finished 1,000,000 rows in 8.4 s with peak RSS 197 MB and completed under a 48 MB heap cap. ExcelJS 4.4.0's stream writer reached 778 MB RSS at 1,000,000 rows and ran out of memory at 300,000 rows under the same cap, and adds 97 packages.

## User Flow (Standard, ordinary report)

1. The user presses "ส่งออก Excel (.xlsx)" (still enabled only after the report has been run, as today).
2. The page sends `POST /api/reports/export` with the report, company and parameters, holding an `AbortController`.
3. The existing export overlay shows "กำลังสร้างไฟล์ Excel…", the elapsed timer, a "ยกเลิก" button, and the note "ถ้าปิดหน้านี้ การส่งออกจะถูกยกเลิก".
4. Outcome:

| Outcome | Result |
|---|---|
| `success`, `rowCount` 0 | toast "ไม่มีข้อมูลให้ส่งออก", no download |
| `success`, `rowCount` > 0 | browser download of `/api/reports/export/{downloadId}` + toast "ส่งออก N รายการเรียบร้อย" |
| error response | toast with the server message |
| user pressed ยกเลิก | toast "ยกเลิกการส่งออกแล้ว" |
| network failure | toast "ไม่สามารถส่งออกข้อมูลได้" |

5. Leaving the page aborts the request; nothing is kept.

`IsHeavy` reports keep the current flow; only the banner's download button changes (see Client).

## Server

### `src/lib/xlsx-stream-writer.js` (new, server only)

`createXlsxStreamWriter(columns, options)` returns a `Transform` whose writable side takes row objects (object mode) and whose readable side emits `.xlsx` bytes. Callers pipe it to `fs.createWriteStream` and apply back-pressure: when `write(row)` returns `false`, pause the SQL request and resume on `'drain'`.

- ZIP written strictly forward: each entry uses a local header with the data-descriptor flag, raw deflate (`zlib.createDeflateRaw`, level 6), then a data descriptor; the central directory is written last. CRC-32 is computed by a small table-based function, not `zlib.crc32`, because the deployment guide installs Node 20.
- Rows are serialized to sheet XML and deflated in chunks of about 64 KB; the transform calls back only after the deflate stream has accepted the chunk, so memory stays bounded.
- Sheet entries come first. `xl/styles.xml`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `_rels/.rels` and `[Content_Types].xml` are written after the last sheet, when the sheet count is known (ExcelJS's stream writer also writes `[Content_Types].xml` after the sheets).
- Each sheet holds a header row plus at most `options.maxRowsPerSheet` data rows (default 1,048,575). Overflow continues on "Report Data (2)", "Report Data (3)", … Every sheet repeats the header row. `options.sheetName` defaults to "Report Data".
- No ZIP64: if any offset or size would exceed 0xFFFFFFFF the writer errors.

Cell rules:

| Value | Cell |
|---|---|
| `null`, `undefined`, `''` | omitted (empty) |
| finite number | number |
| `NaN`, `±Infinity` | omitted |
| boolean | boolean |
| `Date` | Excel serial from UTC (`ms / 86400000 + 25569`, matching mssql's default `useUTC`), minus 1 below serial 61 because Excel counts a phantom 1900-02-29; style `yyyy-mm-dd` when the UTC time is 00:00:00.000, otherwise `yyyy-mm-dd hh:mm:ss`. Dates before 1900-01-01, which Excel shows as `####`, are written as text in the same format |
| string | inline string, XML-escaped, characters invalid in XML 1.0 removed, cut to 32,767 characters |
| `Buffer` | string `0x` + hex, then the string rule |
| anything else (including `bigint`) | `String(value)`, then the string rule |

Header cells are plain strings.

### `src/lib/report-columns.js` (new)

`orderedColumns(columnsMetadata)` returns column names sorted by mssql's `index` (SELECT order) without `_rowNum`. Used by `execute` (replacing its inline sort) and by the export route.

### `src/lib/report-run.js` (new)

Shared authorization and query preparation, so the export route does not become a third copy of the checks in `execute`:

- `prepareReportRun({ session, reportId, companyId, centralPool })` returns `{ ok: true, tSqlQuery, reportName, expectedParams }` or `{ ok: false, status, message }`. It runs the checks in `execute`'s current order with the same messages and the same central-DB query order: report lookup (404), SQL validation (403, logs `BLOCKED_QUERY`), company access for every role (403), role mapping for non-admins (403), then the parameter definitions.
- `bindReportParameters(request, expectedParams, parameters)` binds `date` / `number` / text parameters exactly as `execute` does today.
- Routes read the session first and return 401 before calling the helper.

`execute` switches to these helpers and drops `exportAll` (no caller remains). `execute-async` is not changed.

### `src/lib/export-files.js` (new)

Temporary export files live in `tmp/exports` as `<uuid>.xlsx` plus `<uuid>.json` (`{ userId, fileName, createdAt }`).

- `createExportFile()`, `readExportMeta(id)`, `deleteExportFile(id)`.
- `sweepExportFiles(maxAgeMs = 15 min)` deletes pairs older than the limit. It runs at the start of every export request and in the cron cleanup (`execute-schedules`, next to `cleanupOldJobs`).

### `POST /api/reports/export` (new)

1. Session (401), body validation (400), `prepareReportRun`.
2. `sweepExportFiles()`.
3. Company DB request with `stream = true` and the same timeout as `execute` (`REPORT_REQUEST_TIMEOUT`, default 120 s); writer created on the first `recordset` event with `orderedColumns`; rows piped with back-pressure into `tmp/exports/<uuid>.xlsx`. Only the first recordset is written (same as `execute`); a query with no recordset counts as 0 rows.
4. File name `<report name with \ / : * ? " < > | and control characters replaced by _>_<YYYY-MM-DD>.xlsx` (UTC date, as the client uses today).
5. On completion, log `EXPORT_EXCEL` with the details and `ChangeData` that `execute` wrote for `exportAll` (`Export Excel "<name>" (<company>) ได้ N แถว | params`), including 0-row exports as `execute` did. Then: 0 rows → delete the files and answer `{ success: true, rowCount: 0 }`; otherwise write the metadata and answer `{ success: true, downloadId, fileName, rowCount }`.
6. On SQL or write error: delete partial files, log the error server-side, answer 500 "ไม่สามารถส่งออกข้อมูลได้".
7. When `request.signal` aborts: cancel the SQL request, destroy the writer and delete the files. If the runtime does not signal client disconnects, the query runs to completion and the 15-minute sweep removes the file.

### `GET /api/reports/export/[id]` (new)

- 401 without a session; 404 when `id` is not a UUID, the metadata is missing, or it belongs to another user.
- Streams the file through `Readable.toWeb(fs.createReadStream(...))` with `Content-Type: EXCEL_MIME`, `Content-Length`, and the `Content-Disposition` helper below.
- Deletes the `.xlsx` and `.json` when the read stream closes, whether the download finished or was interrupted (single use; the user can export again).

### `/api/reports/jobs/[id]/download` (heavy reports)

- Shared checks for `GET` and the new `HEAD`: 401 no session, 404 job not found for this user, 400 not `done` or no file path, 410 file missing on disk.
- `GET` streams the file with `Content-Length` from `stat` instead of `readFileSync`.
- `Content-Type` by extension: `.csv` → `text/csv; charset=utf-8`, `.xlsx` → `EXCEL_MIME`, otherwise `application/octet-stream`.
- `HEAD` returns the same status and headers without a body.

### `src/lib/content-disposition.js` (new)

`attachmentHeader(fileName)` → `attachment; filename="<ASCII fallback>"; filename*=UTF-8''<RFC 5987 encoded>`, so Thai report names are not shown percent-encoded. Used by both download routes.

## Client

### `src/lib/file-download.ts` (new)

- `triggerBrowserDownload(url)`: create `<a href=url download>`, click it, remove it. The file never passes through JavaScript.
- `jobDownloadErrorMessage(status)`: 401 → "กรุณาเข้าสู่ระบบใหม่", 400 → "ไฟล์ยังไม่พร้อม", 404 → "ไม่พบไฟล์", 410 → "ไฟล์หมดอายุแล้ว (เก็บ 24 ชม.)", otherwise "ดาวน์โหลดไม่สำเร็จ".
- `downloadJobFile(jobId)`: `HEAD` the job download URL; on failure return `{ ok: false, message }`; on success `triggerBrowserDownload` and return `{ ok: true }`.

### Standard page

- Ordinary-report export uses the flow above instead of `execute` + SheetJS; the page no longer imports `xlsx` or `excel-export`.
- `exportProblem` in `src/lib/standard-report.ts` is replaced by a pure helper that maps the export response (or abort / network failure) to the outcome table.
- The overlay's "ยกเลิก" aborts the request; unmounting the page aborts it too.
- The heavy-job banner's "ดาวน์โหลด" uses `downloadJobFile` instead of `window.open`.

### Job history page

"ดาวน์โหลด" uses `downloadJobFile`; failures show the returned message as a toast.

## Out of Scope

- `execute-async` and the `IsHeavy` CSV output, retention, history and notifications.
- The Template page (the user says Template reports have no export; its leftover "Export Excel" button is a separate question), audit log export (current page only) and schedule emails.
- SheetJS upgrade and removing the `xlsx` package (Template, audit log and schedules still use it).

## Testing

Tests are written first and must fail before implementation.

- `xlsx-stream-writer`: read files back with SheetJS and compare every cell rule above, Thai text, escaping, control characters, the 32,767 cut, `Buffer`, date and date-time styles; sheet split with `maxRowsPerSheet: 3`; CRC-32 of every ZIP entry checked against an independent inflate; back-pressure (`write` returns `false`, then `'drain'`).
- `report-columns`: SELECT order including numeric-like names; `_rowNum` removed.
- `report-run`: each failure branch with status and message, `BLOCKED_QUERY` log, parameter binding by type. The existing `execute` route tests pass unchanged.
- `export-files`: metadata round trip, delete, sweep keeps recent pairs and deletes old ones.
- `POST /api/reports/export` (mocked mssql stream): file and metadata written, `EXPORT_EXCEL` logged, response shape; 0 rows leaves no file; SQL error removes partial files and answers 500; abort cancels the SQL request and removes files; first recordset only; 401/400/403/404 through the helper.
- `GET /api/reports/export/[id]`: 404 for a bad id, another user's file, or a missing file; streams with correct headers; files deleted after the stream closes.
- jobs download route: `GET` streams with correct headers, `HEAD` has no body, 401/404/400/410.
- `content-disposition`, `jobDownloadErrorMessage`, and the Standard outcome helper as pure functions.

## Verification

- `npm test`, `tsc --noEmit`, ESLint on changed files with no new problems, `npm run build` (in the worktree).
- Memory: the real writer, 1,000,000 synthetic rows, under a 48 MB heap cap.
- A sample file (Thai text, dates, two sheets via a small limit) opened in Excel, through automation if Excel is installed, otherwise sent to the user.
- Live app (approved by the user on 2026-10-06 for this feature only): after the code reaches the checkout served at localhost:4000, export one ordinary report from Standard, confirm the browser download, open it in Excel, check that `tmp/exports` is empty afterwards, and try "ยกเลิก" once to see whether the server cancels the query. No other live action.

## Risks

- The export request stays open while the query runs, as today's `execute` export does; it is bounded by `REPORT_REQUEST_TIMEOUT` (120 s default) and the nginx `proxy_read_timeout 180s` in the deployment guide. Reports that need longer should be marked `IsHeavy`.
- `POST` and `GET` must reach the same server process because the file is on local disk; the deployment guide runs a single pm2 process.
- Excel must accept `[Content_Types].xml` placed after the sheets; the Excel check above confirms it.
- Excel may open very large `.xlsx` files more slowly than `.xlsb`; not measured.
- Cancel may only stop the download, not the query, if Next.js 16 does not abort `request.signal` on client disconnect; verified in the live check.
