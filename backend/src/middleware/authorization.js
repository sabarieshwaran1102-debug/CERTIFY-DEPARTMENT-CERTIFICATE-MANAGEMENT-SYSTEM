import pool from '../config/database.js';
import { AppError } from './errorHandler.js';

export const MANAGEMENT_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];
export const GLOBAL_MANAGEMENT_ROLES = ['super_admin', 'admin'];

export const requireManagementRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return next(new AppError('Insufficient permissions for management action', 'FORBIDDEN', 403));
        }
        return next();
    };
};

export const requireGlobalManagement = requireManagementRole(...GLOBAL_MANAGEMENT_ROLES);

export const requireStudentOwnership = (fieldName = 'student_id') => {
    return (req, res, next) => {
        if (req.user.role !== 'student') {
            return next(new AppError('Only students can perform this action', 'FORBIDDEN', 403));
        }
        let resourceStudentId = null;
        if (req.body && req.body[fieldName]) resourceStudentId = req.body[fieldName];
        else if (req.params && req.params[fieldName]) resourceStudentId = req.params[fieldName];
        else if (req.query && req.query[fieldName]) resourceStudentId = req.query[fieldName];
        else if (req.resource && req.resource[fieldName]) resourceStudentId = req.resource[fieldName];
        if (!resourceStudentId) return next(new AppError('Resource not found', 'NOT_FOUND', 404));
        if (String(resourceStudentId) !== String(req.user.student_id)) {
            return next(new AppError('You do not have access to this resource', 'FORBIDDEN', 403));
        }
        return next();
    };
};

export const requireStudentRepRole = (req, res, next) => {
    if (req.user.role !== 'student_representative') {
        return next(new AppError('Only student representatives can perform this action', 'FORBIDDEN', 403));
    }
    return next();
};

export const requireFacultyRole = (req, res, next) => {
    if (req.user.role !== 'coordinating_faculty') {
        return next(new AppError('Only coordinating faculty can perform this action', 'FORBIDDEN', 403));
    }
    return next();
};

/**
 * Middleware: require the caller to be a class_representative assigned to the
 * class referenced by req.params.classId or req.body.class_id.
 * Attaches req.crClassId for downstream use.
 */
export const requireCRForClass = async (req, res, next) => {
    try {
        if (req.user.role !== 'class_representative') {
            return next(new AppError('Only class representatives can perform this action', 'FORBIDDEN', 403));
        }
        if (!req.user.class_id) {
            return next(new AppError('Class representative is not assigned to a class', 'FORBIDDEN', 403));
        }
        const classId = req.params.classId || req.params.id || req.body?.class_id;
        if (classId && String(classId) !== String(req.user.class_id)) {
            return next(new AppError('You do not have access to this class', 'FORBIDDEN', 403));
        }
        req.crClassId = req.user.class_id;
        return next();
    } catch (err) {
        return next(err);
    }
};

/**
 * Load full user including class_id into req.user.
 * Called after verifyToken to attach class_id for CR scoping.
 */
export const loadUserClassId = async (req, res, next) => {
    try {
        if (req.user?.role === 'class_representative' && req.user.class_id === undefined) {
            const result = await pool.query('SELECT class_id FROM users WHERE user_id = $1', [req.user.user_id]);
            req.user.class_id = result.rows[0]?.class_id || null;
        }
        return next();
    } catch (err) {
        return next(err);
    }
};