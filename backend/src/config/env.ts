/**
 * Environment Configuration
 * Validates and exports environment variables with type safety
 */
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Environment {
    // Server
    nodeEnv: 'development' | 'staging' | 'production';
    port: number;

    // Database
    mongodbUri: string;
    redisUrl: string | null;

    // JWT
    jwtSecret: string;
    jwtRefreshSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;

    // Sandbox API
    sandbox: {
        baseUrl: string;
        apiKey: string;
        apiSecret: string;
    };

    // SignDesk API (separate E-Stamp and E-Sign configs)
    signdesk: {
        estamp: {
            baseUrl: string;
            apiKey: string;
            apiId: string;
        };
        esign: {
            baseUrl: string;
            apiKey: string;
            apiId: string;
        };
    };

    // First Party Details (Corporate Signer)
    firstParty: {
        name: string;
        pan: string;
        addressStreet: string;
        addressCity: string;
        addressState: string;
        addressPincode: string;
        email: string;
        mobile: string;
    };

    // IDFY API
    idfy: {
        baseUrl: string;
        accountId: string;
        apiKey: string;
    };

    // AWS S3
    aws: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        s3BucketName: string;
    };

    // Feature Flags
    simulateOtp: boolean;

    // Helpers
    isDev: () => boolean;
    isProd: () => boolean;
    isStaging: () => boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

const getOptionalEnvVar = (key: string): string | null => {
    return process.env[key] || null;
};

export const env: Environment = {
    // Server
    nodeEnv: (getEnvVar('NODE_ENV', 'development') as Environment['nodeEnv']),
    port: parseInt(getEnvVar('PORT', '3001'), 10),

    // Database
    mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/dsa-onboarding-v10'),
    redisUrl: getOptionalEnvVar('REDIS_URL'),

    // JWT
    jwtSecret: getEnvVar('JWT_SECRET', 'dev-jwt-secret-change-in-production-32chars'),
    jwtRefreshSecret: getEnvVar('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-prod-32'),
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '1h'),
    jwtRefreshExpiresIn: getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),

    // Sandbox API
    sandbox: {
        baseUrl: getEnvVar('SANDBOX_BASE_URL', 'https://api.sandbox.co.in'),
        apiKey: getEnvVar('SANDBOX_API_KEY', ''),
        apiSecret: getEnvVar('SANDBOX_API_SECRET', ''),
    },

    // SignDesk E-Stamp API
    signdesk: {
        estamp: {
            baseUrl: getEnvVar('SIGNDESK_ESTAMP_BASE_URL', 'https://in-stamp.staging-signdesk.com/api/v2/estamp'),
            apiKey: getEnvVar('SIGNDESK_ESTAMP_API_KEY', ''),
            apiId: getEnvVar('SIGNDESK_ESTAMP_API_ID', ''),
        },
        esign: {
            baseUrl: getEnvVar('SIGNDESK_ESIGN_BASE_URL', 'https://uat.signdesk.in/api/sandbox'),
            apiKey: getEnvVar('SIGNDESK_ESIGN_API_KEY', ''),
            apiId: getEnvVar('SIGNDESK_ESIGN_API_ID', ''),
        },
    },

    // First Party Details (Corporate Signer)
    firstParty: {
        name: getEnvVar('FIRST_PARTY_NAME', 'Graphsense Solutions'),
        pan: getEnvVar('FIRST_PARTY_PAN', ''),
        addressStreet: getEnvVar('FIRST_PARTY_ADDRESS_STREET', ''),
        addressCity: getEnvVar('FIRST_PARTY_ADDRESS_CITY', ''),
        addressState: getEnvVar('FIRST_PARTY_ADDRESS_STATE', ''),
        addressPincode: getEnvVar('FIRST_PARTY_ADDRESS_PINCODE', ''),
        email: getEnvVar('FIRST_PARTY_EMAIL', 'info@graphsensesolutions.com'),
        mobile: getEnvVar('FIRST_PARTY_MOBILE', '9860023457'),
    },

    // IDFY API
    idfy: {
        baseUrl: getEnvVar('IDFY_BASE_URL', 'https://eve.idfy.com'),
        accountId: getEnvVar('IDFY_ACCOUNT_ID', ''),
        apiKey: getEnvVar('IDFY_API_KEY', ''),
    },

    // AWS S3
    aws: {
        region: getEnvVar('AWS_REGION', 'ap-south-1'),
        accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', ''),
        s3BucketName: getEnvVar('S3_BUCKET_NAME', 'dsa-onboarding-documents'),
    },

    // Feature Flags
    simulateOtp: getEnvVar('SIMULATE_OTP', 'false') === 'true',

    // Helpers
    isDev: () => env.nodeEnv === 'development',
    isProd: () => env.nodeEnv === 'production',
    isStaging: () => env.nodeEnv === 'staging',
};

export default env;
