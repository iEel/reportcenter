import '@/lib/env-check';
import sql from 'mssql';

// Shared pool & timeout settings (configurable via .env)
const REQUEST_TIMEOUT = parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000;   // 30s
const CONNECTION_TIMEOUT = parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000; // 10s
const POOL_MIN = parseInt(process.env.DB_POOL_MIN) || 2;
const POOL_MAX = parseInt(process.env.DB_POOL_MAX) || 20;

// This configuration is for the Central Report Database (ReportCenterDB)
const centralDbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    requestTimeout: REQUEST_TIMEOUT,
    connectionTimeout: CONNECTION_TIMEOUT,
    pool: { min: POOL_MIN, max: POOL_MAX, idleTimeoutMillis: 30000 },
    options: {
        instanceName: process.env.DB_INSTANCE || 'alpha',
        encrypt: false,
        trustServerCertificate: true,
    },
};

// Fallback company configs from .env (used if CompanyDatabases table doesn't exist)
const envCompanyDbConfigs = {
    1: {
        user: process.env.C1_DB_USER,
        password: process.env.C1_DB_PASSWORD,
        server: process.env.C1_DB_SERVER,
        database: process.env.C1_DB_DATABASE,
        requestTimeout: REQUEST_TIMEOUT,
        connectionTimeout: CONNECTION_TIMEOUT,
        pool: { min: POOL_MIN, max: POOL_MAX, idleTimeoutMillis: 30000 },
        options: { instanceName: process.env.C1_DB_INSTANCE || 'SONIC', encrypt: false, trustServerCertificate: true },
        label: 'SNI',
    },
    2: {
        user: process.env.C2_DB_USER,
        password: process.env.C2_DB_PASSWORD,
        server: process.env.C2_DB_SERVER,
        database: process.env.C2_DB_DATABASE,
        requestTimeout: REQUEST_TIMEOUT,
        connectionTimeout: CONNECTION_TIMEOUT,
        pool: { min: POOL_MIN, max: POOL_MAX, idleTimeoutMillis: 30000 },
        options: { instanceName: process.env.C2_DB_INSTANCE || 'GLINK', encrypt: false, trustServerCertificate: true },
        label: 'GRL',
    },
    3: {
        user: process.env.C3_DB_USER,
        password: process.env.C3_DB_PASSWORD,
        server: process.env.C3_DB_SERVER,
        database: process.env.C3_DB_DATABASE,
        requestTimeout: REQUEST_TIMEOUT,
        connectionTimeout: CONNECTION_TIMEOUT,
        pool: { min: POOL_MIN, max: POOL_MAX, idleTimeoutMillis: 30000 },
        options: { instanceName: process.env.C3_DB_INSTANCE || 'AUTOLOGIS', encrypt: false, trustServerCertificate: true },
        label: 'SALOG',
    }
};

// Dynamic company configs loaded from DB (populated on first connectToCompanyDB call)
let dynamicCompanyConfigs = null;
let dynamicConfigLoaded = false;

// Global pool cache to prevent creating multiple connections to the same database unnecessarily
const pools = {};

/**
 * Helper function to manage connection pools with health check.
 * If a cached pool is disconnected (e.g. DB restart), it reconnects automatically.
 */
async function getPool(name, config) {
    // Health check — if pool exists but is no longer connected, remove it
    if (pools[name] && !pools[name].connected) {
        console.warn(`⚠️ [DB] Pool "${name}" disconnected, reconnecting...`);
        try { await pools[name].close(); } catch { /* ignore close errors */ }
        pools[name] = null;
    }

    if (!pools[name]) {
        try {
            const pool = new sql.ConnectionPool(config);
            pools[name] = await pool.connect();
        } catch (err) {
            console.error(`Database Connection Failed! Name: ${name}, Bad Config:`, err);
            pools[name] = null;
            throw err;
        }
    }
    return pools[name];
}

/**
 * Connects to the Central ReportCenter Database
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function connectToCentralDB() {
    return getPool('central', centralDbConfig);
}

/**
 * Load company DB configs from CompanyDatabases table in central DB.
 * Falls back to .env configs if the table doesn't exist.
 * Results are cached — only loads once per server lifecycle.
 */
