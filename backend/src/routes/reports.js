import express from 'express';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import { verifyToken, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import { access } from 'fs/promises';
import path from 'path';
import Certificate from '../models/Certificate.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const validateMonth = (month) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
        throw new AppError('month must use YYYY-MM format', 'VALIDATION_ERROR', 400);
    }
};

const getMonthBounds = (month) => [`${month}-01`, `${month}-01`];

const getFilters = (body = {}) => ({
    department: body.department || null,
    year: body.year || null,
    section: body.section || null,
});

const getMonthlyRecords = async (month, filters) => {
    const [monthStart] = getMonthBounds(month);
    const result = await pool.query(
        `SELECT od.od_id, od.student_id, od.registration_number, od.event_details,
                od.created_at, od.created_by, od.od_status,
                s.register_number, s.name AS student_name, s.department, s.year, s.section,
                c.certificate_id, c.file_name, c.file_size, c.file_type,
                c.submitted_at, c.submission_month
         FROM od_records od
         JOIN students s ON s.student_id = od.student_id
         LEFT JOIN certificates c ON c.od_id = od.od_id
         WHERE od.created_at >= $1::date
           AND od.created_at < ($1::date + INTERVAL '1 month')
           AND ($2::text IS NULL OR s.department = $2)
           AND ($3::text IS NULL OR s.year = $3)
           AND ($4::text IS NULL OR s.section = $4)
         ORDER BY od.created_at DESC, od.od_id DESC`,
        [monthStart, filters.department, filters.year, filters.section]
    );
    return result.rows;
};

/**
 * POST /api/reports/excel
 * Generate and download monthly Excel report (Faculty only)
 * Body: { month: 'YYYY-MM', department?: string, year?: string, section?: string }
 */
router.post('/excel', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const { month } = req.body || {};
        validateMonth(month);
        const records = await getMonthlyRecords(month, getFilters(req.body));
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Monthly OD Records');
        worksheet.columns = [
            { header: 'OD ID', key: 'od_id', width: 12 },
            { header: 'Registration Number', key: 'registration_number', width: 20 },
            { header: 'Register Number', key: 'register_number', width: 18 },
            { header: 'Student Name', key: 'student_name', width: 24 },
            { header: 'Department', key: 'department', width: 18 },
            { header: 'Year', key: 'year', width: 12 },
            { header: 'Section', key: 'section', width: 12 },
            { header: 'Event Details', key: 'event_details', width: 40 },
            { header: 'OD Status', key: 'od_status', width: 14 },
            { header: 'Certificate Submitted', key: 'certificate_submitted', width: 22 },
            { header: 'Certificate File', key: 'file_name', width: 32 },
            { header: 'Submitted At', key: 'submitted_at', width: 24 },
        ];
        records.forEach((record) => worksheet.addRow({
            ...record,
            certificate_submitted: record.certificate_id ? 'Yes' : 'No',
            submitted_at: record.submitted_at || '',
        }));
        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="od-report-${month}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/reports/certificates-zip
 * Bulk download certificates as ZIP (Faculty only)
 * Body: { month: 'YYYY-MM', department?: string, year?: string, section?: string }
 * Filename format: {register_number}_{registration_number}.{ext}
 */
router.post('/certificates-zip', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const { month } = req.body || {};
        validateMonth(month);
        const certificates = await Certificate.getByMonth(month, getFilters(req.body));
        const zip = new AdmZip();
        for (const certificate of certificates) {
            try {
                await access(certificate.file_path);
                const extension = path.extname(certificate.file_name).toLowerCase() ||
                    `.${String(certificate.file_type || '').split('/').pop()}`;
                const fileName = `${certificate.register_number}_${certificate.registration_number}${extension}`;
                zip.addLocalFile(certificate.file_path, '', fileName);
            } catch {
                // Missing files are omitted; the database record remains visible in reports.
            }
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="certificates-${month}.zip"`);
        res.send(zip.toBuffer());
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/reports/monthly-summary
 * Get monthly data summary (Faculty only)
 */
router.get('/monthly-summary', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const { month } = req.query;
        validateMonth(month);
        const records = await getMonthlyRecords(month, getFilters(req.query));
        const certificates = await Certificate.getByMonth(month, getFilters(req.query));
        const submittedOdIds = new Set(certificates.map((certificate) => String(certificate.od_id)));
        const missingRecords = records.filter((record) => !record.certificate_id);
        res.json({
            month,
            total_od_records: records.length,
            certificates_submitted: submittedOdIds.size,
            certificates_missing: missingRecords.length,
            records,
            missing_records: missingRecords,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
