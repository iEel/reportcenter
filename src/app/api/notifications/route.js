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
            IF OBJECT_ID('Notifications') IS NULL
            CREATE TABLE Notifications (
                NotificationId INT IDENTITY(1,1) PRIMARY KEY,
                UserId INT NULL,
                Title NVARCHAR(200) NOT NULL,
                Message NVARCHAR(500) NOT NULL,
                Type NVARCHAR(20) DEFAULT 'info',
                IsRead BIT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);

        const result = await pool.request()
            .input('UserId', sql.Int, session.userId)
            .query(`
                SELECT TOP 20 NotificationId, Title, Message, Type, IsRead, CreatedAt
                FROM Notifications
                WHERE UserId = @UserId OR UserId IS NULL
                ORDER BY CreatedAt DESC
            `);

        const unreadCount = result.recordset.filter(n => !n.IsRead).length;

        return NextResponse.json({
            success: true,
            notifications: result.recordset,
            unreadCount,
        });
    } catch (error) {
        console.error('Notifications GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { notificationId } = await request.json();
        const pool = await connectToCentralDB();

        if (notificationId === 'all') {
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .query('UPDATE Notifications SET IsRead = 1 WHERE (UserId = @UserId OR UserId IS NULL) AND IsRead = 0');
        } else {
            await pool.request()
                .input('Id', sql.Int, parseInt(notificationId))
                .query('UPDATE Notifications SET IsRead = 1 WHERE NotificationId = @Id');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notifications PUT error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
