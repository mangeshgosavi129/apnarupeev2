/**
 * SignDesk E-Sign API Service (eSign 2.1 V 3.1.0)
 * Configured for all entity types
 * 
 * Signing Flow:
 * 1. Second Party (KYC User) signs FIRST via invitation link (immediate)
 * 2. First Party (Company) signs SECOND via email (async)
 */
import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';

interface SecondPartyInfo {
    name: string;
    email: string;
    mobile: string;
    dob?: string;          // DD-MM-YYYY format
    gender?: 'M' | 'F';
    aadhaarLast4?: string;
}

interface FirstPartyInfo {
    name: string;
    email: string;
    mobile: string;
}

interface EsignParams {
    // Base64 stamped PDF from E-Stamp API
    documentContent: string;

    // Second Party (User/KYC) - Signs FIRST
    secondParty: SecondPartyInfo;

    // First Party (Company) - Signs SECOND via email
    firstParty?: FirstPartyInfo;

    // Return URL after signing
    returnUrl?: string;
}

interface EsignResult {
    success: boolean;
    referenceId?: string;
    docketId?: string;
    signingUrl?: string;       // User's signing URL
    companySignerEmail?: string;
    signerInfo?: any[];
    error?: string;
    errorCode?: string;
    rawResponse?: any;
}

