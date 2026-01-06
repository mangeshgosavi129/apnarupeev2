/**
 * Application Model
 * Main DSA onboarding application tracking
 * Supports: Individual, Proprietorship, Partnership, Company (Pvt Ltd, LLP, OPC)
 */
import mongoose, { Schema, Document } from 'mongoose';
import {
    ENTITY_TYPES,
    COMPANY_SUB_TYPES,
    APPLICATION_STATUS,
    KYC_METHODS,
    BANK_VERIFICATION_METHODS,
    DOCUMENT_TYPES,
    EntityType,
    CompanySubType,
    ApplicationStatus,
} from '../config/constants.js';

// Sub-document interfaces
interface AadhaarData {
    name: string;
    maskedNumber: string;
    dob: string;
    gender: string;
    address: string;
    photo?: string;
    verifiedAt: Date;
}

interface PanData {
    number: string;
    name: string;
    verified: boolean;
    nameMatch?: boolean;
    dobMatch?: boolean;
    linkedWithAadhaar: boolean;
    verifiedAt: Date;
}

interface LivenessData {
    verified: boolean;
    imageUrl?: string;
    image?: string;  // Base64 image for PDF
    score?: number;
    verifiedAt: Date;
}

interface FaceMatchData {
    matched: boolean;
    score: number;
    image?: string;  // Face match image for PDF
    verifiedAt: Date;
}

interface CrossValidationData {
    panAadhaar?: {
        nameMatch: boolean;
        dobMatch: boolean;
        flaggedForReview: boolean;
        warnings: string[];
        checkedAt: Date;
    };
    bankKyc?: {
        nameMatch: boolean;
        nameMatchScore: number;
        flaggedForReview: boolean;
        checkedAt: Date;
    };
}

interface KycData {
    method?: typeof KYC_METHODS[keyof typeof KYC_METHODS];
    aadhaar?: AadhaarData;
    pan?: PanData;
    liveness?: LivenessData;
    faceMatch?: FaceMatchData;
    crossValidation?: CrossValidationData;
    selfie?: {
        image?: string;
        capturedAt?: Date;
    };
}

interface BankData {
    accountNumber: string;
    ifsc: string;
    bankName: string;
    branchName: string;
    accountHolderName: string;
    verified: boolean;
    verificationMethod: typeof BANK_VERIFICATION_METHODS[keyof typeof BANK_VERIFICATION_METHODS];
    nameMatchScore?: number;
    flaggedForReview: boolean;
    verifiedAt: Date;
}

interface Reference {
    name: string;
    mobile: string;
    email?: string;
    address: string;
    verified: boolean;
}

interface UploadedDocument {
    type: typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];
    url: string;
    filename: string;
    verified: boolean;
    uploadedAt: Date;
}

interface Partner {
    name: string;
    phone: string;
    email?: string;
    isLeadPartner: boolean;
    kycCompleted: boolean;
    panNumber?: string;
    aadhaarMasked?: string;
    kycData?: KycData;
}

interface Director {
    din: string;
    name: string;
    designation?: string;
    kycCompleted: boolean;
    panNumber?: string;
    aadhaarMasked?: string;
    kycData?: KycData;
}

interface CompanyData {
    cin?: string;
    llpin?: string;
    name: string;
    status: string;
    registrationDate?: string;
    registeredAddress?: string;
    email?: string;
    pan?: string;  // Company PAN
    authorizedCapital?: string;
    paidUpCapital?: string;
    directors: Director[];
}

interface AgreementData {
    generatedUrl?: string;
    generatedAt?: Date;
    estampId?: string;
    estampUrl?: string;
    estampCertificateNumber?: string;
    esignId?: string;
    signedUrl?: string;
    completedAt?: Date;
}

interface CompletedSteps {
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

// Main Application interface
export interface IApplication extends Document {
    // Core Fields
    entityType: EntityType;
    companySubType?: CompanySubType;
    status: ApplicationStatus;
    completedSteps: CompletedSteps;

    // Contact
    phone: string;
    email?: string;

