/**
 * Validation Middleware
 * Generic request validation using Joi
 */
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BadRequestError } from './error.middleware.js';

type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Create validation middleware for request data
 * @param schema Joi schema to validate against
 * @param target Which part of request to validate (body, params, query)
 */
export const validate = (
    schema: Joi.Schema,
    target: ValidationTarget = 'body'
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const dataToValidate = req[target];

        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Get all errors, not just first
            stripUnknown: true, // Remove unknown fields
            convert: true, // Coerce types when possible
        });

        if (error) {
            const errorMessage = error.details
                .map((detail) => detail.message)
                .join(', ');

            res.status(400).json({
                success: false,
                error: errorMessage,
                code: 'VALIDATION_ERROR',
                details: error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                })),
            });
            return;
        }

        // Replace with validated/sanitized values
        req[target] = value;
        next();
    };
};

// Common validation schemas
export const schemas = {
    // Phone number validation
    phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid phone number. Must be a valid 10-digit Indian mobile number.',
            'any.required': 'Phone number is required.',
        }),

    // OTP validation
    otp: Joi.string()
        .length(6)
        .pattern(/^\d+$/)
        .required()
        .messages({
            'string.length': 'OTP must be 6 digits.',
            'string.pattern.base': 'OTP must contain only digits.',
            'any.required': 'OTP is required.',
        }),

    // Aadhaar validation
    aadhaar: Joi.string()
        .length(12)
        .pattern(/^\d+$/)
        .required()
        .messages({
            'string.length': 'Aadhaar number must be 12 digits.',
            'string.pattern.base': 'Aadhaar must contain only digits.',
            'any.required': 'Aadhaar number is required.',
        }),

    // PAN validation
    // 4th character indicates PAN type: P=Person, C=Company, H=HUF, F=Firm, A=AOP, T=Trust, B=BOI, L=Local Authority, J=Artificial Juridical, G=Government
    pan: Joi.string()
        .length(10)
        .pattern(/^[A-Z]{3}[PCFTGHLABJ][A-Z][0-9]{4}[A-Z]$/)
        .uppercase()
        .required()
        .messages({
            'string.length': 'PAN must be 10 characters.',
            'string.pattern.base': 'Invalid PAN format. Expected format: XXXPX1234X',
            'any.required': 'PAN is required.',
        }),

    // IFSC validation
    ifsc: Joi.string()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .uppercase()
        .required()
        .messages({
            'string.pattern.base': 'Invalid IFSC code format.',
            'any.required': 'IFSC code is required.',
        }),

    // Account number validation (API allows up to 40 characters)
    accountNumber: Joi.string()
        .min(8)
        .max(40)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            'string.min': 'Account number must be at least 8 digits.',
            'string.max': 'Account number cannot exceed 40 digits.',
            'string.pattern.base': 'Account number must contain only digits.',
            'any.required': 'Account number is required.',
        }),

    // Email validation
    email: Joi.string()
        .email()
        .messages({
            'string.email': 'Invalid email format.',
        }),

    // Entity type validation
    entityType: Joi.string()
        .valid('individual', 'proprietorship', 'partnership', 'company')
        .required()
        .messages({
            'any.only': 'Invalid entity type.',
            'any.required': 'Entity type is required.',
        }),

    // Company sub-type validation
    companySubType: Joi.string()
        .valid('pvt_ltd', 'llp', 'opc')
        .messages({
            'any.only': 'Invalid company sub-type.',
        }),

    // MongoDB ObjectId validation
    objectId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid ID format.',
        }),

    // CIN validation
    cin: Joi.string()
        .pattern(/^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/)
        .messages({
            'string.pattern.base': 'Invalid CIN format.',
        }),

    // LLPIN validation
    llpin: Joi.string()
        .pattern(/^[A-Z]{3}-[0-9]{4}$/)
        .messages({
            'string.pattern.base': 'Invalid LLPIN format.',
        }),

    // GSTIN validation
    gstin: Joi.string()
        .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
        .messages({
            'string.pattern.base': 'Invalid GSTIN format.',
        }),
};

export default { validate, schemas };
