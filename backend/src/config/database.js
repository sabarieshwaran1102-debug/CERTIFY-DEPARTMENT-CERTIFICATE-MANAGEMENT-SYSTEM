import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// In production, refuse to start without an explicit DB password.
if (isProduction && !process.env.DB_PASSWORD) {
    throw new Error(
        'DB_PASSWORD environment variable is not set. ' +
        'Set it before starting the server in production.'
    );
}

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'certificate_management',
    user:     process.env.DB_USER     || 'postgres',
    // No fallback in production (guarded above). Safe default for local dev only.
    password: process.env.DB_PASSWORD || (isProduction ? undefined : 'postgres'),

    // Connection pool tuning
    max:                    parseInt(process.env.DB_POOL_MAX                || '20',    10),
    idleTimeoutMillis:      parseInt(process.env.DB_IDLE_TIMEOUT_MS         || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '2000',  10),

    // SSL: set DB_SSL=true in production to require encrypted transit.
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: true }
        : false,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});

export default pool;
