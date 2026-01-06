/**
 * Documents Routes
 * Handles: Document upload, verification status, listing
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Application } from '../models/Application.js';
import logger from '../utils/logger.js';
import {
    auth,
    asyncHandler,
    BadRequestError,
    NotFoundError,
    validate,
} from '../middleware/index.js';
import { DOCUMENT_TYPES } from '../config/constants.js';

const router = Router();

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
        }
    },
});

/**
 * GET /api/documents
 * Get all uploaded documents for current application
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
            documents: application.documents.map(doc => ({
                type: doc.type,
                filename: doc.filename,
                url: doc.url,
                verified: doc.verified,
                uploadedAt: doc.uploadedAt,
            })),
            count: application.documents.length,
        });
    })
);

/**
 * POST /api/documents/upload
 * Upload a document
 */
router.post(
    '/upload',
    auth,
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
        if (!req.file) {
            throw BadRequestError('No file uploaded');
        }

        const { documentType } = req.body;

        if (!documentType || !Object.values(DOCUMENT_TYPES).includes(documentType)) {
            throw BadRequestError('Invalid document type');
        }

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Check if document of this type already exists
        const existingIndex = application.documents.findIndex(d => d.type === documentType);

        const documentData = {
            type: documentType,
            url: `/uploads/${req.file.filename}`,
            filename: req.file.originalname,
            verified: false,
            uploadedAt: new Date(),
        };

        if (existingIndex >= 0) {
            // Replace existing document
            application.documents[existingIndex] = documentData as any;
        } else {
            // Add new document
            application.documents.push(documentData as any);
        }

        await application.save();

        logger.info(`[Documents] Uploaded: ${documentType} for ${application._id}`);

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                type: documentType,
                filename: req.file.originalname,
                url: `/uploads/${req.file.filename}`,
            },
        });
    })
);

/**
 * DELETE /api/documents/:type
 * Delete a document by type
 */
router.delete(
    '/:type',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const { type } = req.params;

        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        const docIndex = application.documents.findIndex(d => d.type === type);
        if (docIndex === -1) {
            throw NotFoundError('Document not found');
        }

        // Remove file from disk
        const doc = application.documents[docIndex];
        const filePath = path.join(process.cwd(), doc.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from array
        application.documents.splice(docIndex, 1);
        await application.save();

        logger.info(`[Documents] Deleted: ${type} for ${application._id}`);

        res.json({
            success: true,
            message: 'Document deleted',
        });
    })
);

/**
 * GET /api/documents/required
 * Get list of required documents based on entity type
 */
router.get(
    '/required',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        let requiredDocs: { type: string; label: string; description: string; required: boolean }[] = [];

        switch (application.entityType) {
            case 'individual':
                requiredDocs = [
                    { type: DOCUMENT_TYPES.PHOTO, label: 'Passport Photo', description: 'Recent passport size photo', required: true },
                    { type: DOCUMENT_TYPES.CANCELLED_CHEQUE, label: 'Cancelled Cheque', description: 'For bank verification', required: true },
                ];
                break;

            case 'proprietorship':
                requiredDocs = [
                    { type: DOCUMENT_TYPES.GST_CERTIFICATE, label: 'GST Certificate', description: 'If registered for GST', required: false },
                    { type: DOCUMENT_TYPES.UDYAM_REGISTRATION, label: 'Udyam Registration', description: 'MSME registration certificate', required: false },
                    { type: DOCUMENT_TYPES.SHOP_ACT_LICENSE, label: 'Shop Act License', description: 'Shop establishment license', required: true },
                ];
                break;

            case 'partnership':
                requiredDocs = [
                    { type: DOCUMENT_TYPES.PARTNERSHIP_DEED, label: 'Partnership Deed', description: 'Registered partnership deed', required: true },
                    { type: DOCUMENT_TYPES.GST_CERTIFICATE, label: 'GST Certificate', description: 'Firm GST certificate', required: true },
                    { type: DOCUMENT_TYPES.ADDRESS_PROOF, label: 'Address Proof', description: 'Office address proof (Utility bill, Rent agreement, etc.)', required: true },
                    { type: DOCUMENT_TYPES.UDYAM_REGISTRATION, label: 'Udyog Aadhar', description: 'MSME registration certificate', required: false },
                ];
                break;

            case 'company':
                requiredDocs = [
                    { type: DOCUMENT_TYPES.COI, label: 'Certificate of Incorporation', description: 'Company registration certificate', required: true },
                    { type: DOCUMENT_TYPES.MOA, label: 'MOA', description: 'Memorandum of Association', required: true },
                    { type: DOCUMENT_TYPES.AOA, label: 'AOA', description: 'Articles of Association', required: true },
                    { type: DOCUMENT_TYPES.BOARD_RESOLUTION, label: 'Board Resolution', description: 'Authorization for DSA registration', required: true },
                    { type: DOCUMENT_TYPES.GST_CERTIFICATE, label: 'GST Certificate', description: 'Company GST certificate', required: false },
                    { type: DOCUMENT_TYPES.CANCELLED_CHEQUE, label: 'Cancelled Cheque', description: 'Company bank account cheque', required: true },
                ];
                break;
        }

        // Mark which documents are already uploaded
        const uploadedTypes = application.documents.map(d => d.type);
        const documentsWithStatus = requiredDocs.map(doc => ({
            ...doc,
            uploaded: (uploadedTypes as string[]).includes(doc.type),
        }));

        res.json({
            success: true,
            entityType: application.entityType,
            documents: documentsWithStatus,
            uploadedCount: documentsWithStatus.filter(d => d.uploaded).length,
            requiredCount: requiredDocs.filter(d => d.required).length,
        });
    })
);

/**
 * POST /api/documents/complete
 * Mark documents step as complete
 */
router.post(
    '/complete',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const application = await Application.findById(req.user?.applicationId);
        if (!application) {
            throw NotFoundError('Application not found');
        }

        // Check if minimum required documents are uploaded
        // For now, just mark as complete - can add stricter validation later
        application.completedSteps.documents = true;
        await application.save();

        res.json({
            success: true,
            message: 'Documents step completed',
            nextStep: application.getNextStep(),
        });
    })
);

export default router;
