/**
 * Company Routes
 * Handles: Company/LLP verification via MCA
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Application } from '../models/Application.js';
import { sandboxClient } from '../services/sandbox/index.js';
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

/**
 * POST /api/company/verify
 * Verify company/LLP by CIN/LLPIN
 * @see https://developer.sandbox.co.in/api-reference/kyc/mca/company-master-data
 */
router.post(
    '/verify',
    auth,
    kycLimiter,
    validate(Joi.object({
        cin: Joi.string().when('llpin', {
            is: Joi.exist(),
            then: Joi.optional(),
            otherwise: Joi.required(),
        }),
        llpin: Joi.string().optional(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { cin, llpin } = req.body;
        const identifier = cin || llpin;

        if (!identifier) {
            throw BadRequestError('CIN or LLPIN is required');
        }

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'company') {
            throw BadRequestError('Company verification only for Company entity type');
        }

        // Call MCA API
        const response: any = await sandboxClient.verifyCompanyMasterData(identifier);

        if (!response.data || response.code !== 200) {
            throw BadRequestError(response.message || 'Company verification failed');
        }

        const data = response.data;
        const isLLP = data['@entity'] === 'in.co.sandbox.kyc.mca.llp';

        // Parse company or LLP data
        const masterData = isLLP ? data.llp_master_data : data.company_master_data;

        if (!masterData) {
            throw BadRequestError('Failed to get company data from MCA');
        }

        // Extract directors/partners from directors/signatory_details
        const signatoryDetails = data['directors/signatory_details'] || [];
        const directors = signatoryDetails.map((d: any) => ({
            din: d['din/pan'] || d.din || '',
            name: d.name || '',
            designation: d.designation || '',
            beginDate: d.begin_date || '',
            endDate: d.end_date || '-',
            kycCompleted: false,
        }));

        // Get status based on company or LLP
        const companyStatus = isLLP
            ? masterData.llp_status
            : masterData['company_status(for_efiling)'];

        // Check if company is active
        if (companyStatus && !companyStatus.toLowerCase().includes('active')) {
            throw BadRequestError(`Company status is "${companyStatus}". Only Active companies are allowed.`);
        }

        // Build company data
        const companyName = isLLP ? masterData.llp_name : masterData.company_name;
        const companyCin = isLLP ? undefined : masterData.cin;
        const companyLlpin = isLLP ? masterData.llpin : undefined;
        const registrationDate = masterData.date_of_incorporation;
        const registeredAddress = masterData.registered_address;

        // Update application
        application.company = {
            cin: companyCin,
            llpin: companyLlpin,
            name: companyName,
            status: companyStatus,
            registrationDate,
            registeredAddress,
            email: masterData.email_id,
            authorizedCapital: masterData['authorised_capital(rs)'],
            paidUpCapital: masterData['paid_up_capital(rs)'],
            directors,
        };

        await application.save();

        logger.info(`[Company] Verified: ${companyName} (${identifier}), Directors: ${directors.length}`);

        res.json({
            success: true,
            verified: true,
            isLLP,
            company: {
                name: companyName,
                cin: companyCin,
                llpin: companyLlpin,
                status: companyStatus,
                registrationDate,
                registeredAddress,
                directorsCount: directors.length,
                directors: directors.map((d: any) => ({
                    din: d.din,
                    name: d.name,
                    designation: d.designation,
                })),
            },
        });
    })
);

/**
 * GET /api/company
 * Get company details
 */
router.get(
    '/',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (!application.company) {
            throw NotFoundError('Company not verified yet');
        }

        res.json({
            success: true,
            company: {
                name: application.company.name,
                cin: application.company.cin,
                llpin: application.company.llpin,
                status: application.company.status,
                registrationDate: application.company.registrationDate,
                registeredAddress: application.company.registeredAddress,
                directors: application.company.directors.map(d => ({
                    din: d.din,
                    name: d.name,
                    designation: d.designation,
                    kycCompleted: d.kycCompleted,
                })),
            },
        });
    })
);

/**
 * GET /api/company/directors
 * Get list of directors requiring KYC
 */
router.get(
    '/directors',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (!application.company) {
            throw NotFoundError('Company not verified yet');
        }

        const directors = application.company.directors.map(d => ({
            din: d.din,
            name: d.name,
            designation: d.designation,
            kycCompleted: d.kycCompleted,
            panNumber: d.panNumber ? `${d.panNumber.slice(0, 4)}****${d.panNumber.slice(-1)}` : null,
        }));

        const pendingKyc = directors.filter(d => !d.kycCompleted);

        res.json({
            success: true,
            directors,
            total: directors.length,
            kycCompleted: directors.length - pendingKyc.length,
            kycPending: pendingKyc.length,
        });
    })
);

