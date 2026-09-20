import apiClient from './api';

const odsService = {
  getODs: async (params = {}) => {
    const response = await apiClient.get('/ods', { params });
    return response.data;
  },
  getOD: async (id) => {
    const response = await apiClient.get(`/ods/${id}`);
    return response.data;
  },
  createOD: async (data) => {
    const response = await apiClient.post('/ods', data);
    return response.data;
  },
  cancelOD: async (id, reason) => {
    const response = await apiClient.post(`/ods/${id}/cancel`, { reason });
    return response.data;
  },
};

export default odsService;
