/**
 * API Service
 * Axios instance with interceptors for auth and error handling
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

// Create axios instance
export const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ error?: string; code?: string }>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 (token expired) - try refresh
        if (error.response?.status === 401 &&
            error.response?.data?.code === 'TOKEN_EXPIRED' &&
            !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const { refreshToken, setTokens, logout } = useAuthStore.getState();

                if (!refreshToken) {
                    logout();
                    window.location.href = '/';
                    return Promise.reject(error);
                }

                // Try to refresh tokens
                const response = await axios.post('/api/auth/refresh-token', {
                    refreshToken,
                });

                if (response.data.success) {
                    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
                    setTokens(newAccessToken, newRefreshToken);

                    // Retry original request
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed - logout
                useAuthStore.getState().logout();
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// API methods
export const authApi = {
    sendOtp: (phone: string, entityType?: string, companySubType?: string, email?: string) =>
        api.post('/auth/send-otp', { phone, entityType, companySubType, email }),

    verifyOtp: (phone: string, otp: string, entityType: string, companySubType?: string) =>
        api.post('/auth/verify-otp', { phone, otp, entityType, companySubType }),

    refreshToken: (refreshToken: string) =>
        api.post('/auth/refresh-token', { refreshToken }),

    logout: () => api.post('/auth/logout'),

    me: () => api.get('/auth/me'),
};

export const applicationApi = {
    get: () => api.get('/application'),
    getSteps: () => api.get('/application/steps'),
    getStatus: () => api.get('/application/status'),
    updateEntityType: (entityType: string, companySubType?: string) =>
        api.patch('/application/entity-type', { entityType, companySubType }),
};

export const kycApi = {
    sendAadhaarOtp: (aadhaar: string) =>
        api.post('/kyc/aadhaar/send-otp', { aadhaar }),

    verifyAadhaarOtp: (referenceId: string, otp: string, aadhaarNumber: string) =>
        api.post('/kyc/aadhaar/verify-otp', { referenceId, otp, aadhaarNumber }),

    createDigilockerSession: (flow?: string, docTypes?: string[]) =>
        api.post('/kyc/digilocker/create-session', { flow, docTypes }),

    getDigilockerStatus: (sessionId: string) =>
        api.get(`/kyc/digilocker/status/${sessionId}`),

    fetchDigilockerDocuments: (sessionId: string) =>
        api.post('/kyc/digilocker/fetch-documents', { sessionId }),

    verifyPan: (pan: string) =>
        api.post('/kyc/pan/verify', { pan }),

    uploadSelfie: (image: string) =>
        api.post('/kyc/selfie', { image }),

    completeKyc: () => api.post('/kyc/complete'),
};

export const bankApi = {
    verifyIfsc: (ifsc: string) => api.get(`/bank/verify-ifsc/${ifsc}`),

    verify: (accountNumber: string, confirmAccountNumber: string, ifsc: string) =>
        api.post('/bank/verify', { accountNumber, confirmAccountNumber, ifsc }),

    complete: () => api.post('/bank/complete'),
};

export const agreementApi = {
    generate: () => api.post('/agreement/generate'),
    // E-Stamp and E-Sign can take 2+ minutes, use extended timeout
    estamp: () => api.post('/agreement/estamp', {}, { timeout: 180000 }), // 3 minutes
    esign: () => api.post('/agreement/esign', {}, { timeout: 180000 }), // 3 minutes
    getStatus: () => api.get('/agreement/status'),
    markSigned: () => api.post('/agreement/mark-signed'),
    download: () => api.get('/agreement/download', { responseType: 'blob' }),
};

export default api;
