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
