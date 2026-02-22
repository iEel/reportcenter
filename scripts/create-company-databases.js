/**
 * Create CompanyDatabases table and seed with 3 companies
 * Run: node scripts/create-company-databases.js
 */
const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const centralDbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        instanceName: process.env.DB_INSTANCE || 'alpha',
        encrypt: false,
        trustServerCertificate: true,
    },
};

async function main() {
    console.log(`Connecting to ${centralDbConfig.server}/${centralDbConfig.database}...`);
    const pool = await sql.connect(centralDbConfig);

    // Check if table already exists
    const check = await pool.request().query(`SELECT OBJECT_ID('CompanyDatabases') AS TableExists`);
    if (check.recordset[0].TableExists) {
        console.log('⚠️  CompanyDatabases table already exists!');
        const existing = await pool.request().query(`SELECT * FROM CompanyDatabases`);
        console.table(existing.recordset);
        await pool.close();
        return;
    }

    // Create table
    await pool.request().query(`
        CREATE TABLE CompanyDatabases (
            CompanyId    INT PRIMARY KEY,
            CompanyName  NVARCHAR(200) NOT NULL,
            CompanyLabel NVARCHAR(20) NOT NULL,
            DbUser       NVARCHAR(100) NOT NULL,
            DbPassword   NVARCHAR(200) NOT NULL,
            DbServer     NVARCHAR(200) NOT NULL,
            DbName       NVARCHAR(200) NOT NULL,
            DbInstance   NVARCHAR(100) NULL,
            IsActive     BIT DEFAULT 1,
            CreatedAt    DATETIME DEFAULT GETDATE()
        )
    `);
    console.log('✅ Created CompanyDatabases table');

    // Seed data
    const companies = [
        { id: 1, name: 'Sonic Interfreight', label: 'SNI', user: process.env.C1_DB_USER, pass: process.env.C1_DB_PASSWORD, server: process.env.C1_DB_SERVER, db: process.env.C1_DB_DATABASE, instance: 'SONIC' },
        { id: 2, name: 'Grandlink Logistics', label: 'GRL', user: process.env.C2_DB_USER, pass: process.env.C2_DB_PASSWORD, server: process.env.C2_DB_SERVER, db: process.env.C2_DB_DATABASE, instance: 'GLINK' },
        { id: 3, name: 'Sonic Autologis', label: 'SALOG', user: process.env.C3_DB_USER, pass: process.env.C3_DB_PASSWORD, server: process.env.C3_DB_SERVER, db: process.env.C3_DB_DATABASE, instance: 'AUTOLOGIS' },
    ];

    for (const c of companies) {
        await pool.request()
            .input('CompanyId', sql.Int, c.id)
            .input('CompanyName', sql.NVarChar(200), c.name)
            .input('CompanyLabel', sql.NVarChar(20), c.label)
            .input('DbUser', sql.NVarChar(100), c.user)
            .input('DbPassword', sql.NVarChar(200), c.pass)
            .input('DbServer', sql.NVarChar(200), c.server)
            .input('DbName', sql.NVarChar(200), c.db)
            .input('DbInstance', sql.NVarChar(100), c.instance)
            .query(`
                INSERT INTO CompanyDatabases (CompanyId, CompanyName, CompanyLabel, DbUser, DbPassword, DbServer, DbName, DbInstance)
                VALUES (@CompanyId, @CompanyName, @CompanyLabel, @DbUser, @DbPassword, @DbServer, @DbName, @DbInstance)
            `);
        console.log(`  ✅ Seeded Company ${c.id}: ${c.label} (${c.name})`);
    }

    // Verify
    const result = await pool.request().query(`SELECT CompanyId, CompanyName, CompanyLabel, DbServer, DbName, DbInstance, IsActive FROM CompanyDatabases`);
    console.log('\n📋 CompanyDatabases:');
    console.table(result.recordset);

    await pool.close();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
