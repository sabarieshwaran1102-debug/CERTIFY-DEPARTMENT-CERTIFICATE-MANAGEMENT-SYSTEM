import apiClient from './api';

const odCertService = {
  // Submit (first time) or replace a certificate for a Phase-3A OD
  submit: async (odId, file, opts = {}) => {
    const form = new FormData();
    form.append('od_id', String(odId));
    form.append('file', file);
    if (opts.studentId)  form.append('student_id',  String(opts.studentId));
    if (opts.lateReason) form.append('late_reason', opts.lateReason);
    const response = await apiClient.post('/od-certificates', form);
    return response.data;
  },

  // List certificates (paginated, role-scoped)
  getAll: async (params = {}) => {
    const response = await apiClient.get('/od-certificates', { params });
    return response.data;
  },

  // Certificates needing staff review
  getPending: async (params = {}) => {
    const response = await apiClient.get('/od-certificates/pending', { params });
    return response.data;
  },

  // All certs for a specific OD
  getForOd: async (odId) => {
    const response = await apiClient.get(`/od-certificates/ods/${odId}`);
    return response.data;
  },

  // Single certificate detail
  getById: async (id) => {
    const response = await apiClient.get(`/od-certificates/${id}`);
    return response.data;
  },

  // Download file
  download: async (id) => {
    const response = await apiClient.get(`/od-certificates/${id}/download`, { responseType: 'blob' });
    return response.data;
  },

  // Version history
  getVersions: async (id) => {
    const response = await apiClient.get(`/od-certificates/${id}/versions`);
    return response.data;
  },

  // Staff actions
  verify:       async (id)          => (await apiClient.patch(`/od-certificates/${id}/verify`)).data,
  reject:       async (id, reason)  => (await apiClient.patch(`/od-certificates/${id}/reject`,       { reason })).data,
  approveLate:  async (id)          => (await apiClient.patch(`/od-certificates/${id}/approve-late`)).data,
  rejectLate:   async (id, reason)  => (await apiClient.patch(`/od-certificates/${id}/reject-late`,  { reason })).data,
};

export default odCertService;
