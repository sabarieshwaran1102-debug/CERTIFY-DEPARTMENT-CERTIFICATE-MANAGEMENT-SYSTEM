import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../config/database.js';
import User from '../models/User.js';

dotenv.config();

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password || password.length < 8) {
    throw new Error('Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 8 characters.');
}

const existing = await User.getByUsername(username);
if (existing) {
    throw new Error('The requested admin username is already in use.');
}

await User.create({
    username,
    role: 'admin',
    password_hash: await bcrypt.hash(password, 12),
});

console.log(`Admin account created: ${username}`);
await pool.end();