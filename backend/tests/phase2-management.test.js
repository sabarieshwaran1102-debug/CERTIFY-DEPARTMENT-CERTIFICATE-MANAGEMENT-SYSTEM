import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(currentDirectory, '..', 'src', 'migrations', '005_management_layer.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');
const studentsRoute = readFileSync(path.join(currentDirectory, '..', 'src', 'routes', 'students.js'), 'utf8');
const organizationRoute = readFileSync(path.join(currentDirectory, '..', 'src', 'routes', 'organization.js'), 'utf8');

describe('Phase 2 management foundation', () => {
    it('adds the requested roles and non-destructive management entities', () => {
        expect(migrationSql).toMatch(/'super_admin'/);
        expect(migrationSql).toMatch(/'class_advisor'/);
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS class_advisor_history/);
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS class_representatives/);
        expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS audit_events/);
        expect(migrationSql).toMatch(/ON DELETE RESTRICT/);
    });

    it('exposes scoped student CRUD and confirmed import validation', () => {
        expect(studentsRoute).toMatch(/router\.post\('\/', verifyToken/);
        expect(studentsRoute).toMatch(/router\.patch\('\/:studentId/);
        expect(studentsRoute).toMatch(/router\.patch\('\/:studentId\(\\\\d\+\)\/deactivate/);
        expect(studentsRoute).toMatch(/router\.post\('\/import'/);
        expect(studentsRoute).toMatch(/duplicate in file/);
        expect(studentsRoute).toMatch(/register_number already exists/);
        expect(studentsRoute).toMatch(/await client\.query\('BEGIN'\)/);
    });

    it('exposes advisor history and multiple representative assignment APIs', () => {
        expect(organizationRoute).toMatch(/router\.post\('\/classes\/:id\/advisor'/);
        expect(organizationRoute).toMatch(/class_advisor_history/);
        expect(organizationRoute).toMatch(/router\.post\('\/classes\/:id\/representatives'/);
        expect(organizationRoute).toMatch(/router\.delete\('\/classes\/:id\/representatives\/:studentId'/);
    });
});