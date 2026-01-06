/**
 * Agreement Routes
 * Handles: PDF generation, E-Stamp, E-Sign flow
 */
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Application } from '../models/Application.js';
import { estampService } from '../services/signdesk/estamp.service.js';
import { esignService } from '../services/signdesk/esign.service.js';
import { generateAgreementPDF } from '../services/pdf-agreement/pdfService.js';
import logger from '../utils/logger.js';
import {
    auth,
    asyncHandler,
    BadRequestError,
    NotFoundError,
} from '../middleware/index.js';

const router = Router();

// Ensure agreements directory exists
const agreementsDir = path.join(process.cwd(), 'uploads', 'agreements');
if (!fs.existsSync(agreementsDir)) {
    fs.mkdirSync(agreementsDir, { recursive: true });
}

/**
 * Helper: Format address object to string
 */
function formatAddressObject(addressData: any): string {
    if (!addressData) return '';
    if (typeof addressData === 'string') return addressData;
    if (typeof addressData === 'object') {
        const parts = [
            addressData.house, addressData.street, addressData.landmark,
            addressData.loc, addressData.vtc, addressData.subdist,
            addressData.dist, addressData.state, addressData.country,
            addressData.pc || addressData.pincode
        ].filter(Boolean);
        return parts.join(', ');
    }
    return String(addressData);
}

/**
 * Helper: Get signatory data based on entity type
 */
function getSignatoryData(application: any): {
    name: string;
    pan: string;
    address: string;
    dob: string;
    gender: string;
    aadhaarLast4: string;
    email: string;
    phone: string;
} {
    const entityType = application.entityType;
    let kyc, aadhaarData, maskedNumber;

    if (entityType === 'partnership') {
        // For Partnership - get signatory partner's data
        const partners = application.partners || [];
        const signatory = partners.find((p: any) => p.isSignatory || p.isLeadPartner) || partners[0] || {};
        kyc = signatory.kyc || signatory.kycData || {};
        aadhaarData = kyc.aadhaar?.data || kyc.aadhaar || {};
        maskedNumber = kyc.aadhaar?.maskedNumber || signatory.aadhaarMasked || '';

        return {
            name: aadhaarData.name || signatory.name || 'Partnership Signatory',
            pan: kyc.pan?.number || signatory.panNumber || 'N/A',
            address: formatAddressObject(aadhaarData.address || aadhaarData.full_address) || 'N/A',
            dob: aadhaarData.date_of_birth || aadhaarData.dob || '01-01-1990',
            gender: aadhaarData.gender === 'FEMALE' || aadhaarData.gender === 'F' ? 'F' : 'M',
            aadhaarLast4: maskedNumber.slice(-4) || '0000',
            email: signatory.email || application.email || '',
            phone: signatory.phone || signatory.mobile || application.phone || '',
        };
    } else if (entityType === 'company') {
        // For Company - get signatory director's data
        const directors = application.directors || application.company?.directors || [];
        const signatory = directors.find((d: any) => d.isSignatory) || directors[0] || {};
        kyc = signatory.kyc || signatory.kycData || {};
        aadhaarData = kyc.aadhaar?.data || kyc.aadhaar || {};
        maskedNumber = kyc.aadhaar?.maskedNumber || signatory.aadhaarMasked || '';

        return {
            name: aadhaarData.name || signatory.name || 'Director',
            pan: kyc.pan?.number || signatory.panNumber || 'N/A',
            address: formatAddressObject(aadhaarData.address || aadhaarData.full_address) || 'N/A',
            dob: aadhaarData.date_of_birth || aadhaarData.dob || '01-01-1990',
            gender: aadhaarData.gender === 'FEMALE' || aadhaarData.gender === 'F' ? 'F' : 'M',
            aadhaarLast4: maskedNumber.slice(-4) || '0000',
            email: signatory.email || application.email || '',
            phone: signatory.phone || signatory.mobile || application.phone || '',
        };
    } else {
        // For Individual/Proprietorship - use main KYC data
        kyc = application.kyc || {};
        aadhaarData = kyc.aadhaar?.data || kyc.aadhaar || {};
        maskedNumber = kyc.aadhaar?.maskedNumber || '';

        return {
            name: aadhaarData.name || 'Individual Applicant',
            pan: kyc.pan?.number || 'N/A',
            address: formatAddressObject(aadhaarData.address || aadhaarData.full_address) || 'N/A',
            dob: aadhaarData.date_of_birth || aadhaarData.dob || '01-01-1990',
            gender: aadhaarData.gender === 'FEMALE' || aadhaarData.gender === 'F' ? 'F' : 'M',
            aadhaarLast4: maskedNumber.slice(-4) || '0000',
            email: application.email || '',
            phone: application.phone || '',
        };
    }
}

