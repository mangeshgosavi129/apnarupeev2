/**
 * User Model
 * Represents authenticated DSA users/applicants
 */
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    phone: string;
    email?: string;
    name?: string;

    // Current application reference
    applicationId?: mongoose.Types.ObjectId;

    // OTP handling
    otp?: string;
    otpExpiry?: Date;
    otpAttempts: number;

    // Tokens
    refreshToken?: string;
    refreshTokenExpiry?: Date;

    // Status
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt?: Date;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Methods
    verifyOtp(otp: string): boolean;
    setOtp(): string;
    verifyRefreshToken(token: string): boolean;
}

const UserSchema = new Schema<IUser>({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    email: { type: String },
    name: { type: String },

    // Current application
    applicationId: {
        type: Schema.Types.ObjectId,
        ref: 'Application',
    },

    // OTP
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0 },

    // Tokens
    refreshToken: { type: String, select: false },
    refreshTokenExpiry: { type: Date, select: false },

    // Status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
}, {
    timestamps: true,
});

// Methods
UserSchema.methods.setOtp = function (): string {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    this.otp = bcrypt.hashSync(otp, 10);
    this.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    this.otpAttempts = 0;

    return otp; // Return plain OTP to send via SMS
};

UserSchema.methods.verifyOtp = function (otp: string): boolean {
    if (!this.otp || !this.otpExpiry) return false;

    // Check expiry
    if (new Date() > this.otpExpiry) return false;

    // Check attempts
    if (this.otpAttempts >= 3) return false;

    // Verify OTP
    const isValid = bcrypt.compareSync(otp, this.otp);

    if (!isValid) {
        this.otpAttempts += 1;
    } else {
        // Clear OTP after successful verification
        this.otp = undefined;
        this.otpExpiry = undefined;
        this.otpAttempts = 0;
        this.isVerified = true;
    }

    return isValid;
};

UserSchema.methods.verifyRefreshToken = function (token: string): boolean {
    if (!this.refreshToken || !this.refreshTokenExpiry) return false;

    // Check expiry
    if (new Date() > this.refreshTokenExpiry) return false;

    // Verify token
    return bcrypt.compareSync(token, this.refreshToken);
};

// Static method to find or create user
UserSchema.statics.findOrCreate = async function (phone: string) {
    let user = await this.findOne({ phone });
    if (!user) {
        user = await this.create({ phone });
    }
    return user;
};

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;