class EsignService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: env.signdesk.esign.baseUrl,
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json',
                'x-parse-application-id': env.signdesk.esign.apiId,
                'x-parse-rest-api-key': env.signdesk.esign.apiKey,
            },
        });
    }

    /**
     * Generate unique reference ID
     */
    private generateRefId(): string {
        return `ESIGN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Get expiry date (30 days from now)
     */
    private getExpiryDate(days: number = 30): string {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    }

    /**
     * Extract year of birth from DOB string
     * Handles formats: "30-01-1999", "1999-01-30", "30/01/1999"
     */
    private extractYearOfBirth(dob?: string): string {
        if (!dob) return '1990';

        // Try to find 4-digit year
        const yearMatch = dob.match(/\b(19|20)\d{2}\b/);
        return yearMatch ? yearMatch[0] : '1990';
    }

    /**
     * Extract last 4 digits of Aadhaar
     */
    private extractLast4Aadhaar(aadhaarNumber?: string): string {
        if (!aadhaarNumber) return '0000';
        const digits = aadhaarNumber.replace(/\D/g, '');
        return digits.slice(-4) || '0000';
    }

    /**
     * Initiate E-Sign for Sequential Signing
     * Flow: Second Party (User) signs FIRST → First Party (Company) receives email
     */
    async initiateSign(params: EsignParams): Promise<EsignResult> {
        try {
            const referenceId = this.generateRefId();
            const docRefId = `doc_${Date.now()}`;

            if (!params.documentContent) {
                throw new Error('Stamped document content is required');
            }

            // Extract validation data for second party (user)
            const yearOfBirth = this.extractYearOfBirth(params.secondParty?.dob);
            const aadhaarLast4 = this.extractLast4Aadhaar(params.secondParty?.aadhaarLast4);

            // Default first party (company)
            const firstParty: FirstPartyInfo = params.firstParty || {
                name: env.firstParty.name || 'Graphsense Soolutions',
                email: env.firstParty.email || 'info@graphsensesolutions.com',
                mobile: env.firstParty.mobile || '9860023457',
            };

            // Build signers array - Second Party FIRST, First Party SECOND
            const signersInfo = [
                // ============ SIGNER 1: Second Party (User/KYC - Signs FIRST) ============
                {
                    document_to_be_signed: docRefId,
                    signer_position: {
                        appearance: 'bottom-left',  // User signs on bottom-left
                    },
                    signer_ref_id: `signer_user_${Date.now()}`,
                    signer_email: params.secondParty.email,
                    signer_name: params.secondParty.name,
                    signer_mobile: params.secondParty.mobile,
                    sequence: '1',  // Signs FIRST
                    page_number: 'all',
                    signature_type: 'aadhaar',
                    authentication_mode: 'email',
                    signer_validation_inputs: {
                        year_of_birth: yearOfBirth,
                        gender: params.secondParty?.gender || 'M',
                        name_as_per_aadhaar: params.secondParty.name,
                        last_four_digits_of_aadhaar: aadhaarLast4,
                    },
                    trigger_esign_request: 'true',
                },
                // ============ SIGNER 2: First Party (Company - Signs SECOND via email) ============
                {
                    document_to_be_signed: docRefId,
                    signer_position: {
                        appearance: 'bottom-right',  // Company signs on bottom-right
                    },
                    signer_ref_id: `signer_company_${Date.now()}`,
                    signer_email: firstParty.email,
                    signer_name: firstParty.name,
                    signer_mobile: firstParty.mobile,
                    sequence: '2',  // Signs SECOND (after user)
                    page_number: 'all',
                    signature_type: 'aadhaar',
                    authentication_mode: 'email',  // Receives signing link via email
                    trigger_esign_request: 'true',
                },
            ];

            // Build E-Sign payload
            const payload = {
                reference_id: referenceId,
                expiry_date: this.getExpiryDate(30),
                documents: [{
                    reference_doc_id: docRefId,
                    content_type: 'pdf',
                    content: params.documentContent,
                    signature_sequence: 'sequential',  // Sequential: User first, Company second
                    return_url: params.returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?signed=true`,
                }],
                signers_info: signersInfo,
            };

            logger.info('[ESign] Initiating request:', {
                referenceId,
                secondParty: params.secondParty.name,
                firstParty: firstParty.name,
            });

            logger.debug('[ESign] Request payload (signers):', JSON.stringify(signersInfo, null, 2));

            const response = await this.client.post('/signRequest', payload);

            logger.info('[ESign] Response received:', {
                referenceId,
                status: response.data.status,
                docketId: response.data.docket_id,
            });

            if (response.data.status === 'success') {
                const signerInfo = response.data.signer_info || [];

                // First signer (user) gets the immediate signing URL
                const userSignerInfo = signerInfo[0] || {};

                logger.info('[ESign] SUCCESS - Signing initiated:', {
                    docketId: response.data.docket_id,
                    userSigningUrl: userSignerInfo.invitation_link ? 'Available' : 'Not available',
                });

                return {
                    success: true,
                    referenceId,
                    docketId: response.data.docket_id,
                    signingUrl: userSignerInfo.invitation_link || null,
                    companySignerEmail: firstParty.email,
                    signerInfo: signerInfo,
                    rawResponse: response.data,
                };
            }

            logger.warn('[ESign] FAILED:', response.data.error || response.data.message);
            return {
                success: false,
                error: response.data.error || response.data.message || 'E-Sign failed',
                rawResponse: response.data,
            };
        } catch (error: any) {
            logger.error('[ESign] Error:', {
                message: error.response?.data?.message || error.message,
                code: error.response?.data?.error_code,
                details: error.response?.data,
            });
            return {
                success: false,
                error: error.response?.data?.error || error.response?.data?.message || error.message,
                errorCode: error.response?.data?.error_code,
            };
        }
    }

    /**
     * Backward compatible method
     */
    async createESign(params: {
        pdfUrl?: string;
        documentContent?: string;
        signer: {
            name: string;
            email: string;
            phone: string;
            dob?: string;
            gender?: string;
            aadhaarLast4?: string;
        };
        signatureCoordinates?: {
            page: number;
            x: number;
            y: number;
            width?: number;
            height?: number;
        };
        redirectUrl?: string;
    }): Promise<EsignResult> {
        // If pdfUrl provided instead of content, we'd need to fetch it
        // For now, assume documentContent is provided or derived
        const content = params.documentContent || '';

        return this.initiateSign({
            documentContent: content,
            secondParty: {
                name: params.signer.name,
                email: params.signer.email,
                mobile: params.signer.phone,
                dob: params.signer.dob,
                gender: (params.signer.gender as 'M' | 'F') || 'M',
                aadhaarLast4: params.signer.aadhaarLast4,
            },
            returnUrl: params.redirectUrl,
        });
    }

    /**
     * Get e-sign status
     */
    async getStatus(requestId: string) {
        try {
            const response = await this.client.get(`/status/${requestId}`);
            return {
                success: true,
                status: response.data?.status,
                signedPdfUrl: response.data?.signed_pdf_url,
                signedAt: response.data?.signed_at,
            };
        } catch (error: any) {
            logger.error('[ESign] Status check error:', error.message);
            throw error;
        }
    }

    /**
     * Download signed PDF
     */
    async downloadSignedPdf(requestId: string) {
        try {
            const response = await this.client.get(`/download/${requestId}`, {
                responseType: 'arraybuffer',
            });
            return {
                success: true,
                pdfBuffer: response.data,
            };
        } catch (error: any) {
            logger.error('[ESign] Download error:', error.message);
            throw error;
        }
    }
}

export const esignService = new EsignService();
export default esignService;
