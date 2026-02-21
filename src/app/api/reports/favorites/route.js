import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const pool = await connectToCentralDB();

        // Auto-create table if not exists
        await pool.request().query(`
            IF OBJECT_ID('UserFavorites') IS NULL
            CREATE TABLE UserFavorites (
                UserId INT NOT NULL,
                ReportId INT NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                PRIMARY KEY (UserId, ReportId)
            )
        `);

        const result = await pool.request()
            .input('UserId', sql.Int, session.userId)
            .query(`
                SELECT uf.ReportId, r.ReportName, r.Description, r.ReportType
                FROM UserFavorites uf
                JOIN Reports r ON uf.ReportId = r.ReportId
                WHERE uf.UserId = @UserId AND r.IsActive = 1
                ORDER BY uf.CreatedAt DESC
            `);

        return NextResponse.json({ success: true, favorites: result.recordset });
    } catch (error) {
        console.error('Favorites GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { reportId } = await request.json();
        const pool = await connectToCentralDB();

        // Auto-create table if not exists
        await pool.request().query(`
            IF OBJECT_ID('UserFavorites') IS NULL
            CREATE TABLE UserFavorites (
                UserId INT NOT NULL,
                ReportId INT NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                PRIMARY KEY (UserId, ReportId)
            )
        `);

        // Toggle: if exists, delete. If not, insert.
        const check = await pool.request()
            .input('UserId', sql.Int, session.userId)
            .input('ReportId', sql.Int, parseInt(reportId))
            .query('SELECT 1 FROM UserFavorites WHERE UserId = @UserId AND ReportId = @ReportId');

        if (check.recordset.length > 0) {
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .query('DELETE FROM UserFavorites WHERE UserId = @UserId AND ReportId = @ReportId');
            return NextResponse.json({ success: true, action: 'removed' });
        } else {
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ReportId', sql.Int, parseInt(reportId))
                .query('INSERT INTO UserFavorites (UserId, ReportId) VALUES (@UserId, @ReportId)');
            return NextResponse.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error('Favorites POST error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
