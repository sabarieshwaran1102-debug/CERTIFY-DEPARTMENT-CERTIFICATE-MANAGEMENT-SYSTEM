import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(projectRoot, 'src', 'migrations', '003_admin_role_and_student_dob.sql');
const usersRoutePath = path.join(projectRoot, 'src', 'routes', 'users.js');

const migrationSql = readFileSync(migrationPath, 'utf8');
const usersRoute = readFileSync(usersRoutePath, 'utf8');

test('role hierarchy includes admin-only faculty management', () => {
  expect(migrationSql).toMatch(/'admin'/);
  expect(usersRoute).toMatch(/router\.post\('\/coordinating-faculty', verifyToken, requireRole\('admin'\)/);
  expect(usersRoute).toMatch(/router\.post\('\/student-representatives', verifyToken, requireRole\('coordinating_faculty'\)/);
});
