/**
 * References Routes
 * Handles: Personal/Professional references collection
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
import { VALIDATION } from '../config/constants.js';

const router = Router();

// Reference validation schema
const referenceSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    mobile: schemas.phone,
    email: schemas.email.optional(),
    address: Joi.string().min(10).max(500).required(),
});

/**
 * GET /api/references
 * Get all references for current application
 */
router.get(
    '/',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        res.json({
            success: true,
            references: application.references,
            count: application.references.length,
            required: VALIDATION.MIN_REFERENCES,
            isComplete: application.references.length >= VALIDATION.MIN_REFERENCES,
        });
    })
);

/**
 * POST /api/references
 * Add a reference
 */
router.post(
    '/',
    auth,
    validate(referenceSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, mobile, email, address } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Check if max references reached (allow up to 5)
        if (application.references.length >= 5) {
            throw BadRequestError('Maximum 5 references allowed');
        }

        // Check for duplicate mobile
        const duplicate = application.references.find(r => r.mobile === mobile);
        if (duplicate) {
            throw BadRequestError('Reference with this mobile number already exists');
        }

        // Check that reference is not self
        if (mobile === application.phone) {
            throw BadRequestError('Cannot add yourself as a reference');
        }

        application.references.push({
            name,
            mobile,
            email,
            address,
            verified: false,
        });

        await application.save();

        logger.info(`[References] Added: ${name} for ${application._id}`);

        res.json({
            success: true,
            message: 'Reference added successfully',
            reference: { name, mobile, email, address },
            count: application.references.length,
            required: VALIDATION.MIN_REFERENCES,
        });
    })
);

/**
 * PUT /api/references/:index
 * Update a reference
 */
router.put(
    '/:index',
    auth,
    validate(referenceSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const index = parseInt(req.params.index, 10);
        const { name, mobile, email, address } = req.body;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (index < 0 || index >= application.references.length) {
            throw NotFoundError('Reference not found');
        }

        // Check for duplicate mobile (excluding current)
        const duplicate = application.references.find(
            (r, i) => i !== index && r.mobile === mobile
        );
        if (duplicate) {
            throw BadRequestError('Reference with this mobile number already exists');
        }

        application.references[index] = {
            name,
            mobile,
            email,
            address,
            verified: false,
        };

        await application.save();

        res.json({
            success: true,
            message: 'Reference updated',
            reference: application.references[index],
        });
    })
);

/**
 * DELETE /api/references/:index
 * Delete a reference
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

        if (index < 0 || index >= application.references.length) {
            throw NotFoundError('Reference not found');
        }

        const removed = application.references.splice(index, 1);
        await application.save();

        logger.info(`[References] Removed: ${removed[0].name} from ${application._id}`);

        res.json({
            success: true,
            message: 'Reference removed',
            count: application.references.length,
        });
    })
);

/**
 * POST /api/references/complete
 * Mark references step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        if (application.references.length < VALIDATION.MIN_REFERENCES) {
            throw BadRequestError(
                `Please add at least ${VALIDATION.MIN_REFERENCES} references to continue`
            );
        }

        application.completedSteps.references = true;
        await application.save();

        res.json({
            success: true,
            message: 'References step completed',
            nextStep: application.getNextStep(),
        });
    })
);

export default router;
