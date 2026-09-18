import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import odRecordsRoutes from './routes/od-records.js';
import certificatesRoutes from './routes/certificates.js';
import reportsRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import organizationRoutes from './routes/organization.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

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
    ? configuredCorsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (isProduction) {
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Origin not allowed by CORS policy'));
        }

        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }

        return callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
}));

if (isProduction) {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        const forwardedProto = req.headers['x-forwarded-proto'];
        const isSecure = req.secure || forwardedProto === 'https';

        if (!isSecure) {
            return res.status(403).json({ error: 'HTTPS is required in production.' });
        }

        next();
    });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/od-records', odRecordsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userRoutes);
app.use('/api', organizationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
