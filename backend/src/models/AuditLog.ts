/**
 * Audit Log Model
 * Tracks all significant actions for compliance
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
    // User context
    userId?: mongoose.Types.ObjectId;
    applicationId?: mongoose.Types.ObjectId;
    phone?: string;

    // Action details
    action: string;
    category: 'auth' | 'kyc' | 'bank' | 'document' | 'agreement' | 'admin' | 'system';
    status: 'success' | 'failure' | 'pending';

    // Request context
    method: string;
    path: string;
    ip: string;
    userAgent?: string;

    // Data (sanitized - no PII in plain text)
    requestData?: Record<string, any>;
    responseData?: Record<string, any>;
    errorMessage?: string;

    // Timing
    duration?: number; // milliseconds
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', index: true },
    phone: { type: String },

    action: { type: String, required: true, index: true },
    category: {
        type: String,
        enum: ['auth', 'kyc', 'bank', 'document', 'agreement', 'admin', 'system'],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'pending'],
        required: true,
    },

    method: { type: String },
    path: { type: String },
    ip: { type: String },
    userAgent: { type: String },

    requestData: { type: Schema.Types.Mixed },
    responseData: { type: Schema.Types.Mixed },
    errorMessage: { type: String },

    duration: { type: Number },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});

// Indexes for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, status: 1 });

// TTL index - auto-delete logs after 1 year (adjust as per compliance requirements)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to create sanitized log
AuditLogSchema.statics.log = async function (data: Partial<IAuditLog>) {
    // Sanitize sensitive data from request/response
    const sanitize = (obj: Record<string, any> | undefined): Record<string, any> | undefined => {
        if (!obj) return undefined;

        const sensitiveFields = ['password', 'otp', 'aadhaar', 'pan', 'accountNumber', 'photo'];
        const sanitized = { ...obj };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    };

    return this.create({
        ...data,
        requestData: sanitize(data.requestData),
        responseData: sanitize(data.responseData),
    });
};

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
