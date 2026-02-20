import { NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToCentralDB } from '@/lib/db';

export async function GET(request) {
    try {
        const pool = await connectToCentralDB();

        // Fetch Users
        const usersQuery = `
            SELECT u.UserId, u.Username, u.FullName, u.CompanyId, u.RoleId, r.RoleName, u.IsActive
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            ORDER BY u.UserId DESC
        `;
        const usersResult = await pool.request().query(usersQuery);

        // Fetch Roles
        const rolesQuery = `SELECT RoleId, RoleName FROM Roles ORDER BY RoleId`;
        const rolesResult = await pool.request().query(rolesQuery);

        return NextResponse.json({
            success: true,
            users: usersResult.recordset,
            roles: rolesResult.recordset
        });

    } catch (error) {
        console.error("Error fetching users and roles:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { Username, PasswordHash, FullName, CompanyId, RoleId, IsActive } = body;

        if (!Username || !FullName) {
            return NextResponse.json({ success: false, message: "Username and FullName are required" }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Basic check if user exists
        const checkResult = await pool.request()
            .input('Username', sql.NVarChar(50), Username)
            .query('SELECT UserId FROM Users WHERE Username = @Username');

        if (checkResult.recordset.length > 0) {
            return NextResponse.json({ success: false, message: "Username already exists" }, { status: 400 });
        }

        const insertQuery = `
            INSERT INTO Users (Username, PasswordHash, FullName, CompanyId, RoleId, IsActive)
            VALUES (@Username, @PasswordHash, @FullName, @CompanyId, @RoleId, @IsActive)
        `;

        await pool.request()
            .input('Username', sql.NVarChar(50), Username)
            .input('PasswordHash', sql.NVarChar(255), PasswordHash || 'default_password')
            .input('FullName', sql.NVarChar(150), FullName)
            .input('CompanyId', sql.Int, CompanyId ? parseInt(CompanyId) : null)
            .input('RoleId', sql.Int, RoleId ? parseInt(RoleId) : null)
            .input('IsActive', sql.Bit, IsActive ? 1 : 0)
            .query(insertQuery);

        return NextResponse.json({ success: true, message: "User created successfully" });

    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const body = await request.json();
        const { UserId, FullName, CompanyId, RoleId, IsActive } = body;

        if (!UserId || !FullName) {
            return NextResponse.json({ success: false, message: "UserId and FullName are required" }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        const updateQuery = `
            UPDATE Users
            SET FullName = @FullName,
                CompanyId = @CompanyId,
                RoleId = @RoleId,
                IsActive = @IsActive
            WHERE UserId = @UserId
        `;

        await pool.request()
            .input('UserId', sql.Int, parseInt(UserId))
            .input('FullName', sql.NVarChar(150), FullName)
            .input('CompanyId', sql.Int, CompanyId ? parseInt(CompanyId) : null)
            .input('RoleId', sql.Int, RoleId ? parseInt(RoleId) : null)
            .input('IsActive', sql.Bit, IsActive ? 1 : 0)
            .query(updateQuery);

        return NextResponse.json({ success: true, message: "User updated successfully" });

    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
