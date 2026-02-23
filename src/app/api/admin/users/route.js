import { NextResponse } from 'next/server';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { connectToCentralDB } from '@/lib/db';
import { validatePassword } from '@/lib/password-rules';
import { getSession, invalidateSessionCache } from '@/lib/auth';

export async function GET(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const pool = await connectToCentralDB();

        // Fetch Users
        const usersResult = await pool.request().query(`
            SELECT u.UserId, u.Username, u.FullName, u.CompanyId, u.RoleId, r.RoleName, u.IsActive
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            ORDER BY u.UserId DESC
        `);

        // Fetch Roles
        const rolesResult = await pool.request().query(`SELECT RoleId, RoleName FROM Roles ORDER BY RoleId`);

        // Fetch Company Mappings for all users
        let companyMappings = [];
        try {
            const mappingResult = await pool.request().query(`SELECT UserId, CompanyId FROM UserCompanyMapping`);
            companyMappings = mappingResult.recordset;
        } catch (e) {
            // Table may not exist yet
        }

        // Attach allowedCompanies array to each user
        const users = usersResult.recordset.map(user => ({
            ...user,
            allowedCompanies: companyMappings
                .filter(m => m.UserId === user.UserId)
                .map(m => m.CompanyId)
                .sort((a, b) => a - b),
        }));

        return NextResponse.json({
            success: true,
            users,
            roles: rolesResult.recordset
        });

    } catch (error) {
        console.error("Error fetching users and roles:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { Username, PasswordHash, FullName, CompanyId, RoleId, IsActive, allowedCompanies } = body;

        if (!Username || !FullName) {
            return NextResponse.json({ success: false, message: "Username and FullName are required" }, { status: 400 });
        }

        // Input length validation
        if (Username.length > 50) {
            return NextResponse.json({ success: false, message: 'Username ต้องไม่เกิน 50 ตัวอักษร' }, { status: 400 });
        }
        if (FullName.length > 150) {
            return NextResponse.json({ success: false, message: 'ชื่อต้องไม่เกิน 150 ตัวอักษร' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Check if user exists
        const checkResult = await pool.request()
            .input('Username', sql.NVarChar(50), Username)
            .query('SELECT UserId FROM Users WHERE Username = @Username');

        if (checkResult.recordset.length > 0) {
            return NextResponse.json({ success: false, message: "Username already exists" }, { status: 400 });
        }

        // Hash the password with bcrypt before storing
        const rawPassword = PasswordHash || 'P@ssw0rd123';

        // Validate password complexity
        const { valid, errors } = validatePassword(rawPassword);
        if (!valid) {
            return NextResponse.json(
                { success: false, message: 'รหัสผ่านไม่ผ่านเกณฑ์: ' + errors.join(', ') },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Insert user
        const insertResult = await pool.request()
            .input('Username', sql.NVarChar(50), Username)
            .input('PasswordHash', sql.NVarChar(255), hashedPassword)
            .input('FullName', sql.NVarChar(150), FullName)
            .input('CompanyId', sql.Int, CompanyId ? parseInt(CompanyId) : null)
            .input('RoleId', sql.Int, RoleId ? parseInt(RoleId) : null)
            .input('IsActive', sql.Bit, IsActive ? 1 : 0)
            .query(`
                INSERT INTO Users (Username, PasswordHash, FullName, CompanyId, RoleId, IsActive)
                OUTPUT INSERTED.UserId
                VALUES (@Username, @PasswordHash, @FullName, @CompanyId, @RoleId, @IsActive)
            `);

        const newUserId = insertResult.recordset[0].UserId;

        // Insert company mappings
        if (allowedCompanies && allowedCompanies.length > 0) {
            for (const cid of allowedCompanies) {
                await pool.request()
                    .input('UserId', sql.Int, newUserId)
                    .input('CompanyId', sql.Int, parseInt(cid))
                    .query('INSERT INTO UserCompanyMapping (UserId, CompanyId) VALUES (@UserId, @CompanyId)');
            }
        }

        // Audit log
        try {
            await pool.request()
                .input('UserId', sql.Int, session.userId)
                .input('ActionType', sql.NVarChar(50), 'CREATE_USER')
                .input('Details', sql.NVarChar(500), `สร้างผู้ใช้ "${Username}" (${FullName}), Role: ${RoleId}`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@UserId, @ActionType, @Details)`);
        } catch (e) { console.warn('Audit log failed:', e.message); }

        return NextResponse.json({ success: true, message: "User created successfully" });

    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getSession(request);
        if (!session || session.roleName?.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { UserId, FullName, CompanyId, RoleId, IsActive, allowedCompanies } = body;

        if (!UserId || !FullName) {
            return NextResponse.json({ success: false, message: "UserId and FullName are required" }, { status: 400 });
        }

        // Input length validation
        if (FullName.length > 150) {
            return NextResponse.json({ success: false, message: 'ชื่อต้องไม่เกิน 150 ตัวอักษร' }, { status: 400 });
        }

        const pool = await connectToCentralDB();

        // Update user + increment TokenVersion to force logout
        await pool.request()
            .input('UserId', sql.Int, parseInt(UserId))
            .input('FullName', sql.NVarChar(150), FullName)
            .input('CompanyId', sql.Int, CompanyId ? parseInt(CompanyId) : null)
            .input('RoleId', sql.Int, RoleId ? parseInt(RoleId) : null)
            .input('IsActive', sql.Bit, IsActive ? 1 : 0)
            .query(`
                UPDATE Users
                SET FullName = @FullName, CompanyId = @CompanyId, RoleId = @RoleId, IsActive = @IsActive,
                    TokenVersion = ISNULL(TokenVersion, 0) + 1
                WHERE UserId = @UserId
            `);

        // Invalidate session cache for this user immediately
        invalidateSessionCache(parseInt(UserId));

        // Update company mappings (delete + re-insert)
        if (allowedCompanies) {
            await pool.request()
                .input('UserId', sql.Int, parseInt(UserId))
                .query('DELETE FROM UserCompanyMapping WHERE UserId = @UserId');

            for (const cid of allowedCompanies) {
                await pool.request()
                    .input('UserId', sql.Int, parseInt(UserId))
                    .input('CompanyId', sql.Int, parseInt(cid))
                    .query('INSERT INTO UserCompanyMapping (UserId, CompanyId) VALUES (@UserId, @CompanyId)');
            }
        }

        // Audit log
        try {
            await pool.request()
                .input('LogUserId', sql.Int, session.userId)
                .input('ActionType', sql.NVarChar(50), 'UPDATE_USER')
                .input('Details', sql.NVarChar(500), `แก้ไขผู้ใช้ #${UserId} (${FullName}), Active=${IsActive}, Role=${RoleId}`)
                .query(`INSERT INTO ActivityLogs (UserId, ActionType, Details) VALUES (@LogUserId, @ActionType, @Details)`);
        } catch (e) { console.warn('Audit log failed:', e.message); }

        return NextResponse.json({ success: true, message: "User updated successfully" });

    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
