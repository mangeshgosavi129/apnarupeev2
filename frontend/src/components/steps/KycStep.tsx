/**
 * KYC Step Component
 * Handles DigiLocker/Aadhaar verification and PAN
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    ExternalLink,
    Check,
    Loader2,
    CreditCard,
    ArrowRight,
    Camera,
    Upload,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { kycApi } from '@/services/api';
import { useApplicationStore } from '@/stores/applicationStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface KycStepProps {
    onComplete: () => void;
}

type SubStep = 'method' | 'digilocker' | 'aadhaar-input' | 'aadhaar-otp' | 'pan' | 'selfie' | 'complete';

export default function KycStep({ onComplete }: KycStepProps) {
    const { application } = useApplicationStore();

    const [subStep, setSubStep] = useState<SubStep>('method');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingType, setLoadingType] = useState<'aadhaar' | 'aadhaar_verify' | 'pan' | 'generic'>('generic');
    const [loadingTitle, setLoadingTitle] = useState('Processing...');

    // Check existing KYC state on mount and set correct sub-step
    useEffect(() => {
        if (application?.kyc) {
            const { aadhaar, pan, selfie } = application.kyc;

            // Debug logging
            console.log('[KycStep] Checking KYC state:', {
                aadhaar: aadhaar ? { name: aadhaar.name, verifiedAt: aadhaar.verifiedAt } : null,
                pan: pan ? { number: pan.number, verified: pan.verified } : null,
                selfie: selfie ? { capturedAt: selfie.capturedAt } : null,
            });

            // Load KYC data from application store
            setKycData({
                aadhaar: aadhaar,
                pan: pan,
            });

            // If all verified including selfie, go to complete
            if (aadhaar?.verifiedAt && pan?.verified && selfie?.capturedAt) {
                console.log('[KycStep] Going to complete');
                setSubStep('complete');
            }
            // If Aadhaar and PAN verified but no selfie, go to selfie
            else if (aadhaar?.verifiedAt && pan?.verified && !selfie?.capturedAt) {
                console.log('[KycStep] Going to selfie');
                setSubStep('selfie');
            }
            // If only Aadhaar verified, go to PAN
            else if (aadhaar?.verifiedAt && !pan?.verified) {
                console.log('[KycStep] Going to PAN');
                setSubStep('pan');
            }
            // Otherwise start fresh
            else {
                console.log('[KycStep] Staying at method selection');
            }
        }
    }, [application?.kyc]);

    // Load DigiLocker SDK
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://sdk.sandbox.co.in/kyc/digilocker/sdk.js";
        script.async = true;
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    // Helper to fetch documents
    const fetchDocuments = async (sessionId: string) => {
        setIsLoading(true);
        try {
            const docResponse = await kycApi.fetchDigilockerDocuments(sessionId);
            if (docResponse.data.success) {
                setKycData(docResponse.data);
                toast.success('Documents verified successfully!');

                // If PAN was also fetched, go to selfie
                if (docResponse.data.pan) {
                    setSubStep('selfie');
                } else {
                    setSubStep('pan');
                }
            }
        } catch (error: any) {
            // DigiLocker failed - fall back to Aadhaar OTP
            toast.error('DigiLocker verification failed. Please use Aadhaar OTP instead.');
            setSubStep('aadhaar-input');
        } finally {
            setIsLoading(false);
        }
    };

    // DigiLocker state
    const [digilockerSessionId, setDigilockerSessionId] = useState<string | null>(null);

    // Aadhaar state
    const [aadhaar, setAadhaar] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [otp, setOtp] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);

    // PAN state
    const [pan, setPan] = useState('');

    // KYC data received
    const [kycData, setKycData] = useState<any>(null);

    // Selfie state
    const [selfieImage, setSelfieImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Start DigiLocker flow
    const handleDigilocker = async () => {
        setIsLoading(true);
        try {
            const response = await kycApi.createDigilockerSession('signin', ['aadhaar', 'pan']);

            if (response.data.success) {
                const sessionId = response.data.sessionId;
                setDigilockerSessionId(sessionId);

                // Initialize SDK
                const DigilockerSDK = (window as any).DigilockerSDK;
                if (!DigilockerSDK) {
                    toast.error('DigiLocker SDK not loaded. Please refresh the page.');
                    return;
                }

                DigilockerSDK.setAPIKey((import.meta as any).env.VITE_SANDBOX_API_KEY);

                const options = {
                    session_id: sessionId,
                    brand: {
                        name: "Apna Rupee",
                        logo_url: "https://ui-avatars.com/api/?name=Apna+Rupee&background=0D8ABC&color=fff",
                    },
                    theme: {
                        mode: "light",
                        seed: "#3b82f6",
                    },
                };

                // Setup Event Listener
                class EventListener extends DigilockerSDK.EventListener {
                    onEvent(event: any) {
                        console.log("DigiLocker Event:", event);
                        if (event.type === "in.co.sandbox.kyc.digilocker_sdk.session.completed") {
                            // Automatically fetch documents on success
                            fetchDocuments(sessionId);
                        } else if (event.type === "in.co.sandbox.kyc.digilocker_sdk.session.closed") {
                            // User closed the popup without completing
                            toast.error("DigiLocker session was closed. Please try again or use Aadhaar OTP.");
                            setSubStep('method');
                            setIsLoading(false);
                        }
                    }
                }
                DigilockerSDK.setEventListener(new EventListener());

                // Open SDK
                DigilockerSDK.open(options);
                setSubStep('digilocker');
                toast.success('Please complete verification in the DigiLocker popup.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to start DigiLocker');
        } finally {
            setIsLoading(false);
        }
    };

    // Manual check fallback
    const handleCheckDigilocker = () => {
        if (digilockerSessionId) {
            fetchDocuments(digilockerSessionId);
        }
    };

    // Aadhaar OTP flow
    const handleSendAadhaarOtp = async () => {
        if (aadhaar.length !== 12) {
            toast.error('Please enter a valid 12-digit Aadhaar number');
            return;
        }

        setLoadingType('aadhaar');
        setLoadingTitle('Sending OTP');
        setIsLoading(true);
        try {
            const response = await kycApi.sendAadhaarOtp(aadhaar);

            if (response.data.success) {
                setReferenceId(response.data.referenceId);
                setSubStep('aadhaar-otp');
                toast.success('OTP sent to Aadhaar-registered mobile');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyAadhaarOtp = async () => {
        if (otp.length !== 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }

        setLoadingType('aadhaar_verify');
        setLoadingTitle('Verifying Aadhaar');
        setIsLoading(true);
        try {
            const response = await kycApi.verifyAadhaarOtp(referenceId, otp, aadhaar);

            if (response.data.success && response.data.verified) {
                setKycData({ aadhaar: response.data.aadhaarData });
                toast.success('Aadhaar verified successfully!');
                setSubStep('pan');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'OTP verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Resend OTP handler
    const handleResendOtp = async () => {
        setIsLoading(true);
        try {
            const response = await kycApi.sendAadhaarOtp(aadhaar);
            if (response.data.success) {
                setReferenceId(response.data.referenceId);
                setOtp(''); // Clear old OTP
                setResendCountdown(30); // Start 30-second cooldown
                toast.success('OTP resent successfully!');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    // Countdown timer effect
    useEffect(() => {
        if (resendCountdown > 0) {
            const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCountdown]);

    // PAN verification
    const handleVerifyPan = async () => {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
            toast.error('Please enter a valid PAN number');
            return;
        }

        setLoadingType('pan');
        setLoadingTitle('Verifying PAN');
        setIsLoading(true);
        try {
            const response = await kycApi.verifyPan(pan);

            if (response.data.success && response.data.verified) {
                setKycData((prev: any) => ({ ...prev, pan: response.data.pan }));
                toast.success('PAN verified successfully!');
                setSubStep('selfie');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'PAN verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Complete KYC step
    const handleCompleteKyc = async () => {
        setIsLoading(true);
        try {
            const response = await kycApi.completeKyc();

            if (response.data.success) {
                toast.success('KYC completed!');
                onComplete();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to complete KYC');
        } finally {
            setIsLoading(false);
        }
    };

    // Selfie handlers
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            setStream(mediaStream);
            setIsCameraActive(true);
            if (videoRef) {
                videoRef.srcObject = mediaStream;
            }
        } catch (error) {
            toast.error('Could not access camera. Please allow camera access or upload a photo.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (!videoRef) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.videoWidth;
        canvas.height = videoRef.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setSelfieImage(imageData);
            stopCamera();
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setSelfieImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmitSelfie = async () => {
        if (!selfieImage) {
            toast.error('Please capture or upload a selfie');
            return;
        }

        setIsLoading(true);
        try {
            const response = await kycApi.uploadSelfie(selfieImage);
            if (response.data.success) {
                toast.success('Selfie uploaded successfully!');
                setSubStep('complete');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload selfie');
        } finally {
            setIsLoading(false);
        }
    };

    const retakeSelfie = () => {
        setSelfieImage(null);
    };

    return (
        <>
            {/* Loading Overlay for API calls */}
            <LoadingOverlay
                isVisible={isLoading}
                title={loadingTitle}
                type={loadingType}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                                KYC Verification
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Verify your identity using Aadhaar & PAN
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {/* Method Selection */}
                    {subStep === 'method' && (
                        <motion.div
                            key="method"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid md:grid-cols-2 gap-4"
                        >
                            {/* DigiLocker Option */}
                            <button
                                onClick={() => { handleDigilocker(); }}
                                disabled={isLoading}
                                className="glass-card p-6 text-left hover:ring-2 hover:ring-primary-500 transition-all"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <ExternalLink className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white">DigiLocker</h3>
                                        <span className="text-xs text-green-600 font-medium">Recommended</span>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Fastest method. Auto-fetch Aadhaar & PAN from DigiLocker.
                                </p>
                            </button>

                            {/* Aadhaar OTP Option */}
                            <button
                                onClick={() => { setSubStep('aadhaar-input'); }}
                                disabled={isLoading}
                                className="glass-card p-6 text-left hover:ring-2 hover:ring-primary-500 transition-all"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Aadhaar OTP</h3>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Enter Aadhaar number and verify with OTP.
                                </p>
                            </button>
                        </motion.div>
                    )}

                    {/* DigiLocker Waiting */}
                    {subStep === 'digilocker' && (
                        <motion.div
                            key="digilocker"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-8 text-center"
                        >
                            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Complete DigiLocker Verification
                            </h3>
                            <p className="text-slate-600 mb-6">
                                A new window has opened. Please login to DigiLocker and grant access.
                            </p>
                            <button
                                onClick={handleCheckDigilocker}
                                disabled={isLoading}
                                className="btn-primary"
                            >
                                {isLoading ? 'Checking...' : 'I\'ve Completed Verification'}
                            </button>
                        </motion.div>
                    )}

                    {/* Aadhaar Input */}
                    {subStep === 'aadhaar-input' && (
                        <motion.div
                            key="aadhaar-input"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-6"
                        >
                            <h3 className="text-lg font-semibold mb-4">Enter Aadhaar Number</h3>
                            <input
                                type="text"
                                value={aadhaar}
                                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                placeholder="12-digit Aadhaar number"
                                className="input-primary mb-4 text-center text-lg tracking-widest"
                            />
                            <button
                                onClick={handleSendAadhaarOtp}
                                disabled={aadhaar.length !== 12 || isLoading}
                                className="btn-primary w-full"
                            >
                                {isLoading ? 'Sending OTP...' : 'Get OTP'}
                            </button>
                        </motion.div>
                    )}

                    {/* Aadhaar OTP */}
                    {subStep === 'aadhaar-otp' && (
                        <motion.div
                            key="aadhaar-otp"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-6"
                        >
                            <h3 className="text-lg font-semibold mb-4">Enter Aadhaar OTP</h3>
                            <p className="text-sm text-slate-600 mb-4">OTP sent to Aadhaar-registered mobile</p>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="6-digit OTP"
                                className="input-primary mb-4 text-center text-2xl tracking-[0.5em]"
                            />
                            <button
                                onClick={handleVerifyAadhaarOtp}
                                disabled={otp.length !== 6 || isLoading}
                                className="btn-primary w-full mb-3"
                            >
                                {isLoading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <button
                                onClick={handleResendOtp}
                                disabled={resendCountdown > 0 || isLoading}
                                className="btn-secondary w-full text-sm"
                            >
                                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
                            </button>
                        </motion.div>
                    )}

                    {/* PAN Verification */}
                    {subStep === 'pan' && (
                        <motion.div
                            key="pan"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-6"
                        >
                            <div className="flex items-center gap-2 mb-4 text-success-500">
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Aadhaar Verified: {kycData?.aadhaar?.name}</span>
                            </div>

                            <h3 className="text-lg font-semibold mb-4">Verify PAN</h3>
                            <input
                                type="text"
                                value={pan}
                                onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
                                placeholder="Enter PAN (e.g., ABCDE1234F)"
                                className="input-primary mb-4 text-center text-lg tracking-widest uppercase"
                            />
                            <button
                                onClick={handleVerifyPan}
                                disabled={pan.length !== 10 || isLoading}
                                className="btn-primary w-full"
                            >
                                {isLoading ? 'Verifying...' : 'Verify PAN'}
                            </button>
                        </motion.div>
                    )}

                    {/* Selfie Capture */}
                    {subStep === 'selfie' && (
                        <motion.div
                            key="selfie"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-6"
                        >
                            <div className="flex items-center gap-2 mb-4 text-success-500">
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Aadhaar & PAN Verified</span>
                            </div>

                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Camera className="w-5 h-5" />
                                Take a Selfie
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Please capture a clear photo of your face or upload an existing photo.
                            </p>

                            {/* Camera/Preview Area */}
                            <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden mb-4">
                                {!selfieImage && !isCameraActive && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                        <Camera className="w-16 h-16 mb-2" />
                                        <span>No image captured</span>
                                    </div>
                                )}

                                {isCameraActive && (
                                    <video
                                        ref={(el) => {
                                            setVideoRef(el);
                                            if (el && stream) {
                                                el.srcObject = stream;
                                                el.play();
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                )}

                                {selfieImage && (
                                    <img
                                        src={selfieImage}
                                        alt="Selfie preview"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {!selfieImage && !isCameraActive && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={startCamera}
                                            className="btn-secondary flex items-center justify-center gap-2"
                                        >
                                            <Camera className="w-5 h-5" />
                                            Open Camera
                                        </button>
                                        <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer">
                                            <Upload className="w-5 h-5" />
                                            Upload Photo
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                )}

                                {isCameraActive && (
                                    <button
                                        onClick={capturePhoto}
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        <Camera className="w-5 h-5" />
                                        Capture Photo
                                    </button>
                                )}

                                {selfieImage && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={retakeSelfie}
                                            className="btn-secondary flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-5 h-5" />
                                            Retake
                                        </button>
                                        <button
                                            onClick={handleSubmitSelfie}
                                            disabled={isLoading}
                                            className="btn-primary flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? 'Uploading...' : 'Continue'}
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Complete */}
                    {subStep === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card p-6"
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-success-500" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                                    KYC Verified!
                                </h3>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-3 p-3 bg-success-50 rounded-lg">
                                    <Check className="w-5 h-5 text-success-500" />
                                    <span className="font-medium">Aadhaar: {kycData?.aadhaar?.name}</span>
                                </div>
                                {kycData?.pan && (
                                    <div className="flex items-center gap-3 p-3 bg-success-50 rounded-lg">
                                        <Check className="w-5 h-5 text-success-500" />
                                        <span className="font-medium">PAN: {kycData?.pan?.number}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleCompleteKyc}
                                disabled={isLoading}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {isLoading ? 'Please wait...' : 'Continue to Next Step'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
