import apiClient from './api';

export const studentService = {
    // Get authenticated student's profile
    getMyInfo: async () => {
        try {
            const response = await apiClient.get('/students/me');
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch student info' };
        }
    },

    // Get authenticated student's OD records
    getMyODRecords: async (limit = 50, offset = 0) => {
        try {
            const response = await apiClient.get('/students/me/od-records', {
                params: { limit, offset }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch OD records' };
        }
    },

    // Get authenticated student's certificates
    getMyCertificates: async (limit = 50, offset = 0) => {
        try {
            const response = await apiClient.get('/students/me/certificates', {
                params: { limit, offset }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch certificates' };
        }
    },

    // Search students (for Student Rep use)
    searchStudents: async (query, limit = 20, offset = 0) => {
        try {
            const response = await apiClient.get('/students', {
                params: { q: query, limit, offset }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to search students' };
        }
    },
};

export default studentService;
