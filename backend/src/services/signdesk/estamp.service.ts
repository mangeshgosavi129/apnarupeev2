/**
 * SignDesk E-Stamp API Service (DSS 2.0)
 * Hybrid Implementation:
 * - Robust Address Parsing (v10) to ensure valid State Codes
 * - Payload Structure & Property Details from v4 (Proven compatibility)
 */
import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';

// Comprehensive State Code Mapping (v10 Enhanced)
const STATE_CODES: Record<string, string> = {
    // Full names
    'Maharashtra': 'MH',
    'Karnataka': 'KA',
    'Delhi': 'DL',
    'New Delhi': 'DL',
    'Gujarat': 'GJ',
    'Telangana': 'TG',
    'Tamil Nadu': 'TN',
    'West Bengal': 'WB',
    'Rajasthan': 'RJ',
    'Uttar Pradesh': 'UP',
    'Madhya Pradesh': 'MP',
    'Bihar': 'BR',
    'Kerala': 'KL',
    'Punjab': 'PB',
    'Haryana': 'HR',
    'Odisha': 'OD',
    'Andhra Pradesh': 'AP',
    'Jharkhand': 'JH',
    'Chhattisgarh': 'CG',
    'Goa': 'GA',
    'Assam': 'AS',
    'Himachal Pradesh': 'HP',
    'Jammu and Kashmir': 'JK',
    'Uttarakhand': 'UK',
    'Tripura': 'TR',
    'Puducherry': 'PY',
    'Chandigarh': 'CH',

    // Abbreviations and Common Variations
    'MH': 'MH', 'KA': 'KA', 'DL': 'DL', 'GJ': 'GJ', 'TG': 'TG', 'TN': 'TN',
    'WB': 'WB', 'RJ': 'RJ', 'UP': 'UP', 'MP': 'MP', 'BR': 'BR', 'KL': 'KL',
    'PB': 'PB', 'HR': 'HR', 'OD': 'OD', 'AP': 'AP', 'JH': 'JH', 'CG': 'CG',
    'GA': 'GA', 'AS': 'AS', 'HP': 'HP', 'JK': 'JK', 'UK': 'UK',
};

interface ParsedAddress {
    street_address: string;
    city: string;
    state: string;
    pincode: string;
}

interface EstampParams {
    content: string;
    name: string;
    panNumber: string;
    address: string;
    phone: string;
    email: string;
    district?: string;
    stampAmount?: number;
}

interface EstampResult {
    success: boolean;
    referenceId?: string;
    transactionId?: string;
    stampPaperNumber?: string;
    stampedContent?: string;
    error?: string;
    errorCode?: string;
    data?: any;
}

