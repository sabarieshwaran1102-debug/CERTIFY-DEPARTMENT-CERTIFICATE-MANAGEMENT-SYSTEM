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
        console.log('🌱 Seeding test data...\n');

        // Clear existing test data
        console.log('Clearing existing test data...');
        await client.query('DELETE FROM certificates');
        await client.query('DELETE FROM od_records');
        await client.query('DELETE FROM users');
        await client.query('DELETE FROM students');
        await client.query('ALTER SEQUENCE registration_number_seq RESTART WITH 1');
        console.log('✓ Cleared existing data\n');

        // Create test students
        console.log('Creating test students...');
        const students = [
            { register_number: '22AD001', name: 'Alice Johnson', department: 'CSE', year: '2022', section: 'A' },
            { register_number: '22AD002', name: 'Bob Smith', department: 'CSE', year: '2022', section: 'A' },
            { register_number: '22AD003', name: 'Carol White', department: 'CSE', year: '2022', section: 'B' },
            { register_number: '22EC001', name: 'David Brown', department: 'ECE', year: '2022', section: 'A' },
            { register_number: '22EC002', name: 'Emma Davis', department: 'ECE', year: '2022', section: 'A' },
        ];

        const studentIds = {};
        for (const studentData of students) {
            const student = await Student.create(studentData);
            studentIds[student.register_number] = student.student_id;
            console.log(`  ✓ Created student: ${student.register_number} (ID: ${student.student_id})`);
        }

        // Create test users
        console.log('\nCreating test users...');

        // Student user for 22AD001
        const student1User = await User.create({
            username: 'alice@university.edu',
            role: 'student',
            student_id: studentIds['22AD001'],
        });
        console.log(`  ✓ Created student user: alice@university.edu (ID: ${student1User.user_id})`);

        // Student user for 22AD002
        const student2User = await User.create({
            username: 'bob@university.edu',
            role: 'student',
            student_id: studentIds['22AD002'],
        });
        console.log(`  ✓ Created student user: bob@university.edu (ID: ${student2User.user_id})`);

        // Student Representative user (no student_id)
        const repUser = await User.create({
            username: 'rep@university.edu',
            role: 'student_representative',
            student_id: null,
        });
        console.log(`  ✓ Created student rep user: rep@university.edu (ID: ${repUser.user_id})`);

        // Coordinating Faculty user (no student_id)
        const facultyUser = await User.create({
            username: 'faculty@university.edu',
            role: 'coordinating_faculty',
            student_id: null,
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
        console.log('  Student (22AD001): alice@university.edu (Token will be needed)');
        console.log('  Student (22AD002): bob@university.edu (Token will be needed)');
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
