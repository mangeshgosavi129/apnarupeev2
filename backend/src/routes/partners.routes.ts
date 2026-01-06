/**
 * Partners Routes
 * Handles: Partnership firm partner management
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Application } from '../models/Application.js';
import logger from '../utils/logger.js';
import {
    auth,
    asyncHandler,
    BadRequestError,
    NotFoundError,
    validate,
    schemas,
} from '../middleware/index.js';

const router = Router();

// Partner validation schema
const partnerSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: schemas.phone,
    email: schemas.email.optional(),
    isLeadPartner: Joi.boolean().default(false),
});

/**
 * GET /api/partners
 * Get all partners for current partnership application
 */
router.get(
    '/',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partners only apply to Partnership entity type');
        }

        const partners = application.partners.map(p => ({
            name: p.name,
            phone: p.phone,
            email: p.email,
            isLeadPartner: p.isLeadPartner,
            kycCompleted: p.kycCompleted,
            panNumber: p.panNumber ? `${p.panNumber.slice(0, 4)}****${p.panNumber.slice(-1)}` : null,
            hasPhoto: !!p.kycData?.selfie?.image,
        }));

        const leadPartner = partners.find(p => p.isLeadPartner);
        const kycPendingCount = partners.filter(p => !p.kycCompleted).length;

        res.json({
            success: true,
            partners,
            count: partners.length,
            leadPartner: leadPartner?.name || null,
            kycPendingCount,
            allKycComplete: kycPendingCount === 0 && partners.length > 0,
        });
    })
);

/**
 * POST /api/partners
 * Add a partner
 */
router.post(
    '/',
    auth,
    validate(partnerSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, phone, email, isLeadPartner } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partners only apply to Partnership entity type');
        }

        // Check max partners (10)
        if (application.partners.length >= 10) {
            throw BadRequestError('Maximum 10 partners allowed');
        }

        // Check duplicate phone
        const duplicate = application.partners.find(p => p.phone === phone);
        if (duplicate) {
            throw BadRequestError('Partner with this phone number already exists');
        }

        // If setting as lead partner, unset previous lead
        if (isLeadPartner) {
            application.partners.forEach(p => {
                p.isLeadPartner = false;
            });
        }

        application.partners.push({
            name,
            phone,
            email,
            isLeadPartner: isLeadPartner || application.partners.length === 0, // First partner is lead by default
            kycCompleted: false,
        });

        await application.save();

        logger.info(`[Partners] Added: ${name} for ${application._id}`);

        res.json({
            success: true,
            message: 'Partner added successfully',
            partner: { name, phone, email, isLeadPartner },
            count: application.partners.length,
        });
    })
);

/**
 * PUT /api/partners/:index
 * Update a partner
 */
router.put(
    '/:index',
    auth,
    validate(partnerSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { name, phone, email, isLeadPartner } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        // If setting as lead partner, unset previous lead
        if (isLeadPartner) {
            application.partners.forEach((p, i) => {
                if (i !== index) p.isLeadPartner = false;
            });
        }

        application.partners[index] = {
            ...application.partners[index],
            name,
            phone,
            email,
            isLeadPartner,
        };

        await application.save();

        res.json({
            success: true,
            message: 'Partner updated',
            partner: application.partners[index],
        });
    })
);

/**
 * DELETE /api/partners/:index
 * Remove a partner
 */
router.delete(
    '/:index',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const removed = application.partners.splice(index, 1);

        // If removed partner was lead, make first partner the new lead
        if (removed[0].isLeadPartner && application.partners.length > 0) {
            application.partners[0].isLeadPartner = true;
        }

        await application.save();

        logger.info(`[Partners] Removed: ${removed[0].name} from ${application._id}`);

        res.json({
            success: true,
            message: 'Partner removed',
            count: application.partners.length,
        });
    })
);

/**
 * POST /api/partners/complete
 * Mark partners step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partners only apply to Partnership entity type');
        }

        if (application.partners.length < 2) {
            throw BadRequestError('Partnership requires at least 2 partners');
        }

        // Check if all partners completed KYC
        const pendingKyc = application.partners.filter(p => !p.kycCompleted);
        if (pendingKyc.length > 0) {
            throw BadRequestError(
                `${pendingKyc.length} partner(s) have not completed KYC verification`
            );
        }

        application.completedSteps.partners = true;
        await application.save();

        res.json({
            success: true,
            message: 'Partners step completed',
            nextStep: application.getNextStep(),
        });
    })
);

/**
 * POST /api/partners/:index/verify-pan
 * Verify PAN for a specific partner with full cross-validation
 */
