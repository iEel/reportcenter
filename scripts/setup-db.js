const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Validate required env vars
const required = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please ensure .env.local is configured properly.');
    process.exit(1);
}

const configMaster = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: 'master',
    options: {
        instanceName: process.env.DB_INSTANCE || undefined,
        encrypt: false,
        trustServerCertificate: true
    }
};

const dbName = process.env.DB_DATABASE;

async function setup() {
    try {
        let pool = await sql.connect(configMaster);
        // Create DB if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
            BEGIN
                CREATE DATABASE [${dbName}];
            END
        `);
        console.log(`Database ${dbName} created or already exists.`);
        await pool.close();

        // Now connect to the new DB to run script
        const configApp = { ...configMaster, database: dbName };
        pool = await sql.connect(configApp);

        // Read init_database.sql
        const sqlScript = fs.readFileSync(path.join(__dirname, 'init_database.sql'), 'utf8');
        await pool.request().query(sqlScript);
        console.log('Schema created successfully.');

        await pool.close();
        process.exit(0);
    } catch (e) {
        console.error('Setup DB Failed:', e);
        process.exit(1);
    }
}
setup();
