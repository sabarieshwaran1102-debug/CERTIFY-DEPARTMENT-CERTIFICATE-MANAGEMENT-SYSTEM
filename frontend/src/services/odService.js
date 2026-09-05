import apiClient from './api';

export const odService = {
    // Register a new OD record (Student Rep only)
    registerOD: async (studentId, eventDetails) => {
        try {
            const response = await apiClient.post('/od-records', {
                student_id: studentId,
                event_details: eventDetails
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to register OD' };
        }
    },

    // Get list of OD records
    getODRecords: async (filters = {}, limit = 50, offset = 0) => {
        try {
            const response = await apiClient.get('/od-records', {
                params: { ...filters, limit, offset }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch OD records' };
        }
    },

    // Get a specific OD record by ID
    getODRecord: async (odId) => {
        try {
            const response = await apiClient.get(`/od-records/${odId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch OD record' };
        }
    },
};

export default odService;
