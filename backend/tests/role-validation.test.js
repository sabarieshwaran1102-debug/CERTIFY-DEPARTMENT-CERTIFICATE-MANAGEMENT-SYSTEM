import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(projectRoot, 'src', 'migrations', '003_admin_role_and_student_dob.sql');
const migration5Path = path.join(projectRoot, 'src', 'migrations', '005_management_layer.sql');
const usersRoutePath = path.join(projectRoot, 'src', 'routes', 'users.js');

const migrationSql = readFileSync(migrationPath, 'utf8');
const migration5Sql = readFileSync(migration5Path, 'utf8');
const usersRoute = readFileSync(usersRoutePath, 'utf8');

test('role hierarchy includes admin-only faculty management', () => {
    expect(migrationSql).toMatch(/'admin'/);
    // Users route uses requireManagementRole with admin/super_admin for coordinating-faculty
    expect(usersRoute).toMatch(/coordinating-faculty/);
    expect(usersRoute).toMatch(/requireManagementRole\('admin', 'super_admin'\)/);
    // Student representatives still restricted to coordinating_faculty
    expect(usersRoute).toMatch(/requireRole\('coordinating_faculty'\)/);
});

test('migration 005 adds class_advisor and super_admin roles', () => {
    expect(migration5Sql).toMatch(/'super_admin'/);
    expect(migration5Sql).toMatch(/'class_advisor'/);
    expect(migration5Sql).toMatch(/class_advisor_history/);
    expect(migration5Sql).toMatch(/class_representatives/);
    expect(migration5Sql).toMatch(/audit_events/);
});