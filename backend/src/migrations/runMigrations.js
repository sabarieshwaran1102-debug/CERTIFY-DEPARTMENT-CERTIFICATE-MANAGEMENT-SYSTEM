import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runMigrations = async () => {
    const client = await pool.connect();
    try {
        console.log('Running database migrations...');

        const migrationFiles = fs.readdirSync(__dirname)
            .filter((file) => /^\d+_.*\.sql$/.test(file))
            .sort();

        for (const migrationFile of migrationFiles) {
            const migrationSQL = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
            await client.query(migrationSQL);
            console.log(`✓ Migration ${migrationFile} completed successfully`);
        }

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
