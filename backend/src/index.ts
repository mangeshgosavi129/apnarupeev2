/**
 * DSA Onboarding Platform v10 - Express Server
 * Industry-best onboarding with TypeScript
 */
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

// Config
import { env } from './config/env.js';
import connectDB from './config/database.js';
import logger from './utils/logger.js';

// Middleware
import {
    errorHandler,
    notFoundHandler,
    generalLimiter,
    auditMiddleware,
} from './middleware/index.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import kycRoutes from './routes/kyc.routes.js';
import bankRoutes from './routes/bank.routes.js';
import applicationRoutes from './routes/application.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import referencesRoutes from './routes/references.routes.js';
import partnersRoutes from './routes/partners.routes.js';
import companyRoutes from './routes/company.routes.js';
import agreementRoutes from './routes/agreement.routes.js';

// Initialize Express
const app: Application = express();

// ======================
// Security Middleware
// ======================
app.use(helmet({
    contentSecurityPolicy: env.isDev() ? false : undefined,
    crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
    origin: env.isDev() ? '*' : process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ======================
// Body Parsing
// ======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ======================
// Rate Limiting
// ======================
app.use('/api/', generalLimiter);

// ======================
// Audit Logging
// ======================
if (!env.isDev()) {
    app.use(auditMiddleware);
}

// ======================
// Request Logging (dev)
// ======================
if (env.isDev()) {
    app.use((req, res, next) => {
        logger.debug(`${req.method} ${req.path}`);
        next();
    });
}

// ======================
// Static Files
// ======================
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ======================
// Health & Info
// ======================
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.nodeEnv,
        version: '10.0.0',
    });
});

app.get('/api', (req, res) => {
    res.json({
        success: true,
        name: 'DSA Onboarding API',
        version: '10.0.0',
        description: 'DSA Onboarding Platform v10 - Industry-best UI, frictionless onboarding',
        documentation: '/api/docs',
    });
});

// ======================
// API Routes
// ======================

// Auth routes (login, OTP, token refresh)
app.use('/api/auth', authRoutes);

// Application routes (create, get, update)
app.use('/api/application', applicationRoutes);

// KYC routes (DigiLocker, Aadhaar, PAN, Liveness, Face Match)
app.use('/api/kyc', kycRoutes);

// Bank routes (verification)
app.use('/api/bank', bankRoutes);

// Documents routes (upload, listing)
app.use('/api/documents', documentsRoutes);

// References routes (CRUD)
app.use('/api/references', referencesRoutes);

// Partners routes (for Partnership entity)
app.use('/api/partners', partnersRoutes);

// Company routes (MCA verification, directors)
app.use('/api/company', companyRoutes);

// Agreement routes (PDF, E-Stamp, E-Sign)
app.use('/api/agreement', agreementRoutes);

// ======================
// Error Handling
// ======================
app.use(notFoundHandler);
app.use(errorHandler);

// ======================
// Server Startup
// ======================
const startServer = async (): Promise<void> => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start Express server
        app.listen(env.port, () => {
            logger.info(`🚀 DSA Onboarding v10 running on port ${env.port}`);
            logger.info(`📍 API: http://localhost:${env.port}/api`);
            logger.info(`🏥 Health: http://localhost:${env.port}/health`);
            logger.info(`🌍 Environment: ${env.nodeEnv}`);

            if (env.simulateOtp) {
                logger.warn('⚠️  OTP simulation is ENABLED (dev mode)');
            }
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
