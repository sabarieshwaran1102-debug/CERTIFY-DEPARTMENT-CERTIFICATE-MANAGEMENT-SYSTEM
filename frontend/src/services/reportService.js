import apiClient from './api';

export const reportService = {
    generateExcelReport: async (month, filters = {}) => {
        return apiClient.post('/reports/excel', 
            { month, ...filters },
            { responseType: 'blob' }
        );
    },

    downloadCertificatesZip: async (month, filters = {}) => {
        return apiClient.post('/reports/certificates-zip',
            { month, ...filters },
            { responseType: 'blob' }
        );
    },

    getMonthlySummary: async (month, filters = {}) => {
        return apiClient.get('/reports/monthly-summary', 
            { params: { month, ...filters } }
        );
    },
};

export default reportService;
