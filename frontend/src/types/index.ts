/**
 * Application Types
 * Shared TypeScript interfaces
 */

// Entity Types
export type EntityType = 'individual' | 'proprietorship' | 'partnership' | 'company';
export type CompanySubType = 'pvt_ltd' | 'llp' | 'opc';

// Application Status
export type ApplicationStatus =
    | 'initiated'
    | 'kyc'
    | 'pan'
    | 'bank'
    | 'references'
    | 'documents'
    | 'partners'
    | 'company_verification'
    | 'directors'
    | 'agreement'
    | 'estamp'
    | 'esign'
    | 'completed'
    | 'rejected';

// Completed Steps
export interface CompletedSteps {
    kyc: boolean;
    pan: boolean;
    bank: boolean;
    references: boolean;
    documents: boolean;
    partners: boolean;
    companyVerification: boolean;
    directors: boolean;
    agreement: boolean;
}

// User
export interface User {
    id: string;
    phone: string;
    email?: string;
    name?: string;
    isVerified: boolean;
}

// Application
export interface Application {
    id: string;
    entityType: EntityType;
    companySubType?: CompanySubType;
    status: ApplicationStatus;
    completedSteps: CompletedSteps;
    phone: string;
    email?: string;
    kyc?: {
        method?: 'digilocker' | 'aadhaar_otp';
        aadhaar?: {
            name: string;
            maskedNumber: string;
            dob: string;
            address?: string;
            verified: boolean;
            verifiedAt?: string;
        };
        pan?: {
            number: string;
            name: string;
            verified: boolean;
            verifiedAt?: string;
        };
        selfie?: {
            capturedAt?: string;
        };
        liveness: boolean;
        faceMatch: boolean;
    };
    bank?: {
        accountNumber: string;
        ifsc: string;
        bankName: string;
        accountHolderName: string;
        verified: boolean;
        flaggedForReview?: boolean;
    };
    referencesCount: number;
    documentsCount: number;
    partnersCount: number;
    company?: {
        name: string;
        cin?: string;
        llpin?: string;
        directorsCount: number;
    };
    agreement?: {
        generated: boolean;
        estamped: boolean;
        signed: boolean;
    };
}

// Step configuration
export interface StepConfig {
    id: string;
    name: string;
    order: number;
    completed: boolean;
    current: boolean;
    locked: boolean;
}

// API Response
export interface ApiResponse<T = any> {
    success: boolean;
    error?: string;
    code?: string;
    data?: T;
}

// Auth State
export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
}

// Entity config for UI
export const ENTITY_CONFIG: Record<EntityType, {
    label: string;
    description: string;
    icon: string;
    color: string;
    gradient: string;
}> = {
    individual: {
        label: 'Individual',
        description: 'For personal DSA registration',
        icon: 'User',
        color: 'blue',
        gradient: 'from-blue-500 to-indigo-600',
    },
    proprietorship: {
        label: 'Sole Proprietorship',
        description: 'For business owners',
        icon: 'Briefcase',
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-600',
    },
    partnership: {
        label: 'Partnership',
        description: 'For partnership firms',
        icon: 'Users',
        color: 'violet',
        gradient: 'from-violet-500 to-purple-600',
    },
    company: {
        label: 'Company',
        description: 'Pvt Ltd, LLP, or OPC',
        icon: 'Building2',
        color: 'orange',
        gradient: 'from-orange-500 to-rose-600',
    },
};

export const COMPANY_SUBTYPE_CONFIG: Record<CompanySubType, {
    label: string;
    description: string;
}> = {
    pvt_ltd: { label: 'Private Limited', description: 'Company registered under Companies Act' },
    llp: { label: 'Limited Liability Partnership', description: 'LLP registered firm' },
    opc: { label: 'One Person Company', description: 'Single member company' },
};
