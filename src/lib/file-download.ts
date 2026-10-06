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
