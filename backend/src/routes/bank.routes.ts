/**
 * Bank Routes
 * Handles: Bank verification with name matching
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
import { VALIDATION } from '../config/constants.js';

const router = Router();

/**
 * GET /api/bank/verify-ifsc/:ifsc
 * Verify IFSC and get bank details
 * @see https://developer.sandbox.co.in/api-reference/kyc/bank/ifsc
 */
router.get(
    '/verify-ifsc/:ifsc',
    auth,
    validate(Joi.object({
        ifsc: schemas.ifsc,
    }), 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const { ifsc } = req.params;

        const response: any = await sandboxClient.verifyIfsc(ifsc);

        // IFSC returns flat response (no data wrapper)
        if (response.IFSC) {
            res.json({
                success: true,
                ifsc: response.IFSC,
                bank: response.BANK,
                branch: response.BRANCH,
                address: response.ADDRESS,
                city: response.CITY,
                state: response.STATE,
                district: response.DISTRICT,
                micr: response.MICR,
                // Payment mode support
                impsEnabled: response.IMPS || false,
                neftEnabled: response.NEFT || false,
                rtgsEnabled: response.RTGS || false,
                upiEnabled: response.UPI || false,
            });
        } else {
            throw BadRequestError('Invalid IFSC code');
        }
    })
);

/**
 * POST /api/bank/verify
 * Verify bank account with name matching
 */