class EstampService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: env.signdesk.estamp.baseUrl,
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json',
                'x-parse-application-id': env.signdesk.estamp.apiId,
                'x-parse-rest-api-key': env.signdesk.estamp.apiKey,
            },
        });
    }

    private generateRefId(): string {
        return `ESTAMP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Parse Aadhaar address format to structured address
     * Using Robust Logic to handle 'New Delhi', 'UP' etc correctly
     */
    parseAadhaarAddress(fullAddress: string): ParsedAddress {
        if (!fullAddress) {
            return {
                street_address: 'N/A',
                city: 'Mumbai',
                state: 'MH',
                pincode: '400001',
            };
        }

        // Normalize address
        let cleanAddress = fullAddress.replace(/,+/g, ',').trim();
        const lowerAddress = cleanAddress.toLowerCase();

        // 1. Extract Pincode
        let pincode = '400001';
        const pinRegex = /\b\d{6}\b/;
        const pinMatch = cleanAddress.match(pinRegex);
        if (pinMatch) {
            pincode = pinMatch[0];
            cleanAddress = cleanAddress.replace(pincode, '').trim();
        }

        // 2. Extract State (Robust Search with Word Boundaries)
        let stateCode = 'MH'; // Default
        let stateName = 'Maharashtra';

        for (const [name, code] of Object.entries(STATE_CODES)) {
            // Regex with word boundaries for short names
            const regex = new RegExp(`\\b${name}\\b`, 'i');
            if (regex.test(cleanAddress)) {
                stateCode = code;
                stateName = name;
                break;
            }
        }

        // 3. Remove Country
        cleanAddress = cleanAddress.replace(/India|INDIA|Bharat/gi, '').trim();

        // Remove State name from address to isolate City/Street
        // Use the found stateName for removal
        const stateRegex = new RegExp(stateName, 'gi');
        cleanAddress = cleanAddress.replace(stateRegex, '').trim();

        // 4. Extract City and Street
        let parts = cleanAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);

        let city = 'Mumbai';
        let street = 'N/A';

        if (parts.length > 0) {
            city = parts.pop() || 'Mumbai';
        }

        if (parts.length > 0) {
            street = parts.join(', ');
        } else {
            if (street === 'N/A' && city !== 'Mumbai') {
                street = city;
            }
        }

        // Clean up
        street = street.replace(/^,|,\s*$/g, '').trim() || 'N/A';
        city = city.replace(/^,|,\s*$/g, '').trim() || 'Mumbai';

        logger.info('[EStamp] Robust Parsed address:', { fullAddress, street, city, state: stateCode, pincode });

        return {
            street_address: street,
            city: city,
            state: stateCode,
            pincode: pincode,
        };
    }

    async requestStampPaper(params: EstampParams): Promise<EstampResult> {
        try {
            const referenceId = this.generateRefId();

            if (!params.content) {
                throw new Error('PDF content is required');
            }

            // Parse user's address with robust logic
            const userAddress = this.parseAadhaarAddress(params.address);

            // Build payload (Matching v4 structure)
            const payload = {
                reference_id: referenceId,
                content: params.content,

                // FIRST PARTY
                first_party_name: env.firstParty.name,
                first_party_address: {
                    street_address: env.firstParty.addressStreet || 'Business Park',
                    city: env.firstParty.addressCity || 'Mumbai',
                    state: 'MH', // Hardcoded as v4
                    pincode: env.firstParty.addressPincode || '400001',
                    country: 'India',
                },
                first_party_details: {
                    first_party_entity_type: 'Organization',
                    first_party_id_type: 'PAN',
                    first_party_id_number: env.firstParty.pan,
                },

                // SECOND PARTY
                second_party_name: params.name || 'Individual Applicant',
                second_party_address: {
                    street_address: userAddress.street_address,
                    state: userAddress.state, // Guaranteed valid code by parseAadhaarAddress
                    pincode: userAddress.pincode,
                },
                second_party_details: {
                    second_party_entity_type: 'Individual',
                    second_party_id_type: 'PAN',
                    second_party_id_number: params.panNumber || 'N/A',
                },

                // ESBTR Details (Hardcoded from v4)
                esbtr_details: {
                    property_address: {
                        addressline_1: 'Business Park A',
                        road: 'Main Road',
                        town_village: 'Panvel', // Hardcoded v4
                        district: 'Raigad',     // Hardcoded v4
                        state_code: 'MH',       // Hardcoded v4
                        pincode: '410206',      // Hardcoded v4
                    },
                    property_area: '100',
                    property_area_unit: 'Sq.Feet',
                    district: params.district || 'Pune',
                },

                // Stamp Details
                stamp_amount: [params.stampAmount || 100],
                consideration_amount: '100000',
                stamp_state: 'MH',
                stamp_type: 'Traditional',
                stamp_duty_paid_by: 'First Party',
                document_category: ['147'],

                // User contact
                duty_payer_phone_number: env.firstParty.mobile || '9876543210',
                duty_payer_email_id: env.firstParty.email || 'user@example.com',
            };

            logger.info('[EStamp] Initiating request:', {
                referenceId,
                secondParty: params.name,
                pan: params.panNumber,
                email: params.email,
            });

            logger.info('[EStamp] Request payload:', JSON.stringify(payload, null, 2));

            const response = await this.client.post('/requestStampPaper', payload);

            logger.info('[EStamp] Response received:', {
                referenceId,
                status: response.data.status,
                transactionId: response.data.transaction_id,
                stampPaperNumber: response.data.stamp_paper_number,
            });

            if (response.data.status === 'success') {
                // Normalize stamp paper number (handle array response)
                let spNumber = response.data.stamp_paper_number;
                if (Array.isArray(spNumber)) {
                    spNumber = spNumber.flat(Infinity)[0];
                }

                return {
                    success: true,
                    referenceId,
                    transactionId: response.data.transaction_id,
                    stampPaperNumber: spNumber,
                    stampedContent: response.data.content,
                    data: response.data,
                };
            }

            logger.warn('[EStamp] FAILED:', response.data.message || response.data.error_code);
            return {
                success: false,
                referenceId,
                error: response.data.message || 'E-Stamp failed',
                errorCode: response.data.error_code,
                data: response.data,
            };
        } catch (error: any) {
            // Enhanced error logging
            logger.error('[EStamp] Error:', error.message);

            if (error.response) {
                logger.error('[EStamp] Response Status:', error.response.status);
                logger.error('[EStamp] Response Data:', JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                logger.error('[EStamp] No response received - request timeout or network error');
            }

            const errorMessage = error.response?.data?.message
                || error.response?.data?.error
                || error.response?.data?.description
                || error.message
                || 'E-Stamp request failed';

            return {
                success: false,
                error: errorMessage,
                errorCode: error.response?.data?.error_code || error.response?.status?.toString(),
            };
        }
    }

    async getStatus(requestId: string) {
        try {
            const response = await this.client.get(`/status/${requestId}`);
            return {
                success: true,
                status: response.data?.status,
                certificateNumber: response.data?.certificate_number,
                stampedPdfUrl: response.data?.stamped_pdf_url,
            };
        } catch (error: any) {
            logger.error('[EStamp] Status check error:', error.message);
            throw error;
        }
    }
}

export const estampService = new EstampService();
export default estampService;