/**
 * POST /api/agreement/generate
 * Generate PDF agreement based on entity type
 */
router.post(
    '/generate',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Verify all required steps are complete
        const { entityType, completedSteps } = application;

        // Build required steps based on entity type
        // Note: For partnership/company, KYC is done via partners/directors step, not separate kyc step
        const requiredSteps: (keyof typeof completedSteps)[] = ['bank'];

        if (entityType === 'individual' || entityType === 'proprietorship') {
            // Individual/Proprietorship has application-level KYC
            requiredSteps.push('kyc');
            requiredSteps.push('references');
        }
        if (entityType === 'proprietorship' || entityType === 'partnership' || entityType === 'company') {
            requiredSteps.push('documents');
        }
        if (entityType === 'partnership') {
            // Partnership KYC is done via partners step
            requiredSteps.push('partners');
            requiredSteps.push('references');
        }
        if (entityType === 'company') {
            // Company KYC is done via directors step
            requiredSteps.push('companyVerification', 'directors');
        }

        const missingSteps = requiredSteps.filter(step => !completedSteps[step]);
        if (missingSteps.length > 0) {
            throw BadRequestError(`Please complete these steps first: ${missingSteps.join(', ')}`);
        }

        // Prepare application data for PDF generation
        const appData = application.toObject();

        // Generate PDF using pdf-agreement-service
        logger.info(`[Agreement] Generating PDF for ${entityType}: ${application._id}`);

        const pdfBuffer = await generateAgreementPDF({
            entityType: appData.entityType as any,
            companySubType: appData.companySubType as any,
            phone: appData.phone,
            email: appData.email || '',
            kyc: {
                method: appData.kyc?.method,
                aadhaar: appData.kyc?.aadhaar ? {
                    maskedNumber: appData.kyc.aadhaar.maskedNumber,
                    name: appData.kyc.aadhaar.name,
                    dob: appData.kyc.aadhaar.dob,
                    gender: appData.kyc.aadhaar.gender,
                    address: appData.kyc.aadhaar.address,
                    photo: appData.kyc.aadhaar.photo,
                    data: {
                        name: appData.kyc.aadhaar.name,
                        dob: appData.kyc.aadhaar.dob,
                        address: appData.kyc.aadhaar.address,
                        gender: appData.kyc.aadhaar.gender,
                    },
                } : undefined,
                pan: appData.kyc?.pan,
                liveness: appData.kyc?.liveness,
                faceMatch: appData.kyc?.faceMatch,
                selfie: appData.kyc?.selfie,
            },
            references: appData.references?.map((ref: any) => ({
                name: ref.name,
                mobile: ref.mobile,
                email: ref.email,
                address: ref.address,
            })),
            partners: appData.partners?.map((p: any) => ({
                name: p.name,
                phone: p.phone,
                email: p.email,
                isLeadPartner: p.isLeadPartner,
                isSignatory: p.isLeadPartner, // Lead partner is the signatory
                kycCompleted: p.kycCompleted,
                panNumber: p.panNumber,
                aadhaarMasked: p.aadhaarMasked,
                kycData: p.kycData,
            })),
            company: appData.company ? {
                name: appData.company.name,
                cin: appData.company.cin,
                llpin: appData.company.llpin,
                registeredAddress: appData.company.registeredAddress,
                pan: appData.company.pan,
                directors: appData.company.directors?.map((d: any) => ({
                    din: d.din,
                    dpin: d.dpin,
                    name: d.name,
                    email: d.email,
                    phone: d.phone,
                    isSignatory: d.isSignatory,
                    kycCompleted: d.kycCompleted,
                    kycData: d.kycData,
                })),
            } : undefined,
            businessAddress: appData.businessAddress,
            firmName: appData.firmName,
            firmPan: appData.firmPan,
            livenessImage: appData.kyc?.selfie?.image || appData.kyc?.liveness?.image,
            faceMatchImage: appData.kyc?.selfie?.image || appData.kyc?.faceMatch?.image,
        });

        // Save PDF to file
        const filename = `${application._id}_agreement_${Date.now()}.pdf`;
        const filePath = path.join(agreementsDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);

        const agreementUrl = `/uploads/agreements/${filename}`;

        // Update application
        application.agreement = {
            generatedUrl: agreementUrl,
            generatedAt: new Date(),
        };
        await application.save();

        logger.info(`[Agreement] Generated for: ${application._id}, size: ${pdfBuffer.length} bytes`);

        res.json({
            success: true,
            message: 'Agreement generated successfully',
            agreement: {
                url: agreementUrl,
                size: pdfBuffer.length,
                generatedAt: new Date().toISOString(),
            },
        });
    })
);

