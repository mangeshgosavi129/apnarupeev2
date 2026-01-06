/**
 * Auth Routes
 * Handles: Phone OTP login, token refresh, logout
 */
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import {
    auth,
    generateTokens,
    verifyRefreshToken,
    asyncHandler,
    BadRequestError,
    UnauthorizedError,
    validate,
    schemas,
    authLimiter,
    otpLimiter,
} from '../middleware/index.js';
import { ENTITY_TYPES } from '../config/constants.js';

const router = Router();

/**
 * POST /api/auth/send-otp
 * Send OTP to phone number
 */
router.post(
    '/send-otp',
    otpLimiter,
    validate(Joi.object({
        phone: schemas.phone,
        email: Joi.string().email().optional(),
        entityType: schemas.entityType.optional(),
        companySubType: schemas.companySubType,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { phone, email, entityType, companySubType } = req.body;

        // Find or create user
        let user = await User.findOne({ phone });
        if (!user) {
            user = new User({ phone, email });
        } else if (email) {
            user.email = email;
        }

        // Generate OTP
        const otp = user.setOtp();
        await user.save();

        // In development, log OTP (in production, send via SMS)
        if (env.simulateOtp || env.isDev()) {
            logger.info(`[DEV] OTP for ${phone}: ${otp}`);
        } else {
            // TODO: Integrate SMS provider (MSG91, Twilio, etc.)
            // await smsService.sendOtp(phone, otp);
            logger.info(`OTP sent to ${phone}`);
        }

        res.json({
            success: true,
            message: 'OTP sent successfully',
            phone,
            // Only include OTP in dev mode for testing
            ...(env.simulateOtp && { otp }),
        });
    })
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return JWT tokens
 */
router.post(
    '/verify-otp',
    authLimiter,
    validate(Joi.object({
        phone: schemas.phone,
        otp: schemas.otp,
        entityType: schemas.entityType,
        companySubType: schemas.companySubType,
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { phone, otp, entityType, companySubType } = req.body;

        // Find user with OTP fields
        const user = await User.findOne({ phone }).select('+otp +otpExpiry +otpAttempts');

        if (!user) {
            throw UnauthorizedError('Invalid phone number or OTP');
        }

        // Verify OTP
        const isValid = user.verifyOtp(otp);
        await user.save();

        if (!isValid) {
            // Check if locked out
            if (user.otpAttempts >= 3) {
                throw UnauthorizedError('Too many failed attempts. Please request a new OTP.');
            }
            throw UnauthorizedError('Invalid OTP. Please try again.');
        }

        // Find or create application
        let application = await Application.findOne({
            phone,
            status: { $nin: ['completed', 'rejected'] },
        });

        if (!application) {
            application = new Application({
                phone,
                email: user.email,
                entityType: entityType || ENTITY_TYPES.INDIVIDUAL,
                ...(companySubType && { companySubType }),
            });
            await application.save();
        } else if (user.email && !application.email) {
            // Sync email to application if missing
            application.email = user.email;
            await application.save();
        }

        // Update user with application reference
        user.applicationId = application._id as any;
        user.lastLoginAt = new Date();
        user.isVerified = true;
        await user.save();

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        // Store hashed refresh token
        user.refreshToken = bcrypt.hashSync(refreshToken, 10);
        user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await user.save();

        logger.info(`User logged in: ${phone}`);

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                phone: user.phone,
                isVerified: user.isVerified,
            },
            application: {
                id: application._id,
                entityType: application.entityType,
                companySubType: application.companySubType,
                status: application.status,
                completedSteps: application.completedSteps,
            },
        });
    })
);

/**
 * POST /api/auth/refresh-token
 * Refresh access token using refresh token
 */
router.post(
    '/refresh-token',
    validate(Joi.object({
        refreshToken: Joi.string().required(),
    })),
    asyncHandler(async (req: Request, res: Response) => {
        const { refreshToken } = req.body;

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            throw UnauthorizedError('Invalid or expired refresh token');
        }

        // Find user
        const user = await User.findById(decoded.userId).select('+refreshToken +refreshTokenExpiry');
        if (!user) {
            throw UnauthorizedError('User not found');
        }

        // Verify stored refresh token
        if (!user.refreshToken || !user.refreshTokenExpiry) {
            throw UnauthorizedError('No refresh token found. Please login again.');
        }

        if (new Date() > user.refreshTokenExpiry) {
            throw UnauthorizedError('Refresh token expired. Please login again.');
        }

        if (!bcrypt.compareSync(refreshToken, user.refreshToken)) {
            throw UnauthorizedError('Invalid refresh token');
        }

        // Generate new tokens
        const tokens = generateTokens(user);

        // Update refresh token
        user.refreshToken = bcrypt.hashSync(tokens.refreshToken, 10);
        user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await user.save();

        res.json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    })
);

/**
 * POST /api/auth/logout
 * Invalidate tokens
 */
router.post(
    '/logout',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await User.findById(req.user?.userId);
        if (user) {
            user.refreshToken = undefined;
            user.refreshTokenExpiry = undefined;
            await user.save();
        }

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    })
);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get(
    '/me',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await User.findById(req.user?.userId);
        if (!user) {
            throw UnauthorizedError('User not found');
        }

        const application = user.applicationId
            ? await Application.findById(user.applicationId)
            : null;

        res.json({
            success: true,
            user: {
                id: user._id,
                phone: user.phone,
                email: user.email,
                name: user.name,
                isVerified: user.isVerified,
            },
            application: application
                ? {
                    id: application._id,
                    entityType: application.entityType,
                    companySubType: application.companySubType,
                    status: application.status,
                    completedSteps: application.completedSteps,
                }
                : null,
        });
    })
);

export default router;
