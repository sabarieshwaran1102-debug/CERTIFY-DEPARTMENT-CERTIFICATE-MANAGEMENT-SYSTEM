import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import odRecordsRoutes from './routes/od-records.js';
import certificatesRoutes from './routes/certificates.js';
import reportsRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import organizationRoutes from './routes/organization.js';
import odRoutes from './routes/ods.js';
import odCertificatesRoutes from './routes/od-certificates.js';
import { errorHandler } from './middleware/errorHandler.js';
import pool from './config/database.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const configuredCorsOrigin = (process.env.CORS_ORIGIN || '').trim();
const configuredJwtSecret = process.env.JWT_SECRET || '';
const configuredStoragePath = (process.env.STORAGE_PATH || '').trim();

if (isProduction) {
    if (!configuredJwtSecret || configuredJwtSecret === 'your-secret-key-change-in-production' || configuredJwtSecret.length < 32) {
        throw new Error('JWT_SECRET must be set to a secure value in production.');
    }
    if (!configuredCorsOrigin || configuredCorsOrigin === '*' || configuredCorsOrigin.toLowerCase() === 'null') {
        throw new Error('CORS_ORIGIN must be set to an explicit allowlist in production.');
    }
    if (!configuredStoragePath) {
        throw new Error('STORAGE_PATH must be set in production.');
    }
}

const app = express();

const allowedOrigins = configuredCorsOrigin
    ? configuredCorsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isProduction) {
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Origin not allowed by CORS policy'));
        }
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
}));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Strict limiter for login endpoint — prevents brute-force attacks.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 attempts per IP per window
    standardHeaders: true,     // Return RateLimit-* headers
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    skip: () => !isProduction && process.env.DISABLE_RATE_LIMIT === 'true',
});

// Broad API limiter — prevents scraping/abuse. 300 req / 15 min is generous
// enough to not affect normal application usage.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    skip: () => !isProduction && process.env.DISABLE_RATE_LIMIT === 'true',
});

if (isProduction) {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        const forwardedProto = req.headers['x-forwarded-proto'];
        if (!req.secure && forwardedProto !== 'https') {
            return res.status(403).json({ error: 'HTTPS is required in production.' });
        }
        return next();
    });
}

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Apply the broad rate limiter to all /api routes.
app.use('/api', apiLimiter);

// Apply the strict login limiter BEFORE the auth router.
app.post('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/od-records', odRecordsRoutes);
app.use('/api/ods', odRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/od-certificates', odCertificatesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userRoutes);
app.use('/api', organizationRoutes);

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', timestamp: new Date().toISOString(), db: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'DEGRADED', timestamp: new Date().toISOString(), db: 'disconnected', error: err.message });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use(errorHandler);

export default app;