/**
 * POST /api/company/complete
 * Mark company verification step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (!application.company?.name) {
            throw BadRequestError('Please verify company details first');
        }

        application.completedSteps.companyVerification = true;
        await application.save();

        res.json({
            success: true,
            message: 'Company verification completed',
            nextStep: application.getNextStep(),
        });
    })
);

/**
 * POST /api/directors/complete
 * Mark directors KYC step as complete
 */
router.post(
    '/directors/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (!application.company?.directors?.length) {
            throw BadRequestError('No directors found');
        }

        // Check if all directors completed KYC
        const pendingKyc = application.company.directors.filter(d => !d.kycCompleted);
        if (pendingKyc.length > 0) {
            throw BadRequestError(
                `${pendingKyc.length} director(s) have not completed KYC`
            );
        }

        application.completedSteps.directors = true;
        await application.save();

        res.json({
            success: true,
            message: 'Directors KYC completed',
            nextStep: application.getNextStep(),
        });
    })
);

/**
 * POST /api/company/directors/:din/verify-pan
 * Verify PAN for a specific director with full cross-validation
 */
router.post(
    '/directors/:din/verify-pan',
    auth,
    validate(Joi.object({
        pan: schemas.pan,
        name: Joi.string().min(2).max(100).required(),
        dob: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/).required(), // DD/MM/YYYY
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { din } = req.params;
        const { pan, name, dob } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.entityType !== 'company') {
            throw BadRequestError('Directors only apply to Company entity type');
        }

        if (!application.company?.directors?.length) {
            throw BadRequestError('No directors found. Please verify company first.');
        }

        // Find director by DIN
        const directorIndex = application.company.directors.findIndex(d => d.din === din);
        if (directorIndex === -1) {
            throw NotFoundError(`Director with DIN ${din} not found`);
        }

        const director = application.company.directors[directorIndex];

        // Check if PAN already verified
        if (director.kycCompleted && director.panNumber) {
            throw BadRequestError('Director PAN already verified');
        }

        // Verify PAN with name and DOB
        const response: any = await sandboxClient.verifyPan(
            pan,
            name,
            dob,
            'Y',
            'Director KYC Verification for DSA Onboarding'
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
                `Both Name and Date of Birth for director "${director.name}" (DIN: ${din}) do not match PAN records. ` +
                'Please verify the director details are correct.'
            );
        }

        // RULE: Name mismatch alone = Flag
        if (!nameMatch) {
            flaggedForReview = true;
            warnings.push(`Director name does not match PAN records`);
            logger.warn(`[Director PAN] Name mismatch for DIN ${din}: "${name}"`);
        }

        // RULE: DOB mismatch alone = Flag
        if (!dobMatch) {
            flaggedForReview = true;
            warnings.push(`Director DOB does not match PAN records`);
            logger.warn(`[Director PAN] DOB mismatch for DIN ${din}: ${dob}`);
        }

        // RULE: Not linked with Aadhaar = Flag
        if (aadhaarSeedingStatus === 'n') {
            flaggedForReview = true;
            warnings.push('Director PAN is not linked with Aadhaar');
            logger.warn(`[Director PAN] Not linked with Aadhaar: ${pan}`);
        }

        // RULE: Linking status N/A = Flag
        if (aadhaarSeedingStatus === 'na') {
            flaggedForReview = true;
            warnings.push('Director PAN-Aadhaar linking status unavailable');
            logger.warn(`[Director PAN] Aadhaar linking status N/A: ${pan}`);
        }

        // RULE: PAN must be individual type for directors
        if (panData.category && panData.category !== 'individual') {
            throw BadRequestError(
                `Director PAN category is "${panData.category}". Directors must use personal PAN (category: individual).`
            );
        }

        // Update director
        application.company.directors[directorIndex].panNumber = pan;
        application.company.directors[directorIndex].kycCompleted = !flaggedForReview;
        // Store KYC data
        if (!application.company.directors[directorIndex].kycData) {
            application.company.directors[directorIndex].kycData = {};
        }
        application.company.directors[directorIndex].kycData!.pan = {
            number: pan,
            name: name,
            verified: !flaggedForReview,
            linkedWithAadhaar: isLinkedWithAadhaar,
            verifiedAt: new Date(),
        };

        await application.save();

        logger.info(`[Director PAN] Verified DIN ${din}: ${pan}, category: ${panData.category}, flagged: ${flaggedForReview}`);

        res.json({
            success: true,
            verified: !flaggedForReview,
            flaggedForReview,
            din,
            directorName: director.name,
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

export default router;
