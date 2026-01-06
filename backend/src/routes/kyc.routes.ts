/**
 * KYC Routes
 * Handles: DigiLocker SDK, Aadhaar OKYC, PAN Verification
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Application } from '../models/Application.js';
import { sandboxClient } from '../services/sandbox/index.js';
import digilockerParser from '../utils/digilockerParser.js';
import logger from '../utils/logger.js';
import {
    auth,
    asyncHandler,
    BadRequestError,
    NotFoundError,
    validate,
    schemas,
    kycLimiter,
} from '../middleware/index.js';

const router = Router();

// ======================
// Aadhaar OKYC
// ======================

/**
 * POST /api/kyc/aadhaar/send-otp
 * Generate Aadhaar OTP
 * @see https://developer.sandbox.co.in/api-reference/kyc/aadhaar/okyc/generate-otp
 */
router.post(
    '/aadhaar/send-otp',
    auth,
    kycLimiter,
    validate(Joi.object({
        aadhaar: schemas.aadhaar,
        consent: Joi.string().valid('Y', 'y').default('Y'),
        reason: Joi.string().default('KYC Verification'),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { aadhaar, consent, reason } = req.body;

        const response: any = await sandboxClient.generateAadhaarOtp(aadhaar, consent, reason);

        // Handle "OTP already generated" case (no data wrapper)
        if (response.code === 200 && response.message?.includes('please try after')) {
            throw BadRequestError('OTP already sent. Please wait 45 seconds before retrying.');
        }

        // Handle invalid Aadhaar
        if (response.data?.message === 'Invalid Aadhaar Card') {
            throw BadRequestError('Invalid Aadhaar number. Please check and try again.');
        }

        // Success case: response.data.reference_id
        if (response.code === 200 && response.data?.reference_id) {
            logger.info(`[Aadhaar] OTP sent for: XXXX${aadhaar.slice(-4)}, ref: ${response.data.reference_id}`);
            res.json({
                success: true,
                referenceId: response.data.reference_id,
                message: response.data.message || 'OTP sent to registered mobile number',
            });
        } else {
            throw BadRequestError(response.message || response.data?.message || 'Failed to send OTP');
        }
    })
);

/**
 * POST /api/kyc/aadhaar/verify-otp
 * Verify Aadhaar OTP and get user data
 * @see https://developer.sandbox.co.in/api-reference/kyc/aadhaar/okyc/verify-otp
 */
router.post(
    '/aadhaar/verify-otp',
    auth,
    kycLimiter,
    validate(Joi.object({
        referenceId: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        otp: schemas.otp,
        aadhaarNumber: schemas.aadhaar,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { referenceId, otp, aadhaarNumber } = req.body;

        const response: any = await sandboxClient.verifyAadhaarOtp(String(referenceId), otp);

        // Handle specific error messages from API
        const apiMessage = (response.data?.message || '').toLowerCase();

        if (apiMessage.includes('invalid otp')) {
            throw BadRequestError('Invalid OTP. Please check and try again.');
        }
        if (apiMessage.includes('otp expired')) {
            throw BadRequestError('OTP expired. Please request a new OTP.');
        }
        if (apiMessage.includes('invalid reference')) {
            throw BadRequestError('Session expired. Please enter Aadhaar number again.');
        }
        if (apiMessage.includes('under process') || apiMessage.includes('try after')) {
            throw BadRequestError('Please wait 30 seconds and try again.');
        }

        if (response.code === 200 && response.data) {
            const kycData = response.data;
            const isVerified = kycData.status === 'SUCCESS' || kycData.status === 'VALID';

            if (!isVerified) {
                throw BadRequestError('Aadhaar verification failed');
            }

            // Update application
            const application = await Application.findById(req.user?.applicationId);
            if (application) {
                const maskedNumber = aadhaarNumber
                    ? `XXXX XXXX ${aadhaarNumber.slice(-4)}`
                    : 'XXXX XXXX XXXX';

                application.kyc.method = 'aadhaar_otp';
                application.kyc.aadhaar = {
                    name: kycData.name,
                    maskedNumber,
                    dob: kycData.date_of_birth,
                    gender: kycData.gender,
                    address: kycData.full_address,
                    photo: kycData.photo,
                    verifiedAt: new Date(),
                };
                await application.save();
                logger.info(`[Aadhaar] Verified: ${kycData.name}`);
            }

            res.json({
                success: true,
                verified: true,
                aadhaarData: {
                    name: kycData.name,
                    gender: kycData.gender,
                    dob: kycData.date_of_birth,
                    address: kycData.full_address,
                    hasPhoto: !!kycData.photo,
                },
            });
        } else {
            throw BadRequestError(response.data?.message || 'OTP verification failed');
        }
    })
);

// ======================
// DigiLocker SDK
// ======================

/**
 * POST /api/kyc/digilocker/create-session
 * Create DigiLocker SDK session
 * The frontend will use the SDK with the session_id
 */
router.post(
    '/digilocker/create-session',
    auth,
    kycLimiter,
    validate(Joi.object({
        flow: Joi.string().valid('signin', 'signup').default('signin'),
        docTypes: Joi.array().items(
            Joi.string().valid('aadhaar', 'pan', 'driving_license')
        ).default(['aadhaar', 'pan']),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { flow, docTypes } = req.body;

        const response: any = await sandboxClient.createDigilockerSession(flow, docTypes);

        // Response structure: { timestamp, transaction_id, data: { id, status, created_at }, code }
        if (response.code === 200 && response.data?.id) {
            res.json({
                success: true,
                sessionId: response.data.id,
                status: response.data.status,
                message: 'DigiLocker session created. Use SDK to complete flow.',
            });
        } else {
            throw BadRequestError(response.message || 'Failed to create DigiLocker session');
        }
    })
);

/**
 * GET /api/kyc/digilocker/status/:sessionId
 * Get DigiLocker session status
 * Status: created, initialized, authorized, succeeded, failed, expired
 */
router.get(
    '/digilocker/status/:sessionId',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const { sessionId } = req.params;

        const response: any = await sandboxClient.getDigilockerSessionStatus(sessionId);

        // Response structure: { code, timestamp, data: { status, documents_consented, id }, transaction_id }
        if (response.code === 200 && response.data) {
            res.json({
                success: true,
                sessionId: response.data.id,
                status: response.data.status,
                documentsConsented: response.data.documents_consented || [],
            });
        } else {
            throw BadRequestError(response.message || 'Failed to get session status');
        }
    })
);

/**
 * POST /api/kyc/digilocker/fetch-documents
 * Fetch and parse documents from DigiLocker session
 * Documents are returned as files with S3 URLs to XML content
 */
router.post(
    '/digilocker/fetch-documents',
    auth,
    kycLimiter,
    validate(Joi.object({
        sessionId: Joi.string().required(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { sessionId } = req.body;

        // Verify session is complete
        const statusResponse: any = await sandboxClient.getDigilockerSessionStatus(sessionId);
        const status = statusResponse.data?.status || statusResponse.status;
        if (status !== 'succeeded') {
            throw BadRequestError(`DigiLocker session not complete. Status: ${status}`);
        }

        // Fetch Aadhaar document
        let aadhaarData = null;
        try {
            const aadhaarResponse: any = await sandboxClient.getDigilockerDocument(sessionId, 'aadhaar');
            logger.info(`[DigiLocker] Aadhaar response code: ${aadhaarResponse.code}`);
            logger.info(`[DigiLocker] Aadhaar response data keys: ${JSON.stringify(Object.keys(aadhaarResponse.data || {}))}`);

            if (aadhaarResponse.code === 200 && aadhaarResponse.data?.files?.length > 0) {
                const fileInfo = aadhaarResponse.data.files[0];
                logger.info(`[DigiLocker] Aadhaar file URL: ${fileInfo.url?.substring(0, 100)}...`);
                aadhaarData = await digilockerParser.fetchAndParseAadhaar(fileInfo.url);
            } else {
                logger.warn(`[DigiLocker] Aadhaar response missing files. Code: ${aadhaarResponse.code}, Message: ${aadhaarResponse.message}`);
                logger.warn(`[DigiLocker] Full Aadhaar response: ${JSON.stringify(aadhaarResponse).substring(0, 500)}`);
            }
        } catch (error: any) {
            logger.error('[DigiLocker] Failed to fetch Aadhaar:', error.message || error);
            logger.error('[DigiLocker] Aadhaar error stack:', error.stack);
        }

        // Fetch PAN document
        let panData = null;
        try {
            const panResponse: any = await sandboxClient.getDigilockerDocument(sessionId, 'pan');
            logger.info(`[DigiLocker] PAN response code: ${panResponse.code}`);
            logger.info(`[DigiLocker] PAN response data keys: ${JSON.stringify(Object.keys(panResponse.data || {}))}`);

            if (panResponse.code === 200 && panResponse.data?.files?.length > 0) {
                const fileInfo = panResponse.data.files[0];
                logger.info(`[DigiLocker] PAN file URL: ${fileInfo.url?.substring(0, 100)}...`);
                panData = await digilockerParser.fetchAndParsePan(fileInfo.url);
            } else {
                logger.warn(`[DigiLocker] PAN response missing files. Code: ${panResponse.code}, Message: ${panResponse.message}`);
                logger.warn(`[DigiLocker] Full PAN response: ${JSON.stringify(panResponse).substring(0, 500)}`);
            }
        } catch (error: any) {
            logger.error('[DigiLocker] Failed to fetch PAN:', error.message || error);
            logger.error('[DigiLocker] PAN error stack:', error.stack);
        }

        if (!aadhaarData) {
            logger.error('[DigiLocker] aadhaarData is null - cannot proceed');
            throw BadRequestError('Could not fetch documents from DigiLocker. Please try again or use Aadhaar OTP method.');
        }

        // Update application
        const application = await Application.findById(req.user?.applicationId);
        if (application) {
            application.kyc.method = 'digilocker';
            application.kyc.aadhaar = digilockerParser.transformAadhaarToKycFormat(aadhaarData);

            if (panData) {
                application.kyc.pan = {
                    ...digilockerParser.transformPanToKycFormat(panData),
                    linkedWithAadhaar: true, // Assumed true as both came from DigiLocker
                };
            }

            await application.save();
            logger.info(`[DigiLocker] Documents verified: ${aadhaarData.name}`);
        }

        res.json({
            success: true,
            aadhaar: {
                name: aadhaarData.name,
                dob: aadhaarData.dob,
                gender: aadhaarData.gender,
                address: aadhaarData.address,
                hasPhoto: !!aadhaarData.photo,
            },
            pan: panData
                ? {
                    number: panData.number,
                    name: panData.name,
                }
                : null,
        });
    })
);

// ======================
// PAN Verification
// ======================

/**
 * POST /api/kyc/pan/verify
 * Verify PAN and check Aadhaar linking
 * @see https://developer.sandbox.co.in/api-reference/kyc/pan/verify
 */
router.post(
    '/pan/verify',
    auth,
    kycLimiter,
    validate(Joi.object({
        pan: schemas.pan,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { pan } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Use Aadhaar data for name and DOB matching if available
        let nameAsPerPan = 'NA';
        let dateOfBirth = '01/01/1990';

        if (application.kyc.aadhaar?.name) {
            nameAsPerPan = application.kyc.aadhaar.name;
        }
        if (application.kyc.aadhaar?.dob) {
            // Convert from various formats to DD/MM/YYYY
            const dob = application.kyc.aadhaar.dob;
            if (dob.includes('-')) {
                // Format: DD-MM-YYYY or YYYY-MM-DD
                const parts = dob.split('-');
                if (parts[0].length === 4) {
                    dateOfBirth = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    dateOfBirth = dob.replace(/-/g, '/');
                }
            } else if (dob.includes('/')) {
                dateOfBirth = dob;
            }
        }

        // Verify PAN with name and DOB
        const response: any = await sandboxClient.verifyPan(
            pan,
            nameAsPerPan,
            dateOfBirth,
            'Y',
            'KYC Verification for DSA Onboarding'
        );

        if (response.code !== 200 || !response.data) {
            throw BadRequestError(response.message || 'PAN verification failed');
        }

        const panData = response.data;

        // API returns status as 'valid' or 'invalid' (lowercase)
        const isValid = panData.status === 'valid';

        if (!isValid) {
            const remarks = panData.remarks ? ` (${panData.remarks})` : '';
            throw BadRequestError(`Invalid PAN number${remarks}`);
        }

        // Check for deceased/deleted/liquidated remarks - always block
        if (panData.remarks) {
            const remarksLower = panData.remarks.toLowerCase();
            if (remarksLower.includes('deceased') ||
                remarksLower.includes('deleted') ||
                remarksLower.includes('liquidated') ||
                remarksLower.includes('merger')) {
                throw BadRequestError(`PAN verification failed: ${panData.remarks}. This PAN cannot be used.`);
            }
        }

        // Cross-validation checks
        const nameMatch = panData.name_as_per_pan_match === true;
        const dobMatch = panData.date_of_birth_match === true;
        const aadhaarSeedingStatus = panData.aadhaar_seeding_status; // 'y', 'n', or 'na'
        const isLinkedWithAadhaar = aadhaarSeedingStatus === 'y';

        // Determine blocking and flagging based on cross-validation
        let flaggedForReview = false;
        const warnings: string[] = [];

        // RULE: Both name AND DOB mismatch = BLOCK
        if (nameAsPerPan !== 'NA' && !nameMatch && dateOfBirth !== '01/01/1990' && !dobMatch) {
            throw BadRequestError(
                'Both Name and Date of Birth in PAN do not match your Aadhaar details. ' +
                'Please ensure your PAN is registered under your name as per Aadhaar.'
            );
        }

        // RULE: Name mismatch alone = Flag for review
        if (nameAsPerPan !== 'NA' && !nameMatch) {
            flaggedForReview = true;
            warnings.push('Name in PAN does not match Aadhaar name - flagged for manual review');
            logger.warn(`[PAN] Name mismatch - Aadhaar: "${nameAsPerPan}" vs PAN API returned mismatch`);
        }

        // RULE: DOB mismatch alone = Flag for review
        if (dateOfBirth !== '01/01/1990' && !dobMatch) {
            flaggedForReview = true;
            warnings.push('Date of birth in PAN does not match Aadhaar DOB - flagged for manual review');
            logger.warn(`[PAN] DOB mismatch - Aadhaar DOB: ${dateOfBirth} vs PAN API returned mismatch`);
        }

        // RULE: Not linked with Aadhaar = Flag for review with warning
        if (aadhaarSeedingStatus === 'n') {
            flaggedForReview = true;
            warnings.push('PAN is not linked with Aadhaar. Please link your PAN with Aadhaar to avoid issues.');
            logger.warn(`[PAN] Not linked with Aadhaar: ${pan}`);
        }

        // RULE: Linking status N/A = Flag for review
        if (aadhaarSeedingStatus === 'na') {
            flaggedForReview = true;
            warnings.push('PAN-Aadhaar linking status is unavailable - flagged for manual review');
            logger.warn(`[PAN] Aadhaar linking status N/A: ${pan}`);
        }

        // Check category - Person vs Company mismatch for Individual entity type
        if (panData.category && panData.category !== 'individual') {
            if (application.entityType === 'individual') {
                throw BadRequestError(
                    `PAN category is "${panData.category}" but your entity type is Individual. ` +
                    `Please use a personal PAN (category: individual).`
                );
            }
        }

        // Update application
        application.kyc.pan = {
            number: pan,
            name: nameAsPerPan !== 'NA' ? nameAsPerPan : pan,
            verified: !flaggedForReview, // Not verified if flagged
            linkedWithAadhaar: isLinkedWithAadhaar,
            verifiedAt: new Date(),
        };

        // Store cross-validation results
        if (!application.kyc.crossValidation) {
            application.kyc.crossValidation = {};
        }
        application.kyc.crossValidation.panAadhaar = {
            nameMatch,
            dobMatch,
            flaggedForReview,
            warnings,
            checkedAt: new Date(),
        };

        await application.save();

        logger.info(`[PAN] Verified: ${pan}, category: ${panData.category}, aadhaar_linked: ${isLinkedWithAadhaar}, name_match: ${nameMatch}, dob_match: ${dobMatch}, flagged: ${flaggedForReview}`);

        res.json({
            success: true,
            verified: !flaggedForReview,
            flaggedForReview,
            pan: {
                number: pan,
                category: panData.category,
                nameMatch,
                dobMatch,
                linkedWithAadhaar: isLinkedWithAadhaar,
                aadhaarSeedingStatus,
                remarks: panData.remarks,
            },
            crossValidation: {
                nameMatch,
                dobMatch,
                aadhaarLinked: isLinkedWithAadhaar,
                aadhaarSeedingStatus,
                warnings: warnings.length > 0 ? warnings : undefined,
            },
        });
    })
);

/**
 * POST /api/kyc/selfie
 * Upload selfie image (base64)
 */
router.post(
    '/selfie',
    auth,
    kycLimiter,
    validate(Joi.object({
        image: Joi.string().required().min(100), // Base64 image string
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { image } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Store selfie
        application.kyc.selfie = {
            image: image,
            capturedAt: new Date(),
        };
        await application.save();

        logger.info(`[KYC] Selfie uploaded for application: ${application._id}`);

        res.json({
            success: true,
            message: 'Selfie uploaded successfully',
        });
    })
);

/**
 * POST /api/kyc/complete
 * Mark KYC step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Verify required data is present
        if (!application.kyc.aadhaar?.verifiedAt) {
            throw BadRequestError('Aadhaar verification is required');
        }

        if (!application.kyc.pan?.verified) {
            throw BadRequestError('PAN verification is required');
        }

        if (!application.kyc.selfie?.capturedAt) {
            throw BadRequestError('Selfie verification is required');
        }

        // Mark KYC as complete
        application.completedSteps.kyc = true;
        application.completedSteps.pan = true;
        await application.save();

        res.json({
            success: true,
            message: 'KYC step completed',
            nextStep: application.getNextStep(),
        });
    })
);

export default router;

