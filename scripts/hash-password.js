/**
 * Password Hashing Utility Script
 * Usage: node scripts/hash-password.js <your-password>
 * 
 * Then use the output to UPDATE the user in the database:
 * UPDATE Users SET PasswordHash = '<output>' WHERE Username = 'admin';
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.log('Usage: node scripts/hash-password.js <password>');
    console.log('Example: node scripts/hash-password.js MySecretPassword123');
    process.exit(1);
}

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('\n--- Password Hash Result ---');
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\n--- SQL to update ---');
console.log(`UPDATE Users SET PasswordHash = '${hash}' WHERE Username = 'admin';`);
console.log('');
