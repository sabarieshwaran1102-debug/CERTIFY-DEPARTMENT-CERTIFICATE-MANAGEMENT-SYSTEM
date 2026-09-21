import apiClient from './api';

const managementService = {
    // Departments
    getDepartments: async (params = {}) => (await apiClient.get('/departments', { params })).data,
    createDepartment: async (data) => (await apiClient.post('/departments', data)).data,
    updateDepartment: async (id, data) => (await apiClient.patch(`/departments/${id}`, data)).data,

    // Academic Years
    getAcademicYears: async (params = {}) => (await apiClient.get('/academic-years', { params })).data,
    createAcademicYear: async (data) => (await apiClient.post('/academic-years', data)).data,
    updateAcademicYear: async (id, data) => (await apiClient.patch(`/academic-years/${id}`, data)).data,
    activateAcademicYear: async (id) => (await apiClient.post(`/academic-years/${id}/activate`)).data,
    deactivateAcademicYear: async (id) => (await apiClient.post(`/academic-years/${id}/deactivate`)).data,
    promoteStudents: async (sourceYearId, { target_academic_year_id, class_mappings, notes }) =>
        (await apiClient.post(`/academic-years/${sourceYearId}/promote`, { target_academic_year_id, class_mappings, notes })).data,
    getPromotionHistory: async (yearId) => (await apiClient.get(`/academic-years/${yearId}/promotions`)).data,

    // Classes
    getClasses: async (params = {}) => (await apiClient.get('/classes', { params })).data,
    createClass: async (data) => (await apiClient.post('/classes', data)).data,
    updateClass: async (id, data) => (await apiClient.patch(`/classes/${id}`, data)).data,
    getClass: async (id) => (await apiClient.get(`/classes/${id}`)).data,

    // Students (paginated)
    getStudents: async (params = {}) => (await apiClient.get('/students', { params })).data,
    getStudent: async (id) => (await apiClient.get(`/students/${id}`)).data,
    createStudent: async (data) => (await apiClient.post('/students', data)).data,
    updateStudent: async (id, data) => (await apiClient.patch(`/students/${id}`, data)).data,
    deactivateStudent: async (id, reason) => (await apiClient.patch(`/students/${id}/deactivate`, { reason })).data,
    permanentDeleteStudent: async (id, reason) => (await apiClient.delete(`/students/${id}`, { data: { reason } })).data,

    // Bulk import — new session-based flow
    previewImport: async (classId, file) => {
        const form = new FormData();
        form.append('class_id', classId);
        form.append('file', file);
        return (await apiClient.post('/students/import/preview', form)).data;
    },
    confirmImport: async (sessionId) => {
        return (await apiClient.post('/students/import/confirm', { session_id: sessionId })).data;
    },

    // Advisor
    getFaculty: async () => (await apiClient.get('/faculty')).data,
    getAdvisorHistory: async (classId) => (await apiClient.get(`/classes/${classId}/advisor`)).data,
    assignAdvisor: async (classId, data) => (await apiClient.post(`/classes/${classId}/advisor`, data)).data,

    // Class Representatives
    getRepresentatives: async (classId) => (await apiClient.get(`/classes/${classId}/representatives`)).data,
    assignRepresentative: async (classId, studentId) =>
        (await apiClient.post(`/classes/${classId}/representatives`, { student_id: studentId })).data,
    removeRepresentative: async (classId, studentId) =>
        (await apiClient.delete(`/classes/${classId}/representatives/${studentId}`)).data,
    createCRAccount: async (classId, studentId) =>
        (await apiClient.post(`/classes/${classId}/representative-accounts`, { student_id: studentId })).data,

    // Audit
    getAuditLog: async (params = {}) => (await apiClient.get('/audit', { params })).data,
    getAuditForTarget: async (entity, id) => (await apiClient.get(`/audit/${entity}/${id}`)).data,
};

export default managementService;