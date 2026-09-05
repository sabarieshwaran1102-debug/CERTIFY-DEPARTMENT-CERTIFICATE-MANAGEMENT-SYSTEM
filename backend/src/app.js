import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import odRecordsRoutes from './routes/od-records.js';
import certificatesRoutes from './routes/certificates.js';
import reportsRoutes from './routes/reports.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/od-records', odRecordsRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/reports', reportsRoutes);

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
