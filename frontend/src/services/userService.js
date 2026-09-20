import apiClient from './api';

const handleError = (error, fallback) => {
    throw error.response?.data || { error: fallback };
};

export const userService = {
    getFaculty: async () => {
        try { return (await apiClient.get('/users/coordinating-faculty')).data; }
        catch (e) { return handleError(e, 'Failed to load faculty accounts'); }
    },
    createFaculty: async (username, password) => {
        try { return (await apiClient.post('/users/coordinating-faculty', { username, password })).data; }
        catch (e) { return handleError(e, 'Failed to create faculty account'); }
    },
    updateFaculty: async (userId, updates) => {
        try { return (await apiClient.patch(`/users/coordinating-faculty/${userId}`, updates)).data; }
        catch (e) { return handleError(e, 'Failed to update faculty account'); }
    },
    getClassAdvisors: async () => {
        try { return (await apiClient.get('/users/class-advisors')).data; }
        catch (e) { return handleError(e, 'Failed to load class advisors'); }
    },
    createClassAdvisor: async (username, password) => {
        try { return (await apiClient.post('/users/class-advisors', { username, password })).data; }
        catch (e) { return handleError(e, 'Failed to create class advisor account'); }
    },
    updateClassAdvisor: async (userId, updates) => {
        try { return (await apiClient.patch(`/users/class-advisors/${userId}`, updates)).data; }
        catch (e) { return handleError(e, 'Failed to update class advisor account'); }
    },
    getRepresentatives: async () => {
        try { return (await apiClient.get('/users/student-representatives')).data; }
        catch (e) { return handleError(e, 'Failed to load representative accounts'); }
    },
    createRepresentative: async (username, password) => {
        try { return (await apiClient.post('/users/student-representatives', { username, password })).data; }
        catch (e) { return handleError(e, 'Failed to create representative account'); }
    },
    updateRepresentative: async (userId, updates) => {
        try { return (await apiClient.patch(`/users/student-representatives/${userId}`, updates)).data; }
        catch (e) { return handleError(e, 'Failed to update representative account'); }
    },
};

export default userService;