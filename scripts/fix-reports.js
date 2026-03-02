const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Validate required env vars
const required = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

async function fixReports() {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            options: {
                instanceName: process.env.DB_INSTANCE || undefined,
                encrypt: false,
                trustServerCertificate: true,
            },
        });

        // Make all reports public for now so the user can see them
        await pool.request().query('UPDATE Reports SET IsPublic = 1 WHERE IsPublic = 0');
        console.log("Updated reports to be public.");
        process.exit(0);
    } catch (e) {
        console.error(e);
    }
}
fixReports();
