/**
 * Environment Variable Validation
 * Import this module early to check required env vars on startup.
 */

const REQUIRED = [
    'DB_USER',
    'DB_PASSWORD',
    'DB_SERVER',
    'DB_DATABASE',
    'JWT_SECRET',
];

const RECOMMENDED = [
    { key: 'CRON_SECRET', hint: 'Cron endpoint จะไม่มีการป้องกัน' },
    { key: 'SMTP_USER', hint: 'Email fallback จะใช้ไม่ได้' },
    { key: 'AZURE_TENANT_ID', hint: 'Microsoft Graph API email จะใช้ไม่ได้' },
    { key: 'AZURE_CLIENT_ID', hint: 'Microsoft Graph API email จะใช้ไม่ได้' },
    { key: 'AZURE_CLIENT_SECRET', hint: 'Microsoft Graph API email จะใช้ไม่ได้' },
];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`\n❌ [ENV CHECK] Missing REQUIRED environment variables:\n${missing.map(k => `   - ${k}`).join('\n')}\n`);
} else {
    console.log('✅ [ENV CHECK] All required environment variables are set.');
}

const warnings = RECOMMENDED.filter(r => !process.env[r.key]);
if (warnings.length > 0) {
    console.warn(`⚠️  [ENV CHECK] Missing RECOMMENDED variables:\n${warnings.map(r => `   - ${r.key}: ${r.hint}`).join('\n')}`);
}

// Warn about default JWT secret
if (process.env.JWT_SECRET === 'rc-super-secret-key-2026' || process.env.JWT_SECRET === 'rc-super-secret-key-2026-change-me') {
    console.warn('⚠️  [ENV CHECK] JWT_SECRET is using the default value! Change it in production.');
}

export const envCheckComplete = true;
