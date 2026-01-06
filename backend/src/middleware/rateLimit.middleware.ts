/**
 * Rate Limiting Middleware
 * Protect against brute force and DoS attacks
 */
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RATE_LIMITS } from '../config/constants.js';
import logger from '../utils/logger.js';

// Custom key generator (use user ID if authenticated, else IP)
const keyGenerator = (req: Request): string => {
    if (req.user?.userId) {
        return `user:${req.user.userId}`;
    }
    return `ip:${req.ip}`;
};

// Standard handler for rate limit exceeded
const rateLimitHandler = (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded: ${keyGenerator(req)} - ${req.method} ${req.path}`);
    res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
    });
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
    windowMs: RATE_LIMITS.GENERAL.windowMs,
    max: RATE_LIMITS.GENERAL.max,
    keyGenerator,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Auth endpoints rate limiter (stricter)
 * 10 requests per 15 minutes
 */
export const authLimiter = rateLimit({
    windowMs: RATE_LIMITS.AUTH.windowMs,
    max: RATE_LIMITS.AUTH.max,
    keyGenerator,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

/**
 * OTP rate limiter (very strict)
 * 3 requests per minute per phone number
 */
export const otpLimiter = rateLimit({
    windowMs: RATE_LIMITS.OTP.windowMs,
    max: RATE_LIMITS.OTP.max,
    keyGenerator: (req: Request) => {
        // Use phone number as key for OTP limiting
        const phone = req.body?.phone || req.params?.phone;
        if (phone) {
            return `otp:${phone}`;
        }
        return keyGenerator(req);
    },
    handler: (req: Request, res: Response) => {
        logger.warn(`OTP rate limit exceeded: ${req.body?.phone || req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many OTP requests. Please wait before trying again.',
            code: 'OTP_RATE_LIMIT',
            retryAfter: 60, // seconds
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * KYC verification rate limiter
 * Prevent abuse of external API calls
 */
export const kycLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 requests per 5 minutes
    keyGenerator,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
});

export default {
    generalLimiter,
    authLimiter,
    otpLimiter,
    kycLimiter,
};
