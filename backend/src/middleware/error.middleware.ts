/**
 * Error Handler Middleware
 * Global error handling with proper formatting
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

// Custom API Error class
export class ApiError extends Error {
    statusCode: number;
    code?: string;
    isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code?: string,
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Common error factories
export const BadRequestError = (message: string, code?: string) =>
    new ApiError(message, 400, code);

export const UnauthorizedError = (message: string = 'Unauthorized', code?: string) =>
    new ApiError(message, 401, code);

export const ForbiddenError = (message: string = 'Forbidden', code?: string) =>
    new ApiError(message, 403, code);

export const NotFoundError = (message: string = 'Resource not found', code?: string) =>
    new ApiError(message, 404, code);

export const ConflictError = (message: string, code?: string) =>
    new ApiError(message, 409, code);

export const ValidationError = (message: string, code?: string) =>
    new ApiError(message, 422, code);

export const TooManyRequestsError = (message: string = 'Too many requests', code?: string) =>
    new ApiError(message, 429, code);

export const InternalError = (message: string = 'Internal server error', code?: string) =>
    new ApiError(message, 500, code, false);

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Global error handler
 */
export const errorHandler = (
    err: Error | ApiError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Default error values
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code: string | undefined;
    let stack: string | undefined;

    // Handle known ApiError
    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code;
    }
    // Handle Mongoose validation errors
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
        code = 'VALIDATION_ERROR';
    }
    // Handle Mongoose duplicate key error
    else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
        statusCode = 409;
        message = 'Duplicate entry found';
        code = 'DUPLICATE_ERROR';
    }
    // Handle Mongoose cast errors (invalid ObjectId)
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID';
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    }
    // Handle Joi validation errors
    else if (err.name === 'ValidationError' && (err as any).isJoi) {
        statusCode = 400;
        message = (err as any).details?.[0]?.message || err.message;
        code = 'VALIDATION_ERROR';
    }
    // Generic error
    else {
        message = err.message || message;
    }

    // Log error
    if (statusCode >= 500) {
        logger.error(`[${statusCode}] ${req.method} ${req.path} - ${message}`, {
            error: err.message,
            stack: err.stack,
            body: req.body,
            params: req.params,
            query: req.query,
        });
    } else {
        logger.warn(`[${statusCode}] ${req.method} ${req.path} - ${message}`);
    }

    // Include stack trace in development
    if (env.isDev()) {
        stack = err.stack;
    }

    // Send response
    res.status(statusCode).json({
        success: false,
        error: message,
        code,
        ...(stack && { stack }),
    });
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found`,
        code: 'ROUTE_NOT_FOUND',
    });
};

export default errorHandler;
