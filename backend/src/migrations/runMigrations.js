import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runMigrations = async () => {
    const client = await pool.connect();
    try {
        console.log('Running database migrations...');

        // Read and execute migration file
        const migrationPath = path.join(__dirname, '001_initial_schema.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        await client.query(migrationSQL);
        console.log('✓ Migration 001_initial_schema completed successfully');

        console.log('✓ All migrations completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('✗ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
    }
};

runMigrations();
