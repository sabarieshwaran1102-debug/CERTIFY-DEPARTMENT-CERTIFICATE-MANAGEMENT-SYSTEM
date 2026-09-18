import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(currentDirectory, '..', 'src', 'migrations', '004_organizational_architecture.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

describe('Phase 1 organizational schema', () => {
    it('defines the organizational entities and uniqueness constraints', () => {
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS departments/);
        expect(migrationSql).toMatch(/code VARCHAR\(30\) NOT NULL UNIQUE/);
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS academic_years/);
        expect(migrationSql).toMatch(/name VARCHAR\(20\) NOT NULL UNIQUE/);
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS classes/);
        expect(migrationSql).toMatch(/classes_combination_unique UNIQUE \(department_id, academic_year_id, year_of_study, section\)/);
    });

    it('preserves student identity and adds class lifecycle fields', () => {
        expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS class_id BIGINT/);
        expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS academic_year_id BIGINT/);
        expect(migrationSql).toMatch(/status VARCHAR\(20\) NOT NULL DEFAULT 'ACTIVE'/);
        expect(migrationSql).toMatch(/students_status_check/);
        expect(migrationSql).toMatch(/students_class_fkey/);
        expect(migrationSql).toMatch(/students_academic_year_fkey/);
        expect(migrationSql).toMatch(/ALTER COLUMN class_id SET NOT NULL/);
    });

    it('backfills existing data and preserves OD historical context', () => {
        expect(migrationSql).toMatch(/INSERT INTO departments/);
        expect(migrationSql).toMatch(/INSERT INTO academic_years/);
        expect(migrationSql).toMatch(/UPDATE students s/);
        expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS class_id BIGINT/);
        expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS academic_year_id BIGINT/);
        expect(migrationSql).toMatch(/UPDATE od_records od/);
        expect(migrationSql).toMatch(/od_records_class_fkey/);
    });

    it('keeps the seed representative of multiple departments and class sizes', () => {
        const seedPath = path.join(currentDirectory, '..', 'src', 'utils', 'seedTestData.js');
        const seed = readFileSync(seedPath, 'utf8');
        expect(seed).toMatch(/AI & DS/);
        expect(seed).toMatch(/CSE/);
        expect(seed).toMatch(/ECE/);
        expect(seed).toMatch(/index <= 65/);
        expect(seed).toMatch(/index <= 66/);
    });
});