import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * Auto-create ReportCategories table + add CategoryId to Reports if missing
 */
async function ensureCategorySchema(pool) {
    await pool.request().query(`
        IF OBJECT_ID('ReportCategories') IS NULL
        BEGIN
            CREATE TABLE ReportCategories (
                CategoryId INT IDENTITY(1,1) PRIMARY KEY,
                CategoryName NVARCHAR(100) NOT NULL,
                ColorTag NVARCHAR(20) DEFAULT 'slate',
                SortOrder INT DEFAULT 0,
                CreatedAt DATETIME DEFAULT GETDATE()
            );
            INSERT INTO ReportCategories (CategoryName, ColorTag, SortOrder) VALUES
            (N'ทั่วไป', 'slate', 0);
        END
    `);
    await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'CategoryId')
        ALTER TABLE Reports ADD CategoryId INT NULL;
    `);
}

// GET — list all categories
export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

        const pool = await connectToCentralDB();
        await ensureCategorySchema(pool);

        const result = await pool.request().query(`
            SELECT c.CategoryId, c.CategoryName, c.ColorTag, c.SortOrder,
                   (SELECT COUNT(*) FROM Reports r WHERE r.CategoryId = c.CategoryId AND r.IsActive = 1) AS ReportCount
            FROM ReportCategories c
            ORDER BY c.SortOrder, c.CategoryName
        `);

        // Fetch report names per category
        const reportsResult = await pool.request().query(`
            SELECT r.ReportId, r.ReportName, r.CategoryId
            FROM Reports r
            WHERE r.IsActive = 1 AND r.CategoryId IS NOT NULL
            ORDER BY r.ReportName
        `);

        // Group reports by CategoryId
        const reportsByCategory = {};
        for (const r of reportsResult.recordset) {
            if (!reportsByCategory[r.CategoryId]) reportsByCategory[r.CategoryId] = [];
            reportsByCategory[r.CategoryId].push({ ReportId: r.ReportId, ReportName: r.ReportName });
        }

        return NextResponse.json({ success: true, categories: result.recordset, reportsByCategory });
    } catch (error) {
        console.error('Categories GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// POST — create category
export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { name, colorTag } = await request.json();
        if (!name?.trim()) return NextResponse.json({ success: false, message: 'ชื่อหมวดหมู่ห้ามว่าง' }, { status: 400 });

        const pool = await connectToCentralDB();
        await ensureCategorySchema(pool);

        const result = await pool.request()
            .input('Name', sql.NVarChar(100), name.trim())
            .input('Color', sql.NVarChar(20), colorTag || 'slate')
            .query(`
                INSERT INTO ReportCategories (CategoryName, ColorTag)
                OUTPUT INSERTED.CategoryId
                VALUES (@Name, @Color)
            `);

        return NextResponse.json({ success: true, categoryId: result.recordset[0].CategoryId });
    } catch (error) {
        console.error('Categories POST error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT — update category
export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { categoryId, name, colorTag } = await request.json();
        if (!categoryId || !name?.trim()) return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบ' }, { status: 400 });

        const pool = await connectToCentralDB();
        await pool.request()
            .input('Id', sql.Int, categoryId)
            .input('Name', sql.NVarChar(100), name.trim())
            .input('Color', sql.NVarChar(20), colorTag || 'slate')
            .query('UPDATE ReportCategories SET CategoryName = @Name, ColorTag = @Color WHERE CategoryId = @Id');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Categories PUT error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE — delete category (set reports to NULL)
export async function DELETE(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('categoryId');
        if (!categoryId) return NextResponse.json({ success: false, message: 'Missing categoryId' }, { status: 400 });

        const pool = await connectToCentralDB();

        // Un-assign reports from this category
        await pool.request()
            .input('Id', sql.Int, parseInt(categoryId))
            .query('UPDATE Reports SET CategoryId = NULL WHERE CategoryId = @Id');

        await pool.request()
            .input('Id', sql.Int, parseInt(categoryId))
            .query('DELETE FROM ReportCategories WHERE CategoryId = @Id');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Categories DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
