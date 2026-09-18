/**
 * Seed script for test data
 * Run: node src/utils/seedTestData.js
 */
import pool from '../config/database.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import ODRecord from '../models/ODRecord.js';
import bcrypt from 'bcrypt';

const seedTestData = async () => {
    const client = await pool.connect();
    try {
        const staffPassword = process.env.SEED_TEST_PASSWORD;
        if (!staffPassword || staffPassword.length < 8) {
            throw new Error('Set SEED_TEST_PASSWORD to at least 8 characters before seeding test users.');
        }

        console.log('🌱 Seeding test data...\n');

        // Clear existing test data
        console.log('Clearing existing test data...');
        await client.query('DELETE FROM certificates');
        await client.query('DELETE FROM od_records');
        await client.query('DELETE FROM users');
        await client.query('DELETE FROM students');
        await client.query('ALTER SEQUENCE registration_number_seq RESTART WITH 1');
        console.log('✓ Cleared existing data\n');

        const departmentIds = {};
        for (const department of [
            { name: 'AI & DS', code: 'ADS' },
            { name: 'CSE', code: 'CSE' },
            { name: 'ECE', code: 'ECE' },
        ]) {
            const result = await client.query(
                `INSERT INTO departments (name, code)
                 VALUES ($1, $2)
                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [department.name, department.code]
            );
            departmentIds[department.code] = result.rows[0].id;
        }

        const academicYearIds = {};
        for (const year of [
            { name: '2025-26', start_date: '2025-06-01', end_date: '2026-05-31' },
            { name: '2026-27', start_date: '2026-06-01', end_date: '2027-05-31' },
        ]) {
            const result = await client.query(
                `INSERT INTO academic_years (name, start_date, end_date)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (name) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
                 RETURNING id`,
                [year.name, year.start_date, year.end_date]
            );
            academicYearIds[year.name] = result.rows[0].id;
        }

        const classIds = {};
        const classDefinitions = [
            ['ADS-A', 'ADS', '2026-27', '2nd Year', 'A'],
            ['ADS-B', 'ADS', '2026-27', '2nd Year', 'B'],
            ['CSE-A', 'CSE', '2026-27', '2nd Year', 'A'],
            ['CSE-B', 'CSE', '2026-27', '2nd Year', 'B'],
            ['ECE-A', 'ECE', '2025-26', '3rd Year', 'A'],
        ];
        for (const [displayName, departmentCode, academicYearName, yearOfStudy, section] of classDefinitions) {
            const result = await client.query(
                `INSERT INTO classes (department_id, academic_year_id, year_of_study, section, display_name)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (department_id, academic_year_id, year_of_study, section)
                 DO UPDATE SET display_name = EXCLUDED.display_name
                 RETURNING id`,
                [departmentIds[departmentCode], academicYearIds[academicYearName], yearOfStudy, section, displayName]
            );
            classIds[displayName] = result.rows[0].id;
        }

        // Create test students
        console.log('Creating test students...');
        const students = [
            { register_number: '22AD001', name: 'Alice Johnson', department: 'AI & DS', year: '2nd Year', section: 'A', date_of_birth: '2004-06-15', class_id: classIds['ADS-A'] },
            { register_number: '22AD002', name: 'Bob Smith', department: 'AI & DS', year: '2nd Year', section: 'A', date_of_birth: '2004-08-21', class_id: classIds['ADS-A'] },
            { register_number: '22AD003', name: 'Carol White', department: 'AI & DS', year: '2nd Year', section: 'B', date_of_birth: '2004-11-03', class_id: classIds['ADS-B'] },
            { register_number: '22CS001', name: 'David Brown', department: 'CSE', year: '2nd Year', section: 'A', date_of_birth: '2004-04-10', class_id: classIds['CSE-A'] },
            { register_number: '22EC001', name: 'Emma Davis', department: 'ECE', year: '3rd Year', section: 'A', date_of_birth: '2004-09-27', class_id: classIds['ECE-A'] },
        ];

        for (let index = 3; index <= 65; index += 1) {
            students.push({
                register_number: `26ADSA${String(index).padStart(3, '0')}`,
                name: `Test Student ${String(index).padStart(3, '0')}`,
                department: 'AI & DS',
                year: '2nd Year',
                section: 'A',
                class_id: classIds['ADS-A'],
            });
        }
        for (let index = 2; index <= 66; index += 1) {
            students.push({
                register_number: `26ADSB${String(index).padStart(3, '0')}`,
                name: `Test Student ${String(index).padStart(3, '0')}`,
                department: 'AI & DS',
                year: '2nd Year',
                section: 'B',
                class_id: classIds['ADS-B'],
            });
        }

        const studentIds = {};
        for (const studentData of students) {
            const student = await Student.create(studentData);
            studentIds[student.register_number] = student.student_id;
            console.log(`  ✓ Created student: ${student.register_number} (ID: ${student.student_id})`);
        }

        // Create test users
        console.log('\nCreating test users...');

        const staffPasswordHash = await bcrypt.hash(staffPassword, 12);

        const adminUser = await User.create({
            username: 'admin@university.edu',
            role: 'admin',
            password_hash: staffPasswordHash,
        });
        console.log(`  ✓ Created admin user: admin@university.edu (ID: ${adminUser.user_id})`);

        // Student user for 22AD001
        const student1User = await User.create({
            username: '22AD001',
            role: 'student',
            student_id: studentIds['22AD001'],
            password_hash: await bcrypt.hash('2004-06-15', 12),
        });
        console.log(`  ✓ Created student user: alice@university.edu (ID: ${student1User.user_id})`);

        // Student user for 22AD002
        const student2User = await User.create({
            username: '22AD002',
            role: 'student',
            student_id: studentIds['22AD002'],
            password_hash: await bcrypt.hash('2004-08-21', 12),
        });
        console.log(`  ✓ Created student user: bob@university.edu (ID: ${student2User.user_id})`);

        // Student Representative user (no student_id)
        const repUser = await User.create({
            username: 'rep@university.edu',
            role: 'student_representative',
            student_id: null,
            password_hash: staffPasswordHash,
        });
        console.log(`  ✓ Created student rep user: rep@university.edu (ID: ${repUser.user_id})`);

        // Coordinating Faculty user (no student_id)
        const facultyUser = await User.create({
            username: 'faculty@university.edu',
            role: 'coordinating_faculty',
            student_id: null,
            password_hash: staffPasswordHash,
        });
        console.log(`  ✓ Created faculty user: faculty@university.edu (ID: ${facultyUser.user_id})`);

        // Create test OD records
        console.log('\nCreating test OD records...');
        const od1 = await ODRecord.create(
            studentIds['22AD001'],
            'Attended Tech Conference 2024',
            'rep@university.edu'
        );
        console.log(`  ✓ Created OD: ${od1.registration_number} for student 22AD001`);

        const od2 = await ODRecord.create(
            studentIds['22AD002'],
            'Participated in Science Symposium',
            'rep@university.edu'
        );
        console.log(`  ✓ Created OD: ${od2.registration_number} for student 22AD002`);

        const od3 = await ODRecord.create(
            studentIds['22AD001'],
            'Attended Coding Workshop',
            'rep@university.edu'
        );
        console.log(`  ✓ Created OD: ${od3.registration_number} for student 22AD001`);

        // Verify sequence
        console.log('\nVerifying registration number sequence...');
        const seqValue = await ODRecord.getCurrentSequenceValue();
        console.log(`  Current sequence value: ${seqValue}`);

        console.log('\n✅ Test data seeding completed successfully!\n');
        console.log('Test Users:');
        console.log('  Admin: admin@university.edu (Token will be needed)');
        console.log('  Student (22AD001): 22AD001 (DOB is used as password)');
        console.log('  Student (22AD002): 22AD002 (DOB is used as password)');
        console.log('  Student Rep: rep@university.edu (Token will be needed)');
        console.log('  Faculty: faculty@university.edu (Token will be needed)\n');
        console.log('Registered OD Records:');
        console.log(`  OD-0001 (alice) - Tech Conference 2024`);
        console.log(`  OD-0002 (bob) - Science Symposium`);
        console.log(`  OD-0003 (alice) - Coding Workshop\n`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.release();
    }
};

seedTestData();
