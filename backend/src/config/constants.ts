/**
 * Application Constants
 * Centralized configuration values
 */

// Entity Types
export const ENTITY_TYPES = {
    INDIVIDUAL: 'individual',
    PROPRIETORSHIP: 'proprietorship',
    PARTNERSHIP: 'partnership',
    COMPANY: 'company',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// Company Sub-Types
export const COMPANY_SUB_TYPES = {
    PVT_LTD: 'pvt_ltd',
    LLP: 'llp',
    OPC: 'opc',
} as const;

export type CompanySubType = typeof COMPANY_SUB_TYPES[keyof typeof COMPANY_SUB_TYPES];

// Application Status (State Machine)
export const APPLICATION_STATUS = {
    INITIATED: 'initiated',
    KYC: 'kyc',
    PAN: 'pan',
    BANK: 'bank',
    REFERENCES: 'references',
    DOCUMENTS: 'documents',
    PARTNERS: 'partners',
    COMPANY_VERIFICATION: 'company_verification',
    DIRECTORS: 'directors',
    AGREEMENT: 'agreement',
    ESTAMP: 'estamp',
    ESIGN: 'esign',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
} as const;

export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

// KYC Methods
export const KYC_METHODS = {
    DIGILOCKER: 'digilocker',
    AADHAAR_OTP: 'aadhaar_otp',
} as const;

export type KycMethod = typeof KYC_METHODS[keyof typeof KYC_METHODS];

// Bank Verification Methods
export const BANK_VERIFICATION_METHODS = {
    PENNILESS: 'penniless',
    PENNY_DROP: 'penny_drop',
    MANUAL: 'manual',
} as const;

export type BankVerificationMethod = typeof BANK_VERIFICATION_METHODS[keyof typeof BANK_VERIFICATION_METHODS];

// Document Types
export const DOCUMENT_TYPES = {
    // Business Documents
    GST_CERTIFICATE: 'gst_certificate',
    UDYAM_REGISTRATION: 'udyam_registration',
    SHOP_ACT_LICENSE: 'shop_act_license',

    // Partnership Documents
    PARTNERSHIP_DEED: 'partnership_deed',

    // Company Documents
    COI: 'certificate_of_incorporation',
    MOA: 'memorandum_of_association',
    AOA: 'articles_of_association',
    BOARD_RESOLUTION: 'board_resolution',

    // Personal Documents
    PHOTO: 'photo',
    CANCELLED_CHEQUE: 'cancelled_cheque',
    ADDRESS_PROOF: 'address_proof',

    // Agreement Documents
    UNSIGNED_AGREEMENT: 'unsigned_agreement',
    ESTAMPED_AGREEMENT: 'estamped_agreement',
    SIGNED_AGREEMENT: 'signed_agreement',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// DigiLocker Document Types
export const DIGILOCKER_DOC_TYPES = {
    AADHAAR: 'aadhaar',
    PAN: 'pan',
    DRIVING_LICENSE: 'driving_license',
} as const;

// Step Configuration per Entity Type
export const ENTITY_STEPS: Record<EntityType, string[]> = {
    [ENTITY_TYPES.INDIVIDUAL]: [
        'kyc',         // Includes Aadhaar + PAN verification
        'bank',
        'references',
        'agreement',
    ],
    [ENTITY_TYPES.PROPRIETORSHIP]: [
        'kyc',         // Includes Aadhaar + PAN verification
        'bank',
        'references',
        'documents',
        'agreement',
    ],
    [ENTITY_TYPES.PARTNERSHIP]: [
        'partners',    // Add all partners + KYC (Aadhaar + PAN) for each
        'bank',        // Firm bank account verification
        'documents',   // Partnership Deed, etc.
        'references',  // Business references
        'agreement',   // E-Stamp + E-Sign
    ],
    [ENTITY_TYPES.COMPANY]: [
        'company_verification',
        'directors',
        'bank',
        'documents',
        'agreement',
    ],
};

// Validation Constants
export const VALIDATION = {
    AADHAAR_LENGTH: 12,
    PAN_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    MOBILE_REGEX: /^[6-9]\d{9}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    IFSC_REGEX: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    GSTIN_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    CIN_REGEX: /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
    LLPIN_REGEX: /^[A-Z]{3}-[0-9]{4}$/,
    OTP_LENGTH: 6,
    MIN_REFERENCES: 2,
    // Name match thresholds for bank verification
    NAME_MATCH_BLOCK_THRESHOLD: 70,  // Below 70% = Block
    NAME_MATCH_FLAG_THRESHOLD: 80,   // 70-79% = Flag for review, >=80% = Auto-approve
    NAME_MATCH_THRESHOLD: 80,        // For backward compatibility
};

// Rate Limiting
export const RATE_LIMITS = {
    GENERAL: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // Increased from 100
    },
    AUTH: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // Increased from 10
    },
    OTP: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // Increased from 3
    },
};

// API Timeouts (milliseconds)
export const API_TIMEOUTS = {
    SANDBOX: 30000,
    SIGNDESK: 60000,
    IDFY: 30000,
    DEFAULT: 30000,
};

export default {
    ENTITY_TYPES,
    COMPANY_SUB_TYPES,
    APPLICATION_STATUS,
    KYC_METHODS,
    BANK_VERIFICATION_METHODS,
    DOCUMENT_TYPES,
    DIGILOCKER_DOC_TYPES,
    ENTITY_STEPS,
    VALIDATION,
    RATE_LIMITS,
    API_TIMEOUTS,
};