router.post(
    '/:index/verify-pan',
    auth,
    validate(Joi.object({
        pan: schemas.pan,
        name: Joi.string().min(2).max(100).required(),
        dob: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/).required(), // DD/MM/YYYY
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { pan, name, dob } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partners only apply to Partnership entity type');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const partner = application.partners[index];

        // Check if PAN already verified
        if (partner.kycCompleted && partner.panNumber) {
            throw BadRequestError('Partner PAN already verified');
        }

        // Import sandbox client dynamically to avoid circular dependency
        const { sandboxClient } = await import('../services/sandbox/index.js');

        // Verify PAN with name and DOB
        const response: any = await sandboxClient.verifyPan(
            pan,
            name,
            dob,
            'Y',
            'Partner KYC Verification for DSA Onboarding'
        );

        if (response.code !== 200 || !response.data) {
            throw BadRequestError(response.message || 'PAN verification failed');
        }

        const panData = response.data;

        // Check PAN validity
        if (panData.status !== 'valid') {
            const remarks = panData.remarks ? ` (${panData.remarks})` : '';
            throw BadRequestError(`Invalid PAN number${remarks}`);
        }

        // Check for deceased/deleted remarks - always block
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
        const aadhaarSeedingStatus = panData.aadhaar_seeding_status;
        const isLinkedWithAadhaar = aadhaarSeedingStatus === 'y';

        // Determine blocking and flagging
        let flaggedForReview = false;
        const warnings: string[] = [];

        // RULE: Both name AND DOB mismatch = BLOCK
        if (!nameMatch && !dobMatch) {
            throw BadRequestError(
                `Both Name and Date of Birth for partner "${partner.name}" do not match PAN records. ` +
                'Please verify the partner details are correct.'
            );
        }

        // RULE: Name mismatch alone = Flag
        if (!nameMatch) {
            flaggedForReview = true;
            warnings.push(`Partner name does not match PAN records`);
            logger.warn(`[Partner PAN] Name mismatch for partner ${index}: "${name}"`);
        }

        // RULE: DOB mismatch alone = Flag
        if (!dobMatch) {
            flaggedForReview = true;
            warnings.push(`Partner DOB does not match PAN records`);
            logger.warn(`[Partner PAN] DOB mismatch for partner ${index}: ${dob}`);
        }

        // RULE: Not linked with Aadhaar = Flag
        if (aadhaarSeedingStatus === 'n') {
            flaggedForReview = true;
            warnings.push('Partner PAN is not linked with Aadhaar');
            logger.warn(`[Partner PAN] Not linked with Aadhaar: ${pan}`);
        }

        // RULE: Linking status N/A = Flag
        if (aadhaarSeedingStatus === 'na') {
            flaggedForReview = true;
            warnings.push('Partner PAN-Aadhaar linking status unavailable');
            logger.warn(`[Partner PAN] Aadhaar linking status N/A: ${pan}`);
        }

        // RULE: PAN must be individual type for partners
        if (panData.category && panData.category !== 'individual') {
            throw BadRequestError(
                `Partner PAN category is "${panData.category}". Partners must use personal PAN (category: individual).`
            );
        }

        // Update partner
        application.partners[index].panNumber = pan;
        application.partners[index].kycCompleted = !flaggedForReview;
        // Store KYC data if available
        if (!application.partners[index].kycData) {
            application.partners[index].kycData = {};
        }
        application.partners[index].kycData!.pan = {
            number: pan,
            name: name,
            verified: !flaggedForReview,
            linkedWithAadhaar: isLinkedWithAadhaar,
            verifiedAt: new Date(),
        };

        await application.save();

        logger.info(`[Partner PAN] Verified for partner ${index}: ${pan}, category: ${panData.category}, flagged: ${flaggedForReview}`);

        res.json({
            success: true,
            verified: !flaggedForReview,
            flaggedForReview,
            partnerIndex: index,
            partnerName: partner.name,
            pan: {
                number: pan,
                category: panData.category,
                nameMatch,
                dobMatch,
                linkedWithAadhaar: isLinkedWithAadhaar,
                aadhaarSeedingStatus,
            },
            crossValidation: {
                nameMatch,
                dobMatch,
                aadhaarLinked: isLinkedWithAadhaar,
                warnings: warnings.length > 0 ? warnings : undefined,
            },
        });
    })
);

/**
 * POST /api/partners/:index/kyc/initiate
 * Initiate Aadhaar OTP verification for a specific partner
 */
