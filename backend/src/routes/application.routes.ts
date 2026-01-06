/**
 * Application Routes
 * Manages application lifecycle and status
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Application } from '../models/Application.js';
import logger from '../utils/logger.js';
import {
    auth,
    asyncHandler,
    NotFoundError,
    BadRequestError,
    validate,
    schemas,
} from '../middleware/index.js';
import { ENTITY_TYPES, ENTITY_STEPS } from '../config/constants.js';

const router = Router();

/**
 * GET /api/application
 * Get current user's application
 */
router.get(
    '/',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        if (!req.user?.applicationId) {
            throw NotFoundError('No application found. Please start onboarding.');
        }

        const application = await Application.findById(req.user.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        res.json({
            success: true,
            application: {
                id: application._id,
                entityType: application.entityType,
                companySubType: application.companySubType,
                status: application.status,
                completedSteps: application.completedSteps,
                phone: application.phone,
                email: application.email,
                kyc: {
                    method: application.kyc.method,
                    aadhaar: application.kyc.aadhaar
                        ? {
                            name: application.kyc.aadhaar.name,
                            maskedNumber: application.kyc.aadhaar.maskedNumber,
                            dob: application.kyc.aadhaar.dob,
                            address: application.kyc.aadhaar.address,
                            verified: !!application.kyc.aadhaar.verifiedAt,
                            verifiedAt: application.kyc.aadhaar.verifiedAt,
                        }
                        : null,
                    pan: application.kyc.pan
                        ? {
                            number: application.kyc.pan.number,
                            name: application.kyc.pan.name,
                            verified: application.kyc.pan.verified,
                            verifiedAt: application.kyc.pan.verifiedAt,
                        }
                        : null,
                    selfie: application.kyc.selfie
                        ? {
                            capturedAt: application.kyc.selfie.capturedAt,
                        }
                        : null,
                    liveness: application.kyc.liveness?.verified || false,
                    faceMatch: application.kyc.faceMatch?.matched || false,
                },
                bank: application.bank
                    ? {
                        accountNumber: application.bank.accountNumber?.replace(/.(?=.{4})/g, '*'),
                        ifsc: application.bank.ifsc,
                        bankName: application.bank.bankName,
                        accountHolderName: application.bank.accountHolderName,
                        verified: application.bank.verified,
                    }
                    : null,
                referencesCount: application.references.length,
                documentsCount: application.documents.length,
                partnersCount: application.partners?.length || 0,
                company: application.company
                    ? {
                        name: application.company.name,
                        cin: application.company.cin,
                        llpin: application.company.llpin,
                        directorsCount: application.company.directors?.length || 0,
                    }
                    : null,
                agreement: application.agreement
                    ? {
                        generated: !!application.agreement.generatedUrl,
                        estamped: !!application.agreement.estampUrl,
                        signed: !!application.agreement.signedUrl,
                    }
                    : null,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt,
            },
        });
    })
);

/**
 * GET /api/application/steps
 * Get steps for current entity type
 */
router.get(
    '/steps',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        if (!req.user?.applicationId) {
            throw NotFoundError('No application found');
        }

        const application = await Application.findById(req.user.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        const steps = ENTITY_STEPS[application.entityType] || [];
        const nextStep = application.getNextStep();

        // Build step details
        const stepDetails = steps.map((step, index) => {
            const stepKey = step.replace('_', '') as keyof typeof application.completedSteps;
            const isCompleted = application.completedSteps[stepKey] || false;
            const isCurrent = step === nextStep;

            return {
                id: step,
                name: formatStepName(step),
                order: index + 1,
                completed: isCompleted,
                current: isCurrent,
                locked: !isCompleted && !isCurrent,
            };
        });

        res.json({
            success: true,
            entityType: application.entityType,
            currentStep: nextStep,
            totalSteps: steps.length,
            completedCount: stepDetails.filter(s => s.completed).length,
            steps: stepDetails,
        });
    })
);

/**
 * PATCH /api/application/entity-type
 * Change entity type (only allowed at beginning)
 */
router.patch(
    '/entity-type',
    auth,
    validate(Joi.object({
        entityType: schemas.entityType,
        companySubType: schemas.companySubType,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { entityType, companySubType } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Only allow change if no steps completed
        const anyStepCompleted = Object.values(application.completedSteps).some(v => v);
        if (anyStepCompleted) {
            throw BadRequestError('Cannot change entity type after completing steps');
        }

        application.entityType = entityType;
        if (entityType === ENTITY_TYPES.COMPANY && companySubType) {
            application.companySubType = companySubType;
        } else {
            application.companySubType = undefined;
        }

        await application.save();

        logger.info(`Entity type changed: ${application._id} -> ${entityType}`);

        res.json({
            success: true,
            message: 'Entity type updated',
            entityType: application.entityType,
            companySubType: application.companySubType,
            steps: ENTITY_STEPS[entityType as keyof typeof ENTITY_STEPS],
        });
    })
);

/**
 * GET /api/application/status
 * Get application status summary
 */
router.get(
    '/status',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        const steps = ENTITY_STEPS[application.entityType] || [];
        const completedCount = Object.values(application.completedSteps).filter(v => v).length;
        const progressPercent = Math.round((completedCount / steps.length) * 100);

        res.json({
            success: true,
            status: application.status,
            progress: {
                completed: completedCount,
                total: steps.length,
                percent: progressPercent,
            },
            nextStep: application.getNextStep(),
            isCompleted: application.status === 'completed',
            isRejected: application.status === 'rejected',
        });
    })
);

// Helper function
function formatStepName(step: string): string {
    const names: Record<string, string> = {
        kyc: 'KYC Verification',
        pan: 'PAN Verification',
        bank: 'Bank Verification',
        references: 'References',
        documents: 'Documents',
        partners: 'Partner Details',
        company_verification: 'Company Verification',
        directors: 'Director KYC',
        agreement: 'Agreement',
    };
    return names[step] || step;
}

export default router;
