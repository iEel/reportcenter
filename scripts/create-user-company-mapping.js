/**
 * Script to create UserCompanyMapping table
 * Allows multi-company access per user
 * Usage: node scripts/create-user-company-mapping.js
 */

const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Sonic@rama3',
    server: process.env.DB_SERVER || '192.168.110.106',
    database: process.env.DB_DATABASE || 'ReportCenterDB',
    options: {
        instanceName: 'alpha',
        encrypt: false,
        trustServerCertificate: true,
    },
};

async function run() {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);

    const check = await pool.request().query(`SELECT OBJECT_ID('UserCompanyMapping') AS T`);
    if (check.recordset[0].T) {
        console.log('✅ UserCompanyMapping table already exists.');
        await pool.close();
        process.exit(0);
        return;
    }

    console.log('Creating UserCompanyMapping table...');
    await pool.request().query(`
        CREATE TABLE UserCompanyMapping (
            UserId INT FOREIGN KEY REFERENCES Users(UserId),
            CompanyId INT NOT NULL,
            PRIMARY KEY (UserId, CompanyId)
        );
    `);

    // Grant admin access to all 3 companies by default
    const users = await pool.request().query(`SELECT UserId FROM Users WHERE IsActive = 1`);
    for (const u of users.recordset) {
        await pool.request()
            .input('UserId', sql.Int, u.UserId)
            .query(`
                INSERT INTO UserCompanyMapping (UserId, CompanyId) VALUES (@UserId, 1);
                INSERT INTO UserCompanyMapping (UserId, CompanyId) VALUES (@UserId, 2);
                INSERT INTO UserCompanyMapping (UserId, CompanyId) VALUES (@UserId, 3);
            `);
    }

    console.log('✅ UserCompanyMapping table created and seeded!');
    await pool.close();
    process.exit(0);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
