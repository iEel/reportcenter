const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const configMaster = {
    user: 'sa',
    password: 'Sonic@rama3',
    server: '192.168.110.106',
    database: 'master',
    options: {
        instanceName: 'alpha',
        encrypt: false,
        trustServerCertificate: true
    }
};

async function setup() {
    try {
        let pool = await sql.connect(configMaster);
        // Create DB if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ReportCenterDB')
            BEGIN
                CREATE DATABASE ReportCenterDB;
            END
        `);
        console.log("Database ReportCenterDB created or already exists.");
        await pool.close();

        // Now connect to the new DB to run script
        const configApp = { ...configMaster, database: 'ReportCenterDB' };
        pool = await sql.connect(configApp);

        // Read init_database.sql
        const sqlScript = fs.readFileSync(path.join(__dirname, 'scripts', 'init_database.sql'), 'utf8');

        // mssql driver doesn't like batching DDL sometimes, but let's try 
        // We might need to split by GO or just let it run if it's simple enough
        await pool.request().query(sqlScript);
        console.log("Schema created successfully.");

        await pool.close();
    } catch (e) {
        console.error("Setup DB Failed:", e);
    }
}
setup();
