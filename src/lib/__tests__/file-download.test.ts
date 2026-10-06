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
