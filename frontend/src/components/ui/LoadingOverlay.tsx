/**
 * LoadingOverlay Component
 * Shows animated loading state with descriptive messages for Sandbox API calls
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
    isVisible: boolean;
    title?: string;
    messages?: string[];
    type?: 'aadhaar' | 'aadhaar_verify' | 'pan' | 'bank' | 'document' | 'estamp' | 'esign' | 'generic';
}

// Predefined messages for different operations
const loadingMessages: Record<string, string[]> = {
    aadhaar: [
        'Connecting to UIDAI servers...',
        'Generating secure OTP...',
        'Verifying your Aadhaar details...',
        'Fetching your information...',
        'Almost done...',
    ],
    aadhaar_verify: [
        'Verifying OTP with UIDAI...',
        'Fetching your Aadhaar details...',
        'Validating your identity...',
        'Processing your information...',
        'Almost done...',
    ],
    pan: [
        'Connecting to Income Tax servers...',
        'Verifying your PAN details...',
        'Matching with your records...',
        'Validating information...',
        'Almost done...',
    ],
    bank: [
        'Connecting to banking network...',
        'Verifying account details...',
        'Checking account holder name...',
        'Validating IFSC code...',
        'Almost done...',
    ],
    document: [
        'Uploading your document...',
        'Processing document...',
        'Validating format...',
        'Almost done...',
    ],
    estamp: [
        'Preparing agreement for stamping...',
        'Connecting to stamp paper authority...',
        'Procuring digital stamp paper...',
        'Applying e-stamp to your document...',
        'Generating stamp certificate...',
        'This may take up to a minute...',
        'Almost done...',
    ],
    esign: [
        'Preparing document for signing...',
        'Connecting to e-sign service...',
        'Setting up secure signing session...',
        'Generating signature fields...',
        'Almost ready for your signature...',
    ],
    generic: [
        'Processing your request...',
        'Please wait...',
        'Almost there...',
    ],
};

export function LoadingOverlay({
    isVisible,
    title = 'Processing...',
    messages,
    type = 'generic',
}: LoadingOverlayProps) {
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const displayMessages = messages || loadingMessages[type] || loadingMessages.generic;

    // Cycle through messages every 2 seconds
    useEffect(() => {
        if (!isVisible) {
            setCurrentMessageIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentMessageIndex((prev) =>
                prev < displayMessages.length - 1 ? prev + 1 : prev
            );
        }, 2000);

        return () => clearInterval(interval);
    }, [isVisible, displayMessages.length]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center"
                    >
                        {/* Animated Icon */}
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-16 h-16 mx-auto"
                            >
                                <div className="w-full h-full rounded-full border-4 border-primary-100 border-t-primary-600" />
                            </motion.div>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <Shield className="w-6 h-6 text-primary-600" />
                            </motion.div>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            {title}
                        </h3>

                        {/* Animated Message */}
                        <div className="h-6 overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={currentMessageIndex}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-sm text-slate-500"
                                >
                                    {displayMessages[currentMessageIndex]}
                                </motion.p>
                            </AnimatePresence>
                        </div>

                        {/* Progress Dots */}
                        <div className="flex justify-center gap-1.5 mt-6">
                            {displayMessages.map((_, index) => (
                                <motion.div
                                    key={index}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${index <= currentMessageIndex
                                        ? 'bg-primary-600 w-4'
                                        : 'bg-slate-200 w-1.5'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Security Note */}
                        <p className="text-xs text-slate-400 mt-6 flex items-center justify-center gap-1">
                            <Shield className="w-3 h-3" />
                            Secure connection to government servers
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Inline Loading Spinner with message
 * Use this for button states
 */
export function InlineLoader({
    message = 'Processing...',
    className = '',
}: {
    message?: string;
    className?: string;
}) {
    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {message}
        </span>
    );
}

/**
 * Processing Card
 * Shows a compact loading state within a card
 */
export function ProcessingCard({
    title,
    message,
    icon: Icon = Shield,
}: {
    title: string;
    message: string;
    icon?: React.ComponentType<{ className?: string }>;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary-50 border border-primary-100 rounded-xl p-4 flex items-center gap-4"
        >
            <div className="flex-shrink-0">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-600 flex items-center justify-center"
                >
                    <Icon className="w-4 h-4 text-primary-600" />
                </motion.div>
            </div>
            <div>
                <h4 className="font-medium text-primary-900">{title}</h4>
                <p className="text-sm text-primary-600">{message}</p>
            </div>
        </motion.div>
    );
}

export default LoadingOverlay;
