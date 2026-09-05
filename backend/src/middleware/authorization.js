import { AppError } from './errorHandler.js';

export const requireStudentOwnership = (fieldName = 'student_id') => {
    return (req, res, next) => {
        if (req.user.role !== 'student') {
            throw new AppError('Only students can perform this action', 'FORBIDDEN', 403);
        }

        // Extract student_id from different sources
        let resourceStudentId = null;

        if (req.body && req.body[fieldName]) {
            resourceStudentId = req.body[fieldName];
        } else if (req.params && req.params[fieldName]) {
            resourceStudentId = req.params[fieldName];
        } else if (req.query && req.query[fieldName]) {
            resourceStudentId = req.query[fieldName];
        } else if (req.resource && req.resource[fieldName]) {
            resourceStudentId = req.resource[fieldName];
        }

        if (!resourceStudentId) {
            throw new AppError('Resource not found', 'NOT_FOUND', 404);
        }

        if (String(resourceStudentId) !== String(req.user.student_id)) {
            throw new AppError('You do not have access to this resource', 'FORBIDDEN', 403);
        }

        next();
    };
};

export const requireStudentRepRole = (req, res, next) => {
    if (req.user.role !== 'student_representative') {
        throw new AppError('Only student representatives can perform this action', 'FORBIDDEN', 403);
    }
    next();
};

export const requireFacultyRole = (req, res, next) => {
    if (req.user.role !== 'coordinating_faculty') {
        throw new AppError('Only coordinating faculty can perform this action', 'FORBIDDEN', 403);
    }
    next();
};
