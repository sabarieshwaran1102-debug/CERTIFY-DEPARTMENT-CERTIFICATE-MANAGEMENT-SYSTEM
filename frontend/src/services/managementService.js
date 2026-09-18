import apiClient from './api';

const managementService = {
    getDepartments: async () => (await apiClient.get('/departments')).data,
    createDepartment: async (data) => (await apiClient.post('/departments', data)).data,
    updateDepartment: async (id, data) => (await apiClient.patch(`/departments/${id}`, data)).data,
    getAcademicYears: async () => (await apiClient.get('/academic-years')).data,
    createAcademicYear: async (data) => (await apiClient.post('/academic-years', data)).data,
    updateAcademicYear: async (id, data) => (await apiClient.patch(`/academic-years/${id}`, data)).data,
    getClasses: async () => (await apiClient.get('/classes')).data,
    createClass: async (data) => (await apiClient.post('/classes', data)).data,
    updateClass: async (id, data) => (await apiClient.patch(`/classes/${id}`, data)).data,
    getClass: async (id) => (await apiClient.get(`/classes/${id}`)).data,
    getStudents: async (params = {}) => (await apiClient.get('/students', { params })).data,
    createStudent: async (data) => (await apiClient.post('/students', data)).data,
    updateStudent: async (id, data) => (await apiClient.patch(`/students/${id}`, data)).data,
    deactivateStudent: async (id) => (await apiClient.patch(`/students/${id}/deactivate`)).data,
    getAdvisorHistory: async (id) => (await apiClient.get(`/classes/${id}/advisor`)).data,
    assignAdvisor: async (id, data) => (await apiClient.post(`/classes/${id}/advisor`, data)).data,
    getRepresentatives: async (id) => (await apiClient.get(`/classes/${id}/representatives`)).data,
    assignRepresentative: async (id, studentId) => (await apiClient.post(`/classes/${id}/representatives`, { student_id: studentId })).data,
    removeRepresentative: async (id, studentId) => (await apiClient.delete(`/classes/${id}/representatives/${studentId}`)).data,
    previewImport: async (classId, file) => {
        const form = new FormData();
        form.append('class_id', classId);
        form.append('file', file);
        return (await apiClient.post('/students/import', form)).data;
    },
    confirmImport: async (classId, rows) => {
        const form = new FormData();
        form.append('class_id', classId);
        form.append('confirm', 'true');
        form.append('rows', JSON.stringify(rows));
        return (await apiClient.post('/students/import', form)).data;
    },
};

export default managementService;