    // KYC
    kyc: KycData;

    // Bank
    bank?: BankData;

    // References (Individual, Proprietorship)
    references: Reference[];

    // Documents
    documents: UploadedDocument[];

    // Partnership specific
    partners: Partner[];

    // Company specific
    company?: CompanyData;

    // Agreement
    agreement?: AgreementData;

    // Business Details (Proprietorship/Partnership)
    business?: {
        name?: string;
        address?: string;
        gstNumber?: string;
        udyamNumber?: string;
    };
    businessAddress?: string;  // Business address for PDF
    firmName?: string;         // Partnership firm name
    firmPan?: string;          // Partnership firm PAN

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;

    // Methods
    getNextStep(): string | null;
    canProceedToStep(step: string): boolean;
}

// Schemas
const AadhaarSchema = new Schema({
    name: { type: String },
    maskedNumber: { type: String },
    dob: { type: String },
    gender: { type: String },
    address: { type: String },
    photo: { type: String, select: false }, // Don't include in default queries
    verifiedAt: { type: Date },
}, { _id: false });

const PanSchema = new Schema({
    number: { type: String },
    name: { type: String },
    verified: { type: Boolean, default: false },
    linkedWithAadhaar: { type: Boolean, default: false },
    verifiedAt: { type: Date },
}, { _id: false });

const LivenessSchema = new Schema({
    verified: { type: Boolean, default: false },
    imageUrl: { type: String },
    image: { type: String },  // Base64 image for PDF
    score: { type: Number },
    verifiedAt: { type: Date },
}, { _id: false });

const FaceMatchSchema = new Schema({
    matched: { type: Boolean, default: false },
    score: { type: Number },
    image: { type: String },  // Face match image for PDF
    verifiedAt: { type: Date },
}, { _id: false });

const CrossValidationSchema = new Schema({
    panAadhaar: {
        nameMatch: { type: Boolean },
        dobMatch: { type: Boolean },
        flaggedForReview: { type: Boolean, default: false },
        warnings: [{ type: String }],
        checkedAt: { type: Date },
    },
    bankKyc: {
        nameMatch: { type: Boolean },
        nameMatchScore: { type: Number },
        flaggedForReview: { type: Boolean, default: false },
        checkedAt: { type: Date },
    },
}, { _id: false });

const KycSchema = new Schema({
    method: { type: String, enum: Object.values(KYC_METHODS) },
    aadhaar: { type: AadhaarSchema },
    pan: { type: PanSchema },
    liveness: { type: LivenessSchema },
    faceMatch: { type: FaceMatchSchema },
    crossValidation: { type: CrossValidationSchema },
    selfie: {
        image: { type: String },
        capturedAt: { type: Date },
    },
}, { _id: false });

const BankSchema = new Schema({
    accountNumber: { type: String },
    ifsc: { type: String },
    bankName: { type: String },
    branchName: { type: String },
    accountHolderName: { type: String },
    verified: { type: Boolean, default: false },
    verificationMethod: { type: String, enum: Object.values(BANK_VERIFICATION_METHODS) },
    nameMatchScore: { type: Number },
    flaggedForReview: { type: Boolean, default: false },
    verifiedAt: { type: Date },
}, { _id: false });

const ReferenceSchema = new Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    verified: { type: Boolean, default: false },
}, { _id: false });

const DocumentSchema = new Schema({
    type: { type: String, enum: Object.values(DOCUMENT_TYPES), required: true },
    url: { type: String, required: true },
    filename: { type: String },
    verified: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const PartnerSchema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    isLeadPartner: { type: Boolean, default: false },
    kycCompleted: { type: Boolean, default: false },
    panNumber: { type: String },
    aadhaarMasked: { type: String },
    kycData: { type: KycSchema },
});

const DirectorSchema = new Schema({
    din: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String },
    kycCompleted: { type: Boolean, default: false },
    panNumber: { type: String },
    aadhaarMasked: { type: String },
    kycData: { type: KycSchema },
});

