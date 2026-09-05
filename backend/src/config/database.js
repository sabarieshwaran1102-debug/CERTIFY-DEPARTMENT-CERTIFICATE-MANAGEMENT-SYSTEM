import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'certificate_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

export default pool;