router.post(
    '/verify',
    auth,
    kycLimiter,
    validate(Joi.object({
        accountNumber: schemas.accountNumber,
        confirmAccountNumber: schemas.accountNumber,
        ifsc: schemas.ifsc,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { accountNumber, confirmAccountNumber, ifsc } = req.body;

        // Validate account numbers match
        if (accountNumber !== confirmAccountNumber) {
            throw BadRequestError('Account numbers do not match');
        }

        // Get application
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Ensure KYC is completed first - handle different entity types
        let kycName: string | undefined;

        if (application.entityType === 'partnership') {
            // For partnership - check partner KYC (lead partner for name)
            const partners = application.partners || [];
            const leadPartner = partners.find(p => p.isLeadPartner) || partners[0];

            if (!leadPartner || !leadPartner.kycCompleted) {
                throw BadRequestError('Please complete KYC verification for the lead partner first');
            }

            // Get name from lead partner's Aadhaar KYC
            kycName = leadPartner.kycData?.aadhaar?.name || leadPartner.name;
        } else if (application.entityType === 'company' || application.entityType === 'llp') {
            // For company/LLP - check director KYC (signatory for name)
            const directors = application.company?.directors || [];
            const signatoryDirector = directors.find(d => d.isSignatory) || directors[0];

            if (!signatoryDirector || !signatoryDirector.kycCompleted) {
                throw BadRequestError('Please complete KYC verification for the signatory director first');
            }

            // Get name from signatory director's Aadhaar KYC
            kycName = signatoryDirector.kycData?.aadhaar?.name || signatoryDirector.name;
        } else {
            // For individual/proprietorship - check application-level KYC
            if (!application.kyc.aadhaar?.verifiedAt) {
                throw BadRequestError('Please complete KYC verification first');
            }
            kycName = application.kyc.aadhaar.name;
        }

        if (!kycName) {
            throw BadRequestError('KYC name not found');
        }

        // Verify IFSC first
        const ifscResponse: any = await sandboxClient.verifyIfsc(ifsc);
        if (!ifscResponse.IFSC) {
            throw BadRequestError('Invalid IFSC code');
        }

        // Check if IMPS is supported for penniless verification
        if (!ifscResponse.IMPS) {
            logger.warn(`[Bank] IMPS not supported for IFSC: ${ifsc}`);
            throw BadRequestError(
                `Bank branch ${ifscResponse.BRANCH || ifsc} does not support IMPS. ` +
                `Please use an account from an IMPS-enabled branch.`
            );
        }

        // Verify bank account (penniless/IMPS method)
        const bankResponse: any = await sandboxClient.verifyBankAccountPenniless(
            ifsc,
            accountNumber,
            kycName
        );

        // Response structure: { code, timestamp, transaction_id, data: { account_exists, name_at_bank } }
        const bankData = bankResponse.data || bankResponse;

        // Handle various error messages from API
        if (bankData.message) {
            const msg = bankData.message.toLowerCase();
            if (msg.includes('invalid account') || msg.includes('invalid ifsc')) {
                throw BadRequestError('Invalid account number or IFSC code');
            }
            if (msg.includes('offline')) {
                throw BadRequestError('Bank is currently offline. Please try again later.');
            }
            if (msg.includes('blocked')) {
                throw BadRequestError('This bank account is blocked. Please use a different account.');
            }
            if (msg.includes('nre')) {
                throw BadRequestError('NRE accounts are not supported. Please use a regular savings account.');
            }
        }

        if (!bankData.account_exists) {
            throw BadRequestError(bankData.message || 'Bank account not found or invalid');
        }

        const nameAtBank = bankData.name_at_bank || '';

        // Calculate name match score
        const nameMatchScore = calculateNameMatchScore(kycName, nameAtBank);

        // Thresholds: <70% Block, 70-79% Flag, ≥80% Auto-approve
        const isAutoApproved = nameMatchScore >= VALIDATION.NAME_MATCH_FLAG_THRESHOLD; // ≥80%
        const shouldFlag = nameMatchScore >= VALIDATION.NAME_MATCH_BLOCK_THRESHOLD && nameMatchScore < VALIDATION.NAME_MATCH_FLAG_THRESHOLD; // 70-79%
        const shouldBlock = nameMatchScore < VALIDATION.NAME_MATCH_BLOCK_THRESHOLD; // <70%

        logger.info(`[Bank] Name match: KYC="${kycName}" Bank="${nameAtBank}" Score=${nameMatchScore}% (Block:<70%, Flag:70-79%, Approve:≥80%)`);

        // RULE: Below 70% = BLOCK
        if (shouldBlock) {
            throw BadRequestError(
                `Bank account holder name "${nameAtBank}" does not match your KYC verified name "${kycName}" (Match: ${nameMatchScore}%). ` +
                `Please use a bank account registered in your own name.`
            );
        }

        // Update application
        application.bank = {
            accountNumber,
            ifsc,
            bankName: ifscResponse.BANK,
            branchName: ifscResponse.BRANCH,
            accountHolderName: nameAtBank,
            verified: isAutoApproved || shouldFlag, // Allow flagged accounts to proceed
            verificationMethod: 'penniless',
            nameMatchScore,
            flaggedForReview: shouldFlag,
            verifiedAt: new Date(),
        };

        // Store cross-validation results
        if (!application.kyc.crossValidation) {
            application.kyc.crossValidation = {};
        }
        application.kyc.crossValidation.bankKyc = {
            nameMatch: isAutoApproved,
            nameMatchScore,
            flaggedForReview: shouldFlag,
            checkedAt: new Date(),
        };

        if (isAutoApproved || shouldFlag) {
            application.completedSteps.bank = true;
        }

        await application.save();

        // Build response message based on outcome
        let message: string;
        if (isAutoApproved) {
            message = 'Bank account verified successfully';
        } else if (shouldFlag) {
            message = `Bank verified but flagged for manual review. Name match: ${nameMatchScore}% (requires ≥80% for auto-approval)`;
        } else {
            message = 'Bank verification failed';
        }

        res.json({
            success: true,
            verified: isAutoApproved || shouldFlag, // Allow flagged accounts to proceed
            flaggedForReview: shouldFlag,
            bank: {
                accountNumber: accountNumber.replace(/.(?=.{4})/g, '*'),
                ifsc,
                bankName: ifscResponse.BANK,
                branchName: ifscResponse.BRANCH,
                accountHolderName: nameAtBank,
            },
            nameMatch: {
                kycName,
                bankName: nameAtBank,
                score: nameMatchScore,
                blockThreshold: VALIDATION.NAME_MATCH_BLOCK_THRESHOLD,
                flagThreshold: VALIDATION.NAME_MATCH_FLAG_THRESHOLD,
            },
            message,
        });
    })
);

/**
 * POST /api/bank/complete
 * Mark bank step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (!application.bank?.verified) {
            throw BadRequestError('Bank verification is required');
        }

        application.completedSteps.bank = true;
        await application.save();

        res.json({
            success: true,
            message: 'Bank step completed',
            nextStep: application.getNextStep(),
        });
    })
);

// ======================
// Helper Functions
// ======================

/**
 * Calculate name match score between two names
 * Uses multiple matching strategies
 */
function calculateNameMatchScore(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    // Normalize names
    const normalize = (name: string) =>
        name
            .toUpperCase()
            .replace(/[^A-Z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Exact match
    if (n1 === n2) return 100;

    // Token-based matching
    const tokens1 = n1.split(' ').filter(Boolean);
    const tokens2 = n2.split(' ').filter(Boolean);

    // Count matching tokens
    let matchedTokens = 0;
    for (const token1 of tokens1) {
        if (tokens2.some(token2 =>
            token1 === token2 ||
            token1.includes(token2) ||
            token2.includes(token1) ||
            levenshteinDistance(token1, token2) <= 2
        )) {
            matchedTokens++;
        }
    }

    const tokenScore = (matchedTokens / Math.max(tokens1.length, tokens2.length)) * 100;

    // Levenshtein similarity
    const maxLen = Math.max(n1.length, n2.length);
    const distance = levenshteinDistance(n1, n2);
    const levenshteinScore = ((maxLen - distance) / maxLen) * 100;

    // Use the higher score
    return Math.round(Math.max(tokenScore, levenshteinScore));
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

export default router;
