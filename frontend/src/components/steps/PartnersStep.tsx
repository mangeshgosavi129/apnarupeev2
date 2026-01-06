/**
 * Partners Step Component
 * Manage partnership firm partners with KYC verification (Aadhaar + PAN)
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Plus,
    Trash2,
    Check,
    Loader2,
    ArrowRight,
    Star,
    User,
    Phone,
    Mail,
    Shield,
    X,
    CreditCard,
    Camera,
    Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

interface PartnersStepProps {
    onComplete: () => void;
}

interface Partner {
    name: string;
    phone: string;
    email?: string;
    isLeadPartner: boolean;
    kycCompleted: boolean;
    panNumber?: string;
    hasPhoto?: boolean;
}

// Webcam Capture Modal Component
function WebcamCaptureModal({
    isOpen,
    onClose,
    onCapture
}: {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageData: string) => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
                setIsCameraReady(true);
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError('Unable to access camera. Please allow camera permission.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCameraReady(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Mirror the image for selfie effect
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                onCapture(imageData);
                stopCamera();
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Take Selfie</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-4">
                    {error ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button onClick={startCamera} className="btn-primary">
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="relative rounded-xl overflow-hidden bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-64 object-cover"
                                    style={{ transform: 'scaleX(-1)' }}
                                />
                                {!isCameraReady && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="mt-4 flex gap-3">
                                <button onClick={onClose} className="btn-ghost flex-1">
                                    Cancel
                                </button>
                                <button
                                    onClick={capturePhoto}
                                    disabled={!isCameraReady}
                                    className="btn-primary flex-1"
                                >
                                    <Camera className="w-4 h-4 mr-2" />
                                    Capture Photo
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// Partner KYC Modal Component (Aadhaar + PAN)
function PartnerKycModal({
    isOpen,
    onClose,
    partnerIndex,
    partnerName,
    onSuccess
}: {
    isOpen: boolean;
    onClose: () => void;
    partnerIndex: number;
    partnerName: string;
    onSuccess: () => void;
}) {
    const [step, setStep] = useState<'aadhaar' | 'otp' | 'pan' | 'success'>('aadhaar');
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [referenceId, setReferenceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [verifiedData, setVerifiedData] = useState<any>(null);

    const handleInitiateKyc = async () => {
        if (aadhaarNumber.length !== 12) {
            toast.error('Please enter a valid 12-digit Aadhaar number');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post(`/partners/${partnerIndex}/kyc/initiate`, {
                aadhaarNumber
            });

            if (response.data.success) {
                setReferenceId(response.data.referenceId);
                setStep('otp');
                toast.success('OTP sent to partner\'s registered mobile');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to initiate KYC');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            toast.error('Please enter a valid 6-digit OTP');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post(`/partners/${partnerIndex}/kyc/verify`, {
                referenceId,
                otp,
                aadhaarNumber
            });

            if (response.data.success && response.data.verified) {
                setVerifiedData(response.data.aadhaarData);
                setStep('pan'); // Move to PAN step
                toast.success('Aadhaar verified! Now verify PAN.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'OTP verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyPan = async () => {
        const panRegex = /^[A-Z]{3}[PCFTGHLABJ][A-Z][0-9]{4}[A-Z]$/;
        if (!panRegex.test(panNumber.toUpperCase())) {
            toast.error('Please enter a valid PAN number');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post(`/partners/${partnerIndex}/kyc/verify-pan`, {
                pan: panNumber.toUpperCase()
            });

            if (response.data.success && response.data.verified) {
                setStep('success');
                toast.success('Partner KYC completed successfully!');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'PAN verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setStep('aadhaar');
        setAadhaarNumber('');
        setOtp('');
        setPanNumber('');
        setReferenceId(null);
        setVerifiedData(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Partner KYC</h3>
                            <p className="text-sm text-slate-500">{partnerName}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Progress Indicator */}
                <div className="px-6 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className={`px-2 py-1 rounded ${step === 'aadhaar' || step === 'otp' || step === 'pan' || step === 'success' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100'}`}>
                            1. Aadhaar
                        </div>
                        <span>→</span>
                        <div className={`px-2 py-1 rounded ${step === 'pan' || step === 'success' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100'}`}>
                            2. PAN
                        </div>
                        <span>→</span>
                        <div className={`px-2 py-1 rounded ${step === 'success' ? 'bg-success-100 text-success-700' : 'bg-slate-100'}`}>
                            3. Done
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {step === 'aadhaar' && (
                            <motion.div
                                key="aadhaar"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Partner's Aadhaar Number
                                    </label>
                                    <input
                                        type="text"
                                        value={aadhaarNumber}
                                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        placeholder="Enter 12-digit Aadhaar"
                                        className="input-primary text-center text-lg tracking-widest"
                                        maxLength={12}
                                    />
                                </div>
                                <p className="text-sm text-slate-500">
                                    OTP will be sent to the mobile number registered with this Aadhaar
                                </p>
                                <button
                                    onClick={handleInitiateKyc}
                                    disabled={aadhaarNumber.length !== 12 || isLoading}
                                    className="btn-primary w-full"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Sending OTP...
                                        </>
                                    ) : (
                                        'Send OTP'
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {step === 'otp' && (
                            <motion.div
                                key="otp"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Enter OTP
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="6-digit OTP"
                                        className="input-primary text-center text-2xl tracking-widest"
                                        maxLength={6}
                                    />
                                </div>
                                <p className="text-sm text-slate-500">
                                    Enter the OTP sent to partner's registered mobile
                                </p>
                                <button
                                    onClick={handleVerifyOtp}
                                    disabled={otp.length !== 6 || isLoading}
                                    className="btn-primary w-full"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Verify OTP'
                                    )}
                                </button>
                                <button
                                    onClick={() => setStep('aadhaar')}
                                    className="btn-ghost w-full"
                                >
                                    Back
                                </button>
                            </motion.div>
                        )}

                        {step === 'pan' && (
                            <motion.div
                                key="pan"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                {/* Aadhaar verified badge */}
                                <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
                                    <Check className="w-5 h-5 text-success-500" />
                                    <span className="text-sm text-success-700 dark:text-success-400">
                                        Aadhaar verified: {verifiedData?.name}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <CreditCard className="w-4 h-4 inline mr-1" />
                                        Partner's PAN Number
                                    </label>
                                    <input
                                        type="text"
                                        value={panNumber}
                                        onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                                        placeholder="ABCDE1234F"
                                        className="input-primary text-center text-lg tracking-widest uppercase"
                                        maxLength={10}
                                    />
                                </div>
                                <p className="text-sm text-slate-500">
                                    PAN will be verified against the Aadhaar details
                                </p>
                                <button
                                    onClick={handleVerifyPan}
                                    disabled={panNumber.length !== 10 || isLoading}
                                    className="btn-primary w-full"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Verifying PAN...
                                        </>
                                    ) : (
                                        'Verify PAN & Complete KYC'
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {step === 'success' && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-success-500" />
                                </div>
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    KYC Complete!
                                </h4>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Aadhaar + PAN verified
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default function PartnersStep({ onComplete }: PartnersStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);

    // KYC Modal state
    const [kycModalOpen, setKycModalOpen] = useState(false);
    const [kycPartnerIndex, setKycPartnerIndex] = useState<number>(0);
    const [kycPartnerName, setKycPartnerName] = useState<string>('');

    // Webcam Modal state
    const [webcamModalOpen, setWebcamModalOpen] = useState(false);
    const [webcamPartnerIndex, setWebcamPartnerIndex] = useState<number>(0);

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [isLeadPartner, setIsLeadPartner] = useState(false);

    const MIN_PARTNERS = 2;

    useEffect(() => {
        loadPartners();
    }, []);

    const loadPartners = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/partners');
            if (response.data.success) {
                setPartners(response.data.partners);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to load partners');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setPhone('');
        setEmail('');
        setIsLeadPartner(false);
        setShowForm(false);
        setEditIndex(null);
    };

    const handleSubmit = async () => {
        if (!name || !phone) {
            toast.error('Please fill all required fields');
            return;
        }

        if (phone.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        setIsLoading(true);
        try {
            if (editIndex !== null) {
                await api.put(`/partners/${editIndex}`, { name, phone, email, isLeadPartner });
                toast.success('Partner updated');
            } else {
                await api.post('/partners', { name, phone, email, isLeadPartner });
                toast.success('Partner added');
            }

            resetForm();
            await loadPartners();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save partner');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (index: number) => {
        const partner = partners[index];
        setName(partner.name);
        setPhone(partner.phone);
        setEmail(partner.email || '');
        setIsLeadPartner(partner.isLeadPartner);
        setEditIndex(index);
        setShowForm(true);
    };

    const handleDelete = async (index: number) => {
        if (!confirm('Remove this partner?')) return;

        setIsLoading(true);
        try {
            await api.delete(`/partners/${index}`);
            toast.success('Partner removed');
            await loadPartners();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenKycModal = (index: number, name: string) => {
        setKycPartnerIndex(index);
        setKycPartnerName(name);
        setKycModalOpen(true);
    };

    // Open webcam modal for selfie capture
    const handleOpenWebcam = (index: number) => {
        setWebcamPartnerIndex(index);
        setWebcamModalOpen(true);
    };

    // Handle webcam captured photo
    const handleWebcamPhoto = async (imageData: string) => {
        setIsLoading(true);
        try {
            const response = await api.post(`/partners/${webcamPartnerIndex}/photo`, {
                photo: imageData
            });
            if (response.data.success) {
                toast.success('Photo captured successfully!');
                await loadPartners();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload photo');
        } finally {
            setIsLoading(false);
        }
    };

    // Photo upload handler for lead partner
    const handlePhotoUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            toast.error('Please upload a JPEG or PNG image');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB');
            return;
        }

        setIsLoading(true);
        try {
            // Convert to base64 using Promise
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });

            const response = await api.post(`/partners/${index}/photo`, {
                photo: base64
            });

            if (response.data.success) {
                toast.success('Photo uploaded successfully!');
                await loadPartners();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to upload photo');
        } finally {
            setIsLoading(false);
            // Reset file input
            event.target.value = '';
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            const response = await api.post('/partners/complete');
            if (response.data.success) {
                toast.success('Partners step completed!');
                onComplete();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to complete step');
        } finally {
            setIsLoading(false);
        }
    };

    const kycPendingCount = partners.filter(p => !p.kycCompleted).length;
    const canComplete = partners.length >= MIN_PARTNERS && kycPendingCount === 0;

    return (
        <div className="space-y-6">
            {/* KYC Modal */}
            <PartnerKycModal
                isOpen={kycModalOpen}
                onClose={() => setKycModalOpen(false)}
                partnerIndex={kycPartnerIndex}
                partnerName={kycPartnerName}
                onSuccess={loadPartners}
            />

            {/* Webcam Capture Modal */}
            <WebcamCaptureModal
                isOpen={webcamModalOpen}
                onClose={() => setWebcamModalOpen(false)}
                onCapture={handleWebcamPhoto}
            />

            {/* Header */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                            Partnership Details
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Add at least {MIN_PARTNERS} partners for your firm
                        </p>
                    </div>
                </div>
            </div>

            {/* Partners List */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                        Partners ({partners.length}/{MIN_PARTNERS} required)
                    </h3>
                    {!showForm && partners.length < 10 && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-secondary flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Partner
                        </button>
                    )}
                </div>

                {/* List */}
                <AnimatePresence>
                    {partners.map((partner, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-4 rounded-xl mb-3 border-2 ${partner.isLeadPartner
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200'
                                : 'bg-slate-50 dark:bg-slate-800 border-transparent'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">{partner.name}</span>
                                        {partner.isLeadPartner && (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                                                <Star className="w-3 h-3" />
                                                Lead Partner
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            +91 {partner.phone}
                                        </div>
                                        {partner.email && (
                                            <div className="flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {partner.email}
                                            </div>
                                        )}
                                    </div>
                                    {/* KYC Status */}
                                    <div className="mt-2">
                                        {partner.kycCompleted ? (
                                            <div className="space-y-2">
                                                <span className="flex items-center gap-1 text-sm text-success-600">
                                                    <Check className="w-4 h-4" />
                                                    KYC Verified
                                                    {partner.panNumber && (
                                                        <span className="text-slate-400 ml-2">
                                                            (PAN: {partner.panNumber.slice(0, 4)}****)
                                                        </span>
                                                    )}
                                                </span>
                                                {/* Photo upload for lead partner */}
                                                {partner.isLeadPartner && (
                                                    <div className="flex items-center gap-3 mt-1">
                                                        {partner.hasPhoto ? (
                                                            // Photo already captured - show status
                                                            <>
                                                                <span className="flex items-center gap-1 text-sm text-success-600 font-medium">
                                                                    <Check className="w-4 h-4" />
                                                                    Photo Captured
                                                                </span>
                                                                <span className="text-slate-300">|</span>
                                                                <button
                                                                    onClick={() => handleOpenWebcam(index)}
                                                                    className="text-sm text-slate-500 hover:text-primary-600"
                                                                >
                                                                    Retake
                                                                </button>
                                                            </>
                                                        ) : (
                                                            // No photo yet - show capture options
                                                            <>
                                                                {/* Camera Capture - Opens Webcam Modal */}
                                                                <button
                                                                    onClick={() => handleOpenWebcam(index)}
                                                                    className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                                                                >
                                                                    <Camera className="w-4 h-4" />
                                                                    Take Selfie
                                                                </button>
                                                                <span className="text-slate-300">|</span>
                                                                {/* File Upload */}
                                                                <label className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-700 cursor-pointer">
                                                                    <Upload className="w-4 h-4" />
                                                                    Upload Photo
                                                                    <input
                                                                        type="file"
                                                                        accept="image/jpeg,image/png,image/jpg"
                                                                        className="hidden"
                                                                        onChange={(e) => handlePhotoUpload(index, e)}
                                                                    />
                                                                </label>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleOpenKycModal(index, partner.name)}
                                                className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                                            >
                                                <Shield className="w-4 h-4" />
                                                Complete KYC (Aadhaar + PAN)
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(index)}
                                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(index)}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Empty state */}
                {partners.length === 0 && !showForm && (
                    <div className="text-center py-8">
                        <p className="text-slate-500 mb-4">No partners added yet</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add First Partner
                        </button>
                    </div>
                )}

                {/* Add/Edit Form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl"
                        >
                            <h4 className="font-medium mb-4">
                                {editIndex !== null ? 'Edit Partner' : 'Add New Partner'}
                            </h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Partner's full name"
                                        className="input-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="10-digit mobile"
                                        className="input-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="input-primary"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isLeadPartner"
                                        checked={isLeadPartner}
                                        onChange={(e) => setIsLeadPartner(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300"
                                    />
                                    <label htmlFor="isLeadPartner" className="text-sm">
                                        Lead Partner (authorized signatory)
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    className="btn-primary"
                                >
                                    {isLoading ? 'Saving...' : editIndex !== null ? 'Update' : 'Add Partner'}
                                </button>
                                <button onClick={resetForm} className="btn-ghost">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Continue Button */}
            {partners.length >= MIN_PARTNERS && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <button
                        onClick={handleComplete}
                        disabled={isLoading || !canComplete}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Please wait...
                            </>
                        ) : (
                            <>
                                Continue to Next Step
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                    {kycPendingCount > 0 && (
                        <p className="text-center text-sm text-warning-600 mt-2">
                            {kycPendingCount} partner(s) need to complete KYC (Aadhaar + PAN)
                        </p>
                    )}
                </motion.div>
            )}
        </div>
    );
}