const CompanySchema = new Schema({
    cin: { type: String },
    llpin: { type: String },
    name: { type: String },
    status: { type: String },
    registrationDate: { type: String },
    registeredAddress: { type: String },
    email: { type: String },
    pan: { type: String },
    authorizedCapital: { type: String },
    paidUpCapital: { type: String },
    directors: [DirectorSchema],
}, { _id: false });

const AgreementSchema = new Schema({
    generatedUrl: { type: String },
    generatedAt: { type: Date },
    estampId: { type: String },
    estampUrl: { type: String },
    estampCertificateNumber: { type: String },
    esignId: { type: String },
    signedUrl: { type: String },
    completedAt: { type: Date },
}, { _id: false });

const CompletedStepsSchema = new Schema({
    kyc: { type: Boolean, default: false },
    pan: { type: Boolean, default: false },
    bank: { type: Boolean, default: false },
    references: { type: Boolean, default: false },
    documents: { type: Boolean, default: false },
    partners: { type: Boolean, default: false },
    companyVerification: { type: Boolean, default: false },
    directors: { type: Boolean, default: false },
    agreement: { type: Boolean, default: false },
}, { _id: false });

// Main Application Schema
const ApplicationSchema = new Schema<IApplication>({
    entityType: {
        type: String,
        enum: Object.values(ENTITY_TYPES),
        required: true,
        index: true,
    },
    companySubType: {
        type: String,
        enum: Object.values(COMPANY_SUB_TYPES),
    },
    status: {
        type: String,
        enum: Object.values(APPLICATION_STATUS),
        default: APPLICATION_STATUS.INITIATED,
        index: true,
    },
    completedSteps: {
        type: CompletedStepsSchema,
        default: () => ({}),
    },

    // Contact
    phone: { type: String, required: true, index: true },
    email: { type: String },

    // KYC
    kyc: { type: KycSchema, default: () => ({}) },

    // Bank
    bank: { type: BankSchema },

    // References
    references: [ReferenceSchema],

    // Documents
    documents: [DocumentSchema],

    // Partnership
    partners: [PartnerSchema],

    // Company
    company: { type: CompanySchema },

    // Agreement
    agreement: { type: AgreementSchema },

    // Business Details
    business: {
        name: { type: String },
        address: { type: String },
        gstNumber: { type: String },
        udyamNumber: { type: String },
    },
    businessAddress: { type: String },  // Business address for PDF
    firmName: { type: String },         // Partnership firm name
    firmPan: { type: String },          // Partnership firm PAN

    // Rejection
    completedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
ApplicationSchema.index({ phone: 1, status: 1 });
ApplicationSchema.index({ createdAt: -1 });
ApplicationSchema.index({ 'company.cin': 1 }, { sparse: true });

// Methods
ApplicationSchema.methods.getNextStep = function (): string | null {
    const steps = require('../config/constants.js').ENTITY_STEPS[this.entityType];
    if (!steps) return null;

    for (const step of steps) {
        const stepKey = step.replace('_', '') as keyof CompletedSteps;
        if (!this.completedSteps[stepKey]) {
            return step;
        }
    }
    return null;
};

ApplicationSchema.methods.canProceedToStep = function (step: string): boolean {
    const steps = require('../config/constants.js').ENTITY_STEPS[this.entityType];
    if (!steps) return false;

    const stepIndex = steps.indexOf(step);
    if (stepIndex === -1) return false;
    if (stepIndex === 0) return true;

    // All previous steps must be completed
    for (let i = 0; i < stepIndex; i++) {
        const prevStep = steps[i].replace('_', '') as keyof CompletedSteps;
        if (!this.completedSteps[prevStep]) {
            return false;
        }
    }
    return true;
};

// Pre-save middleware
ApplicationSchema.pre('save', function (next) {
    // Auto-update status based on completed steps
    if (this.status === APPLICATION_STATUS.COMPLETED || this.status === APPLICATION_STATUS.REJECTED) {
        return next();
    }

    const nextStep = this.getNextStep();
    if (nextStep) {
        this.status = nextStep as ApplicationStatus;
    }

    next();
});

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);
export default Application;
