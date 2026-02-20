/**
 * Script to create ActivityLogs table in the database
 * Usage: node scripts/create-activity-logs.js
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

async function createTable() {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);

    // Check if table already exists
    const checkResult = await pool.request().query(
        `SELECT OBJECT_ID('ActivityLogs') AS TableExists`
    );

    if (checkResult.recordset[0].TableExists) {
        console.log('✅ ActivityLogs table already exists.');
        await pool.close();
        process.exit(0);
        return;
    }

    console.log('Creating ActivityLogs table...');
    await pool.request().query(`
        CREATE TABLE ActivityLogs (
            LogId INT PRIMARY KEY IDENTITY(1,1),
            UserId INT FOREIGN KEY REFERENCES Users(UserId),
            ReportId INT FOREIGN KEY REFERENCES Reports(ReportId),
            CompanyId INT,
            ActionType NVARCHAR(50) NOT NULL,
            Details NVARCHAR(500),
            CreatedAt DATETIME DEFAULT GETDATE()
        );

        CREATE INDEX IX_ActivityLogs_CreatedAt ON ActivityLogs(CreatedAt DESC);
        CREATE INDEX IX_ActivityLogs_UserId ON ActivityLogs(UserId);
    `);

    console.log('✅ ActivityLogs table created successfully!');
    await pool.close();
    process.exit(0);
}

createTable().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