async function loadCompanyConfigs() {
    if (dynamicConfigLoaded) return dynamicCompanyConfigs || envCompanyDbConfigs;

    try {
        const pool = await connectToCentralDB();
        const tableCheck = await pool.request().query(
            `SELECT OBJECT_ID('CompanyDatabases') AS TableExists`
        );

        if (!tableCheck.recordset[0].TableExists) {
            // Auto-create table
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

            // Seed with existing .env configs
            for (const [id, cfg] of Object.entries(envCompanyDbConfigs)) {
                if (cfg.user && cfg.server && cfg.database) {
                    await pool.request()
                        .input('CompanyId', sql.Int, parseInt(id))
                        .input('CompanyName', sql.NVarChar(200), cfg.label)
                        .input('CompanyLabel', sql.NVarChar(20), cfg.label)
                        .input('DbUser', sql.NVarChar(100), cfg.user)
                        .input('DbPassword', sql.NVarChar(200), cfg.password || '')
                        .input('DbServer', sql.NVarChar(200), cfg.server)
                        .input('DbName', sql.NVarChar(200), cfg.database)
                        .input('DbInstance', sql.NVarChar(100), cfg.options?.instanceName || null)
                        .query(`
                            INSERT INTO CompanyDatabases (CompanyId, CompanyName, CompanyLabel, DbUser, DbPassword, DbServer, DbName, DbInstance)
                            VALUES (@CompanyId, @CompanyName, @CompanyLabel, @DbUser, @DbPassword, @DbServer, @DbName, @DbInstance)
                        `);
                }
            }
            console.log('✅ [DB] Created CompanyDatabases table and seeded from .env');
        }

        // Load from table
        const result = await pool.request().query(`
            SELECT CompanyId, CompanyName, CompanyLabel, DbUser, DbPassword, DbServer, DbName, DbInstance
            FROM CompanyDatabases
            WHERE IsActive = 1
            ORDER BY CompanyId
        `);

        if (result.recordset.length > 0) {
            dynamicCompanyConfigs = {};
            for (const row of result.recordset) {
                dynamicCompanyConfigs[row.CompanyId] = {
                    user: row.DbUser,
                    password: row.DbPassword,
                    server: row.DbServer,
                    database: row.DbName,
                    options: { instanceName: row.DbInstance || '', encrypt: false, trustServerCertificate: true },
                    label: row.CompanyLabel,
                    name: row.CompanyName,
                };
            }
            console.log(`✅ [DB] Loaded ${result.recordset.length} company configs from CompanyDatabases table`);
        }
    } catch (e) {
        console.warn('⚠️ [DB] Could not load CompanyDatabases table, using .env fallback:', e.message);
    }

    dynamicConfigLoaded = true;
    return dynamicCompanyConfigs || envCompanyDbConfigs;
}

/**
 * Dynamically connects to a specific Company's Database
 * Tries CompanyDatabases table first, falls back to .env config
 * @param {number} companyId 
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function connectToCompanyDB(companyId) {
    const configs = await loadCompanyConfigs();
    const config = configs[companyId];
    if (!config) {
        throw new Error(`Configuration for Company ID ${companyId} not found.`);
    }
    return getPool(`company_${companyId}`, config);
}

/**
 * Get readable company label by ID
 * @param {number|string} companyId
 * @returns {string}
 */
export async function getCompanyLabelAsync(companyId) {
    const configs = await loadCompanyConfigs();
    const config = configs[companyId];
    return config?.label || `บริษัท ${companyId}`;
}

// Synchronous fallback (uses .env labels, for cases where async isn't possible)
export function getCompanyLabel(companyId) {
    if (dynamicCompanyConfigs) {
        const config = dynamicCompanyConfigs[companyId];
        if (config?.label) return config.label;
    }
    const config = envCompanyDbConfigs[companyId];
    return config?.label || `บริษัท ${companyId}`;
}

/**
 * Get all available company configs (for admin UI, etc.)
 * @returns {Promise<Array<{ companyId: number, label: string }>>}
 */
export async function getCompanyList() {
    const configs = await loadCompanyConfigs();
    return Object.entries(configs).map(([id, cfg]) => ({
        companyId: parseInt(id),
        label: cfg.label,
    }));
}
