/**
 * PDF Agreement Service - TypeScript Wrapper
 * Integrates the JavaScript pdf-agreement-service with TypeScript backend
 */

import path from 'path';
import logger from '../../utils/logger.js';

// Import types
export interface ApplicationData {
    entityType: 'individual' | 'proprietorship' | 'partnership' | 'company';
    companySubType?: 'pvt_ltd' | 'llp' | 'opc';
    phone: string;
    email: string;
    name?: string;

    // KYC Data
    kyc: {
        method?: 'digilocker' | 'aadhaar_otp';
        aadhaar?: {
            maskedNumber?: string;
            name?: string;
            dob?: string;
            gender?: string;
            address?: string;
            photo?: string;
            verifiedAt?: Date;
            // Nested data format (from DigiLocker parsing)
            data?: {
                name?: string;
                dob?: string;
                address?: string;
                gender?: string;
            };
        };
        pan?: {
            number?: string;
            name?: string;
            verified?: boolean;
            verifiedAt?: Date;
        };
        liveness?: {
            verified?: boolean;
            image?: string;
        };
        faceMatch?: {
            matched?: boolean;
            score?: number;
            image?: string;
        };
        selfie?: {
            image?: string;
            capturedAt?: Date;
        };
    };

    // Bank Details
    bank?: {
        accountNumber?: string;
        ifsc?: string;
        bankName?: string;
        accountHolderName?: string;
    };

    // References (for Individual/Proprietorship)
    references?: Array<{
        name: string;
        mobile: string;
        email?: string;
        address?: string;
    }>;

    // Partners (for Partnership)
    partners?: Array<{
        name: string;
        phone: string;
        email?: string;
        isLeadPartner?: boolean;
        kycCompleted?: boolean;
        panNumber?: string;
        kycData?: {
            aadhaar?: {
                address?: string;
            };
        };
    }>;

    // Company Data
    company?: {
        name?: string;
        cin?: string;
        llpin?: string;
        registeredAddress?: string;
        pan?: string;
        directors?: Array<{
            din?: string;
            dpin?: string;
            name: string;
            email?: string;
            phone?: string;
            isSignatory?: boolean;
            kycCompleted?: boolean;
            kycData?: {
                aadhaar?: {
                    address?: string;
                };
            };
        }>;
    };

    // Business details
    businessAddress?: string;
    firmName?: string;
    firmPan?: string;
    companyName?: string;
    companyPan?: string;
    registeredAddress?: string;

    // Signatory image
    livenessImage?: string;
    faceMatchImage?: string;
}

/**
 * Normalize application data to match pdf-agreement-service expected format
 * Handles both DigiLocker (nested data) and OTP (flat data) formats
 */
function normalizeApplicationData(application: ApplicationData): any {
    const kyc = application.kyc || {};
    const aadhaar = kyc.aadhaar || {};

    // Normalize Aadhaar data - handle both nested and flat formats
    const normalizedAadhaar = {
        maskedNumber: aadhaar.maskedNumber || '',
        data: {
            name: aadhaar.data?.name || aadhaar.name || '',
            dob: aadhaar.data?.dob || aadhaar.dob || '',
            address: aadhaar.data?.address || aadhaar.address || '',
            gender: aadhaar.data?.gender || aadhaar.gender || '',
        },
        photo: aadhaar.photo || '',
    };

    // Normalize PAN data
    const normalizedPan = {
        number: kyc.pan?.number || '',
        name: kyc.pan?.name || '',
        verified: kyc.pan?.verified || false,
    };

    // Build normalized application object
    const normalized: any = {
        ...application,
        kyc: {
            aadhaar: normalizedAadhaar,
            pan: normalizedPan,
            liveness: kyc.liveness,
            faceMatch: kyc.faceMatch,
        },
    };

    // For Individual/Proprietorship - use Aadhaar name if not set
    if (!normalized.name) {
        normalized.name = normalizedAadhaar.data.name;
    }

    // For Partnership - ensure partners have proper KYC structure
    if (application.entityType === 'partnership' && application.partners) {
        normalized.partners = application.partners.map(p => ({
            ...p,
            kyc: p.kycData ? {
                aadhaar: { data: { address: p.kycData.aadhaar?.address || '' } }
            } : undefined,
        }));
    }

    // For Company - ensure directors have proper structure + copy company fields
    if (application.entityType === 'company' && application.company) {
        normalized.companyName = application.company.name || application.companyName;
        normalized.companyPan = application.company.pan || application.companyPan;
        normalized.registeredAddress = application.company.registeredAddress || application.registeredAddress;

        normalized.directors = (application.company.directors || []).map(d => ({
            ...d,
            kyc: d.kycData ? {
                aadhaar: { data: { address: d.kycData.aadhaar?.address || '' } }
            } : undefined,
        }));
    }

    // Add signatory image from selfie, liveness, or face match (priority: selfie > liveness > faceMatch)
    normalized.livenessImage = kyc.selfie?.image ||
        application.livenessImage ||
        application.faceMatchImage ||
        kyc.liveness?.image ||
        kyc.faceMatch?.image || '';

    return normalized;
}

// Load the pdf-agreement-service JavaScript module
// Using require for CommonJS compatibility
let pdfServiceModule: any = null;

async function loadPdfService() {
    if (!pdfServiceModule) {
        // Path relative to the compiled output location
        const servicePath = path.join(__dirname, 'index.js');
        pdfServiceModule = require(servicePath);
    }
    return pdfServiceModule;
}

/**
 * Generate DSA Agreement PDF from Application data
 * 
 * @param application - Application document from MongoDB
 * @returns PDF as Buffer
 */
export async function generateAgreementPDF(application: ApplicationData): Promise<Buffer> {
    try {
        logger.info(`[PDF] Generating agreement for entity: ${application.entityType}`);

        // Normalize application data to expected format
        const normalizedData = normalizeApplicationData(application);

        // Load and use the JavaScript module
        const pdfService = await loadPdfService();

        // Generate PDF
        const pdfBuffer = await pdfService.generateAgreementPDF(normalizedData);

        logger.info(`[PDF] Generated successfully: ${pdfBuffer.length} bytes`);

        return pdfBuffer;
    } catch (error: any) {
        logger.error('[PDF] Generation failed:', error.message);
        throw new Error(`PDF generation failed: ${error.message}`);
    }
}

/**
 * Get entity-specific mapper for debugging
 */
export async function getMapper(entityType: string) {
    const pdfService = await loadPdfService();
    return pdfService.mappers;
}

export { ApplicationData as PDFApplicationData };