/**
 * POST /api/agreement/estamp
 * Initiate E-Stamp process with SignDesk
 */
router.post(
    '/estamp',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Check if agreement was already generated
        if (!application.agreement?.generatedUrl) {
            throw BadRequestError('Agreement must be generated first before E-Stamp');
        }

        // Read the existing agreement file (which already has the photo embedded)
        const agreementPath = path.join(process.cwd(), application.agreement.generatedUrl);

        if (!fs.existsSync(agreementPath)) {
            throw NotFoundError('Generated agreement file not found. Please regenerate.');
        }

        const pdfBuffer = fs.readFileSync(agreementPath);
        const pdfBase64 = pdfBuffer.toString('base64');

        // Get signatory data based on entity type
        const appData = application.toObject();
        const signatoryData = getSignatoryData(appData);

        logger.info('[Agreement] Initiating E-Stamp:', {
            entityType: appData.entityType,
            name: signatoryData.name,
            pan: signatoryData.pan,
            email: signatoryData.email,
        });

        // Call SignDesk E-Stamp API
        const stampResult = await estampService.requestStampPaper({
            content: pdfBase64,
            name: signatoryData.name,
            panNumber: signatoryData.pan,
            address: signatoryData.address,
            phone: signatoryData.phone,
            email: signatoryData.email,
            stampAmount: 100,
        });

        if (stampResult.success) {
            // Update application with E-Stamp result
            application.agreement = {
                ...application.agreement,
                generatedUrl: application.agreement?.generatedUrl,
                generatedAt: application.agreement?.generatedAt || new Date(),
                estampId: stampResult.referenceId,
                estampUrl: stampResult.stampPaperNumber,
                estampCertificateNumber: stampResult.stampPaperNumber,
            };

            // Store stamped content for e-sign (not in DB, just in memory or temp file)
            // For now, we'll re-fetch from application in esign route

            await application.save();

            // Save stamped content to temp file for e-sign
            if (stampResult.stampedContent) {
                const stampedFilename = `${application._id}_stamped_${Date.now()}.pdf`;
                const stampedFilePath = path.join(agreementsDir, stampedFilename);
                fs.writeFileSync(stampedFilePath, Buffer.from(stampResult.stampedContent, 'base64'));

                application.agreement.estampUrl = `/uploads/agreements/${stampedFilename}`;
                await application.save();
            }

            logger.info(`[Agreement] E-stamp completed: ${stampResult.referenceId}`);

            res.json({
                success: true,
                message: 'E-Stamp completed successfully',
                estampRequestId: stampResult.referenceId,
                transactionId: stampResult.transactionId,
                stampPaperNumber: stampResult.stampPaperNumber,
                status: 'completed',
                nextStep: 'Proceed to E-Sign',
            });
        } else {
            logger.error('[Agreement] E-stamp failed:', stampResult.error);
            throw BadRequestError(stampResult.error || 'E-Stamp failed');
        }
    })
);

/**
 * POST /api/agreement/esign
 * Initiate E-Sign process with SignDesk
 */
