/**
 * Audit Logging Middleware
 * Log all API requests for compliance
 */
import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import logger from '../utils/logger.js';

// Paths to exclude from audit logging
const EXCLUDED_PATHS = [
    '/health',
    '/api',
    '/favicon.ico',
];

// Fields to sanitize in request/response
const SENSITIVE_FIELDS = [
    'password',
    'otp',
    'aadhaar',
    'pan',
    'accountNumber',
    'photo',
    'apiKey',
    'secret',
    'token',
];

/**
 * Sanitize object by redacting sensitive fields
 */
const sanitizeData = (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
        // Check if key matches sensitive field
        const isFieldSensitive = SENSITIVE_FIELDS.some(field =>
            key.toLowerCase().includes(field.toLowerCase())
        );

        if (isFieldSensitive) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeData(sanitized[key]);
        }
    }

    return sanitized;
};

/**
 * Determine category from request path
 */
const getCategoryFromPath = (path: string): string => {
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/kyc') || path.includes('/digilocker')) return 'kyc';
    if (path.includes('/bank')) return 'bank';
    if (path.includes('/document') || path.includes('/upload')) return 'document';
    if (path.includes('/agreement') || path.includes('/estamp') || path.includes('/esign')) return 'agreement';
    if (path.includes('/admin')) return 'admin';
    return 'system';
};

/**
 * Audit logging middleware
 * Logs request and response details for compliance
 */
export const auditMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Skip excluded paths
    if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
        return next();
    }

    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    // Override res.json to capture response
    res.json = (body: any): Response => {
        const duration = Date.now() - startTime;
        const status = res.statusCode < 400 ? 'success' : 'failure';

        // Create audit log asynchronously (don't block response)
        setImmediate(async () => {
            try {
                await AuditLog.create({
                    userId: req.user?.userId,
                    applicationId: req.user?.applicationId,
                    phone: req.user?.phone || req.body?.phone,

                    action: `${req.method} ${req.path}`,
                    category: getCategoryFromPath(req.path),
                    status,

                    method: req.method,
                    path: req.path,
                    ip: req.ip || req.socket.remoteAddress || 'unknown',
                    userAgent: req.get('User-Agent'),

                    requestData: sanitizeData({
                        params: req.params,
                        query: req.query,
                        body: req.body,
                    }),
                    responseData: sanitizeData(body),
                    errorMessage: status === 'failure' ? body?.error : undefined,

                    duration,
                });
            } catch (error) {
                logger.error('Failed to create audit log:', error);
            }
        });

        return originalJson(body);
    };

    next();
};

export default auditMiddleware;
