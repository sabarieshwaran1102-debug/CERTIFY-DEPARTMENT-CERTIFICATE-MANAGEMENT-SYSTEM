import apiClient from './api';

// TODO: Implement after backend endpoints are ready

export const authService = {
    login: async (credentials) => {
        // Pending authentication method confirmation
        throw new Error('Authentication method not yet configured');
    },

    logout: async () => {
        return apiClient.post('/auth/logout');
    },

    getCurrentUser: async () => {
        return apiClient.get('/auth/me');
    },
};

export default authService;
