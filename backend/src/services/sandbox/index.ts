/**
 * Sandbox API Service
 * Handles all Sandbox.co.in API integrations
 * - Automatic token refresh
 * - Retry on auth failures
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';

class SandboxClient {
    private client: AxiosInstance;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: env.sandbox.baseUrl,
            timeout: 30000,
        });
    }

    /**
     * Authenticate with Sandbox API
     * Token valid for 24 hours
     */
    async authenticate(): Promise<void> {
        try {
            logger.info('[Sandbox] Authenticating...');

            const response = await axios.post(
                `${env.sandbox.baseUrl}/authenticate`,
                {},
                {
                    headers: {
                        'x-api-key': env.sandbox.apiKey,
                        'x-api-secret': env.sandbox.apiSecret,
                        'x-api-version': '1.0',
                    },
                }
            );

            if (response.data?.access_token) {
                this.accessToken = response.data.access_token;
                // Token valid for 24 hours, refresh after 23 hours
                this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
                logger.info('[Sandbox] Authentication successful');
            } else {
                throw new Error('No access token in response');
            }
        } catch (error: any) {
            logger.error('[Sandbox] Authentication failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if token is expired or about to expire
     */
    private isTokenExpired(): boolean {
        if (!this.accessToken || !this.tokenExpiry) return true;
        // Refresh 5 minutes before expiry
        return new Date() >= new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000);
    }

    /**
     * Ensure valid token before API call
     */
    private async ensureToken(): Promise<void> {
        if (!this.isTokenExpired()) return;

        // Prevent concurrent refresh attempts
        if (this.isRefreshing) {
            await this.refreshPromise;
            return;
        }

        this.isRefreshing = true;
        this.refreshPromise = this.authenticate();

        try {
            await this.refreshPromise;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    /**
     * Get headers with access token
     */
    private getHeaders(): Record<string, string> {
        return {
            'Authorization': this.accessToken || '',
            'x-api-key': env.sandbox.apiKey,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
        };
    }

    /**
     * Execute API request with automatic token refresh
     */
    async request<T>(
        method: 'GET' | 'POST',
        endpoint: string,
        data?: any,
        config?: AxiosRequestConfig
    ): Promise<T> {
        await this.ensureToken();

        const requestConfig: AxiosRequestConfig = {
            method,
            url: endpoint,
            headers: this.getHeaders(),
            ...config,
        };

        if (method === 'POST' && data) {
            requestConfig.data = data;
        } else if (method === 'GET' && data) {
            requestConfig.params = data;
        }

        try {
            const response = await this.client.request<T>(requestConfig);
            return response.data;
        } catch (error: any) {
            // Log full error details
            if (error.response) {
                logger.error(`[Sandbox] API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                logger.error(`[Sandbox] No response received: ${error.message}`);
            } else {
                logger.error(`[Sandbox] Request setup error: ${error.message}`);
            }

            // Retry on 403 (token expired)
            if (error.response?.status === 403 &&
                error.response?.data?.message?.includes('Insufficient privilege')) {
                logger.warn('[Sandbox] Token expired, refreshing...');
                this.accessToken = null;
                await this.ensureToken();

                requestConfig.headers = this.getHeaders();
                const retryResponse = await this.client.request<T>(requestConfig);
                return retryResponse.data;
            }

            throw error;
        }
    }

    // ======================
    // Aadhaar OKYC Methods
    // ======================

    /**
     * Generate Aadhaar OTP
     */
    async generateAadhaarOtp(
        aadhaarNumber: string,
        consent: string = 'Y',
        reason: string = 'KYC Verification'
    ) {
        logger.info(`[Sandbox] Generating Aadhaar OTP for: XXXX${aadhaarNumber.slice(-4)}`);

        return this.request('POST', '/kyc/aadhaar/okyc/otp', {
            '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
            aadhaar_number: aadhaarNumber,
            consent,
            reason,
        });
    }

    /**
     * Verify Aadhaar OTP
     */
    async verifyAadhaarOtp(referenceId: string, otp: string) {
        logger.info(`[Sandbox] Verifying Aadhaar OTP, ref: ${referenceId}`);

        return this.request('POST', '/kyc/aadhaar/okyc/otp/verify', {
            '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
            reference_id: referenceId,
            otp,
        });
    }

    // ======================
    // DigiLocker SDK Methods
    // ======================

    /**
     * Create DigiLocker session
     * @see https://developer.sandbox.co.in/api-reference/kyc/digilocker-sdk/create-session
     */
    async createDigilockerSession(
        flow: 'signin' | 'signup' = 'signin',
        docTypes: ('aadhaar' | 'pan' | 'driving_license')[] = ['aadhaar', 'pan']
    ) {
        logger.info(`[Sandbox] Creating DigiLocker session: ${flow}, docs: ${docTypes.join(', ')}`);

        return this.request('POST', '/kyc/digilocker-sdk/sessions/create', {
            '@entity': 'in.co.sandbox.kyc.digilocker.sdk.session.request',
            flow,
            doc_types: docTypes,
        });
    }

    /**
     * Get DigiLocker session status
     * Status can be: created, initialized, authorized, succeeded, failed, expired
     * @see https://developer.sandbox.co.in/api-reference/kyc/digilocker-sdk/get-session-status
     */
    async getDigilockerSessionStatus(sessionId: string) {
        logger.info(`[Sandbox] Getting DigiLocker status: ${sessionId}`);

        return this.request('GET', `/kyc/digilocker-sdk/sessions/${sessionId}/status`);
    }

    /**
     * Get DigiLocker document
     * Document can only be fetched if user has provided consent
     * @see https://developer.sandbox.co.in/api-reference/kyc/digilocker-sdk/get-document
     */
    async getDigilockerDocument(sessionId: string, docType: 'aadhaar' | 'pan' | 'driving_license') {
        logger.info(`[Sandbox] Getting DigiLocker document: ${docType} from session ${sessionId}`);

        return this.request('GET', `/kyc/digilocker-sdk/sessions/${sessionId}/documents/${docType}`);
    }

    // ======================
    // PAN Methods
    // ======================

    /**
     * Verify PAN
     */
    async verifyPan(
        panNumber: string,
        nameAsPerPan: string = 'NA',
        dateOfBirth: string = '01/01/1990',
        consent: string = 'Y',
        reason: string = 'KYC Verification'
    ) {
        logger.info(`[Sandbox] Verifying PAN: ${panNumber}`);

        return this.request('POST', '/kyc/pan/verify', {
            '@entity': 'in.co.sandbox.kyc.pan_verification.request',
            pan: panNumber,
            name_as_per_pan: nameAsPerPan,
            date_of_birth: dateOfBirth,
            consent,
            reason,
        });
    }

    /**
     * Check PAN-Aadhaar linking status
     */
    async checkPanAadhaarLink(
        panNumber: string,
        aadhaarNumber: string,
        consent: string = 'Y',
        reason: string = 'Verification'
    ) {
        logger.info(`[Sandbox] Checking PAN-Aadhaar link: ${panNumber}`);

        return this.request('POST', '/kyc/pan-aadhaar/status', {
            '@entity': 'in.co.sandbox.kyc.pan_aadhaar_link.request',
            pan: panNumber,
            aadhaar: aadhaarNumber,
            consent,
            reason,
        });
    }

    // ======================
    // Bank Methods
    // ======================

    /**
     * Verify IFSC code
     */
    async verifyIfsc(ifsc: string) {
        logger.info(`[Sandbox] Verifying IFSC: ${ifsc}`);

        return this.request('GET', `/bank/${ifsc}`);
    }

    /**
     * Bank account verification (Penniless/IMPS)
     */
    async verifyBankAccountPenniless(
        ifsc: string,
        accountNumber: string,
        name?: string,
        mobile?: string
    ) {
        logger.info(`[Sandbox] Verifying bank (penniless): ${ifsc} / ${accountNumber.slice(-4)}`);

        const params: Record<string, string> = {};
        if (name) params.name = name;
        if (mobile) params.mobile = mobile;

        return this.request(
            'GET',
            `/bank/${ifsc}/accounts/${accountNumber}/penniless-verify`,
            Object.keys(params).length > 0 ? params : undefined
        );
    }

    /**
     * Bank account verification (Penny Drop)
     */
    async verifyBankAccountPenny(
        ifsc: string,
        accountNumber: string,
        name?: string,
        mobile?: string
    ) {
        logger.info(`[Sandbox] Verifying bank (penny): ${ifsc} / ${accountNumber.slice(-4)}`);

        const params: Record<string, string> = {};
        if (name) params.name = name;
        if (mobile) params.mobile = mobile;

        return this.request(
            'GET',
            `/bank/${ifsc}/accounts/${accountNumber}/verify`,
            Object.keys(params).length > 0 ? params : undefined
        );
    }

    // ======================
    // MCA Methods
    // ======================

    /**
     * Verify Company/LLP by CIN/LLPIN
     * @see https://developer.sandbox.co.in/api-reference/kyc/mca/company-master-data
     * @param cinOrLlpin - CIN (21 chars) for Company or LLPIN (7 chars, e.g., ABC-1234) for LLP
     */
    async verifyCompanyMasterData(
        cinOrLlpin: string,
        consent: string = 'y',
        reason: string = 'Company verification for DSA onboarding'
    ) {
        logger.info(`[Sandbox] Verifying company/LLP: ${cinOrLlpin}`);

        return this.request('POST', '/mca/company/master-data/search', {
            '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
            id: cinOrLlpin,
            consent,
            reason,
        });
    }

    // ======================
    // Utility Methods
    // ======================

    /**
     * Force refresh token (for testing)
     */
    async forceRefreshToken(): Promise<void> {
        this.accessToken = null;
        this.tokenExpiry = null;
        await this.authenticate();
    }

    /**
     * Get token status (for debugging)
     */
    getTokenStatus() {
        return {
            hasToken: !!this.accessToken,
            expiresAt: this.tokenExpiry?.toISOString() || null,
            isExpired: this.isTokenExpired(),
        };
    }
}

// Export singleton instance
export const sandboxClient = new SandboxClient();
export default sandboxClient;
