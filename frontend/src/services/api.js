import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Token helpers - sessionStorage clears on tab/browser close.
export const tokenStore = {
    get: () => sessionStorage.getItem('token'),
    set: (t) => sessionStorage.setItem('token', t),
    remove: () => sessionStorage.removeItem('token'),
};

// Request interceptor - attach JWT and fix FormData Content-Type.
apiClient.interceptors.request.use(
    (config) => {
        const token = tokenStore.get();
        if (token) {
            config.headers.Authorization = Bearer ;
        }
        // When body is FormData, remove the default Content-Type so the browser
        // sets the correct multipart/form-data boundary automatically.
        // Manually setting 'multipart/form-data' without the boundary breaks multer.
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - clear token and redirect on 401.
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            tokenStore.remove();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