router.post(
    '/esign',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Check E-Stamp is complete
        if (!application.agreement?.estampUrl && !application.agreement?.generatedUrl) {
            throw BadRequestError('Please generate and e-stamp the agreement first');
        }

        // Get stamped content
        const stampedPdfPath = application.agreement?.estampUrl || application.agreement?.generatedUrl;
        if (!stampedPdfPath) {
            throw BadRequestError('Stamped document not found');
        }

        // Read the stamped PDF
        const fullPath = path.join(process.cwd(), stampedPdfPath);
        if (!fs.existsSync(fullPath)) {
            throw BadRequestError('Stamped PDF file not found');
        }
        const stampedContent = fs.readFileSync(fullPath).toString('base64');

        // Get signatory data based on entity type
        const appData = application.toObject();
        const signatoryData = getSignatoryData(appData);

        // Get auth token for return URL
        const authToken = req.headers.authorization?.replace('Bearer ', '') || '';

        logger.info('[Agreement] Initiating E-Sign:', {
            entityType: appData.entityType,
            name: signatoryData.name,
            email: signatoryData.email,
            aadhaarLast4: signatoryData.aadhaarLast4,
            dob: signatoryData.dob,
        });

        // Call SignDesk E-Sign API
        const signResult = await esignService.initiateSign({
            documentContent: stampedContent,
            secondParty: {
                name: signatoryData.name,
                email: signatoryData.email,
                mobile: signatoryData.phone,
                dob: signatoryData.dob,
                gender: signatoryData.gender as 'M' | 'F',
                aadhaarLast4: signatoryData.aadhaarLast4,
            },
            returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?signed=true&token=${authToken}`,
        });

        if (signResult.success) {
            // Update application with E-Sign result
            application.agreement = {
                ...application.agreement,
                esignId: signResult.referenceId,
            };
            await application.save();

            logger.info(`[Agreement] E-sign initiated: ${signResult.referenceId}`);

            res.json({
                success: true,
                message: 'E-Sign initiated successfully',
                esignRequestId: signResult.referenceId,
                docketId: signResult.docketId,
                signingUrl: signResult.signingUrl,
                status: 'initiated',
                nextStep: 'Complete your Aadhaar signing at the URL. Company will receive signing link after you complete.',
            });
        } else {
            logger.error('[Agreement] E-sign failed:', signResult.error);
            throw BadRequestError(signResult.error || 'E-Sign failed');
        }
    })
);

/**
 * GET /api/agreement/status
 * Get agreement status
 */
router.get(
    '/status',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        const agreement = application.agreement || {};

        res.json({
            success: true,
            status: {
                pdfGenerated: !!agreement.generatedUrl,
                pdfGeneratedAt: agreement.generatedAt,
                estampCompleted: !!agreement.estampId,
                estampId: agreement.estampId,
                esignCompleted: !!agreement.signedUrl,
                esignId: agreement.esignId,
                signingUrl: agreement.signedUrl ? null : undefined, // Hide once signed
                signedAt: agreement.completedAt,
                complete: application.completedSteps?.agreement || false,
            },
        });
    })
);

/**
 * POST /api/agreement/mark-signed
 * Called when user returns from E-Sign after completing their signature
 */
router.post(
    '/mark-signed',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Mark user as signed (waiting for company signature)
        application.completedSteps.agreement = true;
        application.status = 'completed';
        application.completedAt = new Date();
        await application.save();

        logger.info(`[Agreement] User signing completed for: ${application._id}`);

        res.json({
            success: true,
            message: 'Signing completed - agreement is now active',
            status: 'completed',
        });
    })
);

/**
 * GET /api/agreement/download
 * Download the generated agreement PDF
 */
router.get(
    '/download',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        const pdfUrl = application.agreement?.signedUrl ||
            application.agreement?.estampUrl ||
            application.agreement?.generatedUrl;

        if (!pdfUrl) {
            throw BadRequestError('No agreement generated yet');
        }

        // If it's a local file
        if (pdfUrl.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), pdfUrl);
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=DSA-Agreement-${application._id}.pdf`);
                fs.createReadStream(filePath).pipe(res);
                return;
            }
        }

        // External URL
        res.json({
            success: true,
            downloadUrl: pdfUrl,
        });
    })
);

/**
 * Webhooks for SignDesk callbacks
 */
router.post(
    '/webhook/estamp',
    asyncHandler(async (req: Request, res: Response) => {
        logger.info('[Webhook] E-stamp callback received:', req.body);
        // Handle e-stamp completion webhook
        res.json({ success: true });
    })
);

router.post(
    '/webhook/esign',
    asyncHandler(async (req: Request, res: Response) => {
        logger.info('[Webhook] E-sign callback received:', req.body);
        // Handle e-sign completion webhook
        res.json({ success: true });
    })
);

export default router;
