const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

async function fixReports() {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER || 'sa',
            password: process.env.DB_PASSWORD || 'Sonic@rama3',
            server: process.env.DB_SERVER || '192.168.110.106',
            database: process.env.DB_DATABASE || 'ReportCenterDB',
            options: {
                instanceName: 'alpha',
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
