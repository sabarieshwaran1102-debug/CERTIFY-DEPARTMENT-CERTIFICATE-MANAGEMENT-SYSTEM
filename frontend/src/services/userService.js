import apiClient from './api';

const handleError = (error, fallback) => {
    throw error.response?.data || { error: fallback };
};

export const userService = {
    getFaculty: async () => {
        try {
            const response = await apiClient.get('/users/coordinating-faculty');
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to load faculty accounts');
        }
    },

    createFaculty: async (username, password) => {
        try {
            const response = await apiClient.post('/users/coordinating-faculty', { username, password });
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to create faculty account');
        }
    },

    updateFaculty: async (userId, updates) => {
        try {
            const response = await apiClient.patch(`/users/coordinating-faculty/${userId}`, updates);
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to update faculty account');
        }
    },

    getRepresentatives: async () => {
        try {
            const response = await apiClient.get('/users/student-representatives');
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to load representative accounts');
        }
    },

    createRepresentative: async (username, password) => {
        try {
            const response = await apiClient.post('/users/student-representatives', { username, password });
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to create representative account');
        }
    },

    updateRepresentative: async (userId, updates) => {
        try {
            const response = await apiClient.patch(`/users/student-representatives/${userId}`, updates);
            return response.data;
        } catch (error) {
            return handleError(error, 'Failed to update representative account');
        }
    },
};

export default userService;