router.post(
    '/:index/kyc/initiate',
    auth,
    validate(Joi.object({
        aadhaarNumber: Joi.string().length(12).pattern(/^\d+$/).required(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { aadhaarNumber } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partner KYC only applies to Partnership entity type');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const partner = application.partners[index];

        if (partner.kycCompleted) {
            throw BadRequestError('Partner KYC is already completed');
        }

        // Import sandbox service
        const { sandboxClient } = await import('../services/sandbox/index.js');

        // Call Sandbox Aadhaar OTP generation
        const response = await sandboxClient.generateAadhaarOtp(aadhaarNumber) as any;

        if (response.code === 200 && response.data?.reference_id) {
            logger.info(`[Partner KYC] OTP initiated for partner ${index}: ${partner.name}`);

            res.json({
                success: true,
                message: 'OTP sent to partner\'s registered mobile number',
                partnerIndex: index,
                partnerName: partner.name,
                referenceId: response.data.reference_id,
            });
        } else {
            const apiMessage = response.message || response.data?.message || 'Failed to generate OTP';

            if (apiMessage.includes('OTP generated') && apiMessage.includes('try after')) {
                throw BadRequestError('Please wait 45 seconds and try again.');
            }
            if (apiMessage.includes('Invalid Aadhaar')) {
                throw BadRequestError('Invalid Aadhaar number. Please check and try again.');
            }

            throw BadRequestError(apiMessage);
        }
    })
);

/**
 * POST /api/partners/:index/kyc/verify
 * Verify OTP and complete partner KYC
 */
router.post(
    '/:index/kyc/verify',
    auth,
    validate(Joi.object({
        referenceId: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        otp: Joi.string().length(6).pattern(/^\d+$/).required(),
        aadhaarNumber: Joi.string().length(12).pattern(/^\d+$/).optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { referenceId, otp, aadhaarNumber } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partner KYC only applies to Partnership entity type');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const partner = application.partners[index];

        if (partner.kycCompleted) {
            throw BadRequestError('Partner KYC is already completed');
        }

        // Import sandbox service
        const { sandboxClient } = await import('../services/sandbox/index.js');

        // Verify OTP
        const response = await sandboxClient.verifyAadhaarOtp(
            String(referenceId),
            otp
        ) as any;

        const apiMessage = response.data?.message || response.message || '';

        if (apiMessage.includes('Invalid OTP')) {
            throw BadRequestError('Invalid OTP. Please try again.');
        }
        if (apiMessage.includes('OTP Expired')) {
            throw BadRequestError('OTP has expired. Please request a new OTP.');
        }
        if (apiMessage.includes('Invalid Reference')) {
            throw BadRequestError('Invalid reference. Please request a new OTP.');
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

            // Update partner's KYC data (but DO NOT mark kycCompleted - that happens after PAN)
            const maskedNumber = aadhaarNumber
                ? `XXXX XXXX ${aadhaarNumber.slice(-4)}`
                : 'XXXX XXXX XXXX';

            partner.aadhaarMasked = maskedNumber;
            partner.kycData = {
                method: 'aadhaar_otp',
                aadhaar: {
                    name: kycData.name,
                    maskedNumber,
                    dob: kycData.date_of_birth,
                    gender: kycData.gender,
                    address: kycData.full_address,
                    photo: kycData.photo,
                    verifiedAt: new Date(),
                },
            };

            await application.save();

            logger.info(`[Partner KYC] Verified: ${partner.name} (partner ${index})`);

            res.json({
                success: true,
                verified: true,
                partnerIndex: index,
                partnerName: partner.name,
                aadhaarData: {
                    name: kycData.name,
                    gender: kycData.gender,
                    dob: kycData.date_of_birth,
                    hasPhoto: !!kycData.photo,
                },
                // Don't mark complete yet - need PAN verification
                message: 'Aadhaar verified. Please verify PAN to complete KYC.',
                nextStep: 'pan',
            });
        } else {
            throw BadRequestError(response.data?.message || 'OTP verification failed');
        }
    })
);

/**
 * POST /api/partners/:index/kyc/verify-pan
 * Verify PAN for partner and complete KYC
 */
router.post(
    '/:index/kyc/verify-pan',
    auth,
    validate(Joi.object({
        pan: Joi.string().length(10).pattern(/^[A-Z]{3}[PCFTGHLABJ][A-Z][0-9]{4}[A-Z]$/).required(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { pan } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partner KYC only applies to Partnership entity type');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const partner = application.partners[index];

        if (partner.kycCompleted) {
            throw BadRequestError('Partner KYC is already completed');
        }

        // Check if Aadhaar was verified first
        if (!partner.kycData?.aadhaar?.name) {
            throw BadRequestError('Please complete Aadhaar verification before PAN verification');
        }

        // Get partner's name and DOB from Aadhaar
        const aadhaarName = partner.kycData.aadhaar.name;
        // Aadhaar DOB is in format DD-MM-YYYY, PAN API needs DD/MM/YYYY
        let aadhaarDob = partner.kycData.aadhaar.dob || '01/01/1990';
        if (aadhaarDob.includes('-')) {
            aadhaarDob = aadhaarDob.replace(/-/g, '/'); // Convert DD-MM-YYYY to DD/MM/YYYY
        }

        // Import sandbox service and verify PAN
        const { sandboxClient } = await import('../services/sandbox/index.js');
        const response = await sandboxClient.verifyPan(pan, aadhaarName, aadhaarDob) as any;

        if (response.code !== 200 || !response.data) {
            throw BadRequestError(response.data?.message || 'PAN verification failed');
        }

        const panData = response.data;

        if (panData.status !== 'valid') {
            throw BadRequestError('Invalid PAN number');
        }

        // Check name and DOB match - STRICT CROSS-VALIDATION
        const nameMatch = panData.name_as_per_pan_match === true;
        const dobMatch = panData.date_of_birth_match === true;
        const isLinkedWithAadhaar = panData.aadhaar_seeding_status === 'y';

        // STRICT: Name must match between PAN and Aadhaar
        if (!nameMatch) {
            logger.warn(`[Partner KYC] PAN-Aadhaar name mismatch for partner ${index}: PAN=${pan}`);
            throw BadRequestError('PAN name does not match Aadhaar name. Please ensure you are using your own PAN card.');
        }

        // Warning: DOB mismatch (allow but flag)
        if (!dobMatch) {
            logger.warn(`[Partner KYC] DOB mismatch for partner ${index}: PAN=${pan}, AadhaarDOB=${aadhaarDob}`);
        }

        // Warning: PAN not linked with Aadhaar (allow but flag)
        if (!isLinkedWithAadhaar) {
            logger.warn(`[Partner KYC] PAN not linked with Aadhaar for partner ${index}: PAN=${pan}`);
        }

        // Update partner KYC data with PAN
        partner.panNumber = pan;
        partner.kycData.pan = {
            number: pan,
            name: aadhaarName,
            verified: true,
            nameMatch,
            dobMatch,
            linkedWithAadhaar: isLinkedWithAadhaar,
            verifiedAt: new Date(),
        };

        // Update partner name with Aadhaar-verified name
        partner.name = aadhaarName;

        // Mark KYC as complete
        partner.kycCompleted = true;

        await application.save();

        logger.info(`[Partner KYC] PAN verified for partner ${index}: ${pan}, nameMatch=${nameMatch}, dobMatch=${dobMatch}`);

        res.json({
            success: true,
            verified: true,
            partnerIndex: index,
            partnerName: partner.name,
            kycCompleted: true,
            panData: {
                pan,
                category: panData.category,
                nameMatch,
                dobMatch,
                aadhaarLinked: isLinkedWithAadhaar,
            },
        });
    })
);

/**
 * POST /api/partners/:index/photo
 * Upload selfie/photo for partner (required for lead partner for agreement)
 */
router.post(
    '/:index/photo',
    auth,
    validate(Joi.object({
        photo: Joi.string().required().description('Base64 encoded photo (JPEG/PNG)'),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { photo } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'partnership') {
            throw BadRequestError('Partner photo only applies to Partnership entity type');
        }

        if (index < 0 || index >= application.partners.length) {
            throw NotFoundError('Partner not found');
        }

        const partner = application.partners[index];

        // Validate photo is valid base64
        const base64Regex = /^data:image\/(jpeg|jpg|png);base64,/i;
        let photoData = photo;

        // If it has data URI prefix, keep it; otherwise it's raw base64
        if (!base64Regex.test(photo)) {
            // Add data URI prefix for JPEG if missing
            photoData = `data:image/jpeg;base64,${photo}`;
        }

        // Save photo to partner's kycData
        if (!partner.kycData) {
            partner.kycData = {};
        }
        partner.kycData.selfie = {
            image: photoData,
            capturedAt: new Date(),
        };

        await application.save();

        logger.info(`[Partner Photo] Uploaded for partner ${index}: ${partner.name} (isLeadPartner: ${partner.isLeadPartner})`);

        res.json({
            success: true,
            partnerIndex: index,
            partnerName: partner.name,
            hasPhoto: true,
            message: 'Photo uploaded successfully',
        });
    })
);

export default router;
