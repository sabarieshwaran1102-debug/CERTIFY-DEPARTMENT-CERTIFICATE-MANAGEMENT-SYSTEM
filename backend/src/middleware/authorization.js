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
            return next(new AppError('Resource not found', 'NOT_FOUND', 404));
        }

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
