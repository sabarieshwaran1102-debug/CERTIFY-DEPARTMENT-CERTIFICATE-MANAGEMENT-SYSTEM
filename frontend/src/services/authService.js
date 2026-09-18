import apiClient from './api';

export const authService = {
    login: async (credentials = {}) => {
        try {
            const payload = {
                username: credentials.username,
                password: credentials.password,
                role: credentials.role,
            };

            const response = await apiClient.post('/auth/login', payload);
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Login failed' };
        }
    },

    logout: async () => {
        try {
            const response = await apiClient.post('/auth/logout');
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Logout failed' };
        }
    },

    getCurrentUser: async () => {
        try {
            const response = await apiClient.get('/auth/me');
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch current user' };
        }
    },
};

export default authService;
