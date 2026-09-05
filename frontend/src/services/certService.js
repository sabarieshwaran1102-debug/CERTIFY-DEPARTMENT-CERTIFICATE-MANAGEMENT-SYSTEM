import apiClient from './api';

export const certService = {
    // Submit a certificate for an OD record
    submitCertificate: async (registrationNumber, file) => {
        try {
            const formData = new FormData();
            formData.append('registration_number', registrationNumber);
            formData.append('file', file);
            
            const response = await apiClient.post('/certificates', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to submit certificate' };
        }
    },

    // Download a certificate file
    downloadCertificate: async (certId) => {
        try {
            const response = await apiClient.get(`/certificates/${certId}/download`, {
                responseType: 'blob',
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to download certificate' };
        }
    },

    // Get certificates list (Faculty only)
    getCertificates: async (filters = {}, limit = 50, offset = 0) => {
        try {
            const response = await apiClient.get('/certificates', {
                params: { ...filters, limit, offset }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { error: 'Failed to fetch certificates' };
        }
    },
};

export default certService;
