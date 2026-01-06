/**
 * Login Page
 * Phone OTP authentication with premium UI
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Lock, Sparkles, Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApplicationStore } from '@/stores/applicationStore';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api';
import { ENTITY_CONFIG } from '@/types';

type Step = 'phone' | 'otp';

export default function Login() {
    const navigate = useNavigate();
    const { entityType, companySubType, setApplication } = useApplicationStore();
    const { login } = useAuthStore();

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [devOtp, setDevOtp] = useState<string | null>(null);

    const entityConfig = ENTITY_CONFIG[entityType];

    const handleSendOtp = async () => {
        if (phone.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authApi.sendOtp(phone, entityType, companySubType || undefined, email);

            if (response.data.success) {
                toast.success('OTP sent to your mobile number');
                setStep('otp');

                // Store dev OTP for testing
                if (response.data.otp) {
                    setDevOtp(response.data.otp);
                }
            } else {
                toast.error(response.data.error || 'Failed to send OTP');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authApi.verifyOtp(phone, otp, entityType, companySubType || undefined);

            if (response.data.success) {
                toast.success('Login successful!');

                // Update auth store
                login(
                    response.data.user,
                    response.data.accessToken,
                    response.data.refreshToken
                );

                // Update application store
                if (response.data.application) {
                    setApplication(response.data.application);
                }

                navigate('/onboarding');
            } else {
                toast.error(response.data.error || 'Invalid OTP');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setOtp('');
        await handleSendOtp();
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="py-6 px-4">
                <div className="max-w-7xl mx-auto">
                    <button
                        onClick={() => step === 'phone' ? navigate('/') : setStep('phone')}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    {/* Card */}
                    <div className="glass-card p-8">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div
                                className={`inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br ${entityConfig.gradient} items-center justify-center mb-4`}
                            >
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">
                                {step === 'phone' ? 'Enter Your Details' : 'Verify OTP'}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                {step === 'phone'
                                    ? `Registering as ${entityConfig.label}`
                                    : `OTP sent to +91 ${phone}`}
                            </p>
                        </div>

                        {/* Forms */}
                        <AnimatePresence mode="wait">
                            {step === 'phone' ? (
                                <motion.div
                                    key="phone"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    {/* Phone Input */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Mobile Number
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-500">
                                                <Phone className="w-5 h-5" />
                                                <span className="font-medium">+91</span>
                                            </div>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                placeholder="Enter 10-digit number"
                                                className="input-primary pl-24"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Email Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Enter your email"
                                                className="input-primary pl-12"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSendOtp}
                                        disabled={phone.length !== 10 || !email || isLoading}
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Sending OTP...
                                            </>
                                        ) : (
                                            'Get OTP'
                                        )}
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="otp"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    {/* OTP Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Enter OTP
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Lock className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="Enter 6-digit OTP"
                                                className="input-primary pl-12 text-center text-2xl tracking-[0.5em] font-mono"
                                                autoFocus
                                                maxLength={6}
                                            />
                                        </div>

                                        {/* Dev OTP display */}
                                        {devOtp && (
                                            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                                                <span className="text-xs text-yellow-700 dark:text-yellow-400">
                                                    Dev OTP: <span className="font-mono font-bold">{devOtp}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={otp.length !== 6 || isLoading}
                                        className="btn-primary w-full flex items-center justify-center gap-2 mb-4"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Verifying...
                                            </>
                                        ) : (
                                            'Verify & Continue'
                                        )}
                                    </button>

                                    <button
                                        onClick={handleResendOtp}
                                        disabled={isLoading}
                                        className="btn-ghost w-full text-sm"
                                    >
                                        Didn't receive OTP? Resend
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Trust indicators */}
                    <div className="mt-8 text-center text-sm text-slate-500">
                        <p>Your data is encrypted and secure</p>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
