/**
 * `Content-Disposition` for a download: an ASCII fallback for old clients plus the real
 * (often Thai) name as RFC 5987 `filename*`, so browsers do not show it percent-encoded.
 */
export function attachmentHeader(fileName) {
    const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(fileName).replace(/['()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
