/**
 * Script to update the admin user password hash in the database
 * Usage: node scripts/update-admin-password.js
 */

const sql = require('mssql');
const bcrypt = require('bcryptjs');

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

async function updatePassword() {
    const newPassword = 'admin1234';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    console.log('Connecting to database...');
    const pool = await sql.connect(config);

    console.log('Updating admin password...');
    await pool.request()
        .input('Hash', sql.NVarChar(255), hash)
        .input('Username', sql.NVarChar(50), 'admin')
        .query('UPDATE Users SET PasswordHash = @Hash WHERE Username = @Username');

    console.log('✅ Password updated successfully!');
    console.log('Username: admin');
    console.log('Password: admin1234');

    await pool.close();
    process.exit(0);
}

updatePassword().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
