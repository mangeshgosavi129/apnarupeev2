/**
 * Authentication Middleware
 * JWT token verification and user context injection
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';
import logger from '../utils/logger.js';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                phone: string;
                applicationId?: string;
            };
        }
    }
}

interface JwtPayload {
    userId: string;
    phone: string;
    applicationId?: string;
    iat: number;
    exp: number;
}

/**
 * Authenticate JWT token from Authorization header
 */
export const auth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
            return;
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

        // Attach user to request
        req.user = {
            userId: decoded.userId,
            phone: decoded.phone,
            applicationId: decoded.applicationId,
        };

        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({
                success: false,
                error: 'Token expired. Please refresh your token.',
                code: 'TOKEN_EXPIRED',
            });
            return;
        }

        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({
                success: false,
                error: 'Invalid token.',
            });
            return;
        }

        logger.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed.',
        });
    }
};

/**
 * Optional auth - doesn't fail if no token, just doesn't set user
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

        req.user = {
            userId: decoded.userId,
            phone: decoded.phone,
            applicationId: decoded.applicationId,
        };

        next();
    } catch {
        // Silently continue without user context
        next();
    }
};

/**
 * Generate JWT tokens (access + refresh)
 */
export const generateTokens = (user: IUser): { accessToken: string; refreshToken: string } => {
    const payload = {
        userId: user._id.toString(),
        phone: user.phone,
        applicationId: user.applicationId?.toString(),
    };

    const accessToken = jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as string,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
        { userId: user._id.toString() },
        env.jwtRefreshSecret,
        { expiresIn: env.jwtRefreshExpiresIn as string } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
};

/**
 * Verify refresh token and generate new access token
 */
export const verifyRefreshToken = (token: string): { userId: string } | null => {
    try {
        const decoded = jwt.verify(token, env.jwtRefreshSecret) as { userId: string };
        return decoded;
    } catch {
        return null;
    }
};

export default { auth, optionalAuth, generateTokens, verifyRefreshToken };
